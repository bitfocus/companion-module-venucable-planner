import { test } from 'node:test'
import assert from 'node:assert/strict'
import WebSocket from 'ws'
import { VenuCableLink, REPLACED, fmtClock, fmtLate, liveNow } from '../src/link.js'

// Below Linux's ephemeral range (32768+), so a parallel test's outgoing connection can't hold it.
const PORT = 31850
const open = (origin) =>
	new Promise((resolve) => {
		const ws = new WebSocket(`ws://127.0.0.1:${PORT}`, { origin })
		ws.on('open', () => resolve({ ws, ok: true }))
		ws.on('error', () => resolve({ ws, ok: false }))
	})
const once = (em, ev) => new Promise((r) => em.once(ev, r))

test('only the VenuCable web app can connect', async () => {
	const link = new VenuCableLink({ port: PORT, extraOrigins: ['http://localhost:8765/'] }).start()
	await once(link, 'listening')
	assert.equal((await open('https://evil.example')).ok, false)
	assert.equal((await open('http://localhost:9999')).ok, false)
	const app = await open('https://app.venucable.com')
	assert.equal(app.ok, true)
	app.ws.close()
	const dev = await open('http://localhost:8765')
	assert.equal(dev.ok, true, 'extra origin (trailing slash ignored)')
	dev.ws.close()
	await link.stop()
})

test('hello, state and commands', async () => {
	const link = new VenuCableLink({ port: PORT }).start()
	await once(link, 'listening')
	assert.equal(link.send('undo'), false, 'nothing connected')
	const { ws } = await open('https://app.venucable.com')
	const got = []
	ws.on('message', (d) => got.push(JSON.parse(String(d))))
	const connected = once(link, 'connected')
	ws.send(JSON.stringify({ t: 'hello', app: 'VenuCable', v: 1 }))
	await connected
	const st = once(link, 'state')
	ws.send(JSON.stringify({ t: 'state', plan: 'Gala', kit: [{ name: 'PTZ camera', short: 'PTZ' }] }))
	await st
	assert.equal(link.state.plan, 'Gala')
	ws.send('not json')
	assert.equal(link.send('add', { slot: 2 }), true)
	await new Promise((r) => setTimeout(r, 50))
	assert.deepEqual(got, [{ t: 'do', a: 'add', slot: 2 }])
	const gone = once(link, 'disconnected')
	ws.close()
	await gone
	assert.equal(link.state, null)
	await link.stop()
})

test('a second VenuCable tab takes over and the first is told why', async () => {
	const link = new VenuCableLink({ port: PORT }).start()
	await once(link, 'listening')
	const a = await open('https://app.venucable.com')
	const closed = new Promise((r) => a.ws.on('close', (code) => r(code)))
	const b = await open('https://app.venucable.com')
	assert.equal(await closed, REPLACED)
	assert.equal(link.connected, true)
	b.ws.close()
	await link.stop()
})

test('countdown and lateness on the keys', () => {
	assert.equal(fmtClock(245000), '4:05')
	assert.equal(fmtClock(-80000), '+1:20')
	assert.equal(fmtClock(3750000), '1:02:30')
	assert.equal(fmtLate(10000), 'On time')
	assert.equal(fmtLate(125000), '2m late')
	assert.equal(fmtLate(-60000), '1m early')
	const now = 1_000_000
	assert.deepEqual(liveNow({ state: 'live', endAt: now + 30000, late: 0 }, now), {
		left: 30000,
		over: false,
		soon: true,
		late: 0,
		held: false,
	})
	const over = liveNow({ state: 'live', endAt: now - 90000, late: 60000 }, now)
	assert.equal(over.over, true)
	assert.equal(over.late, 150000, 'overrunning makes the show later')
	assert.equal(liveNow({ state: 'ready' }).left, null)
	// On hold for 2 minutes with 45s left: the countdown stays put, and the show is 2 minutes later.
	const held = liveNow({ state: 'live', held: true, heldAt: now - 120000, left: 45000, endAt: 0, late: 0 }, now)
	assert.equal(held.held, true)
	assert.equal(held.left, 45000)
	assert.equal(held.soon, true)
	assert.equal(held.late, 120000)
})
