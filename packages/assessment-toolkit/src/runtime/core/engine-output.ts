/**
 * Section runtime engine outputs (M7 — Variant C, layered core).
 *
 * Outputs are the closed discriminated union of effects the transition
 * function returns. The adapter (PR 2) takes the output array, walks
 * it in order, and dispatches each one to the right bridge (DOM
 * events, legacy events, framework-error bus, subscriber fan-out).
 *
 * Outputs carry only plain data so the transition table can be tested
 * exhaustively without any DOM or coordinator wiring.
 *
 * Adjustment A2 from the M7 implementation plan: `loading-complete`
 * is an output, **not** an FSM phase. The transition emits it from
 * the `interactive` phase when the readiness signals indicate every
 * item has finished loading. This mirrors today's
 * `pie-loading-complete` DOM event semantics.
 */

import type { Stage, StageStatus } from "@pie-players/pie-players-shared/pie";
import type { CohortKey } from "./cohort.js";
import type { EngineReadinessDetail } from "./engine-readiness.js";
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
 * Readiness snapshot. Mirrors the legacy `readiness-change` DOM event.
 * Emitted whenever the readiness signals or strict-mode gate produce a
 * different `EngineReadinessDetail` than the previously emitted one.
 */
export type EngineOutputReadinessChange = {
	kind: "readiness-change";
	detail: EngineReadinessDetail;
};

/**
 * Legacy `interaction-ready` emit. One-shot per cohort: fires when
 * `interactionReady` first becomes `true` for the cohort. Mirrors the
 * deprecated DOM event of the same name.
 */
export type EngineOutputInteractionReady = {
	kind: "interaction-ready";
	detail: EngineReadinessDetail;
};

/**
 * Legacy `ready` emit. One-shot per cohort: fires when
 * `allLoadingComplete` first becomes `true` for the cohort. Mirrors
 * the deprecated DOM event of the same name.
 */
export type EngineOutputReady = {
	kind: "ready";
	detail: EngineReadinessDetail;
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
	| EngineOutputReadinessChange
	| EngineOutputInteractionReady
	| EngineOutputReady
	| EngineOutputLoadingComplete
	| EngineOutputFrameworkError;
