import type { SectionPlayerPolicies } from "./types.js";

export type {
	SectionPlayerPolicies,
	SectionPlayerPreloadPolicy,
	SectionPlayerReadinessPolicy,
	SectionPlayerTelemetryPolicy,
} from "./types.js";

export const DEFAULT_SECTION_PLAYER_POLICIES: SectionPlayerPolicies = {
	readiness: { mode: "progressive" },
	preload: { enabled: true },
	telemetry: { enabled: true },
};

/**
 * The complete policy set a layout runs under: each field the host leaves
 * unset, including a whole missing section of a partial object, takes its
 * value from `DEFAULT_SECTION_PLAYER_POLICIES`.
 */
export function resolveSectionPlayerPolicies(
	policies: Partial<SectionPlayerPolicies> | null | undefined,
): SectionPlayerPolicies {
	const mode = policies?.readiness?.mode;
	return {
		readiness: {
			mode:
				mode === "strict" || mode === "progressive"
					? mode
					: DEFAULT_SECTION_PLAYER_POLICIES.readiness.mode,
		},
		preload: { enabled: policies?.preload?.enabled !== false },
		telemetry: { enabled: policies?.telemetry?.enabled !== false },
	};
}
