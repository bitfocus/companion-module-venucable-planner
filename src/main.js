import { InstanceBase, InstanceStatus, runEntrypoint } from '@companion-module/base'
import { VenuCableLink, DEFAULT_PORT, fmtClock, fmtLate, fmtTime, liveNow } from './link.js'
import { RelayLink, RELAY_URL, validKey, timerUrl } from './relay.js'
import { actions, feedbacks, variables, presets, KIT_SLOTS } from './definitions.js'

class VenuCableInstance extends InstanceBase {
	async init(config) {
		this.config = config
		this.setActionDefinitions(actions(this))
		this.setFeedbackDefinitions(feedbacks(this))
		this.setVariableDefinitions(variables())
		this.setPresetDefinitions(presets(this))
		await this.startLink()
		// The running-order countdown ticks here, so VenuCable only sends changes.
		this.timer = setInterval(() => this.tick(), 1000)
	}

	async destroy() {
		clearInterval(this.timer)
		await this.link?.stop()
	}

	async configUpdated(config) {
		this.config = config
		await this.startLink()
	}

	getConfigFields() {
		const local = (o) => o.mode === 'local'
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'How it connects',
				value:
					'In VenuCable, open Projects, tick "Connect to Bitfocus Companion" under Stream Deck and copy the pairing key into the box below. ' +
					'Companion can then be on any computer - this one, a server or a Pi - as long as it has internet. ' +
					'With no internet at the venue, choose "Same computer" instead and run Companion on the computer VenuCable is open on.',
			},
			{
				type: 'dropdown',
				id: 'mode',
				label: 'Connect',
				width: 6,
				default: 'relay',
				choices: [
					{ id: 'relay', label: 'Through VenuCable (any computer, needs internet)' },
					{ id: 'local', label: 'Same computer as VenuCable (no internet needed)' },
				],
			},
			{
				type: 'textinput',
				id: 'key',
				label: 'Pairing key (from VenuCable: Projects → Stream Deck)',
				width: 8,
				default: '',
				isVisible: (o) => o.mode !== 'local',
			},
			{
				type: 'number',
				id: 'port',
				label: 'Port',
				tooltip:
					'Leave at 41799 unless something else on this computer uses it. If you change it, set the same port in VenuCable.',
				width: 4,
				default: DEFAULT_PORT,
				min: 1024,
				max: 65535,
				isVisible: local,
			},
			{
				type: 'number',
				id: 'browse_keys',
				label: 'Item keys on your "Kit by category" page',
				tooltip:
					'How many item keys you placed, so "More" pages through the category by that many. 10 fits a 15-key Stream Deck.',
				width: 4,
				default: 10,
				min: 1,
				max: 32,
			},
			{
				type: 'textinput',
				id: 'origins',
				label: 'Extra allowed web addresses (testing only)',
				tooltip: 'Comma-separated, e.g. http://localhost:8765. app.venucable.com is always allowed.',
				width: 8,
				default: '',
				isVisible: local,
			},
			{
				type: 'textinput',
				id: 'relay',
				label: 'Relay address (testing only)',
				tooltip: `Leave empty for ${RELAY_URL}.`,
				width: 8,
				default: '',
				isVisible: (o) => o.mode !== 'local',
			},
		]
	}

	relayUrl() {
		return String(this.config?.relay || '').trim() || RELAY_URL
	}
	isLocal() {
		return this.config?.mode === 'local'
	}

	async startLink() {
		await this.link?.stop()
		const waiting = () => this.updateStatus(InstanceStatus.Connecting, 'Waiting for VenuCable')
		if (this.isLocal()) {
			const port = Number(this.config?.port) || DEFAULT_PORT
			const extraOrigins = String(this.config?.origins || '').split(',')
			this.link = new VenuCableLink({ port, extraOrigins })
			this.link.on('listening', waiting)
			this.link.on('error', (err) => {
				const msg = err?.code === 'EADDRINUSE' ? `Port ${port} is already in use` : String(err?.message || err)
				this.log('error', msg)
				this.updateStatus(InstanceStatus.ConnectionFailure, msg)
			})
		} else {
			this.link = new RelayLink({ key: this.config?.key, url: this.relayUrl() })
			this.link.on('relay', (up) =>
				up ? waiting() : this.updateStatus(InstanceStatus.Disconnected, "Can't reach VenuCable - retrying"),
			)
			this.link.on('error', (err) => {
				const msg =
					err?.code === 'NO_KEY'
						? 'Paste the pairing key from VenuCable (Projects → Stream Deck)'
						: err?.code === 'BAD_KEY'
							? 'VenuCable did not accept that pairing key - copy it again from VenuCable'
							: String(err?.message || err)
				this.log(err?.code === 'NO_KEY' ? 'info' : 'error', msg)
				this.updateStatus(err?.code === 'REPLACED' ? InstanceStatus.ConnectionFailure : InstanceStatus.BadConfig, msg)
			})
			this.updateStatus(InstanceStatus.Connecting, 'Connecting to VenuCable')
		}
		this.link.on('connected', () => {
			this.updateStatus(InstanceStatus.Ok)
			this.log('info', 'VenuCable connected')
			this.refresh()
		})
		this.link.on('state', () => {
			// A state can arrive before (or without) a hello, e.g. after the relay reconnects.
			if (this.link.connected) this.updateStatus(InstanceStatus.Ok)
			this.refresh()
		})
		this.link.on('disconnected', () => {
			waiting()
			this.refresh()
		})
		this.link.start()
		this.refresh()
	}

	// Kit by category: VenuCable sends the whole category; the keys page through it here.
	browseSize() {
		return Math.min(32, Math.max(1, Number(this.config?.browse_keys) || 10))
	}
	browsePages() {
		const n = this.link?.state?.browse?.items?.length || 0
		return Math.max(1, Math.ceil(n / this.browseSize()))
	}
	browseItem(slot) {
		const items = this.link?.state?.browse?.items || []
		if (slot > this.browseSize()) return null
		return items[(this.browsePage || 0) * this.browseSize() + slot - 1] || null
	}
	browseTurn(dir) {
		const pages = this.browsePages()
		this.browsePage = ((((this.browsePage || 0) + dir) % pages) + pages) % pages
		this.refresh()
	}

	// Show-timer page (VenuCable's /timer): a message for the presenter ('toggle' clears it if
	// it's already showing), or blank it. VenuCable keeps them and sends them to the page.
	screenMessage(text, mode = 'toggle') {
		const msg = String(text || '')
			.trim()
			.slice(0, 120)
		const cur = this.link?.state?.screen?.msg || ''
		const same = !!cur && cur.toUpperCase() === msg.toUpperCase()
		return this.link.send('screen-msg', { msg: mode === 'clear' || (mode === 'toggle' && same) ? '' : msg })
	}
	screenBlank(mode = 'toggle') {
		const blank = !!this.link?.state?.screen?.blank
		return this.link.send('screen-blank', { blank: mode === 'toggle' ? !blank : mode === 'on' })
	}

	liveNow() {
		return liveNow(this.link?.state?.live)
	}

	// Everything the keys show, from VenuCable's last update.
	refresh() {
		const s = this.link?.state
		// The show timer's address: VenuCable sends it (whichever way the deck connects); before
		// that, with a pairing key, it's worked out from the key.
		const key = this.config?.key
		const v = {
			connected: s ? 'yes' : 'no',
			screen_url: s?.timer || (!this.isLocal() && validKey(key) ? timerUrl(key, this.relayUrl()) : ''),
		}
		v.plan = s?.plan ?? ''
		v.selected = s?.selected ?? ''
		v.tool = s?.mode === 'path:cable_route' ? 'route' : (s?.mode ?? '')
		v.read_only = s?.readOnly ? 'yes' : 'no'
		v.screen_message = s?.screen?.msg ?? ''
		const c = s?.checks
		v.checks = !c
			? ''
			: c.errors
				? `${c.errors} error${c.errors > 1 ? 's' : ''}`
				: c.warnings
					? `${c.warnings} warning${c.warnings > 1 ? 's' : ''}`
					: 'All clear'
		v.checks_errors = c?.errors ?? 0
		v.checks_warnings = c?.warnings ?? 0
		const L = s?.live
		v.live_state = L?.state ?? ''
		v.live_title = L?.title ?? ''
		v.live_who = L?.who ?? ''
		v.live_next = L?.state === 'live' ? L.next || 'End of show' : ''
		v.live_pos = L?.state === 'live' ? `${L.i}/${L.n}` : ''
		v.live_held = L?.state === 'live' && L.held ? 'yes' : 'no'
		v.file = s?.file?.name ?? ''
		const B = s?.browse
		if (B?.catId !== this.browseCatId) {
			this.browseCatId = B?.catId
			this.browsePage = 0
		}
		this.browsePage = Math.min(this.browsePage || 0, this.browsePages() - 1)
		v.browse_cat = B?.cat ?? ''
		v.browse_cat_pos = B?.n ? `${B.i}/${B.n}` : ''
		v.browse_page = B ? `${this.browsePage + 1}/${this.browsePages()}` : ''
		v.browse_view = B ? (B.view === 'mine' ? 'My kit' : 'All kit') : ''
		for (let i = 1; i <= KIT_SLOTS; i++) {
			const it = this.browseItem(i)
			v[`browse_${i}`] = it?.name ?? ''
			v[`browse_${i}_short`] = it?.short ?? ''
		}
		for (let i = 1; i <= KIT_SLOTS; i++) {
			const k = s?.kit?.[i - 1]
			v[`kit_${i}`] = k?.name ?? ''
			v[`kit_${i}_short`] = k?.short ?? ''
		}
		this.setVariableValues({ ...v, ...this.liveVars() })
		this.checkFeedbacks()
	}

	// Every timer on the live screen, worked out from the last update so they tick smoothly.
	liveVars(now = Date.now()) {
		const L = this.link?.state?.live
		const n = liveNow(L, now)
		const clock = { clock: fmtTime(now, true), clock_short: fmtTime(now) }
		// Before the show (or once it's over) the timer keys read –:–– rather than going blank.
		const dash = '–:––'
		const blank = {
			live_left: dash,
			live_late: '',
			live_late_short: '–',
			live_elapsed: dash,
			live_show_elapsed: dash,
			live_show_left: dash,
			live_ends: dash,
		}
		if (L?.state !== 'live') return { ...clock, ...blank, live_left: L?.state === 'done' ? 'Ended' : dash }
		const late = n.late
		const showLeft = Math.max(0, n.left) + (L.rest || 0)
		return {
			...clock,
			live_left: fmtClock(n.left),
			live_late: fmtLate(late),
			live_late_short:
				Math.abs(late) < 30000 ? '0' : `${late > 0 ? '+' : '−'}${Math.max(1, Math.round(Math.abs(late) / 60000))}m`,
			live_elapsed: fmtClock(Math.max(0, (L.dur || 0) - n.left)),
			live_show_elapsed: L.showAt ? fmtClock(Math.max(0, now - L.showAt)) : '',
			live_show_left: fmtClock(showLeft),
			live_ends: fmtTime(now + showLeft),
		}
	}

	tick() {
		// The time of day ticks always; the rest only while a show is live.
		if (this.link?.state?.live?.state !== 'live') {
			this.setVariableValues({ clock: fmtTime(Date.now(), true), clock_short: fmtTime(Date.now()) })
			return
		}
		this.setVariableValues(this.liveVars())
		this.checkFeedbacks('live_soon', 'live_over', 'live_status', 'live_held')
	}
}

runEntrypoint(VenuCableInstance, [])
