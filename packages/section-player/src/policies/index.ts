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
