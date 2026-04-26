/**
 * Canonical stage vocabulary (M6 of the Coherent Options Surface track).
 *
 * One monotonic stage list is the unified replacement for today's drift of
 * `toolkit-ready`, `section-ready`, `section-controller-ready`,
 * `interaction-ready`, `readiness-change`, and `ready`. Hosts ask the same
 * question — "is this CE at stage ≥ X?" — across every `<pie-section-player-*>`
 * and `<pie-assessment-toolkit>` element.
 *
 * The four-stage canonical list (`composed`, `engine-ready`, `interactive`,
 * `disposed`) was finalized after the M5/M6 cumulative review confirmed
 * zero internal or external consumers for the original `attached`,
 * `runtime-bound`, and `ui-rendered` stages. The retro keeps the same
 * shape for both the toolkit CE and the layout CEs — every CE iterates
 * through the same list so subscribers don't need to special-case shape.
 *
 * Locked decisions (see `m6_ready_vocab_canonical_followup.plan.md`):
 * - **A1** Stage machine model with one canonical event family.
 * - **B1** "All items loaded" is reclassified as `pie-loading-complete`,
 *   not a stage. The legacy `ready` DOM event keeps firing as a deprecated
 *   alias.
 * - **C1** `readiness.mode = "strict"` only delays the `interactive`
 *   transition; every earlier stage fires identically across modes.
 * - **D1** One DOM event family `pie-stage-change` with the stage in the
 *   payload, mirroring the M3 `framework-error` idiom.
 *
 * Failure semantics deliberately stay in the M3 framework-error contract —
 * `status: "failed"` records the position; the framework error records the
 * cause.
 */

export const STAGES = Object.freeze([
	"composed",
	"engine-ready",
	"interactive",
	"disposed",
] as const);

export type Stage = (typeof STAGES)[number];

export type StageStatus = "entered" | "skipped" | "failed";

/**
 * Subset of the source CE shape used by stage subscribers. Both shapes
 * apply every canonical stage post-retro — the distinction stays in the
 * type so future shape-specific stages (e.g. layout-only `paginated`) can
 * be added without churn at the call sites.
 */
export type StageSourceCe = "toolkit" | "layout";

/**
 * Stages that apply to a given CE shape. Post-retro the toolkit and the
 * layout CEs share the same canonical list; `applicableStages` is kept as
 * an indirection so the tracker, telemetry, and tests don't have to be
 * rewritten when a future stage diverges between shapes.
 */
export function applicableStages(_sourceCe: StageSourceCe): readonly Stage[] {
	return STAGES;
}

/**
 * Strict ordering index used by the tracker to detect monotonic
 * violations. `disposed` is last; `composed` is first.
 */
export function stageOrdinal(stage: Stage): number {
	const idx = STAGES.indexOf(stage);
	if (idx === -1) {
		throw new Error(`Unknown stage \`${stage}\``);
	}
	return idx;
}

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
	loadedCount: number;
	timestamp: string;
	sourceCe: string;
};
