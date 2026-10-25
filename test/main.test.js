import { test } from 'node:test'
import assert from 'node:assert/strict'
import WebSocket from 'ws'
import '../src/main.js'

// Below Linux's ephemeral range (32768+), so a parallel test's outgoing connection can't hold it.
const PORT = 31851
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

test('the module starts, waits for VenuCable, and shows what it sends', async () => {
	const m = globalThis.__instance
	await m.init({ mode: 'local', port: PORT, origins: 'http://localhost:8765' })
	await sleep(100)
	assert.deepEqual(m.calls.status.at(-1), ['connecting', 'Waiting for VenuCable'])
	assert.equal(m.getConfigFields().find((f) => f.id === 'port').default, 41799)
	assert.ok(Object.keys(m.presetDefs).length > 20)
	assert.equal(m.calls.vars.connected, 'no')

	const ws = new WebSocket(`ws://127.0.0.1:${PORT}`, { origin: 'http://localhost:8765' })
	await new Promise((r) => ws.on('open', r))
	ws.send(JSON.stringify({ t: 'hello', app: 'VenuCable', v: 1 }))
	const now = Date.now()
	ws.send(
		JSON.stringify({
			t: 'state',
			plan: 'Gala',
			mode: 'cable',
			selected: 'CAM 1',
			kit: [{ name: 'PTZ camera', short: 'PTZ' }],
			checks: { level: 'error', errors: 2, warnings: 1 },
			live: {
				state: 'live',
				title: 'Keynote',
				who: 'Dr Smith',
				i: 3,
				n: 8,
				next: 'Q&A',
				endAt: now + 65000,
				late: 120000,
			},
		}),
	)
	await sleep(150)
	const v = m.calls.vars
	assert.deepEqual(m.calls.status.at(-1), ['ok', null])
	assert.equal(v.connected, 'yes')
	assert.equal(v.kit_1, 'PTZ camera')
	assert.equal(v.kit_2, '')
	assert.equal(v.checks, '2 errors')
	assert.equal(v.live_title, 'Keynote')
	assert.equal(v.live_pos, '3/8')
	assert.equal(v.live_late, '2m late')
	assert.match(v.live_left, /^1:0[45]$/)
	assert.equal(m.feedbackDefs.checks.callback({ options: { level: 'error' } }), true)
	assert.equal(m.feedbackDefs.tool.callback({ options: { tool: 'cable' } }), true)
	assert.equal(m.feedbackDefs.kit_slot.callback({ options: { slot: 2 } }), false)

	// Kit by category: 12 cameras on 10 item keys page as 10 + 2, and a new category starts at page 1.
	const cams = Array.from({ length: 12 }, (_, i) => ({ type: `cam${i + 1}`, name: `Camera ${i + 1}`, short: 'CAM' }))
	ws.send(
		JSON.stringify({
			t: 'state',
			plan: 'Gala',
			browse: { view: 'all', cat: 'Cameras', catId: 'camera', color: '#7dd3fc', i: 1, n: 9, items: cams },
		}),
	)
	await sleep(100)
	assert.equal(v.browse_cat, 'Cameras')
	assert.equal(v.browse_cat_pos, '1/9')
	assert.equal(v.browse_page, '1/2')
	assert.equal(v.browse_1, 'Camera 1')
	assert.equal(v.browse_10, 'Camera 10')
	assert.equal(v.browse_11, '', 'only as many keys as configured')
	m.browseTurn(1)
	assert.equal(v.browse_page, '2/2')
	assert.equal(v.browse_1, 'Camera 11')
	assert.equal(v.browse_3, '')
	assert.equal(m.feedbackDefs.browse_slot.callback({ options: { slot: 3 } }), false)
	assert.equal(m.feedbackDefs.browse_more.callback({ options: {} }), true)
	assert.deepEqual(Object.keys(m.feedbackDefs.browse_colour.callback({ options: {} })).sort(), ['bgcolor', 'color'])
	const pressed = new Promise((r) => ws.once('message', (d) => r(JSON.parse(String(d)))))
	await m.actionDefs.browse_add.callback({ options: { slot: 2 } })
	assert.deepEqual(await pressed, { t: 'do', a: 'add-type', type: 'cam12' })
	m.browseTurn(1)
	assert.equal(v.browse_page, '1/2', 'wraps round')
	ws.send(
		JSON.stringify({
			t: 'state',
			plan: 'Gala',
			browse: { view: 'mine', cat: 'Audio', catId: 'audio', color: '#22d3ee', i: 2, n: 9, items: cams.slice(0, 3) },
		}),
	)
	await sleep(100)
	assert.equal(v.browse_page, '1/1')
	assert.equal(v.browse_view, 'My kit')
	ws.send(
		JSON.stringify({
			t: 'state',
			plan: 'Gala',
			mode: 'cable',
			selected: 'CAM 1',
			kit: [{ name: 'PTZ camera', short: 'PTZ' }],
			checks: { level: 'error', errors: 2, warnings: 1 },
			live: {
				state: 'live',
				title: 'Keynote',
				who: 'Dr Smith',
				i: 3,
				n: 8,
				next: 'Q&A',
				endAt: now + 65000,
				late: 120000,
			},
		}),
	)
	await sleep(100)

	// The countdown ticks in the module between updates.
	await sleep(1100)
	assert.match(v.live_left, /^1:0[34]$/)

	// Every live timer, worked out from one update: 5-minute segment with 65s left, the
	// rest of the show 10 minutes, started 20 minutes ago, running 2 minutes late.
	const t = Date.now()
	ws.send(
		JSON.stringify({
			t: 'state',
			plan: 'Gala',
			live: {
				state: 'live',
				title: 'Keynote',
				i: 3,
				n: 8,
				next: 'Q&A',
				endAt: t + 65000,
				late: 120000,
				dur: 300000,
				rest: 600000,
				showAt: t - 1200000,
			},
		}),
	)
	await sleep(100)
	assert.match(v.live_elapsed, /^3:5[45]$/)
	assert.match(v.live_show_elapsed, /^20:0[01]$/)
	assert.match(v.live_show_left, /^11:0[45]$/)
	assert.match(v.live_ends, /^\d\d:\d\d$/)
	assert.equal(v.live_late_short, '+2m')
	assert.match(v.clock, /^\d\d:\d\d:\d\d$/)
	assert.equal(m.feedbackDefs.live_status.callback({ options: { status: 'late' } }), true)
	assert.equal(m.feedbackDefs.live_status.callback({ options: { status: 'ontime' } }), false)
	// The Next key moves the show on, like GO.
	assert.deepEqual(m.presetDefs.live_next.steps[0].down, [{ actionId: 'live_go', options: {} }])

	// A button press reaches VenuCable.
	const got = new Promise((r) => ws.once('message', (d) => r(JSON.parse(String(d)))))
	await m.actionDefs.add_kit.callback({ options: { slot: 1 } })
	assert.deepEqual(await got, { t: 'do', a: 'add', slot: 1 })

	ws.close()
	await sleep(100)
	assert.equal(v.connected, 'no')
	assert.equal(v.kit_1, '')

	// Changing the port in the config restarts the listener there.
	await m.configUpdated({ mode: 'local', port: PORT + 1 })
	const ws2 = new WebSocket(`ws://127.0.0.1:${PORT + 1}`, { origin: 'https://app.venucable.com' })
	await new Promise((r, j) => {
		ws2.on('open', r)
		ws2.on('error', j)
	})
	ws2.close()
	await m.destroy()
})

