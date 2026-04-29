import {
	STAGES,
	applicableStages,
	stageOrdinal,
	type Stage,
	type StageChangeDetail,
	type StageSourceCe,
	type StageStatus,
} from "./stages.js";

/**
 * Stage tracker primitive (M6).
 *
 * One tracker per CE instance per cohort. `enter(stage, status?)` is the
 * only mutation; `reset()` rolls the cohort over (e.g. when
 * `(sectionId, attemptId)` changes).
 *
 * The tracker enforces the locked invariants from
 * `m6_ready_vocab_canonical_followup.plan.md` §3.1–§3.6:
 * - Monotonic ordering across `STAGES`. Backward transitions inside one
 *   cohort are rejected (dev) / warned-once (prod) so subscribers never
 *   see a stage regress without an intervening `reset()`.
 * - Per-CE applicability. The post-retro canonical list applies to
 *   every CE shape; the `applicableStages` indirection is kept so a
 *   future shape-specific stage can opt out without rewriting callers.
 *   Non-applicable stages auto-emit `status: "skipped"` when an
 *   applicable later stage is entered, so iteration order stays stable
 *   across CE shapes.
 * - One source for every emit. The injected `emit(detail)` function
 *   drives DOM events, engine subscribers, and coordinator subscribers
 *   from the same call site so no surface drifts.
 *
 * Failure semantics intentionally piggyback on the M3 framework-error
 * contract: `enter(stage, "failed")` records the position; the
 * framework error records the cause.
 */

export type CreateStageTrackerOptions = {
	sourceCe: string;
	sourceCeShape: StageSourceCe;
	runtimeId: string;
	sectionId?: string;
	attemptId?: string;
	emit: (detail: StageChangeDetail) => void;
	now?: () => string;
	onUnexpectedTransition?: (info: {
		from: Stage | null;
		to: Stage;
		reason: "backward" | "duplicate";
	}) => void;
};

export type StageTracker = {
	enter: (stage: Stage, status?: StageStatus) => void;
	reset: (next?: { sectionId?: string; attemptId?: string }) => void;
	getCurrent: () => Stage | null;
};

let unexpectedTransitionWarned = false;

function defaultUnexpectedTransitionLogger(info: {
	from: Stage | null;
	to: Stage;
	reason: "backward" | "duplicate";
}): void {
	if (unexpectedTransitionWarned) return;
	unexpectedTransitionWarned = true;
	if (typeof console !== "undefined" && console.warn) {
		console.warn(
			`[pie-stage-tracker] Unexpected ${info.reason} stage transition ` +
				`from \`${info.from ?? "<none>"}\` to \`${info.to}\`. ` +
				`Stage transitions are expected to be monotonic within a cohort; ` +
				`call \`reset()\` when \`(sectionId, attemptId)\` changes.`,
		);
	}
}

export function createStageTracker(opts: CreateStageTrackerOptions): StageTracker {
	const applicable = applicableStages(opts.sourceCeShape);
	const applicableSet = new Set(applicable);
	const now = opts.now ?? (() => new Date().toISOString());
	const onUnexpected =
		opts.onUnexpectedTransition ?? defaultUnexpectedTransitionLogger;

	let current: Stage | null = null;
	let sectionId = opts.sectionId;
	let attemptId = opts.attemptId;
	const emitted = new Set<Stage>();

	function emitDetail(stage: Stage, status: StageStatus): void {
		opts.emit({
			stage,
			status,
			runtimeId: opts.runtimeId,
			sectionId,
			attemptId,
			timestamp: now(),
			sourceCe: opts.sourceCe,
		});
	}

	function fillSkippedBefore(stage: Stage): void {
		const targetIdx = stageOrdinal(stage);
		const startIdx = current === null ? 0 : stageOrdinal(current) + 1;
		for (let idx = startIdx; idx < targetIdx; idx += 1) {
			const skipCandidate = STAGES[idx];
			if (applicableSet.has(skipCandidate)) continue;
			if (emitted.has(skipCandidate)) continue;
			emitted.add(skipCandidate);
			emitDetail(skipCandidate, "skipped");
		}
	}

	function enter(stage: Stage, status: StageStatus = "entered"): void {
		const nextOrdinal = stageOrdinal(stage);
		const currentOrdinal = current === null ? -1 : stageOrdinal(current);

		if (status === "entered") {
			if (emitted.has(stage)) {
				onUnexpected({ from: current, to: stage, reason: "duplicate" });
				return;
			}
			if (nextOrdinal < currentOrdinal) {
				onUnexpected({ from: current, to: stage, reason: "backward" });
				return;
			}
			if (!applicableSet.has(stage)) {
				// A non-applicable stage entered with `entered` is a programming
				// error: the tracker auto-skips it when a later stage enters.
				// Treat it as a `skipped` emission and continue.
				if (emitted.has(stage)) return;
				emitted.add(stage);
				emitDetail(stage, "skipped");
				return;
			}
			fillSkippedBefore(stage);
			emitted.add(stage);
			current = stage;
			emitDetail(stage, "entered");
			return;
		}

		// `status === "failed"` records position; do not gate on monotonic
		// ordering — failure can happen during any transition. Mark the stage
		// as emitted so a subsequent `entered` for the same stage warns as a
		// duplicate; downstream recovery should call `reset()` first.
		if (status === "failed") {
			fillSkippedBefore(stage);
			emitted.add(stage);
			current = stage;
			emitDetail(stage, "failed");
			return;
		}

		// `status === "skipped"` is reserved for the auto-fill path; explicit
		// callers shouldn't pass it. Accept it idempotently for robustness.
		if (emitted.has(stage)) return;
		emitted.add(stage);
		emitDetail(stage, "skipped");
	}

	function reset(next?: { sectionId?: string; attemptId?: string }): void {
		current = null;
		emitted.clear();
		if (next) {
			sectionId = next.sectionId;
			attemptId = next.attemptId;
		}
	}

	function getCurrent(): Stage | null {
		return current;
	}

	return { enter, reset, getCurrent };
}
