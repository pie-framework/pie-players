/**
 * Section runtime engine outputs (M7 — Variant C, layered core).
 *
 * Outputs are the closed discriminated union of effects the transition
 * function returns. The adapter (PR 2) takes the output array, walks
 * it in order, and dispatches each one to the right bridge (DOM
 * events, framework-error bus, subscriber fan-out).
 *
 * Outputs carry only plain data so the transition table can be tested
 * exhaustively without any DOM or coordinator wiring.
 *
 * Adjustment A2 from the M7 implementation plan: `loading-complete`
 * is an output, **not** an FSM phase. The transition emits it from
 * the `interactive` phase when the readiness signals indicate every
 * item has finished loading. This mirrors today's
 * `pie-loading-complete` DOM event semantics.
 *
 * The deprecated readiness output kinds (`readiness-change`,
 * `interaction-ready`, `ready`) were removed in the broad
 * architecture review compat sweep along with their DOM-event bridge
 * (`legacy-event-bridge.ts`). Stage and readiness changes now flow
 * through `stage-change` (with `EngineReadinessDetail` available via
 * `SectionEngineCore.getState()` / kernel `selectReadiness()`); the
 * "all items loaded" signal flows through `loading-complete` only.
 */

import type { Stage, StageStatus } from "@pie-players/pie-players-shared/pie";
import type { CohortKey } from "./cohort.js";
import type { FrameworkErrorModel } from "../../services/framework-error.js";

/**
 * Stage transition. The adapter dispatches a `pie-stage-change` DOM
 * event with the canonical detail and forwards to subscribers /
 * coordinator. The status indicates whether the stage was entered,
 * skipped, or recorded as failed.
 */
export type EngineOutputStageChange = {
	kind: "stage-change";
	stage: Stage;
	status: StageStatus;
	cohort: CohortKey | null;
};

/**
 * Canonical `pie-loading-complete` emit (M6 D1). One-shot per cohort.
 * Fires from the `interactive` phase when loaded == items count and
 * the readiness signals satisfy `allLoadingComplete`.
 */
export type EngineOutputLoadingComplete = {
	kind: "loading-complete";
	cohort: CohortKey;
	itemCount: number;
	loadedCount: number;
};

/**
 * Framework error fan-out. Mirrors the M3 `framework-error` DOM event
 * and the `subscribeFrameworkErrors` listener channel. Emitted on
 * every `framework-error` input.
 */
export type EngineOutputFrameworkError = {
	kind: "framework-error";
	error: FrameworkErrorModel;
};

export type SectionEngineOutput =
	| EngineOutputStageChange
	| EngineOutputLoadingComplete
	| EngineOutputFrameworkError;
