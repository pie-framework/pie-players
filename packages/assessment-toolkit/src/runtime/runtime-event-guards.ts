export function createRuntimeId(prefix = "runtime"): string {
	return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}