test('cable route, Finish, undo / redo and view-only access on the keys', async () => {
	const m = globalThis.__instance
	await m.init({ mode: 'local', port: PORT + 3, origins: 'http://localhost:8765' })
	await sleep(100)
	const ws = new WebSocket(`ws://127.0.0.1:${PORT + 3}`, { origin: 'http://localhost:8765' })
	await new Promise((r) => ws.on('open', r))
	ws.send(JSON.stringify({ t: 'hello', app: 'VenuCable', v: 1 }))
	const state = (x) => ws.send(JSON.stringify({ t: 'state', plan: 'Gala', ...x }))
	state({ mode: 'path:cable_route', drawing: true, undo: true, redo: false, readOnly: false })
	await sleep(100)
	const F = m.feedbackDefs
	assert.equal(m.calls.vars.tool, 'route')
	assert.equal(F.tool.callback({ options: { tool: 'route' } }), true)
	assert.equal(F.tool.callback({ options: { tool: 'select' } }), false)
	assert.equal(F.drawing.callback({ options: {} }), true)
	assert.equal(F.can_undo.callback({ options: { what: 'undo' } }), true)
	assert.equal(F.can_undo.callback({ options: { what: 'redo' } }), false)
	assert.equal(F.read_only.callback({ options: {} }), false)
	state({ mode: 'select', readOnly: true })
	await sleep(100)
	assert.equal(F.drawing.callback({ options: {} }), false)
	assert.equal(F.read_only.callback({ options: {} }), true)
	assert.equal(m.calls.vars.read_only, 'yes')
	// The edit keys go dark with view-only access: the read-only look comes last, so it wins.
	assert.equal(m.presetDefs.delete.feedbacks.at(-1).feedbackId, 'read_only')
	assert.equal(m.presetDefs.undo.feedbacks.at(-1).feedbackId, 'read_only')
	ws.close()
	await m.destroy()
})

