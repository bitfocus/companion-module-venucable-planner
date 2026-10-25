// The link to VenuCable through VenuCable's relay (wss://app.venucable.com/link). Companion
// connects OUT to it, so it works on any computer - the one VenuCable is open on, a server or
// a Pi - with nothing listening here. VenuCable shows a pairing key (Projects → Stream Deck)
// that goes in this connection's settings; the relay pairs the two by that key.
//
// Same events and methods as the same-computer link (link.js), so the rest of the module
// doesn't care which is in use: 'connected' (VenuCable said hello), 'state', 'disconnected',
// plus 'relay' (the relay itself connected or not) and 'error'.
import { EventEmitter } from 'node:events'
import { createHash } from 'node:crypto'
import WebSocket from 'ws'

export const RELAY_URL = 'wss://app.venucable.com/link'
// The relay's close code when another Companion connected with the same key.
export const REPLACED = 4000
const KEY_RE = /^[A-Z2-7]{26}$/

// The key as typed: spaces and dashes ignored, any case.
export const normalKey = (k) =>
	String(k || '')
		.toUpperCase()
		.replace(/[\s-]/g, '')
export const validKey = (k) => KEY_RE.test(normalKey(k))

// The show-timer page's room: the key's hash, so the page's address can't press keys.
export const roomOf = (key) =>
	createHash('sha256')
		.update('venucable-link:' + normalKey(key))
		.digest('hex')

// The show-timer page for this key, on the same site as the relay.
export function timerUrl(key, relay = RELAY_URL) {
	const u = new URL(relay)
	u.protocol = u.protocol === 'ws:' ? 'http:' : 'https:'
	u.pathname = '/timer'
	u.search = ''
	u.searchParams.set('room', roomOf(key))
	return u.toString()
}

export class RelayLink extends EventEmitter {
	constructor({ key, url = RELAY_URL, pingEvery = 25000 } = {}) {
		super()
		this.key = normalKey(key)
		this.url = url
		this.pingEvery = pingEvery
		this.ws = null
		this.state = null
		this.app = false // VenuCable is at the other end
		this.open = false // the relay itself is connected
		this.stopped = false
		this.tries = 0
	}

	start() {
		this.stopped = false
		if (!validKey(this.key)) {
			// Reported on the next tick, so listeners attached after start() still hear it.
			setImmediate(() => this.emit('error', Object.assign(new Error('No pairing key yet'), { code: 'NO_KEY' })))
			return this
		}
		this.#connect()
		return this
	}

	#connect() {
		if (this.stopped) return
		const u = new URL(this.url)
		u.searchParams.set('key', this.key)
		u.searchParams.set('role', 'module')
		const ws = new WebSocket(u, { handshakeTimeout: 15000, maxPayload: 512 * 1024 })
		this.ws = ws
		ws.on('open', () => {
			this.open = true
			this.tries = 0
			this.emit('relay', true)
			this.#beat()
		})
		ws.on('message', (data) => {
			const text = String(data)
			if (text === 'pong') {
				this.alive = true
				return
			}
			let m
			try {
				m = JSON.parse(text)
			} catch {
				return
			}
			if (m?.t === 'peer') {
				if (!m.app && this.app) this.#lostApp()
				this.app = !!m.app
			} else if (m?.t === 'hello' && m.app === 'VenuCable') {
				this.app = true
				this.emit('connected')
			} else if (m?.t === 'state') {
				this.app = true
				this.state = m
				this.emit('state', m)
			}
		})
		ws.on('unexpected-response', (_req, res) => {
			// The relay turned the key down (400): retrying won't help until the key changes.
			if (res.statusCode === 400) {
				this.stopped = true
				this.emit('error', Object.assign(new Error('VenuCable did not accept the pairing key'), { code: 'BAD_KEY' }))
			}
			ws.terminate()
		})
		ws.on('close', (code) => {
			clearInterval(this.pinger)
			if (this.ws !== ws) return
			this.ws = null
			const was = this.open
			this.open = false
			if (this.app) this.#lostApp()
			this.app = false
			if (was) this.emit('relay', false)
			if (code === REPLACED) {
				// Another Companion uses this key. Don't fight it: wait for a settings change.
				this.stopped = true
				this.emit(
					'error',
					Object.assign(new Error('Another Companion is using this pairing key'), { code: 'REPLACED' }),
				)
				return
			}
			this.#retry()
		})
		ws.on('error', () => {}) // 'close' follows
	}

	// No internet, or the relay restarted: try again after 2s, doubling to 30s.
	#retry() {
		if (this.stopped) return
		clearTimeout(this.retryTimer)
		this.retryTimer = setTimeout(() => this.#connect(), Math.min(30000, 2000 * 2 ** Math.min(this.tries++, 4)))
	}

	// Keep the connection open through routers that drop quiet ones, and notice a dead one.
	#beat() {
		clearInterval(this.pinger)
		this.alive = true
		this.pinger = setInterval(() => {
			if (!this.alive) return this.ws?.terminate()
			this.alive = false
			try {
				this.ws?.send('ping')
			} catch {
				/* closing */
			}
		}, this.pingEvery)
	}

	#lostApp() {
		this.app = false
		this.state = null
		this.emit('disconnected')
	}

	get connected() {
		return this.open && this.app && !!this.ws && this.ws.readyState === WebSocket.OPEN
	}

	// Ask VenuCable to do something. Returns false if VenuCable isn't connected.
	send(action, extra = {}) {
		if (!this.connected) return false
		this.ws.send(JSON.stringify({ t: 'do', a: action, ...extra }))
		return true
	}

	async stop() {
		this.stopped = true
		clearTimeout(this.retryTimer)
		clearInterval(this.pinger)
		const ws = this.ws
		this.ws = null
		this.open = false
		this.app = false
		this.state = null
		if (!ws) return
		await new Promise((resolve) => {
			if (ws.readyState === WebSocket.CLOSED) return resolve()
			ws.once('close', () => resolve())
			ws.terminate()
		})
	}
}
