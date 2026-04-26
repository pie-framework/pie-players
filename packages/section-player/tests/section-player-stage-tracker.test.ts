import { describe, expect, mock, test } from "bun:test";

mock.module("@pie-players/pie-item-player", () => ({}));

async function loadStageTracker() {
	return import(
		"../src/components/shared/section-player-stage-tracker"
	);
}

const FROZEN_TIMES = [
	"2025-01-01T00:00:00.000Z",
	"2025-01-01T00:00:00.001Z",
	"2025-01-01T00:00:00.002Z",
	"2025-01-01T00:00:00.003Z",
	"2025-01-01T00:00:00.004Z",
	"2025-01-01T00:00:00.005Z",
	"2025-01-01T00:00:00.006Z",
];

function frozenClock(): () => string {
	let i = 0;
	return () => FROZEN_TIMES[Math.min(i++, FROZEN_TIMES.length - 1)];
}

type CapturedDetail = {
	stage: string;
	status: string;
	runtimeId: string;
	sectionId?: string;
	attemptId?: string;
	sourceCe: string;
	timestamp: string;
};

function makeEmit(): {
	emit: (detail: CapturedDetail) => void;
	captured: CapturedDetail[];
} {
	const captured: CapturedDetail[] = [];
	return {
		emit: (detail) => captured.push(detail),
		captured,
	};
}

describe("createStageTracker — layout CE shape", () => {
	test("emits every applicable stage in canonical order", async () => {
		const { createStageTracker } = await loadStageTracker();
		const { emit, captured } = makeEmit();
		const tracker = createStageTracker({
			sourceCe: "pie-section-player-splitpane",
			sourceCeShape: "layout",
			runtimeId: "rt-1",
			sectionId: "s-1",
			attemptId: "a-1",
			emit,
			now: frozenClock(),
		});

		tracker.enter("attached");
		tracker.enter("composed");
		tracker.enter("runtime-bound");
		tracker.enter("engine-ready");
		tracker.enter("ui-rendered");
		tracker.enter("interactive");
		tracker.enter("disposed");

		expect(captured.map((c) => `${c.stage}:${c.status}`)).toEqual([
			"attached:entered",
			"composed:entered",
			"runtime-bound:entered",
			"engine-ready:entered",
			"ui-rendered:entered",
			"interactive:entered",
			"disposed:entered",
		]);
		expect(captured[0].sectionId).toBe("s-1");
		expect(captured[0].attemptId).toBe("a-1");
	});

	test("rejects backward transitions without resetting", async () => {
		const { createStageTracker } = await loadStageTracker();
		const { emit, captured } = makeEmit();
		const onUnexpected = mock(() => {});
		const tracker = createStageTracker({
			sourceCe: "pie-section-player-splitpane",
			sourceCeShape: "layout",
			runtimeId: "rt-1",
			emit,
			now: frozenClock(),
			onUnexpectedTransition: onUnexpected,
		});

		tracker.enter("composed");
		tracker.enter("runtime-bound");
		tracker.enter("composed");

		expect(captured.map((c) => c.stage)).toEqual(["composed", "runtime-bound"]);
		expect(onUnexpected).toHaveBeenCalledTimes(1);
		expect(onUnexpected.mock.calls[0]?.[0]).toMatchObject({
			from: "runtime-bound",
			to: "composed",
			reason: "duplicate",
		});
	});

	test("rejects duplicate `entered` for the same stage", async () => {
		const { createStageTracker } = await loadStageTracker();
		const { emit, captured } = makeEmit();
		const onUnexpected = mock(() => {});
		const tracker = createStageTracker({
			sourceCe: "pie-section-player-splitpane",
			sourceCeShape: "layout",
			runtimeId: "rt-1",
			emit,
			now: frozenClock(),
			onUnexpectedTransition: onUnexpected,
		});

		tracker.enter("composed");
		tracker.enter("composed");

		expect(captured.length).toBe(1);
		expect(onUnexpected).toHaveBeenCalledWith({
			from: "composed",
			to: "composed",
			reason: "duplicate",
		});
	});

	test("`reset()` rolls cohort over and re-arms emission", async () => {
		const { createStageTracker } = await loadStageTracker();
		const { emit, captured } = makeEmit();
		const tracker = createStageTracker({
			sourceCe: "pie-section-player-splitpane",
			sourceCeShape: "layout",
			runtimeId: "rt-1",
			sectionId: "s-1",
			attemptId: "a-1",
			emit,
			now: frozenClock(),
		});

		tracker.enter("composed");
		tracker.enter("runtime-bound");
		tracker.reset({ sectionId: "s-2", attemptId: "a-2" });
		tracker.enter("composed");

		const reEmitted = captured.filter((c) => c.stage === "composed");
		expect(reEmitted.length).toBe(2);
		expect(reEmitted[0].sectionId).toBe("s-1");
		expect(reEmitted[1].sectionId).toBe("s-2");
	});
});

describe("createStageTracker — toolkit CE shape", () => {
	test("auto-skips `ui-rendered` when `interactive` enters", async () => {
		const { createStageTracker } = await loadStageTracker();
		const { emit, captured } = makeEmit();
		const tracker = createStageTracker({
			sourceCe: "pie-assessment-toolkit",
			sourceCeShape: "toolkit",
			runtimeId: "rt-1",
			emit,
			now: frozenClock(),
		});

		tracker.enter("attached");
		tracker.enter("composed");
		tracker.enter("runtime-bound");
		tracker.enter("engine-ready");
		tracker.enter("interactive");

		expect(captured.map((c) => `${c.stage}:${c.status}`)).toEqual([
			"attached:entered",
			"composed:entered",
			"runtime-bound:entered",
			"engine-ready:entered",
			"ui-rendered:skipped",
			"interactive:entered",
		]);
	});

	test("`getCurrent()` reports the last entered stage", async () => {
		const { createStageTracker } = await loadStageTracker();
		const { emit } = makeEmit();
		const tracker = createStageTracker({
			sourceCe: "pie-assessment-toolkit",
			sourceCeShape: "toolkit",
			runtimeId: "rt-1",
			emit,
			now: frozenClock(),
		});

		expect(tracker.getCurrent()).toBeNull();
		tracker.enter("attached");
		expect(tracker.getCurrent()).toBe("attached");
		tracker.enter("composed");
		expect(tracker.getCurrent()).toBe("composed");
	});
});

describe("createStageTracker — failure semantics", () => {
	test("`failed` status records position without gating future transitions on the same stage", async () => {
		const { createStageTracker } = await loadStageTracker();
		const { emit, captured } = makeEmit();
		const tracker = createStageTracker({
			sourceCe: "pie-section-player-splitpane",
			sourceCeShape: "layout",
			runtimeId: "rt-1",
			emit,
			now: frozenClock(),
		});

		tracker.enter("composed");
		tracker.enter("runtime-bound", "failed");

		expect(captured.map((c) => `${c.stage}:${c.status}`)).toEqual([
			"composed:entered",
			"runtime-bound:failed",
		]);
		expect(tracker.getCurrent()).toBe("runtime-bound");
	});
});
