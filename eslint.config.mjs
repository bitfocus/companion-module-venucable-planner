import { generateEslintConfig } from '@companion-module/tools/eslint/config.mjs'

const base = await generateEslintConfig({
	ignores: ['release/**', 'pkg/**'],
})

// The module is ESM ("type": "module"); the shared config assumes CommonJS for .js
export default [
	...base,
	{ files: ['**/*.js'], languageOptions: { sourceType: 'module' } },
	{
		// The test harness stubs the SDK through Node's loader hooks
		files: ['test/**/*.js'],
		rules: { 'n/no-unsupported-features/node-builtins': 'off', 'n/no-unpublished-import': 'off' },
	},
	{
		// Dev scripts, run by hand with the developer's own Node (not part of the module): icons.js
		// draws the key faces with Playwright from the app's checkout, which isn't one of the
		// module's own dependencies (and may not be installed at all); mirror.js copies the module.
		files: ['scripts/**/*.js'],
		rules: {
			'n/no-extraneous-import': 'off',
			'n/no-missing-import': 'off',
			'n/no-unpublished-import': 'off',
			'n/no-process-exit': 'off',
			'n/no-unsupported-features/node-builtins': 'off',
		},
	},
]
