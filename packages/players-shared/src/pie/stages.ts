/**
 * Stage vocabulary of the section player's `pie-stage-change` event.
 *
 * A cohort (one section and attempt) moves through `composed`,
 * `engine-ready`, `interactive` and `disposed`, in that order. The section
 * runtime engine in `@pie-players/pie-assessment-toolkit` is the only emitter;
 * it dispatches the event on the layout element. `pie-loading-complete`
 * reports that every item loaded and is not a stage. `readiness.mode =
 * "strict"` only delays `interactive`.
 *
 * `status` is `entered`, or `failed` for the stage a non-recoverable
 * framework error stopped the chain at, with `skipped` for each later stage
 * up to `interactive`. The `framework-error` event carries the cause.
 */

export const STAGES = Object.freeze([
	"composed",
	"engine-ready",
	"interactive",
	"disposed",
] as const);

export type Stage = (typeof STAGES)[number];

export type StageStatus = "entered" | "skipped" | "failed";

export type StageChangeDetail = {
	stage: Stage;
	status: StageStatus;
	/** Matches the existing `runtimeId` carried by toolkit telemetry. */
	runtimeId: string;
	sectionId?: string;
	attemptId?: string;
	/** ISO-8601, monotonic across one cohort. */
	timestamp: string;
	/** Tag name minus the `--version-<encoded>` suffix. */
	sourceCe: string;
};

export type LoadingCompleteDetail = {
	runtimeId: string;
	sectionId: string;
	attemptId?: string;
	itemCount: number;
	/** Equals `itemCount`: the event fires once every item has loaded. */
	loadedCount: number;
	timestamp: string;
	sourceCe: string;
};
