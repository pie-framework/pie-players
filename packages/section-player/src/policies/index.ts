import type { SectionPlayerPolicies } from "./types.js";

export const DEFAULT_SECTION_PLAYER_POLICIES: SectionPlayerPolicies = {
	readiness: { mode: "progressive" },
	preload: { enabled: true },
	focus: { autoFocusFirstItem: false },
	telemetry: { enabled: true },
};
