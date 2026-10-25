// Actions, feedbacks, variables and presets for VenuCable.
import { combineRgb } from '@companion-module/base'
import { ICONS } from './icons.js'

export const KIT_SLOTS = 32

const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)
const NAVY = combineRgb(21, 26, 44)
const VIOLET = combineRgb(110, 92, 255)
const GREEN = combineRgb(52, 211, 153)
const AMBER = combineRgb(251, 191, 36)
const RED = combineRgb(239, 68, 68)
const GREY = combineRgb(60, 64, 80)

const TOOLS = [
	{ id: 'select', label: 'Select' },
	{ id: 'cable', label: 'Cable' },
	{ id: 'measure', label: 'Measure' },
	{ id: 'route', label: 'Cable route' },
]
// VenuCable's name for each tool's mode.
const TOOL_MODE = { route: 'path:cable_route' }

// The show-timer screen's messages for the presenter, from the Message action's choices.
export const SCREEN_MESSAGES = ['WRAP UP', 'STRETCH', 'STAND BY']

export function actions(self) {
	const warn = () => self.log('warn', 'VenuCable is not connected - switch it on in VenuCable: Projects → Stream Deck')
	const send = (a, extra) => () => {
		if (!self.link.send(a, extra)) warn()
	}
	return {
		add_kit: {
			name: 'Add an item from My kit',
			description: 'Puts the item in the middle of the plan on screen, selected, ready to drag into place.',
			options: [
				{
					type: 'number',
					id: 'slot',
					label: 'My kit item (1 = first starred item in the Kit tab)',
					default: 1,
					min: 1,
					max: KIT_SLOTS,
					step: 1,
				},
			],
			callback: (e) => send('add', { slot: Number(e.options.slot) || 1 })(),
		},
		add_type: {
			name: 'Add a specific item (by catalog id)',
			options: [{ type: 'textinput', id: 'type', label: 'Catalog id, e.g. ptz', default: '' }],
			callback: (e) => send('add-type', { type: String(e.options.type || '').trim() })(),
		},
		tool: {
			name: 'Pick a tool',
			options: [
				{
					type: 'dropdown',
					id: 'tool',
					label: 'Tool',
					default: 'select',
					choices: TOOLS,
				},
			],
			callback: (e) => send('tool', { tool: e.options.tool })(),
		},
		finish: {
			name: 'Finish the route, room or road being drawn',
			description: 'The same as Enter or a double-click in VenuCable.',
			options: [],
			callback: send('finish'),
		},
		undo: { name: 'Undo', options: [], callback: send('undo') },
		redo: { name: 'Redo', options: [], callback: send('redo') },
		delete: { name: 'Delete the selected item', options: [], callback: send('delete') },
		duplicate: { name: 'Duplicate the selected item', options: [], callback: send('duplicate') },
		lock: {
			name: 'Lock / unlock the selected item',
			description: "A locked item can't be dragged or turned by accident (the same as L in VenuCable).",
			options: [],
			callback: send('lock'),
		},
		save: {
			name: 'Save the plan to its file',
			description:
				'Saves to the file the plan was last saved to or opened from (save it once with Ctrl+S first: browsers only open the Save dialog for a click or key press in the tab).',
			options: [],
			callback: send('save'),
		},
		rotate: {
			name: 'Turn the selected item',
			options: [
				{
					type: 'dropdown',
					id: 'deg',
					label: 'Turn by',
					default: '15',
					choices: ['-90', '-45', '-15', '15', '45', '90'].map((d) => ({ id: d, label: `${d}°` })),
				},
			],
			callback: (e) => send('rotate', { deg: Number(e.options.deg) || 15 })(),
		},
		fit: { name: 'Zoom to fit', options: [], callback: send('fit') },
		zoom: {
			name: 'Zoom in / out',
			options: [
				{
					type: 'dropdown',
					id: 'dir',
					label: 'Direction',
					default: 'in',
					choices: [
						{ id: 'in', label: 'In' },
						{ id: 'out', label: 'Out' },
					],
				},
			],
			callback: (e) => send('zoom', { dir: e.options.dir })(),
		},
		area: {
			name: 'Next / previous area',
			description: 'Steps through the areas in the plan (stage, FOH, zones…) and the whole venue.',
			options: [
				{
					type: 'dropdown',
					id: 'dir',
					label: 'Direction',
					default: 'next',
					choices: [
						{ id: 'next', label: 'Next' },
						{ id: 'prev', label: 'Previous' },
					],
				},
			],
			callback: (e) => send('area', { dir: e.options.dir })(),
		},
		browse_cat: {
			name: 'Kit by category: next / previous category',
			description:
				'Steps through the kit categories (Cameras, Vision mixers, Audio…). VenuCable opens the same category in its Kit tab.',
			options: [
				{
					type: 'dropdown',
					id: 'dir',
					label: 'Direction',
					default: 'next',
					choices: [
						{ id: 'next', label: 'Next' },
						{ id: 'prev', label: 'Previous' },
					],
				},
			],
			callback: (e) => send('browse-cat', { dir: e.options.dir })(),
		},
		browse_page: {
			name: 'Kit by category: next / previous page of items',
			description: 'When a category has more items than you have item keys.',
			options: [
				{
					type: 'dropdown',
					id: 'dir',
					label: 'Direction',
					default: 'next',
					choices: [
						{ id: 'next', label: 'Next' },
						{ id: 'prev', label: 'Previous' },
					],
				},
			],
			callback: (e) => self.browseTurn(e.options.dir === 'prev' ? -1 : 1),
		},
		browse_view: {
			name: 'Kit by category: All kit / My kit',
			options: [
				{
					type: 'dropdown',
					id: 'view',
					label: 'Show',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Switch between them' },
						{ id: 'all', label: 'All kit' },
						{ id: 'mine', label: 'My kit' },
					],
				},
			],
			callback: (e) => send('browse-view', { view: e.options.view })(),
		},
		browse_add: {
			name: 'Kit by category: add item',
			description: 'Adds the item on this key (in the category and page showing) to the middle of the plan.',
			options: [
				{ type: 'number', id: 'slot', label: 'Item key (1 = first)', default: 1, min: 1, max: KIT_SLOTS, step: 1 },
			],
			callback: (e) => {
				const it = self.browseItem(Number(e.options.slot) || 1)
				if (it) send('add-type', { type: it.type })()
			},
		},
		live_go: { name: 'Running order: Go / Next segment', options: [], callback: send('live-go') },
		live_back: { name: 'Running order: Back a segment', options: [], callback: send('live-back') },
		live_show: { name: 'Running order: show the live screen', options: [], callback: send('live-show') },
		live_hide: { name: 'Running order: back to the plan', options: [], callback: send('live-hide') },
		live_nudge: {
			name: 'Running order: more / less time for the segment on air',
			description: "Moves the segment's end (and the show's finish) by this many minutes.",
			options: [
				{
					type: 'number',
					id: 'min',
					label: 'Minutes (negative takes time off)',
					default: 1,
					min: -60,
					max: 60,
					step: 1,
				},
			],
			callback: (e) => send('live-nudge', { min: Math.round(Number(e.options.min) || 0) })(),
		},
		live_hold: {
			name: 'Running order: hold / resume',
			description: "Stops the segment's countdown (the show counts as late while it's held). Go or Back also resume.",
			options: [
				{
					type: 'dropdown',
					id: 'mode',
					label: 'Press',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Hold / resume' },
						{ id: 'hold', label: 'Hold' },
						{ id: 'resume', label: 'Resume' },
					],
				},
			],
			callback: (e) => send('live-hold', { mode: e.options.mode })(),
		},
		screen_message: {
			name: 'Show timer screen: message to the presenter',
			description:
				'Shows a message big on VenuCable\'s show-timer page until you clear it. Press again to clear it when set to "Show / clear".',
			options: [
				{
					type: 'dropdown',
					id: 'text',
					label: 'Message',
					default: SCREEN_MESSAGES[0],
					choices: SCREEN_MESSAGES.map((m) => ({ id: m, label: m })),
					allowCustom: true,
					tooltip: 'Pick one or type your own',
				},
				{
					type: 'dropdown',
					id: 'mode',
					label: 'Press',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Show / clear' },
						{ id: 'show', label: 'Show' },
						{ id: 'clear', label: 'Clear any message' },
					],
				},
			],
			callback: (e) => {
				if (!self.screenMessage(String(e.options.text ?? ''), e.options.mode)) warn()
			},
		},
		screen_blank: {
			name: 'Show timer screen: blank',
			description: "Blanks VenuCable's show-timer page (black, or clear with bg=transparent), until pressed again.",
			options: [
				{
					type: 'dropdown',
					id: 'mode',
					label: 'Press',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Blank / show' },
						{ id: 'on', label: 'Blank' },
						{ id: 'off', label: 'Show' },
					],
				},
			],
			callback: (e) => {
				if (!self.screenBlank(e.options.mode)) warn()
			},
		},
	}
}

