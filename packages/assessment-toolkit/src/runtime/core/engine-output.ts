/**
 * Section runtime engine outputs.
 *
 * Outputs are the closed union of effects the transition function returns. The
 * adapter walks each batch in order and hands it to the DOM-event bridge and the
 * subscriber fan-out. Outputs carry only plain data, so the transition table is
 * testable without DOM or coordinator wiring.
 *
 * Framework errors are not an output. The toolkit that owns the coordinator
 * publishes each one once, as its `framework-error` event and `onFrameworkError`
 * hook; the engine sees an error only through the readiness signals, and a
 * fatal one before `interactive` ends the cohort's stage chain as `failed`.
 */

import type { Stage, StageStatus } from "@pie-players/pie-players-shared/pie";
import type { CohortKey } from "./cohort.js";

/**
 * Stage transition. The adapter dispatches it as `pie-stage-change` with the
 * canonical detail. The status says whether the stage was entered, skipped, or
 * recorded as failed.
 */
export type EngineOutputStageChange = {
	kind: "stage-change";
	stage: Stage;
	status: StageStatus;
	cohort: CohortKey | null;
};

/**
 * Canonical `pie-loading-complete`. One-shot per cohort, emitted when the
 * readiness signals satisfy `allLoadingComplete`.
 */
export type EngineOutputLoadingComplete = {
	kind: "loading-complete";
	cohort: CohortKey;
	itemCount: number;
	loadedCount: number;
};

export type SectionEngineOutput =
	| EngineOutputStageChange
	| EngineOutputLoadingComplete;
