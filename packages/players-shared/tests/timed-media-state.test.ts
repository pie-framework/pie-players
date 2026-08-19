import { describe, expect, test } from "bun:test";
import type { FormativeCorrectness } from "../src/formative/index.js";
import {
	createTimedMediaState,
	normalizeTimedMediaSectionData,
	reduceTimedMediaState,
	resolveTimedMediaEnforcement,
	resolveTimedMediaProjection,
	timedMediaProjectionSignature,
	type ResolvedTimedMediaSectionData,
	type TimedMediaDeliveryState,
	type TimedMediaInput,
	type TimedMediaSectionSessionSlice,
} from "../src/timed-media/index.js";

const ITEMS = ["q1", "q2"];

function resolve(timedMedia: unknown): ResolvedTimedMediaSectionData {
	const result = normalizeTimedMediaSectionData({
		timedMedia,
		itemIdentifiers: ITEMS,
		resolveStimulusRenderableId: () => "passage-video",
		resolveItemTryBudget: () => "unlimited",
	});
	if (!result.data) {
		throw new Error(
			`fixture is malformed: ${result.errors.map((e) => e.code).join(", ")}`,
		);
	}
	return result.data;
}

const delivery = (
	overrides: Partial<TimedMediaDeliveryState> = {},
): TimedMediaDeliveryState => ({
	respondedByItemId: {},
	correctnessByItemId: {},
	itemsComplete: false,
	...overrides,
});

const correctness = (
	entries: Record<string, FormativeCorrectness>,
): TimedMediaDeliveryState => delivery({ correctnessByItemId: entries });

function run(
	data: ResolvedTimedMediaSectionData,
	inputs: TimedMediaInput[],
	deliveryState: TimedMediaDeliveryState = delivery(),
	initial: TimedMediaSectionSessionSlice = createTimedMediaState(),
) {
	let state = initial;
	let last = reduceTimedMediaState({
		state,
		data,
		delivery: deliveryState,
		input: inputs[0],
	});
	state = last.state;
	for (const input of inputs.slice(1)) {
		last = reduceTimedMediaState({ state, data, delivery: deliveryState, input });
		state = last.state;
	}
	return { state, effects: last.effects, changed: last.changed };
}

const REVEAL_SECTION = resolve({
	stimulusRef: "stimulus",
	cues: [
		{
			identifier: "cue-reveal",
			range: { startSeconds: 10 },
			itemRefs: ["q1"],
			policy: { activation: "reveal" },
		},
		{
			identifier: "cue-marker",
			range: { startSeconds: 20, endSeconds: 25 },
			itemRefs: [],
			policy: { activation: "metadata" },
		},
	],
});

const GATE_SECTION = resolve({
	stimulusRef: "stimulus",
	cues: [
		{
			identifier: "cue-gate",
			range: { startSeconds: 5 },
			itemRefs: ["q1"],
			policy: {
				activation: "gate",
				releaseOn: "correct",
				onUnknownCorrectness: "release",
			},
		},
		{
			identifier: "cue-reveal",
			range: { startSeconds: 30 },
			itemRefs: ["q2"],
			policy: { activation: "reveal" },
		},
	],
});

