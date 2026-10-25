/* global document -- page.evaluate callbacks run in the browser */
// Draws the key faces (the VenuCable design's line icon with its label underneath, in Barlow) to
// PNG and writes src/icons.js. The label is part of the picture, not Companion text, so it never
// gets clipped or broken mid-word, whatever the deck. Run after changing an icon: node scripts/icons.js (uses Playwright's Chromium
// from the app's node_modules). The PNGs are 144 px so they stay sharp on the bigger decks;
// Companion scales them to the key. The icon sits in the top half, the key's text below it.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'

const WHITE = '#eef0fa'
const ICONS = {
	select: ['<path d="M6 3l13 7-6 1.8L10 18z"/>'],
	cable: ['<path d="M5 17c4 0 4-10 7-10s3 10 7 10"/><circle cx="4" cy="17" r="2"/><circle cx="20" cy="17" r="2"/>'],
	measure: ['<rect x="2.5" y="8" width="19" height="8" rx="1.5"/><path d="M6.5 8v3M10.5 8v4M14.5 8v3M18.5 8v4"/>'],
	route: ['<path d="M4 19h5V9h6V5h5"/><circle cx="4" cy="19" r="1.6"/><circle cx="20" cy="5" r="1.6"/>'],
	finish: ['<path d="M5 12.5l4.5 4.5L19 7.5"/>'],
	undo: ['<path d="M9 13L4 8l5-5"/><path d="M4 8h10a6 6 0 010 12h-3"/>'],
	redo: ['<path d="M15 13l5-5-5-5"/><path d="M20 8H10a6 6 0 000 12h3"/>'],
	duplicate: [
		'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3"/>',
	],
	turn_r: ['<path d="M20 12a8 8 0 11-2.3-5.6"/><path d="M20 3.5V9h-5.5"/>'],
	turn_l: ['<path d="M4 12a8 8 0 102.3-5.6"/><path d="M4 3.5V9h5.5"/>'],
	delete: ['<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', '#f87171'],
	lock: ['<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'],
	save: ['<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>'],
	fit: ['<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'],
	zoom_in: ['<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.5-4.5M10.5 7.5v6M7.5 10.5h6"/>'],
	zoom_out: ['<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.5-4.5M7.5 10.5h6"/>'],
	area: ['<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'],
	view: [
		'<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><path d="M17 13.5l1 2.2 2.4.3-1.8 1.6.5 2.4-2.1-1.2-2.1 1.2.5-2.4-1.8-1.6 2.4-.3z"/>',
	],
	checks: ['<path d="M5 12.5l4.5 4.5L19 7.5"/>', '#062016', 3],
	prev: ['<path d="M15 5l-7 7 7 7"/>'],
	next: ['<path d="M9 5l7 7-7 7"/>'],
	go: ['<path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor"/>', '#052e14'],
	back: ['<path d="M18 5l-10 7 10 7z"/><path d="M5.5 5v14"/>'],
	live: ['<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>'],
	plan: ['<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'],
	hold: ['<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'],
	link: [
		'<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
	],
	blank: ['<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4M4 3l16 14"/>'],
}

// Each key face: [icon, label, icon colour, label colour]. "_on" faces are for the lit state
// (violet behind), "_dark" ones for amber or green behind.
const DIM = '#9aa1c4'
const DARK = '#1a1203'
const KEYS = {
	select: ['select', 'Select'],
	select_on: ['select', 'Select', WHITE, WHITE],
	cable: ['cable', 'Cable'],
	cable_on: ['cable', 'Cable', WHITE, WHITE],
	measure: ['measure', 'Measure'],
	measure_on: ['measure', 'Measure', WHITE, WHITE],
	route: ['route', 'Route'],
	route_on: ['route', 'Route', WHITE, WHITE],
	finish: ['finish', 'Finish'],
	undo: ['undo', 'Undo'],
	redo: ['redo', 'Redo'],
	duplicate: ['duplicate', 'Copy'],
	rot_l: ['turn_l', '−15°'],
	rot_r: ['turn_r', '+15°'],
	rot_90: ['turn_r', '90°'],
	delete: ['delete', 'Delete', '#f87171', '#f87171'],
	lock: ['lock', 'Lock'],
	lock_on: ['lock', 'Locked', WHITE, WHITE],
	save: ['save', 'Save'],
	save_dark: ['save', 'Save', DARK, DARK],
	fit: ['fit', 'Fit'],
	zoom_in: ['zoom_in', 'Zoom in'],
	zoom_out: ['zoom_out', 'Zoom out'],
	area: ['area', 'Area'],
	view_all: ['view', 'All kit', WHITE, WHITE],
	view_mine: ['view', 'My kit', WHITE, WHITE],
	prev: ['prev', ''],
	next: ['next', ''],
	go: ['go', 'GO', '#052e14', '#052e14'],
	back: ['back', 'Back'],
	live: ['live', 'Live'],
	plan: ['plan', 'Plan'],
	hold: ['hold', 'Hold'],
	resume: ['go', 'Resume', DARK, DARK],
	blank: ['blank', 'Blank'],
	blank_on: ['blank', 'Blank', WHITE, WHITE],
	linked: ['link', 'Linked', '#34d399', '#34d399'],
	offline: ['link', 'Offline', '#3c4050', '#5c6178'],
}

const font = (w) =>
	`@font-face{font-family:Barlow;font-weight:${w};src:url(data:font/woff2;base64,${readFileSync(new URL(`../../fonts/Barlow-${w}.woff2`, import.meta.url)).toString('base64')})}`

const browser = await chromium
	.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' })
	.catch(() => chromium.launch())
const page = await browser.newPage({ viewport: { width: 144, height: 144 } })
const out = {}
for (const [id, [icon, label, color = WHITE, labelColor = DIM]] of Object.entries(KEYS)) {
	const [paths, , width = 2.2] = ICONS[icon]
	// With no label the icon is bigger and centred (◀ ▶).
	const g = label ? 'translate(44 12) scale(2.33)' : 'translate(28 28) scale(3.67)'
	await page.setContent(
		`<style>${font(700)}body{margin:0;background:transparent}div{position:absolute;left:4px;right:4px;top:90px;height:44px;display:flex;align-items:center;justify-content:center;font:700 30px/1 Barlow;letter-spacing:.03em;text-transform:uppercase;white-space:nowrap;color:${labelColor}}</style>` +
			`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" style="position:absolute;color:${color}"><g transform="${g}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>` +
			(label ? `<div><span>${label}</span></div>` : ''),
	)
	await page.evaluate(() => document.fonts.ready)
	// Shrink the label until it fits inside the key's bezel (it hides a few pixels at each edge).
	await page.evaluate(() => {
		const d = document.querySelector('div')
		if (!d) return
		let size = 30
		while (d.firstChild.getBoundingClientRect().width > 108 && size > 14) d.style.fontSize = `${--size}px`
	})
	out[id] = (await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: 144, height: 144 } })).toString(
		'base64',
	)
}
await browser.close()
writeFileSync(
	new URL('../src/icons.js', import.meta.url),
	'// Generated by scripts/icons.js - key faces (icon + label) as base64 PNG (144 px), for presets.\n' +
		'export const ICONS = {\n' +
		Object.entries(out)
			.map(([k, v]) => `\t${k}: '${v}',`)
			.join('\n') +
		'\n}\n',
)
console.log(Object.keys(out).length, 'key faces')
