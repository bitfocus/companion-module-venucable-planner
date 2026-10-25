import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { actions, feedbacks, variables, presets, KIT_SLOTS } from '../src/definitions.js'

const self = {
	label: 'venucable',
	link: { state: null, connected: false, send: () => true },
	log() {},
	liveNow: () => ({}),
}

test('every preset uses real actions, feedbacks, options and variables', () => {
	const A = actions(self),
		F = feedbacks(self),
		P = presets(self)
	const vars = new Set(variables().map((v) => v.variableId))
	assert.equal(vars.size, variables().length, 'variable ids are unique')
	assert.ok(vars.has(`kit_${KIT_SLOTS}`))
	for (const [id, p] of Object.entries(P)) {
		if (p.type === 'text') continue
		for (const step of p.steps)
			for (const a of [...step.down, ...(step.rotate_left ?? []), ...(step.rotate_right ?? [])]) {
				assert.ok(A[a.actionId], `${id}: action ${a.actionId}`)
				const known = new Set(A[a.actionId].options.map((o) => o.id))
				for (const k of Object.keys(a.options)) assert.ok(known.has(k), `${id}: option ${k}`)
			}
		for (const f of p.feedbacks) {
			assert.ok(F[f.feedbackId], `${id}: feedback ${f.feedbackId}`)
			// Without a style, Companion 4.3+ treats it as advanced and blanks the key while it's true.
			if (F[f.feedbackId].type === 'boolean')
				assert.ok(f.style && Object.keys(f.style).length, `${id}: ${f.feedbackId} needs a style`)
			const known = new Set(F[f.feedbackId].options.map((o) => o.id))
			for (const k of Object.keys(f.options)) assert.ok(known.has(k), `${id}: feedback option ${k}`)
		}
		for (const [, v] of p.style.text.matchAll(/\$\(venucable:([a-z0-9_]+)\)/g))
			assert.ok(vars.has(v), `${id}: variable ${v}`)
	}
})

test('presets look like the design: icons exist, dials turn', () => {
	const P = presets(self)
	for (const [id, p] of Object.entries(P)) {
		if (p.type === 'text') continue
		if ('png64' in p.style) assert.ok(p.style.png64 && p.style.png64.length > 100, `${id}: icon missing`)
		for (const f of p.feedbacks)
			if (f.style && 'png64' in f.style) assert.ok(f.style.png64?.length > 100, `${id}: ${f.feedbackId} face missing`)
		// Keys never show Companion's top bar, and each sets its text size ('auto' guesses too big).
		assert.equal(p.style.show_topbar, false, `${id}: top bar`)
		if (p.style.text && id !== 'live_countdown') assert.notEqual(p.style.size, 'auto', `${id}: text size`)
		const turns = p.steps.some((s) => s.rotate_left?.length || s.rotate_right?.length)
		if (turns) assert.equal(p.options?.rotaryActions, true, `${id}: turning needs rotaryActions`)
	}
	assert.equal(P.dial_zoom.steps[0].rotate_right[0].actionId, 'zoom')
	assert.equal(P.dial_left.steps[0].down[0].actionId, 'live_hold')
})

test('actions send the right commands', () => {
	const sent = []
	const s = { ...self, link: { ...self.link, send: (a, x) => (sent.push([a, x]), true) } }
	const A = actions(s)
	A.add_kit.callback({ options: { slot: 3 } })
	A.rotate.callback({ options: { deg: '-45' } })
	A.live_go.callback({ options: {} })
	A.tool.callback({ options: { tool: 'cable' } })
	A.tool.callback({ options: { tool: 'route' } })
	A.finish.callback({ options: {} })
	assert.deepEqual(sent, [
		['add', { slot: 3 }],
		['rotate', { deg: -45 }],
		['live-go', undefined],
		['tool', { tool: 'cable' }],
		['tool', { tool: 'route' }],
		['finish', undefined],
	])
})

// Only inside the VenuCable repository (not the Bitfocus copy, which has no app next to it).
const appFile = new URL('../../companion.js', import.meta.url)
test("the app's download link shows this module's version", { skip: !existsSync(appFile) }, () => {
	const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
	const app = readFileSync(appFile, 'utf8')
	assert.equal(/COMPANION_MODULE_VERSION = "([^"]+)"/.exec(app)?.[1], pkg.version, 'update companion.js too')
})

test('the Stream Deck + XL pages use real presets, actions and feedbacks', async () => {
	const { buildPage, PAGE_FILES } = await import('../scripts/pages.js')
	const A = actions(self),
		F = feedbacks(self)
	for (const file of PAGE_FILES) {
		const page = buildPage(file)
		assert.equal(page.version, 7)
		assert.equal(page.type, 'page')
		let keys = 0
		for (const [row, cols] of Object.entries(page.page.controls))
			for (const [col, c] of Object.entries(cols)) {
				assert.ok(+row <= 5 && +col <= 8, `${file}: ${row}/${col} is on the deck`)
				if (c.type !== 'button') continue
				keys++
				for (const set of Object.values(c.steps[0].action_sets))
					for (const a of set) assert.ok(A[a.definitionId], `${file}: action ${a.definitionId}`)
				for (const f of c.feedbacks) assert.ok(F[f.definitionId], `${file}: feedback ${f.definitionId}`)
				if (+row === 5) assert.equal(c.options.rotaryActions, true, `${file}: dial ${col} turns`)
				assert.equal(c.style.show_topbar, false, `${file}: ${row}/${col} has no top bar`)
				if (+row === 4) assert.ok(page.page.controls[5][col], `${file}: strip cell ${col} is over a dial`)
				if (+row === 4) assert.equal(c.steps[0].action_sets.down.length, 0, `${file}: touching the strip does nothing`)
			}
		assert.ok(keys >= 20, `${file}: ${keys} keys`)
	}
})