describe("cue activation", () => {
	test("a cue fires when playback reaches its range and not before", () => {
		const before = run(REVEAL_SECTION, [{ kind: "time", currentTimeSeconds: 9.5 }]);
		expect(before.state.visitedCueIdentifiers).toEqual([]);
		expect(before.effects.activatedCueIdentifier).toBeUndefined();

		const after = run(REVEAL_SECTION, [
			{ kind: "time", currentTimeSeconds: 9.5 },
			{ kind: "time", currentTimeSeconds: 10.2 },
		]);
		expect(after.state.visitedCueIdentifiers).toEqual(["cue-reveal"]);
		expect(after.effects.activatedCueIdentifier).toBe("cue-reveal");
		expect(after.state.activeCueIdentifier).toBe("cue-reveal");
	});

	test("a reveal cue completes on activation; a metadata cue reveals nothing", () => {
		const { state } = run(REVEAL_SECTION, [
			{ kind: "time", currentTimeSeconds: 21 },
		]);
		expect(state.visitedCueIdentifiers).toEqual(["cue-reveal", "cue-marker"]);
		expect(state.completedCueIdentifiers).toEqual(["cue-reveal", "cue-marker"]);

		const projection = resolveTimedMediaProjection({
			data: REVEAL_SECTION,
			state,
			delivery: delivery(),
			capabilities: { canPause: true, canRestrictSeeking: true },
		});
		expect(projection.revealedItemIds).toEqual(["q1"]);
		expect(projection.gate).toBeNull();
	});

	test("a cue stays visited when the learner seeks back before it", () => {
		const { state } = run(REVEAL_SECTION, [
			{ kind: "time", currentTimeSeconds: 12 },
			{ kind: "seek", currentTimeSeconds: 2 },
		]);
		expect(state.visitedCueIdentifiers).toEqual(["cue-reveal"]);
		expect(state.mediaCurrentTime).toBe(2);
	});

	test("one reduction crossing several cues reports the furthest activation", () => {
		const { state, effects } = run(REVEAL_SECTION, [
			{ kind: "time", currentTimeSeconds: 22 },
		]);
		expect(state.visitedCueIdentifiers).toEqual(["cue-reveal", "cue-marker"]);
		expect(effects.activatedCueIdentifier).toBe("cue-marker");
	});

	test("an unchanged reduction returns the state it was given", () => {
		const first = run(REVEAL_SECTION, [{ kind: "time", currentTimeSeconds: 12 }]);
		const second = reduceTimedMediaState({
			state: first.state,
			data: REVEAL_SECTION,
			delivery: delivery(),
			input: { kind: "delivery-changed" },
		});
		expect(second.changed).toBe(false);
		expect(second.state).toBe(first.state);
	});
});

