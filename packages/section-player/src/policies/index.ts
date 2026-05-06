import type { SectionPlayerPolicies } from "./types.js";

export const DEFAULT_SECTION_PLAYER_POLICIES: SectionPlayerPolicies = {
	readiness: { mode: "progressive" },
	preload: { enabled: true },
	telemetry: { enabled: true },
};

/**
 * Whether the section-level element preload pipeline should run. Defaults to
 * `true` when the policy is unset or partially set so existing hosts are
 * unaffected. Hosts opt out by passing `policies.preload.enabled === false`,
 * which short-circuits `warmupSectionElements` in `SectionItemsPane`. Items
 * still mount and item-players register their own elements on demand.
 */
export function isPreloadEnabled(
	policies: SectionPlayerPolicies | null | undefined,
): boolean {
	return policies?.preload?.enabled !== false;
}

/**
 * Whether the section-player layout elements should attach the
 * instrumentation event bridge. Defaults to `true` when the policy is unset
 * or partially set. Hosts opt out by passing
 * `policies.telemetry.enabled === false`, which skips
 * `attachInstrumentationEventBridge` setup entirely. Hosts that want a
 * different shape of opt-out can still supply a custom
 * `instrumentationProvider`.
 */
export function isTelemetryEnabled(
	policies: SectionPlayerPolicies | null | undefined,
): boolean {
	return policies?.telemetry?.enabled !== false;
}
