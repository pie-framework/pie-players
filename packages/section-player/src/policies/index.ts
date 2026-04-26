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

let deprecationWarned = false;

/**
 * Resolve the auto-focus strategy from a focus policy input, honoring the
 * deprecated `autoFocusFirstItem` boolean when present. Presence is detected
 * via `"autoFocusFirstItem" in policy` so that explicit `false` wins over the
 * default, mirroring how callers historically toggled the old flag.
 */
export function resolveAutoFocusStrategy(
	policy: SectionPlayerFocusPolicy | null | undefined,
): SectionPlayerAutoFocusStrategy {
	if (!policy) return DEFAULT_FOCUS_POLICY.autoFocus;
	if ("autoFocusFirstItem" in policy && policy.autoFocusFirstItem !== undefined) {
		if (!deprecationWarned && typeof console !== "undefined") {
			deprecationWarned = true;
			console.warn(
				"[pie-section-player] SectionPlayerFocusPolicy.autoFocusFirstItem is " +
					"deprecated; use autoFocus: 'start-of-content' | 'current-item' | 'none' instead.",
			);
		}
		return policy.autoFocusFirstItem ? "start-of-content" : "none";
	}
	return policy.autoFocus ?? DEFAULT_FOCUS_POLICY.autoFocus;
}
