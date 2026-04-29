/**
 * Stable runtime-instance id generator.
 *
 * Produces a per-runtime id used to scope DOM attribute names and
 * telemetry tags. Single export by design — not a "guards" module.
 */
export function createRuntimeId(prefix = "runtime"): string {
	return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}
