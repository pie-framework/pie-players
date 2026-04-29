import type {
	SectionPlayerAutoFocusStrategy,
	SectionPlayerFocusPolicy,
	SectionPlayerPolicies,
} from "./types.js";

export const DEFAULT_FOCUS_POLICY: SectionPlayerFocusPolicy = {
	autoFocus: "start-of-content",
};

export const DEFAULT_SECTION_PLAYER_POLICIES: SectionPlayerPolicies = {
	readiness: { mode: "progressive" },
	preload: { enabled: true },
	focus: DEFAULT_FOCUS_POLICY,
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

/**
 * Resolve the auto-focus strategy from a focus policy input, falling back to
 * the package default (`"start-of-content"`) when the policy is unset or
 * leaves `autoFocus` undefined.
 */
export function resolveAutoFocusStrategy(
	policy: SectionPlayerFocusPolicy | null | undefined,
): SectionPlayerAutoFocusStrategy {
	if (!policy) return DEFAULT_FOCUS_POLICY.autoFocus;
	return policy.autoFocus ?? DEFAULT_FOCUS_POLICY.autoFocus;
}