export function feedbacks(self) {
	const st = () => self.link.state
	return {
		connected: {
			type: 'boolean',
			name: 'VenuCable is connected',
			defaultStyle: { bgcolor: GREEN, color: BLACK },
			options: [],
			callback: () => self.link.connected && !!st(),
		},
		checks: {
			type: 'boolean',
			name: 'Plan checks are…',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [
				{
					type: 'dropdown',
					id: 'level',
					label: 'Level',
					default: 'error',
					choices: [
						{ id: 'ok', label: 'All clear' },
						{ id: 'warn', label: 'Warnings' },
						{ id: 'error', label: 'Errors' },
					],
				},
			],
			callback: (f) => st()?.checks?.level === f.options.level,
		},
		tool: {
			type: 'boolean',
			name: 'Tool in use',
			defaultStyle: { bgcolor: VIOLET, color: WHITE },
			options: [
				{
					type: 'dropdown',
					id: 'tool',
					label: 'Tool',
					default: 'select',
					choices: TOOLS,
				},
			],
			callback: (f) => !!st() && st().mode === (TOOL_MODE[f.options.tool] || f.options.tool),
		},
		drawing: {
			type: 'boolean',
			name: 'A route, room or road is being drawn',
			description: 'For the Finish key.',
			defaultStyle: { bgcolor: VIOLET, color: WHITE },
			options: [],
			callback: () => !!st()?.drawing,
		},
		can_undo: {
			type: 'boolean',
			name: 'There is something to undo / redo',
			defaultStyle: { bgcolor: NAVY, color: WHITE },
			options: [
				{
					type: 'dropdown',
					id: 'what',
					label: 'Something to',
					default: 'undo',
					choices: [
						{ id: 'undo', label: 'Undo' },
						{ id: 'redo', label: 'Redo' },
					],
				},
			],
			callback: (f) => !!st()?.[f.options.what === 'redo' ? 'redo' : 'undo'],
		},
		read_only: {
			type: 'boolean',
			name: 'The plan is view only',
			description: 'True with view-only (Crew) access, when VenuCable refuses changes.',
			defaultStyle: { bgcolor: BLACK, color: GREY },
			options: [],
			callback: () => !!st()?.readOnly,
		},
		screen_message: {
			type: 'boolean',
			name: 'Show timer screen: a message is showing',
			defaultStyle: { bgcolor: AMBER, color: BLACK },
			options: [
				{
					type: 'textinput',
					id: 'text',
					label: 'This message (blank = any)',
					default: '',
				},
			],
			callback: (f) => {
				const m = st()?.screen?.msg || ''
				const want = String(f.options.text ?? '').trim()
				return !!m && (!want || want.toUpperCase() === m.toUpperCase())
			},
		},
		screen_blank: {
			type: 'boolean',
			name: 'Show timer screen: blanked',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [],
			callback: () => !!st()?.screen?.blank,
		},
		live_running: {
			type: 'boolean',
			name: 'Running order: a show is live',
			defaultStyle: { bgcolor: VIOLET, color: WHITE },
			options: [],
			callback: () => st()?.live?.state === 'live',
		},
		live_soon: {
			type: 'boolean',
			name: 'Running order: under a minute left',
			defaultStyle: { bgcolor: AMBER, color: BLACK },
			options: [],
			callback: () => self.liveNow().soon,
		},
		live_status: {
			type: 'boolean',
			name: 'Running order: on time / late / early',
			description: 'Within 30 seconds counts as on time.',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [
				{
					type: 'dropdown',
					id: 'status',
					label: 'When the show is',
					default: 'late',
					choices: [
						{ id: 'late', label: 'Running late' },
						{ id: 'early', label: 'Running early' },
						{ id: 'ontime', label: 'On time' },
					],
				},
			],
			callback: (f) => {
				const late = self.liveNow().late
				if (late == null) return false
				const s = Math.abs(late) < 30000 ? 'ontime' : late > 0 ? 'late' : 'early'
				return s === f.options.status
			},
		},
		live_held: {
			type: 'boolean',
			name: 'Running order: on hold',
			defaultStyle: { bgcolor: AMBER, color: BLACK },
			options: [],
			callback: () => self.liveNow().held,
		},
		locked: {
			type: 'boolean',
			name: 'The selected item is locked',
			defaultStyle: { bgcolor: VIOLET, color: WHITE },
			options: [],
			callback: () => !!st()?.locked,
		},
		unsaved: {
			type: 'boolean',
			name: 'Changes not yet saved to the file',
			description: 'True when the plan has a file (this session) and has changed since it was saved.',
			defaultStyle: { bgcolor: AMBER, color: BLACK },
			options: [],
			callback: () => !!st()?.file?.unsaved,
		},
		live_over: {
			type: 'boolean',
			name: 'Running order: segment has overrun',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [],
			callback: () => self.liveNow().over,
		},
		browse_slot: {
			type: 'boolean',
			name: 'Kit by category: item key is set',
			defaultStyle: { bgcolor: NAVY, color: WHITE },
			options: [{ type: 'number', id: 'slot', label: 'Item key', default: 1, min: 1, max: KIT_SLOTS, step: 1 }],
			callback: (f) => !!self.browseItem(Number(f.options.slot) || 1),
		},
		browse_more: {
			type: 'boolean',
			name: 'Kit by category: more than one page',
			defaultStyle: { bgcolor: VIOLET, color: WHITE },
			options: [],
			callback: () => self.browsePages() > 1,
		},
		browse_view: {
			type: 'boolean',
			name: 'Kit by category: showing My kit',
			defaultStyle: { bgcolor: VIOLET, color: WHITE },
			options: [],
			callback: () => st()?.browse?.view === 'mine',
		},
		browse_colour: {
			type: 'advanced',
			name: 'Kit by category: category colour',
			description: "Colours the key in the category's colour, as in VenuCable.",
			options: [],
			callback: () => {
				const m = /^#([0-9a-f]{6})$/i.exec(st()?.browse?.color || '')
				if (!m) return {}
				const n = parseInt(m[1], 16)
				return { bgcolor: combineRgb(n >> 16, (n >> 8) & 255, n & 255), color: BLACK }
			},
		},
		kit_slot: {
			type: 'boolean',
			name: 'My kit item is set',
			description: 'True when My kit has an item in this position (so an empty key can look empty).',
			defaultStyle: { bgcolor: NAVY, color: WHITE },
			options: [{ type: 'number', id: 'slot', label: 'My kit item', default: 1, min: 1, max: KIT_SLOTS, step: 1 }],
			callback: (f) => !!st()?.kit?.[Number(f.options.slot) - 1],
		},
	}
}

