export async function resolve(spec, ctx, next) {
	if (spec === '@companion-module/base')
		return { url: new URL('./stub-base.js', import.meta.url).href, shortCircuit: true }
	return next(spec, ctx)
}
