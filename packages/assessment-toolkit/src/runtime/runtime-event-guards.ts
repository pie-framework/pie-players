export function createRuntimeId(prefix = "runtime"): string {
	return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

export function shouldHandleBySourceRuntime(
	sourceRuntimeId: string | undefined,
	currentRuntimeId: string,
): boolean {
	if (!sourceRuntimeId) return true;
	return sourceRuntimeId !== currentRuntimeId;
}
