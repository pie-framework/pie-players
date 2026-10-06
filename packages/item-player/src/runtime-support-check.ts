export type RuntimeSupportStrategy = "iife" | "esm" | "preloaded";
export type RuntimeSupportCheckMode = "off" | "on";

/**
 * Runtime-support metadata describes the ESM builds a package publishes, so
 * only the esm strategy probes it. The iife strategy loads bundles the PIE
 * build service assembles, and the preloaded strategy loads nothing.
 */
export function shouldProbeRuntimeSupport(
	strategy: RuntimeSupportStrategy,
	mode: RuntimeSupportCheckMode,
): boolean {
	return strategy === "esm" && mode === "on";
}
