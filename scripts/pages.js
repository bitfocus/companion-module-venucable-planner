// Builds ready-made Companion pages for the Stream Deck + XL from the presets, laid out as in the
// VenuCable Stream Deck design: one page for building the plan and one for show day. Run with
// `npm run pages`; they're written to release/ as .companionconfig files (Companion → Import /
// Export → Import, then pick the page to import them to and the VenuCable connection to use).
//
// The files use Companion's version 7 page format (Companion 4.0), which later versions upgrade
// on import. Keys are rows 0-3, columns 0-8; the touch strip is row 4 and the six dials row 5, both in
// columns 0, 2, 3, 5, 6 and 8 (as Companion's Stream Deck surface lays out the + XL). Each strip
// cell gets the strip_ preset matching the dial under it.
import { writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { presets } from '../src/definitions.js'

const LABEL = 'venucable'
const CONN = 'venucableplanner01'
const P = presets({ label: LABEL })
const DIALS = [0, 2, 3, 5, 6, 8]

const PAGES = {
	'venucable-build': {
		name: 'VenuCable build',
		keys: [
			['status', 'tool_select', 'tool_cable', 'tool_measure', 'undo', 'redo', 'duplicate', 'rot_90', 'delete'],
			// Row 2 and the middle of row 3: 14 item keys for the category showing (All kit or My kit,
			// switched by the key below), so set "Item keys" to 14 in the connection's settings.
			['browse_1', 'browse_2', 'browse_3', 'browse_4', 'browse_5', 'browse_6', 'browse_7', 'browse_8', 'browse_9'],
			[
				'browse_prev',
				'browse_cat',
				'browse_next',
				'browse_10',
				'browse_11',
				'browse_12',
				'browse_13',
				'browse_14',
				'browse_more',
			],
			['browse_view', 'checks', 'fit', 'zoom_out', 'zoom_in', 'area_next', 'plan', 'clock', 'pageup'],
		],
		dials: ['dial_zoom', 'dial_turn', 'dial_area', 'dial_category', 'dial_items', 'dial_history'],
	},
	'venucable-show': {
		name: 'VenuCable show day',
		keys: [
			[
				'live_go',
				'live_back',
				'live_title',
				'live_countdown',
				'live_next',
				'live_late_short',
				'live_elapsed',
				'live_show_elapsed',
				'clock',
			],
			[
				'live_pos',
				'live_who',
				'live_hold',
				'live_less',
				'live_more',
				'live_ends',
				'live_show',
				'live_hide',
				'pagedown',
			],
			// Rows 2 and 3 are left free for the operator's own vMix / ATEM keys.
		],
		dials: ['dial_now', 'dial_left', 'dial_next', 'dial_late', 'dial_show_left', 'dial_ends'],
	},
}

// Stable ids, so building again gives the same files.
const idOf = (...parts) => createHash('sha1').update(parts.join('/')).digest('base64url').slice(0, 21)

function control(page, where, presetId) {
	if (presetId === 'pageup' || presetId === 'pagedown') return { type: presetId }
	const p = P[presetId]
	if (!p || p.type !== 'button') throw new Error(`${page}: no button preset ${presetId}`)
	const s = p.style
	const action = (set) => (a, i) => ({
		type: 'action',
		id: idOf(page, where, set, i),
		definitionId: a.actionId,
		connectionId: CONN,
		options: { ...a.options },
	})
	const step = p.steps[0]
	const sets = { down: step.down.map(action('down')), up: [] }
	if (p.options?.rotaryActions) {
		sets.rotate_left = (step.rotate_left ?? []).map(action('left'))
		sets.rotate_right = (step.rotate_right ?? []).map(action('right'))
	}
	return {
		type: 'button',
		options: { rotaryActions: !!p.options?.rotaryActions, stepAutoProgress: true },
		style: {
			text: s.text,
			textExpression: false,
			size: s.size ?? 'auto',
			alignment: s.alignment ?? 'center:center',
			pngalignment: s.pngalignment ?? 'center:center',
			color: s.color,
			bgcolor: s.bgcolor,
			show_topbar: s.show_topbar ?? 'default',
			png64: s.png64 ?? null,
		},
		feedbacks: p.feedbacks.map((f, i) => ({
			type: 'feedback',
			id: idOf(page, where, 'fb', i),
			definitionId: f.feedbackId,
			connectionId: CONN,
			options: { ...f.options },
			isInverted: !!f.isInverted,
			style: f.style ? { ...f.style } : undefined,
		})),
		steps: { 0: { action_sets: sets, options: { runWhileHeld: [] } } },
	}
}

export function buildPage(file) {
	const def = PAGES[file]
	const controls = {}
	const put = (row, col, presetId) => ((controls[row] ??= {})[col] = control(file, `${row}/${col}`, presetId))
	def.keys.forEach((ids, row) => ids.forEach((id, col) => put(row, col, id)))
	def.dials.forEach((id, i) => {
		put(4, DIALS[i], id.replace('dial_', 'strip_'))
		put(5, DIALS[i], id)
	})
	return {
		version: 7,
		type: 'page',
		companionBuild: undefined,
		page: {
			id: idOf(file),
			name: def.name,
			controls,
			gridSize: { minColumn: 0, maxColumn: 8, minRow: 0, maxRow: 5 },
		},
		instances: {
			[CONN]: {
				// Companion 4.0 reads instance_type, later versions moduleId.
				label: LABEL,
				instance_type: 'venucable-planner',
				moduleId: 'venucable-planner',
				lastUpgradeIndex: -1,
				enabled: true,
				sortOrder: 0,
				// Used only when the import makes a new connection: Build has 14 item keys.
				config: { port: 41799, browse_keys: 14, lan: false, origins: '' },
			},
		},
		connectionCollections: undefined,
		oldPageNumber: 1,
	}
}

export const PAGE_FILES = Object.keys(PAGES)

if (import.meta.url === `file://${process.argv[1]}`) {
	mkdirSync(new URL('../release/', import.meta.url), { recursive: true })
	for (const file of PAGE_FILES) {
		writeFileSync(
			new URL(`../release/${file}.companionconfig`, import.meta.url),
			JSON.stringify(buildPage(file), null, '\t'),
		)
		console.log(`release/${file}.companionconfig`)
	}
}
