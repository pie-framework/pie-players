/**
 * Canonical stage vocabulary (M6 of the Coherent Options Surface track).
 *
 * One monotonic stage list is the unified replacement for today's drift of
 * `toolkit-ready`, `section-ready`, `section-controller-ready`,
 * `interaction-ready`, `readiness-change`, and `ready`. Hosts ask the same
 * question — "is this CE at stage ≥ X?" — across every `<pie-section-player-*>`
 * and `<pie-assessment-toolkit>` element.
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
	"attached",
	"composed",
	"runtime-bound",
	"engine-ready",
	"ui-rendered",
	"interactive",
	"disposed",
] as const);

export type Stage = (typeof STAGES)[number];

export type StageStatus = "entered" | "skipped" | "failed";

/**
 * Subset of the source CE shape used by stage subscribers. The toolkit has
 * no UI of its own, so it skips `ui-rendered`; layout CEs render frames and
 * apply every stage.
 */
export type StageSourceCe = "toolkit" | "layout";

const TOOLKIT_STAGES: readonly Stage[] = Object.freeze([
	"attached",
	"composed",
	"runtime-bound",
	"engine-ready",
	"interactive",
	"disposed",
]);

const LAYOUT_STAGES: readonly Stage[] = STAGES;

/**
 * Stages that apply to a given CE shape. Subscribers use the returned
 * order to verify a coherent iteration through the canonical list per
 * cohort; the tracker emits `status: "skipped"` for stages a CE does
 * not apply (today: only `ui-rendered` on the toolkit) so iteration
 * order stays stable.
 */
export function applicableStages(sourceCe: StageSourceCe): readonly Stage[] {
	return sourceCe === "toolkit" ? TOOLKIT_STAGES : LAYOUT_STAGES;
}

/**
 * Strict ordering index used by the tracker to detect monotonic
 * violations. `disposed` is last; `attached` is first.
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
