export type RuntimeSupportStrategy = "iife" | "esm" | "preloaded";
export type RuntimeSupportCheckMode = "off" | "on";

export function shouldProbeRuntimeSupport(
	strategy: RuntimeSupportStrategy,
	mode: RuntimeSupportCheckMode,
): boolean {
	if (strategy === "iife") {
		return false;
	}
	return mode === "on";
}
