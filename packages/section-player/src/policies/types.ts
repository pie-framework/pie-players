import type { SectionPlayerReadinessChangeDetail } from "../contracts/public-events.js";

export type SectionPlayerReadinessPolicy = {
	mode: "progressive" | "strict";
};

export type SectionPlayerPreloadPolicy = {
	enabled: boolean;
};

/**
 * Strategy the section player uses to move focus after every navigation event
 * (Next / Back / navigateTo) and when the host calls `focusStart()` on the
 * layout element (Skip-to-Main).
 *
 * - `"start-of-content"` (default): focus the passage card when present,
 *   else the first item card. Matches assessment UX where Skip-to-Main and
 *   navigation land in the same place. Best for one-item-per-page layouts.
 * - `"current-item"`: focus the newly-active item card (queried as
 *   `pie-section-player-item-card[is-current]`). Best for stacked/list
 *   layouts where multiple items are visible at once.
 * - `"none"`: framework never moves focus on navigation; the host owns it
 *   entirely. `focusStart()` still moves focus (defaults to
 *   start-of-content) because hosts only call it when they want focus
 *   to move.
 */
export type SectionPlayerAutoFocusStrategy =
	| "none"
	| "start-of-content"
	| "current-item";

export type SectionPlayerFocusPolicy = {
	autoFocus: SectionPlayerAutoFocusStrategy;
};

export type SectionPlayerTelemetryPolicy = {
	enabled: boolean;
};

export type SectionPlayerPolicies = {
	readiness: SectionPlayerReadinessPolicy;
	preload: SectionPlayerPreloadPolicy;
	focus: SectionPlayerFocusPolicy;
	telemetry: SectionPlayerTelemetryPolicy;
};

export interface ReadinessPolicyAdapter {
	computeFinalReady(detail: SectionPlayerReadinessChangeDetail): boolean;
}
