// The same-computer link to VenuCable, for venues without internet. VenuCable runs in a web
// browser, which can't accept connections, so this module listens and the VenuCable tab on
// this computer connects to it. Only this computer (127.0.0.1) can connect, and only from the
// VenuCable web app. (With internet, the relay (relay.js) works from any computer instead.)
import { EventEmitter } from 'node:events'
import http from 'node:http'
import { WebSocketServer } from 'ws'

export const DEFAULT_PORT = 41799
export const APP_ORIGINS = ['https://app.venucable.com']

// Close code telling a VenuCable tab another tab took over (it waits until it's used again).
export const REPLACED = 4000

const isLoopback = (addr) => addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'

export class VenuCableLink extends EventEmitter {
	constructor({ port = DEFAULT_PORT, extraOrigins = [] } = {}) {
		super()
		this.port = port
		this.origins = new Set([...APP_ORIGINS, ...extraOrigins.map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean)])
		this.http = null
		this.server = null
		this.client = null
		this.state = null
	}

	start() {
		// Plain HTTP gets nothing: the port is only for VenuCable's WebSocket.
		this.http = http.createServer((req, res) =>
			res.writeHead(426, { 'content-type': 'text/plain' }).end('VenuCable Stream Deck link'),
		)
		this.server = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 })
		this.http.on('upgrade', (req, socket, head) => {
			// VenuCable itself: this computer only, and only the VenuCable web app (not other websites).
			if (!isLoopback(req.socket.remoteAddress) || !this.origins.has(req.headers.origin)) {
				socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
				socket.destroy()
				return
			}
			this.server.handleUpgrade(req, socket, head, (ws) => this.server.emit('connection', ws, req))
		})
		this.http.on('listening', () => this.emit('listening'))
		this.http.on('error', (err) => this.emit('error', err))
		this.server.on('connection', (ws) => {
			// The most recently opened (or used) VenuCable tab is the one the buttons control.
			if (this.client) this.client.close(REPLACED, 'Another VenuCable tab connected')
			this.client = ws
			this.state = null
			ws.on('message', (data) => {
				let msg
				try {
					msg = JSON.parse(String(data))
				} catch {
					return
				}
				if (msg?.t === 'hello' && msg.app === 'VenuCable') this.emit('connected')
				else if (msg?.t === 'state') {
					this.state = msg
					this.emit('state', msg)
				}
			})
			ws.on('close', () => {
				if (this.client !== ws) return
				this.client = null
				this.state = null
				this.emit('disconnected')
			})
			ws.on('error', () => {})
		})
		this.http.listen(this.port, '127.0.0.1')
		return this
	}

	get connected() {
		return !!this.client && this.client.readyState === 1
	}

	// Ask VenuCable to do something. Returns false if no VenuCable tab is connected.
	send(action, extra = {}) {
		if (!this.connected) return false
		this.client.send(JSON.stringify({ t: 'do', a: action, ...extra }))
		return true
	}

	async stop() {
		const srv = this.http
		this.http = null
		this.client = null
		this.state = null
		if (!srv) return
		for (const ws of this.server.clients) ws.terminate()
		this.server.close()
		srv.closeAllConnections?.()
		await new Promise((resolve) => srv.close(() => resolve()))
	}
}

// "4:05", "1:02:30"; overruns as "+1:20" - the same as VenuCable's live screen.
export function fmtClock(ms) {
	const neg = ms < 0
	const s = Math.floor(Math.abs(ms) / 1000)
	const h = Math.floor(s / 3600)
	const m = Math.floor(s / 60) % 60
	const ss = String(s % 60).padStart(2, '0')
	return (neg ? '+' : '') + (h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`)
}

export function fmtLate(ms) {
	if (Math.abs(ms) < 30000) return 'On time'
	const m = Math.max(1, Math.round(Math.abs(ms) / 60000))
	const t = m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}` : `${m}m`
	return `${t} ${ms > 0 ? 'late' : 'early'}`
}

// Time of day for a key: 24-hour, e.g. 21:05 (with seconds: 21:05:09).
export function fmtTime(ms, secs = false) {
	const d = new Date(ms)
	const p = (n) => String(n).padStart(2, '0')
	return `${p(d.getHours())}:${p(d.getMinutes())}${secs ? ':' + p(d.getSeconds()) : ''}`
}

// The live running order as the keys show it, worked out each second from the last update.
// On hold the countdown stays where it stopped, and the show gets later by every second of it.
export function liveNow(live, now = Date.now()) {
	if (!live || live.state !== 'live') return { left: null, over: false, soon: false, late: null, held: false }
	const held = !!live.held
	const left = held ? (live.left ?? 0) : live.endAt - now
	const late = live.late + Math.max(0, -left) + (held && live.heldAt ? Math.max(0, now - live.heldAt) : 0)
	return { left, over: left < 0, soon: left >= 0 && left < 60000, late, held }
}
