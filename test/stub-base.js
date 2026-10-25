// A stand-in for @companion-module/base, recording what the module tells Companion.
import * as real from '../node_modules/@companion-module/base/dist/index.js'
export const { InstanceStatus, combineRgb } = real
export class InstanceBase {
	constructor() {
		this.calls = { status: [], vars: {}, checked: 0, logs: [] }
	}
	get label() {
		return 'venucable'
	}
	setActionDefinitions(d) {
		this.actionDefs = d
	}
	setFeedbackDefinitions(d) {
		this.feedbackDefs = d
	}
	setVariableDefinitions(d) {
		this.variableDefs = d
	}
	setPresetDefinitions(d) {
		this.presetDefs = d
	}
	setVariableValues(v) {
		Object.assign(this.calls.vars, v)
	}
	checkFeedbacks() {
		this.calls.checked++
	}
	updateStatus(s, m) {
		this.calls.status.push([s, m ?? null])
	}
	log(level, msg) {
		this.calls.logs.push([level, msg])
	}
}
export function runEntrypoint(Cls) {
	globalThis.__instance = new Cls()
}