export function variables() {
	const defs = [
		{ variableId: 'connected', name: 'Connected (yes / no)' },
		{ variableId: 'screen_url', name: 'Show timer page address, for vMix / OBS (with the pairing key)' },
		{ variableId: 'plan', name: 'Plan name' },
		{ variableId: 'selected', name: 'Selected item' },
		{ variableId: 'tool', name: 'Tool in use' },
		{ variableId: 'checks', name: 'Checks summary, e.g. "2 errors"' },
		{ variableId: 'checks_errors', name: 'Number of check errors' },
		{ variableId: 'checks_warnings', name: 'Number of check warnings' },
		{ variableId: 'live_state', name: 'Running order: ready / live / done' },
		{ variableId: 'live_title', name: 'Running order: current segment' },
		{ variableId: 'live_who', name: 'Running order: who is on' },
		{ variableId: 'live_left', name: 'Running order: time left, e.g. 4:05 or +1:20 over' },
		{ variableId: 'live_next', name: 'Running order: next segment' },
		{ variableId: 'live_pos', name: 'Running order: segment number, e.g. 3/8' },
		{ variableId: 'live_late', name: 'Running order: on time / 2m late / 1m early' },
		{ variableId: 'live_late_short', name: 'Running order: late or early, short, e.g. +2m / −1m / 0' },
		{ variableId: 'live_elapsed', name: 'Running order: time into this segment' },
		{ variableId: 'live_show_elapsed', name: 'Running order: time since the show started' },
		{ variableId: 'live_show_left', name: 'Running order: time left in the whole show' },
		{ variableId: 'live_ends', name: 'Running order: when the show will finish at this rate, e.g. 22:40' },
		{ variableId: 'clock', name: 'Time of day, e.g. 21:05:09' },
		{ variableId: 'clock_short', name: 'Time of day, e.g. 21:05' },
		{ variableId: 'read_only', name: 'Plan is view only (yes / no)' },
		{ variableId: 'live_held', name: 'Running order: on hold (yes / no)' },
		{ variableId: 'file', name: "Name of the plan's file (once saved or opened this session)" },
		{ variableId: 'screen_message', name: 'Show timer screen: message showing' },
	]
	defs.push(
		{ variableId: 'browse_cat', name: 'Kit by category: category showing' },
		{ variableId: 'browse_cat_pos', name: 'Kit by category: category number, e.g. 3/14' },
		{ variableId: 'browse_page', name: 'Kit by category: page, e.g. 1/3' },
		{ variableId: 'browse_view', name: 'Kit by category: All kit / My kit' },
	)
	for (let i = 1; i <= KIT_SLOTS; i++) {
		defs.push({ variableId: `browse_${i}`, name: `Kit by category: item key ${i} name` })
		defs.push({ variableId: `browse_${i}_short`, name: `Kit by category: item key ${i} short label` })
	}
	for (let i = 1; i <= KIT_SLOTS; i++) {
		defs.push({ variableId: `kit_${i}`, name: `My kit ${i}: name` })
		defs.push({ variableId: `kit_${i}_short`, name: `My kit ${i}: short label (CAM, MIX…)` })
	}
	return defs
}

