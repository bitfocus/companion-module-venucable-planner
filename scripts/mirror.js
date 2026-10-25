// Copies the module into a checkout of bitfocus/companion-module-venucable-planner, the public
// repository Bitfocus builds and publishes from. This folder (VenuCable/app/companion-module)
// stays the one to work in; the Bitfocus repository gets a copy for each release:
//
//   node scripts/mirror.js ../../companion-module-venucable-planner
//   (then commit there, push, and publish a GitHub release tagged vX.Y.Z)
//
// VenuCable-only files stay behind: the handover notes, and the built package and ready-made
// pages (release/, which the VenuCable app serves; ignored there).
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const target = process.argv[2]
if (!target || !existsSync(path.join(target, '.git'))) {
	console.error('Usage: node scripts/mirror.js <checkout of bitfocus/companion-module-venucable-planner>')
	process.exit(1)
}

const COPY = [
	'.github',
	'.gitattributes',
	'.gitignore',
	'.prettierignore',
	'.yarnrc.yml',
	'LICENSE',
	'README.md',
	'companion',
	'eslint.config.mjs',
	'scripts',
	'src',
	'test',
	'yarn.lock',
]

// Everything else in the target (the template's files) goes, apart from git itself.
for (const f of readdirSync(target))
	if (f !== '.git' && !COPY.includes(f) && f !== 'package.json')
		rmSync(path.join(target, f), { recursive: true, force: true })
for (const f of COPY) {
	rmSync(path.join(target, f), { recursive: true, force: true })
	cpSync(path.join(here, f), path.join(target, f), { recursive: true })
}

cpSync(path.join(here, 'package.json'), path.join(target, 'package.json'))
// release/ is committed here (the VenuCable app serves it); there it's only a build output.
writeFileSync(path.join(target, '.gitignore'), readFileSync(path.join(here, '.gitignore'), 'utf8') + '/release\n')
const pkg = JSON.parse(readFileSync(path.join(here, 'package.json'), 'utf8'))
console.log(`Copied v${pkg.version} to ${target}`)