test('the Stream Deck asks VenuCable for a message on the show-timer page, or to blank it', async () => {
	const m = globalThis.__instance
	await m.init({ mode: 'local', port: PORT + 4, origins: 'http://localhost:8765' })
	await sleep(100)
	const ws = new WebSocket(`ws://127.0.0.1:${PORT + 4}`, { origin: 'http://localhost:8765' })
	await new Promise((r) => ws.on('open', r))
	const got = []
	ws.on('message', (d) => got.push(JSON.parse(String(d))))
	ws.send(JSON.stringify({ t: 'hello', app: 'VenuCable', v: 1 }))
	const state = (screen) => ws.send(JSON.stringify({ t: 'state', plan: 'Gala', screen }))
	state({ msg: '', blank: false })
	await sleep(100)
	const A = m.actionDefs,
		F = m.feedbackDefs
	A.screen_message.callback({ options: { text: 'WRAP UP', mode: 'toggle' } })
	await sleep(50)
	assert.deepEqual(got.at(-1), { t: 'do', a: 'screen-msg', msg: 'WRAP UP' })
	// VenuCable keeps the message and says so; the keys follow what it says.
	state({ msg: 'WRAP UP', blank: false })
	await sleep(100)
	assert.equal(m.calls.vars.screen_message, 'WRAP UP')
	assert.equal(F.screen_message.callback({ options: { text: 'wrap up' } }), true)
	assert.equal(F.screen_message.callback({ options: { text: 'STRETCH' } }), false)
	assert.equal(F.screen_message.callback({ options: { text: '' } }), true, 'blank = any message')
	A.screen_message.callback({ options: { text: 'STRETCH', mode: 'toggle' } })
	A.screen_message.callback({ options: { text: 'wrap up', mode: 'toggle' } })
	A.screen_message.callback({ options: { text: '  Go to Q&A  ', mode: 'show' } })
	A.screen_message.callback({ options: { text: '', mode: 'clear' } })
	A.screen_blank.callback({ options: { mode: 'toggle' } })
	A.screen_blank.callback({ options: { mode: 'off' } })
	await sleep(50)
	assert.deepEqual(got.slice(-6), [
		{ t: 'do', a: 'screen-msg', msg: 'STRETCH' },
		{ t: 'do', a: 'screen-msg', msg: '' },
		{ t: 'do', a: 'screen-msg', msg: 'Go to Q&A' },
		{ t: 'do', a: 'screen-msg', msg: '' },
		{ t: 'do', a: 'screen-blank', blank: true },
		{ t: 'do', a: 'screen-blank', blank: false },
	])
	state({ msg: '', blank: true })
	await sleep(100)
	assert.equal(F.screen_blank.callback({ options: {} }), true)
	// With the same-computer link the timer's address comes from VenuCable.
	assert.equal(m.calls.vars.screen_url, '')
	ws.send(JSON.stringify({ t: 'state', plan: 'Gala', timer: 'https://app.venucable.com/timer?room=abc' }))
	await sleep(100)
	assert.equal(m.calls.vars.screen_url, 'https://app.venucable.com/timer?room=abc')
	ws.close()
	await m.destroy()
})