// The presets follow VenuCable's Stream Deck design: black key faces like the app's dark ground,
// a line icon over a small label, the violet accent for what's active, green to GO, and amber /
// red when time runs short or over.
const FACE = combineRgb(5, 6, 11)
const INK = combineRgb(238, 240, 250)
const GO_BG = combineRgb(34, 197, 94)
const GO_INK = combineRgb(5, 46, 20)

export function presets(self) {
	const v = (id) => `$(${self.label}:${id})`
	const btn = (category, name, text, actions, feedbacks = [], style = {}) => ({
		type: 'button',
		category,
		name,
		// No top bar (it takes a fifth of the key). Text sizes are set per key: Companion's 'auto'
		// guesses from the number of characters, so short words come out too big and get clipped.
		// Measured on a Stream Deck + XL: 10 fits about 9 characters a line, 12 about 8, 14 about 6,
		// 18 about 5; the key's bezel also hides a few pixels at each edge.
		style: { text, size: '14', color: INK, bgcolor: FACE, ...style, show_topbar: false },
		steps: [{ down: actions, up: [] }],
		feedbacks,
	})
	// A key with a line icon above its label, as in the design. Both are drawn into one picture
	// (src/icons.js, made by scripts/icons.js), so the label fits on any deck. `face` names it; the
	// lit and amber states swap in their own picture through the feedback's style.
	const iconBtn = (category, name, face, _text, actions, feedbacks = [], style = {}) =>
		btn(category, name, '', actions, feedbacks, { png64: ICONS[face], pngalignment: 'center:center', ...style })
	const lit = (face, bgcolor = VIOLET) => ({ bgcolor, color: WHITE, png64: ICONS[face] })
	// A dial (Stream Deck +): turn left / right, press, and the text shows on the touch strip above it.
	// The strip is wider than a key, so these keep their set sizes.
	const dial = (name, text, { left = [], right = [], press = [] }, feedbacks = [], style = {}) => {
		const b = btn('Dials (Stream Deck +)', name, text, press, feedbacks, style)
		return {
			...b,
			style: { ...b.style, size: style.size ?? '14' },
			options: { rotaryActions: true },
			steps: [{ down: press, up: [], rotate_left: left, rotate_right: right }],
		}
	}
	const act = (actionId, options = {}) => ({ actionId, options })
	// Every boolean feedback on a preset needs its own style: Companion 4.3+ treats one without a
	// style as an advanced feedback that replaces the whole key, which blanks it while it's true.
	// Edit keys go dark with view-only (Crew) access, when VenuCable refuses changes.
	const off = { bgcolor: BLACK, color: GREY }
	const readOnly = { feedbackId: 'read_only', options: {}, style: off }
	const p = {}

	p.status = iconBtn(
		'View',
		'VenuCable connected',
		'linked',
		'',
		[],
		[{ feedbackId: 'connected', options: {}, isInverted: true, style: { png64: ICONS.offline } }],
	)
	p.plan = btn('View', 'Plan name', `PLAN\\n${v('plan')}`, [], [], { size: 10 })

	for (let i = 1; i <= 15; i++) {
		p[`kit_${i}`] = btn(
			'My kit',
			`My kit ${i}`,
			v(`kit_${i}`),
			[act('add_kit', { slot: i })],
			[{ feedbackId: 'kit_slot', options: { slot: i }, isInverted: true, style: off }, readOnly],
			{ size: 10 },
		)
	}

	// A 15-key Stream Deck: ◀ category ▶, more, All/My kit, then 10 item keys.
	p.browse_prev = iconBtn('Kit by category', 'Previous category', 'prev', '', [act('browse_cat', { dir: 'prev' })])
	p.browse_cat = btn(
		'Kit by category',
		'Category (press for the next)',
		`${v('browse_cat_pos')}\\n${v('browse_cat')}`,
		[act('browse_cat', { dir: 'next' })],
		[{ feedbackId: 'browse_colour', options: {} }],
		{ size: 12 },
	)
	p.browse_next = iconBtn('Kit by category', 'Next category', 'next', '', [act('browse_cat', { dir: 'next' })])
	p.browse_more = btn(
		'Kit by category',
		'More items (next page)',
		`MORE\\n${v('browse_page')}`,
		[act('browse_page', { dir: 'next' })],
		[{ feedbackId: 'browse_more', options: {}, isInverted: true, style: off }],
		{ size: '14' },
	)
	p.browse_view = iconBtn(
		'Kit by category',
		'All kit / My kit',
		'view_all',
		'',
		[act('browse_view', { view: 'toggle' })],
		[{ feedbackId: 'browse_view', options: {}, style: lit('view_mine') }],
	)
	for (let i = 1; i <= 15; i++) {
		p[`browse_${i}`] = btn(
			'Kit by category',
			`Item key ${i}`,
			v(`browse_${i}`),
			[act('browse_add', { slot: i })],
			[{ feedbackId: 'browse_slot', options: { slot: i }, isInverted: true, style: off }, readOnly],
			{ size: 10 },
		)
	}

	for (const [id, label, icon] of [
		['select', 'Select', 'select'],
		['cable', 'Cable', 'cable'],
		['measure', 'Measure', 'measure'],
		['route', 'Route', 'route'],
	]) {
		const fb = [{ feedbackId: 'tool', options: { tool: id }, style: lit(`${id}_on`) }]
		if (id === 'route') fb.push(readOnly)
		p[`tool_${id}`] = iconBtn(
			'Tools',
			id === 'route' ? 'Cable route' : label,
			icon,
			label,
			[act('tool', { tool: id })],
			fb,
		)
	}
	p.finish = iconBtn(
		'Tools',
		'Finish drawing',
		'finish',
		'Finish',
		[act('finish')],
		[{ feedbackId: 'drawing', options: {}, isInverted: true, style: off }],
	)
	const nothing = (what) => ({ feedbackId: 'can_undo', options: { what }, isInverted: true, style: off })
	p.undo = iconBtn('Edit', 'Undo', 'undo', 'Undo', [act('undo')], [nothing('undo'), readOnly])
	p.redo = iconBtn('Edit', 'Redo', 'redo', 'Redo', [act('redo')], [nothing('redo'), readOnly])
	p.duplicate = iconBtn('Edit', 'Duplicate', 'duplicate', 'Duplicate', [act('duplicate')], [readOnly])
	p.lock = iconBtn(
		'Edit',
		'Lock / unlock',
		'lock',
		'Lock',
		[act('lock')],
		[{ feedbackId: 'locked', options: {}, style: lit('lock_on') }, readOnly],
	)
	p.save = iconBtn(
		'Edit',
		'Save to file',
		'save',
		'Save',
		[act('save')],
		[{ feedbackId: 'unsaved', options: {}, style: lit('save_dark', AMBER) }],
	)
	p.delete = iconBtn('Edit', 'Delete', 'delete', 'Delete', [act('delete')], [readOnly])
	p.rot_l = iconBtn('Edit', 'Turn left 15°', 'rot_l', '', [act('rotate', { deg: '-15' })], [readOnly])
	p.rot_r = iconBtn('Edit', 'Turn right 15°', 'rot_r', '', [act('rotate', { deg: '15' })], [readOnly])
	p.rot_90 = iconBtn('Edit', 'Turn 90°', 'rot_90', '', [act('rotate', { deg: '90' })], [readOnly])
	p.fit = iconBtn('View', 'Zoom to fit', 'fit', 'Fit', [act('fit')])
	p.zoom_in = iconBtn('View', 'Zoom in', 'zoom_in', 'Zoom in', [act('zoom', { dir: 'in' })])
	p.zoom_out = iconBtn('View', 'Zoom out', 'zoom_out', 'Zoom out', [act('zoom', { dir: 'out' })])
	p.area_next = iconBtn('View', 'Next area', 'area', 'Next area', [act('area', { dir: 'next' })])
	p.checks = btn(
		'View',
		'Checks',
		`CHECKS\\n${v('checks')}`,
		[],
		[
			{ feedbackId: 'checks', options: { level: 'ok' }, style: { bgcolor: GREEN, color: BLACK } },
			{ feedbackId: 'checks', options: { level: 'warn' }, style: { bgcolor: AMBER, color: BLACK } },
			{ feedbackId: 'checks', options: { level: 'error' }, style: { bgcolor: RED, color: WHITE } },
		],
		{ size: 12 },
	)

	// The countdown: black while there's time, amber in the last minute, red once over.
	const countdown = [
		{ feedbackId: 'live_soon', options: {}, style: { bgcolor: AMBER, color: BLACK } },
		{ feedbackId: 'live_over', options: {}, style: { bgcolor: RED, color: WHITE } },
		{ feedbackId: 'live_held', options: {}, style: { bgcolor: GREY, color: WHITE } },
	]
	const timing = [
		{ feedbackId: 'live_status', options: { status: 'ontime' }, style: { bgcolor: GREEN, color: BLACK } },
		{ feedbackId: 'live_status', options: { status: 'early' }, style: { bgcolor: AMBER, color: BLACK } },
		{ feedbackId: 'live_status', options: { status: 'late' }, style: { bgcolor: RED, color: WHITE } },
	]
	p.live_now = btn(
		'Running order',
		'Now + time left',
		`${v('live_title')}\\n${v('live_left')}`,
		[act('live_show')],
		countdown,
		{ size: 12 },
	)
	p.live_go = iconBtn('Running order', 'Go / Next', 'go', 'GO', [act('live_go')], [], {
		bgcolor: GO_BG,
		color: GO_INK,
		size: '18',
	})
	p.live_back = iconBtn('Running order', 'Back', 'back', 'Back', [act('live_back')])
	// Next moves on too (GO starts the show, and also moves on once it's running).
	p.live_next = btn('Running order', 'Next segment', `NEXT\\n${v('live_next')}`, [act('live_go')], [], { size: 12 })
	p.live_late = btn('Running order', 'On time / late', `${v('live_pos')}\\n${v('live_late')}`, [], timing, {
		size: 12,
	})
	p.live_title = btn('Running order', 'Now (segment name)', `NOW ${v('live_pos')}\\n${v('live_title')}`, [], [], {
		size: 12,
	})
	p.live_who = btn('Running order', 'Who is on', `WHO\\n${v('live_who')}`, [], [], { size: 12 })
	p.live_pos = btn('Running order', 'Segment number', `SEGMENT\\n${v('live_pos')}`, [], [], { size: 12 })
	p.live_show = iconBtn('Running order', 'Live screen', 'live', 'Live view', [act('live_show')])
	p.live_hide = iconBtn('Running order', 'Back to plan', 'plan', 'Plan', [act('live_hide')])
	p.live_less = btn('Running order', 'A minute less', '−1 min', [act('live_nudge', { min: -1 })], [], { size: '18' })
	p.live_more = btn('Running order', 'A minute more', '+1 min', [act('live_nudge', { min: 1 })], [], { size: '18' })
	p.live_hold = iconBtn(
		'Running order',
		'Hold / resume',
		'hold',
		'Hold',
		[act('live_hold', { mode: 'toggle' })],
		[{ feedbackId: 'live_held', options: {}, style: lit('resume', AMBER) }],
	)

	// The live screen's timers, one per key: a small label over the time. Labels are kept short
	// (or the size small) so Companion never breaks a word to fit. Pressing one opens the live screen.
	const showLive = [act('live_show')]
	const timer = (id, name, label, variable, feedbacks, size) =>
		(p[id] = btn('Live timers', name, `${label}\\n${v(variable)}`, showLive, feedbacks, { size }))
	p.live_countdown = btn('Live timers', 'Countdown (big)', v('live_left'), showLive, countdown, { size: '18' })
	timer('live_elapsed', 'Time into this segment', 'SO FAR', 'live_elapsed', [], '14')
	timer('live_late_short', 'Late / early (short)', 'LATE', 'live_late_short', timing, '18')
	timer('live_show_elapsed', 'Show running time (since GO)', 'SHOW RAN', 'live_show_elapsed', [], 12)
	timer('live_show_left', 'Show time left', 'SHOW LEFT', 'live_show_left', [], 12)
	timer('live_ends', 'Show finishes at', 'ENDS AT', 'live_ends', [], 12)
	timer('clock', 'Time of day', 'TIME', 'clock_short', [], '14')

	// The show-timer pages (/screen): a message for the presenter, or blank them.
	const msgKey = (id, text, label) =>
		(p[id] = btn(
			'Show timer screen',
			label,
			text.replace(' ', '\\n'),
			[act('screen_message', { text, mode: 'toggle' })],
			[{ feedbackId: 'screen_message', options: { text }, style: { bgcolor: AMBER, color: BLACK } }],
			{ size: '14' },
		))
	msgKey('screen_wrap', 'WRAP UP', 'Wrap up (show / clear)')
	msgKey('screen_stretch', 'STRETCH', 'Stretch (show / clear)')
	msgKey('screen_standby', 'STAND BY', 'Stand by (show / clear)')
	p.screen_clear = btn(
		'Show timer screen',
		'Clear the message',
		`CLEAR\\n${v('screen_message')}`,
		[act('screen_message', { text: '', mode: 'clear' })],
		[{ feedbackId: 'screen_message', options: { text: '' }, style: { bgcolor: AMBER, color: BLACK } }],
		{ size: 12 },
	)
	p.screen_blank = iconBtn(
		'Show timer screen',
		'Blank the screen (blank / show)',
		'blank',
		'Blank',
		[act('screen_blank', { mode: 'toggle' })],
		[{ feedbackId: 'screen_blank', options: {}, style: lit('blank_on', RED) }],
	)

	// Dials, for the Stream Deck + and + XL. Building the plan:
	p.dials_info = {
		type: 'text',
		category: 'Dials (Stream Deck +)',
		name: 'Drag these onto the dials',
		text: 'Put the matching Touch strip preset on the strip above each dial, to label it. Building: zoom, turn, area, category, items, undo / redo. Show day: now, countdown (turn for ±1 minute, press to hold), next (press to GO), on time / late, show left, ends at.',
	}
	p.dial_zoom = dial(
		'Zoom (press: fit)',
		'ZOOM',
		{ left: [act('zoom', { dir: 'out' })], right: [act('zoom', { dir: 'in' })], press: [act('fit')] },
		[],
		{ size: '18' },
	)
	p.dial_turn = dial(
		'Turn the selected item (press: 90°)',
		'TURN\\n15°',
		{
			left: [act('rotate', { deg: '-15' })],
			right: [act('rotate', { deg: '15' })],
			press: [act('rotate', { deg: '90' })],
		},
		[readOnly],
		{ size: '18' },
	)
	p.dial_area = dial(
		'Area',
		'AREA',
		{ left: [act('area', { dir: 'prev' })], right: [act('area', { dir: 'next' })] },
		[],
		{ size: '18' },
	)
	p.dial_category = dial(
		'Kit category (press: All kit / My kit)',
		`${v('browse_cat_pos')}\\n${v('browse_cat')}`,
		{
			left: [act('browse_cat', { dir: 'prev' })],
			right: [act('browse_cat', { dir: 'next' })],
			press: [act('browse_view', { view: 'toggle' })],
		},
		[{ feedbackId: 'browse_colour', options: {} }],
		{ size: '14' },
	)
	p.dial_items = dial(
		'Kit items, page by page',
		`ITEMS\\n${v('browse_page')}`,
		{ left: [act('browse_page', { dir: 'prev' })], right: [act('browse_page', { dir: 'next' })] },
		[],
		{ size: '18' },
	)
	p.dial_history = dial('Undo / redo', 'UNDO ◂ ▸ REDO', { left: [act('undo')], right: [act('redo')] }, [readOnly], {
		size: '14',
	})
	// Show day:
	p.dial_now = dial(
		'Now (press: live screen)',
		`NOW ${v('live_pos')}\\n${v('live_title')}`,
		{ press: [act('live_show')] },
		[],
		{ size: '14' },
	)
	p.dial_left = dial(
		'Countdown (turn: ±1 minute, press: hold)',
		v('live_left'),
		{
			left: [act('live_nudge', { min: -1 })],
			right: [act('live_nudge', { min: 1 })],
			press: [act('live_hold', { mode: 'toggle' })],
		},
		countdown,
		{ size: '30' },
	)
	p.dial_next = dial('Next (press: GO)', `NEXT\\n${v('live_next')}`, { press: [act('live_go')] }, [], { size: '14' })
	p.dial_late = dial('On time / late', `${v('live_late')}`, {}, timing, { size: '18' })
	p.dial_show_left = dial('Show time left', `SHOW LEFT\\n${v('live_show_left')}`, {}, [], { size: '18' })
	p.dial_ends = dial('Show finishes at', `ENDS AT\\n${v('live_ends')}`, {}, [], { size: '18' })

	// The touch strip (Stream Deck + and + XL) is its own row of buttons above the dials, so each
	// dial gets a matching strip cell: the same label and colours, just for showing. A touch does
	// nothing, so brushing the strip can't move the show on.
	for (const [id, d] of Object.entries(p)) {
		if (!id.startsWith('dial_') || d.type !== 'button') continue
		p[id.replace('dial_', 'strip_')] = {
			...d,
			category: 'Touch strip (Stream Deck +)',
			name: d.name.replace(/ \(.*\)$/, ''),
			options: undefined,
			steps: [{ down: [], up: [] }],
		}
	}
	return p
}