describe("gate cues", () => {
	test("a gate holds playback and releases when the item is correct", () => {
		const held = run(GATE_SECTION, [{ kind: "time", currentTimeSeconds: 6 }]);
		expect(held.effects.pause).toBe(true);
		expect(held.state.completedCueIdentifiers).toEqual([]);

		const released = reduceTimedMediaState({
			state: held.state,
			data: GATE_SECTION,
			delivery: correctness({ q1: "correct" }),
			input: { kind: "delivery-changed" },
		});
		expect(released.effects.pause).toBe(false);
		expect(released.effects.releasedCueIdentifier).toBe("cue-gate");
		expect(released.state.completedCueIdentifiers).toEqual(["cue-gate"]);
	});

	test("an incorrect answer keeps the gate holding", () => {
		const held = run(
			GATE_SECTION,
			[{ kind: "time", currentTimeSeconds: 6 }],
			correctness({ q1: "incorrect" }),
		);
		expect(held.effects.pause).toBe(true);
		const projection = resolveTimedMediaProjection({
			data: GATE_SECTION,
			state: held.state,
			delivery: correctness({ q1: "incorrect" }),
			capabilities: { canPause: true, canRestrictSeeking: true },
		});
		expect(projection.gate).toMatchObject({
			cueIdentifier: "cue-gate",
			holding: true,
			enforcement: "enforced",
			itemRefs: ["q1"],
		});
	});

	test("partial-or-better releases on partial credit", () => {
		const data = resolve({
			stimulusRef: "stimulus",
			cues: [
				{
					identifier: "cue-gate",
					range: { startSeconds: 1 },
					itemRefs: ["q1"],
					policy: {
						activation: "gate",
						releaseOn: "partial-or-better",
						onUnknownCorrectness: "hold",
					},
				},
			],
		});
		const partial = run(
			data,
			[{ kind: "time", currentTimeSeconds: 2 }],
			correctness({ q1: "partial" }),
		);
		expect(partial.effects.pause).toBe(false);
		const incorrect = run(
			data,
			[{ kind: "time", currentTimeSeconds: 2 }],
			correctness({ q1: "incorrect" }),
		);
		expect(incorrect.effects.pause).toBe(true);
	});

	test("onUnknownCorrectness decides an item nothing can score", () => {
		const releasing = run(
			GATE_SECTION,
			[{ kind: "time", currentTimeSeconds: 6 }],
			correctness({ q1: "unknown" }),
		);
		expect(releasing.effects.pause).toBe(false);

		const holdingData = resolve({
			stimulusRef: "stimulus",
			cues: [
				{
					identifier: "cue-gate",
					range: { startSeconds: 5 },
					itemRefs: ["q1"],
					policy: {
						activation: "gate",
						releaseOn: "correct",
						onUnknownCorrectness: "hold",
					},
				},
			],
		});
		const holding = run(
			holdingData,
			[{ kind: "time", currentTimeSeconds: 6 }],
			correctness({ q1: "unknown" }),
		);
		expect(holding.effects.pause).toBe(true);
	});

	test("a released gate stays released when a retry lowers correctness", () => {
		const held = run(GATE_SECTION, [{ kind: "time", currentTimeSeconds: 6 }]);
		const released = reduceTimedMediaState({
			state: held.state,
			data: GATE_SECTION,
			delivery: correctness({ q1: "correct" }),
			input: { kind: "delivery-changed" },
		});
		const afterRetry = reduceTimedMediaState({
			state: released.state,
			data: GATE_SECTION,
			delivery: correctness({ q1: "incorrect" }),
			input: { kind: "delivery-changed" },
		});
		expect(afterRetry.effects.pause).toBe(false);
		expect(afterRetry.state.completedCueIdentifiers).toEqual(["cue-gate"]);
	});

	test("responded reads item completion, not Try state", () => {
		const data = resolve({
			stimulusRef: "stimulus",
			cues: [
				{
					identifier: "cue-gate",
					range: { startSeconds: 1 },
					itemRefs: ["q1", "q2"],
					policy: { activation: "gate", releaseOn: "responded" },
				},
			],
		});
		const oneAnswered = run(
			data,
			[{ kind: "time", currentTimeSeconds: 2 }],
			delivery({ respondedByItemId: { q1: true } }),
		);
		expect(oneAnswered.effects.pause).toBe(true);

		const bothAnswered = run(
			data,
			[{ kind: "time", currentTimeSeconds: 2 }],
			delivery({ respondedByItemId: { q1: true, q2: true } }),
		);
		expect(bothAnswered.effects.pause).toBe(false);
	});

	// The answer to "may a gate name a subset of a multi-item cue's items": no new
	// syntax, because two cues at one timestamp already say it. The gate names the
	// items that must be answered, a reveal beside it names the optional ones, and
	// both activate in the same reduction.
	test("a gate and a reveal at the same timestamp split must-answer from optional", () => {
		const section = resolve({
			stimulusRef: "stimulus",
			cues: [
				{
					identifier: "cue-gate",
					range: { startSeconds: 5 },
					itemRefs: ["q1"],
					policy: {
						activation: "gate",
						releaseOn: "responded",
					},
				},
				{
					identifier: "cue-optional",
					range: { startSeconds: 5 },
					itemRefs: ["q2"],
					policy: { activation: "reveal" },
				},
			],
		});
		const held = run(section, [{ kind: "time", currentTimeSeconds: 6 }]);
		// Both items are on screen, and only the gate's item holds playback.
		expect(held.state.visitedCueIdentifiers).toEqual(["cue-gate", "cue-optional"]);
		expect(held.state.completedCueIdentifiers).toEqual(["cue-optional"]);
		expect(held.effects.pause).toBe(true);
		expect(held.state.activeCueIdentifier).toBe("cue-gate");

		// Answering the gate's item releases playback with the optional one still
		// unanswered, which is the whole point of the split.
		const released = run(
			section,
			[{ kind: "time", currentTimeSeconds: 6 }],
			delivery({ respondedByItemId: { q1: true } }),
			held.state,
		);
		expect(released.effects.pause).toBe(false);
		expect(released.state.completedCueIdentifiers).toEqual([
			"cue-gate",
			"cue-optional",
		]);
	});

	test("seeking past a gate still trips it", () => {
		const seekAhead = resolve({
			stimulusRef: "stimulus",
			playbackPolicy: { allowSeekAhead: true },
			cues: [
				{
					identifier: "cue-gate",
					range: { startSeconds: 5, endSeconds: 8 },
					itemRefs: ["q1"],
					policy: { activation: "gate", releaseOn: "responded" },
				},
			],
		});
		const { effects, state } = run(seekAhead, [
			{ kind: "seek", currentTimeSeconds: 60 },
		]);
		expect(state.visitedCueIdentifiers).toEqual(["cue-gate"]);
		expect(effects.pause).toBe(true);
	});
});