test('more time, hold, lock and save on the keys', async () => {
	const m = globalThis.__instance
	await m.init({ mode: 'local', port: PORT + 6, origins: 'http://localhost:8765' })
	await sleep(100)
	const ws = new WebSocket(`ws://127.0.0.1:${PORT + 6}`, { origin: 'http://localhost:8765' })
	await new Promise((r) => ws.on('open', r))
	ws.send(JSON.stringify({ t: 'hello', app: 'VenuCable', v: 1 }))
	const got = []
	ws.on('message', (d) => got.push(JSON.parse(String(d))))
	const A = m.actionDefs,
		F = m.feedbackDefs,
		v = m.calls.vars
	A.live_nudge.callback({ options: { min: -1 } })
	A.live_hold.callback({ options: { mode: 'toggle' } })
	A.lock.callback({ options: {} })
	A.save.callback({ options: {} })
	await sleep(100)
	assert.deepEqual(got, [
		{ t: 'do', a: 'live-nudge', min: -1 },
		{ t: 'do', a: 'live-hold', mode: 'toggle' },
		{ t: 'do', a: 'lock' },
		{ t: 'do', a: 'save' },
	])
	// Held 2 minutes into a 5-minute segment, 3 minutes ago: frozen at 3:00 left, show 3 minutes late.
	const t = Date.now()
	ws.send(
		JSON.stringify({
			t: 'state',
			plan: 'Gala',
			locked: true,
			file: { name: 'gala.venucable', unsaved: true },
			live: {
				state: 'live',
				title: 'Keynote',
				i: 1,
				n: 3,
				endAt: t,
				dur: 300000,
				rest: 600000,
				late: 0,
				held: true,
				heldAt: t - 180000,
				left: 180000,
			},
		}),
	)
	await sleep(1200)
	assert.equal(v.live_left, '3:00', 'the countdown stays put on hold')
	assert.equal(v.live_elapsed, '2:00')
	assert.equal(v.live_late_short, '+3m')
	assert.equal(v.live_held, 'yes')
	assert.equal(v.file, 'gala.venucable')
	assert.equal(F.live_held.callback({ options: {} }), true)
	assert.equal(F.locked.callback({ options: {} }), true)
	assert.equal(F.unsaved.callback({ options: {} }), true)
	// On hold the key swaps to its Resume face (the label is drawn into the picture).
	assert.equal(m.presetDefs.live_hold.feedbacks[0].style.png64, (await import('../src/icons.js')).ICONS.resume)
	ws.close()
	await m.destroy()
})

test('a port already in use is reported, not a crash', async () => {
	const blocker = new (await import('ws')).WebSocketServer({ host: '127.0.0.1', port: PORT + 2 })
	await new Promise((r) => blocker.once('listening', r))
	const m = globalThis.__instance
	await m.init({ mode: 'local', port: PORT + 2 })
	await sleep(100)
	assert.deepEqual(m.calls.status.at(-1), ['connection_failure', `Port ${PORT + 2} is already in use`])
	await m.destroy()
	blocker.close()
})
