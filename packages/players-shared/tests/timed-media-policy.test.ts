import { describe, expect, test } from "bun:test";
import {
	TIMED_MEDIA_PLAYBACK_POLICY_DEFAULTS,
	normalizeTimedMediaSectionData,
	type TimedMediaItemTryBudget,
} from "../src/timed-media/index.js";

const ITEMS = ["q1", "q2"];

const validate = (
	timedMedia: unknown,
	options?: {
		stimulus?: string | null;
		budgets?: Record<string, TimedMediaItemTryBudget>;
	},
) =>
	normalizeTimedMediaSectionData({
		timedMedia,
		itemIdentifiers: ITEMS,
		resolveStimulusRenderableId: (ref) => {
			const known = options?.stimulus ?? "video-stimulus-1";
			return known && ref === known ? "passage-video" : undefined;
		},
		// Unlimited by default so a fixture only has to say so when the Try budget is
		// what it is testing.
		resolveItemTryBudget: (itemId) => options?.budgets?.[itemId] ?? "unlimited",
	});

const revealCue = {
	identifier: "cue-1",
	range: { startSeconds: 10 },
	itemRefs: ["q1"],
	policy: { activation: "reveal" },
};

const codes = (result: ReturnType<typeof validate>) =>
	result.errors.map((error) => error.code);