describe("seek restriction", () => {
	test("a forward seek past the furthest position is clamped", () => {
		const watched = run(REVEAL_SECTION, [
			{ kind: "time", currentTimeSeconds: 12 },
		]);
		const seeked = reduceTimedMediaState({
			state: watched.state,
			data: REVEAL_SECTION,
			delivery: delivery(),
			input: { kind: "seek", currentTimeSeconds: 90 },
		});
		expect(seeked.effects.seekToSeconds).toBe(12);
		expect(seeked.state.mediaCurrentTime).toBe(12);
		expect(seeked.state.maxPositionSeconds).toBe(12);
	});

	test("a nudge inside the tolerance is left alone", () => {
		const watched = run(REVEAL_SECTION, [
			{ kind: "time", currentTimeSeconds: 12 },
		]);
		const seeked = reduceTimedMediaState({
			state: watched.state,
			data: REVEAL_SECTION,
			delivery: delivery(),
			input: { kind: "seek", currentTimeSeconds: 12.4 },
		});
		expect(seeked.effects.seekToSeconds).toBeUndefined();
		expect(seeked.state.mediaCurrentTime).toBe(12.4);
	});

	test("allowSeekAhead: true clamps nothing", () => {
		const data = resolve({
			stimulusRef: "stimulus",
			playbackPolicy: { allowSeekAhead: true },
			cues: [
				{
					identifier: "cue-reveal",
					range: { startSeconds: 200 },
					itemRefs: ["q1"],
					policy: { activation: "reveal" },
				},
			],
		});
		const { state, effects } = run(data, [
			{ kind: "seek", currentTimeSeconds: 300 },
		]);
		expect(effects.seekToSeconds).toBeUndefined();
		expect(state.maxPositionSeconds).toBe(300);
	});
});

describe("completion", () => {
	test("aggregate completion separates cues, items and the media", () => {
		const data = resolve({
			stimulusRef: "stimulus",
			playbackPolicy: { requireMediaCompletion: true },
			cues: [
				{
					identifier: "cue-reveal",
					range: { startSeconds: 5 },
					itemRefs: ["q1"],
					policy: { activation: "reveal" },
				},
			],
		});
		const cuesOnly = run(data, [{ kind: "time", currentTimeSeconds: 6 }]);
		expect(cuesOnly.state.aggregateComplete).toBe(false);

		const itemsToo = reduceTimedMediaState({
			state: cuesOnly.state,
			data,
			delivery: delivery({ itemsComplete: true }),
			input: { kind: "delivery-changed" },
		});
		expect(itemsToo.state.aggregateComplete).toBe(false);

		const ended = reduceTimedMediaState({
			state: itemsToo.state,
			data,
			delivery: delivery({ itemsComplete: true }),
			input: { kind: "ended", currentTimeSeconds: 60 },
		});
		expect(ended.state.mediaCompleted).toBe(true);
		expect(ended.state.aggregateComplete).toBe(true);
	});

	test("requireMediaCompletion: false completes without the media ending", () => {
		const ready = run(
			REVEAL_SECTION,
			[{ kind: "time", currentTimeSeconds: 21 }],
			delivery({ itemsComplete: true }),
		);
		expect(ready.state.mediaCompleted).toBe(false);
		expect(ready.state.aggregateComplete).toBe(true);
	});

	test("a held gate keeps the section incomplete", () => {
		const held = run(
			GATE_SECTION,
			[{ kind: "time", currentTimeSeconds: 31 }],
			delivery({ itemsComplete: true }),
		);
		expect(held.state.aggregateComplete).toBe(false);
	});
});

