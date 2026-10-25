import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { WebSocketServer } from 'ws'
import { RelayLink, roomOf, timerUrl, validKey, normalKey } from '../src/relay.js'

// Below Linux's ephemeral range (32768+), so a parallel test's outgoing connection can't hold it.
const PORT = 31870
const KEY = 'ABCDE-FGHIJ-KLMNO-PQRST-UVWXYZ'
const once = (em, ev) => new Promise((r) => em.once(ev, r))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// A stand-in for VenuCable's relay: records how the module connects, and lets the test speak
// for the relay (and the VenuCable tab behind it).
function fakeRelay({ status } = {}) {
	const srv = http.createServer()
	const wss = new WebSocketServer({ noServer: true })
	const seen = []
	srv.on('upgrade', (req, socket, head) => {
		seen.push(new URL(req.url, 'http://x'))
		if (status) {
			socket.write(`HTTP/1.1 ${status} No\r\n\r\n`)
			return socket.destroy()
		}
		wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws))
	})
	const relay = { seen, wss, srv, got: [] }
	wss.on('connection', (ws) => {
		relay.ws = ws
		ws.on('message', (d) => {
			const t = String(d)
			if (t === 'ping') return ws.send('pong')
			relay.got.push(JSON.parse(t))
		})
	})
	relay.say = (m) => relay.ws.send(JSON.stringify(m))
	relay.close = () =>
		new Promise((r) => {
			for (const c of wss.clients) c.terminate()
			srv.close(() => r())
		})
	return new Promise((r) => srv.listen(PORT, '127.0.0.1', () => r(relay)))
}

test('pairing keys and the show-timer room match the relay', async () => {
	assert.equal(normalKey(KEY), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')
	assert.equal(validKey('abcde fghij klmno pqrst uvwxyz'), true)
	assert.equal(validKey('ABC'), false)
	assert.equal(validKey('ABCDEFGHIJKLMNOPQRSTUVWXY1'), false, '1 is not base32')
	// The module and VenuCable's relay must agree, or the timer link would point nowhere. The
	// relay's own tests (VenuCable repo, tests/relay.test.mjs) check the same value.
	assert.equal(roomOf(KEY), '074f38f11839b4fdc5afb79dbc9d7abcbf66d2cd1a82d0d7f5d0c1f85b93325c')
	assert.match(timerUrl(KEY), /^https:\/\/app\.venucable\.com\/timer\?room=[0-9a-f]{64}$/)
	assert.match(timerUrl(KEY, 'ws://127.0.0.1:8787/link'), /^http:\/\/127\.0\.0\.1:8787\/timer\?room=/)
})

test('no key: says so and connects to nothing', async () => {
	const link = new RelayLink({ key: '' }).start()
	const err = await once(link, 'error')
	assert.equal(err.code, 'NO_KEY')
	assert.equal(link.send('undo'), false)
	await link.stop()
})

test('connects out, waits for VenuCable, then passes state and commands', async () => {
	const relay = await fakeRelay()
	const link = new RelayLink({ key: KEY, url: `ws://127.0.0.1:${PORT}/link` }).start()
	assert.equal(await once(link, 'relay'), true)
	const u = relay.seen[0]
	assert.equal(u.pathname, '/link')
	assert.equal(u.searchParams.get('role'), 'module')
	assert.equal(u.searchParams.get('key'), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'sent without dashes')
	relay.say({ t: 'peer', app: false, module: true })
	await sleep(50)
	assert.equal(link.connected, false, 'relay up, VenuCable not there yet')
	assert.equal(link.send('undo'), false)
	const hello = once(link, 'connected')
	relay.say({ t: 'peer', app: true, module: true })
	relay.say({ t: 'hello', app: 'VenuCable', v: 1 })
	await hello
	relay.say({ t: 'state', plan: 'Gala' })
	await once(link, 'state')
	assert.equal(link.state.plan, 'Gala')
	assert.equal(link.send('live-go'), true)
	await sleep(50)
	assert.deepEqual(relay.got, [{ t: 'do', a: 'live-go' }])
	// VenuCable closes its tab: the keys go back to waiting.
	const gone = once(link, 'disconnected')
	relay.say({ t: 'peer', app: false, module: true })
	await gone
	assert.equal(link.state, null)
	assert.equal(link.connected, false)
	await link.stop()
	await relay.close()
})

test('reconnects when the relay drops, and keeps pinging', async () => {
	let relay = await fakeRelay()
	const link = new RelayLink({ key: KEY, url: `ws://127.0.0.1:${PORT}/link`, pingEvery: 100 }).start()
	await once(link, 'relay')
	await sleep(250)
	assert.ok(link.alive, 'pong received')
	const down = once(link, 'relay')
	await relay.close()
	assert.equal(await down, false)
	relay = await fakeRelay()
	assert.equal(await once(link, 'relay'), true, 'back after the 2s retry')
	await link.stop()
	await relay.close()
})

test('a key the relay turns down, or another Companion taking over, stops retrying', async () => {
	let relay = await fakeRelay({ status: 400 })
	let link = new RelayLink({ key: KEY, url: `ws://127.0.0.1:${PORT}/link` }).start()
	assert.equal((await once(link, 'error')).code, 'BAD_KEY')
	await sleep(2500)
	assert.equal(relay.seen.length, 1, 'no retry')
	await link.stop()
	await relay.close()

	relay = await fakeRelay()
	link = new RelayLink({ key: KEY, url: `ws://127.0.0.1:${PORT}/link` }).start()
	await once(link, 'relay')
	const err = once(link, 'error')
	relay.ws.close(4000, 'Replaced')
	assert.equal((await err).code, 'REPLACED')
	await sleep(2500)
	assert.equal(relay.seen.length, 1, 'no retry')
	await link.stop()
	await relay.close()
})