describe("normalizeTimedMediaSectionData", () => {
	test("a minimal section resolves with the restrictive playback defaults", () => {
		const result = validate({
			stimulusRef: "video-stimulus-1",
			cues: [revealCue],
		});
		expect(result.errors).toEqual([]);
		expect(result.data).toMatchObject({
			stimulusRef: "video-stimulus-1",
			stimulusRenderableId: "passage-video",
			playbackPolicy: TIMED_MEDIA_PLAYBACK_POLICY_DEFAULTS,
		});
		expect(result.data?.cues[0]).toMatchObject({
			identifier: "cue-1",
			activation: "reveal",
			itemRefs: ["q1"],
			holdsPlayback: false,
		});
	});

	test("an unresolvable stimulusRef fails rather than delivering silent cues", () => {
		const result = validate({
			stimulusRef: "no-such-block",
			cues: [revealCue],
		});
		expect(codes(result)).toContain("unresolved-stimulus-ref");
		expect(result.data).toBeNull();
	});

	test("a missing stimulusRef is an error, not a default", () => {
		const result = validate({ cues: [revealCue] });
		expect(codes(result)).toContain("missing-stimulus-ref");
	});

	test("a section with no cues is malformed", () => {
		const result = validate({ stimulusRef: "video-stimulus-1", cues: [] });
		expect(codes(result)).toContain("no-cues");
	});

	test("a gate on correctness must state onUnknownCorrectness", () => {
		const result = validate({
			stimulusRef: "video-stimulus-1",
			cues: [
				{
					identifier: "cue-gate",
					range: { startSeconds: 5 },
					itemRefs: ["q1"],
					policy: { activation: "gate", releaseOn: "correct" },
				},
			],
		});
		expect(codes(result)).toEqual(["missing-unknown-correctness"]);
	});

	test("a gate on responded needs no onUnknownCorrectness", () => {
		const result = validate({
			stimulusRef: "video-stimulus-1",
			cues: [
				{
					identifier: "cue-gate",
					range: { startSeconds: 5 },
					itemRefs: ["q1"],
					policy: { activation: "gate", releaseOn: "responded" },
				},
			],
		});
		expect(result.errors).toEqual([]);
		expect(result.data?.cues[0]).toMatchObject({
			releaseOn: "responded",
			holdsPlayback: true,
			onUnknownCorrectness: undefined,
		});
	});

	test("a gate with no release condition is malformed", () => {
		const result = validate({
			stimulusRef: "video-stimulus-1",
			cues: [
				{
					identifier: "cue-gate",
					range: { startSeconds: 5 },
					itemRefs: ["q1"],
					policy: { activation: "gate" },
				},
			],
		});
		expect(codes(result)).toEqual(["missing-release-condition"]);
	});

	test("pauseOnRequiredCue: false leaves a gate holding nothing", () => {
		const result = validate({
			stimulusRef: "video-stimulus-1",
			playbackPolicy: { pauseOnRequiredCue: false },
			cues: [
				{
					identifier: "cue-gate",
					range: { startSeconds: 5 },
					itemRefs: ["q1"],
					policy: { activation: "gate", releaseOn: "responded" },
				},
			],
		});
		expect(result.errors).toEqual([]);
		expect(result.data?.cues[0].holdsPlayback).toBe(false);
		expect(result.data?.playbackPolicy).toMatchObject({
			pauseOnRequiredCue: false,
			allowSeekAhead: false,
		});
	});

	test("a cue naming an item the section does not hold is reported", () => {
		const result = validate({
			stimulusRef: "video-stimulus-1",
			cues: [
				{
					identifier: "cue-1",
					range: { startSeconds: 10 },
					itemRefs: ["q1", "ghost"],
					policy: { activation: "reveal" },
				},
			],
		});
		expect(codes(result)).toEqual(["unknown-item-ref"]);
	});

	test("only a metadata cue may activate no item", () => {
		const result = validate({
			stimulusRef: "video-stimulus-1",
			cues: [
				{
					identifier: "cue-marker",
					range: { startSeconds: 1, endSeconds: 4 },
					itemRefs: [],
					policy: { activation: "metadata" },
				},
				{
					identifier: "cue-empty-reveal",
					range: { startSeconds: 6 },
					itemRefs: [],
					policy: { activation: "reveal" },
				},
			],
		});
		expect(codes(result)).toEqual(["missing-item-refs"]);
	});

	test("duplicate cue identifiers are rejected", () => {
		const result = validate({
			stimulusRef: "video-stimulus-1",
			cues: [revealCue, { ...revealCue, range: { startSeconds: 30 } }],
		});
		expect(codes(result)).toEqual(["duplicate-cue-identifier"]);
	});

	test("an end at or before the start reads as a point cue", () => {
		const result = validate({
			stimulusRef: "video-stimulus-1",
			cues: [
				{
					...revealCue,
					range: { startSeconds: 10, endSeconds: 10 },
				},
			],
		});
		expect(result.data?.cues[0].range).toEqual({ startSeconds: 10 });
	});

	test("a negative start is not a cue", () => {
		const result = validate({
			stimulusRef: "video-stimulus-1",
			cues: [{ ...revealCue, range: { startSeconds: -1 } }],
		});
		expect(codes(result)).toEqual(["invalid-cue-range"]);
	});

	test("a correctness gate over a finite Try budget is refused", () => {
		const result = validate(
			{
				stimulusRef: "video-stimulus-1",
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
				],
			},
			{ budgets: { q1: "finite" } },
		);
		expect(codes(result)).toEqual(["gate-requires-unlimited-tries"]);
		expect(result.errors[0].message).toContain("q1");
	});

	test("a correctness gate over a non-formative item is refused", () => {
		const result = validate(
			{
				stimulusRef: "video-stimulus-1",
				cues: [
					{
						identifier: "cue-gate",
						range: { startSeconds: 5 },
						itemRefs: ["q1"],
						policy: {
							activation: "gate",
							releaseOn: "partial-or-better",
							onUnknownCorrectness: "hold",
						},
					},
				],
			},
			{ budgets: { q1: "not-formative" } },
		);
		expect(codes(result)).toEqual(["gate-requires-unlimited-tries"]);
	});

	test("a responded gate is indifferent to the Try budget", () => {
		const result = validate(
			{
				stimulusRef: "video-stimulus-1",
				cues: [
					{
						identifier: "cue-gate",
						range: { startSeconds: 5 },
						itemRefs: ["q1"],
						policy: { activation: "gate", releaseOn: "responded" },
					},
				],
			},
			{ budgets: { q1: "not-formative" } },
		);
		expect(result.errors).toEqual([]);
	});

	test("an unknown scoring strategy is reported rather than dropped", () => {
		const result = validate({
			stimulusRef: "video-stimulus-1",
			cues: [revealCue],
			scoringPolicy: { strategy: "guess" },
		});
		expect(codes(result)).toContain("invalid-scoring-policy");
	});

	test("an authored scoring strategy survives validation unchanged", () => {
		const result = validate({
			stimulusRef: "video-stimulus-1",
			cues: [revealCue],
			scoringPolicy: { strategy: "sum-child-outcomes" },
		});
		expect(result.data?.scoringPolicy).toEqual({
			strategy: "sum-child-outcomes",
		});
	});
});