describe("capability degradation", () => {
	test("a source that cannot pause makes gating advisory and says so", () => {
		const enforcement = resolveTimedMediaEnforcement({
			playbackPolicy: GATE_SECTION.playbackPolicy,
			capabilities: { canPause: false, canRestrictSeeking: true },
			hasGate: true,
		});
		expect(enforcement.pause).toBe("advisory");
		expect(enforcement.degradations).toHaveLength(1);
		expect(enforcement.degradations[0]).toMatchObject({
			policy: "pause-on-required-cue",
			capability: "canPause",
		});
	});

	test("cues still fire and state is still recorded under degradation", () => {
		const held = run(GATE_SECTION, [{ kind: "time", currentTimeSeconds: 6 }]);
		const projection = resolveTimedMediaProjection({
			data: GATE_SECTION,
			state: held.state,
			delivery: delivery(),
			capabilities: { canPause: false, canRestrictSeeking: false },
		});
		expect(projection.revealedItemIds).toEqual(["q1"]);
		expect(projection.gate).toMatchObject({
			holding: true,
			enforcement: "advisory",
		});
		expect(projection.enforcement).toEqual({
			pause: "advisory",
			seek: "advisory",
		});
		expect(projection.degradations.map((entry) => entry.policy)).toEqual([
			"pause-on-required-cue",
			"restrict-seek-ahead",
		]);
	});

	test("a section with no gate degrades nothing on a source that cannot pause", () => {
		const enforcement = resolveTimedMediaEnforcement({
			playbackPolicy: { ...REVEAL_SECTION.playbackPolicy, allowSeekAhead: true },
			capabilities: { canPause: false, canRestrictSeeking: false },
			hasGate: false,
		});
		expect(enforcement.degradations).toEqual([]);
		expect(enforcement.pause).toBe("enforced");
	});

	test("an unattached source reports authored intent, not a measured gap", () => {
		const projection = resolveTimedMediaProjection({
			data: GATE_SECTION,
			state: createTimedMediaState(),
			delivery: delivery(),
			capabilities: null,
		});
		expect(projection.mediaAttached).toBe(false);
		expect(projection.degradations).toEqual([]);
		expect(projection.enforcement.pause).toBe("enforced");
	});

	test("a metadata cue's items are not sequenced by the timeline", () => {
		const data = resolve({
			stimulusRef: "stimulus",
			cues: [
				{
					identifier: "cue-marker",
					range: { startSeconds: 5 },
					itemRefs: ["q2"],
					policy: { activation: "metadata" },
				},
				{
					identifier: "cue-reveal",
					range: { startSeconds: 10 },
					itemRefs: ["q1"],
					policy: { activation: "reveal" },
				},
			],
		});
		const { state } = run(data, [{ kind: "time", currentTimeSeconds: 6 }]);
		const projection = resolveTimedMediaProjection({
			data,
			state,
			delivery: delivery(),
			capabilities: { canPause: true, canRestrictSeeking: true },
		});
		// Visited, so it recorded state; and it sequences nothing, so q2 is an ordinary
		// item. A cue counted as sequencing but never as revealing hides its items for
		// the whole section.
		expect(projection.visitedCueIdentifiers).toEqual(["cue-marker"]);
		expect(projection.sequencedItemIds).toEqual(["q1"]);
		expect(projection.revealedItemIds).toEqual([]);
	});
});

describe("timedMediaProjectionSignature", () => {
	const project = (state: TimedMediaSectionSessionSlice) =>
		resolveTimedMediaProjection({
			data: REVEAL_SECTION,
			state,
			delivery: delivery(),
			capabilities: { canPause: true, canRestrictSeeking: true },
		});

	test("holds still while only the clock moves", () => {
		const base = createTimedMediaState();
		const first = project({ ...base, mediaCurrentTime: 1, maxPositionSeconds: 1 });
		const second = project({ ...base, mediaCurrentTime: 4, maxPositionSeconds: 4 });
		expect(timedMediaProjectionSignature(second)).toBe(
			timedMediaProjectionSignature(first),
		);
	});

	test("moves once playback covers a bucket of new ground", () => {
		const base = createTimedMediaState();
		const early = project({ ...base, mediaCurrentTime: 4, maxPositionSeconds: 4 });
		const later = project({ ...base, mediaCurrentTime: 24, maxPositionSeconds: 24 });
		// Position renders nowhere, so this exists only so a reload has a furthest
		// position to clamp `allowSeekAhead: false` against.
		expect(timedMediaProjectionSignature(later)).not.toBe(
			timedMediaProjectionSignature(early),
		);
	});

	test("moves on cue state", () => {
		const base = createTimedMediaState();
		const before = project(base);
		const after = project({ ...base, visitedCueIdentifiers: ["cue-reveal"] });
		expect(timedMediaProjectionSignature(after)).not.toBe(
			timedMediaProjectionSignature(before),
		);
	});

	test("an absent projection has no signature", () => {
		expect(timedMediaProjectionSignature(null)).toBe("");
		expect(timedMediaProjectionSignature(undefined)).toBe("");
	});
});
