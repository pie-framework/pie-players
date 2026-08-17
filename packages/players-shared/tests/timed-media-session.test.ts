import { describe, expect, test } from "bun:test";
import {
	createTimedMediaState,
	normalizeTimedMediaSectionData,
	normalizeTimedMediaSectionSlice,
	reduceTimedMediaState,
	toTimedMediaSectionSlice,
	type ResolvedTimedMediaSectionData,
} from "../src/timed-media/index.js";

const DATA: ResolvedTimedMediaSectionData = (() => {
	const result = normalizeTimedMediaSectionData({
		timedMedia: {
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
				{
					identifier: "cue-reveal",
					range: { startSeconds: 30 },
					itemRefs: ["q2"],
					policy: { activation: "reveal" },
				},
			],
		},
		itemIdentifiers: ["q1", "q2"],
		resolveStimulusRenderableId: () => "passage-video",
		resolveItemTryBudget: () => "unlimited",
	});
	if (!result.data) throw new Error("fixture is malformed");
	return result.data;
})();

const delivery = {
	respondedByItemId: {},
	correctnessByItemId: {},
	itemsComplete: false,
};

const restore = (slice: unknown) =>
	normalizeTimedMediaSectionSlice({ slice, data: DATA });

describe("timed-media session round trip", () => {
	test("progress, visits, completion and the active cue survive a round trip", () => {
		const watched = reduceTimedMediaState({
			state: createTimedMediaState(),
			data: DATA,
			delivery,
			input: { kind: "time", currentTimeSeconds: 31 },
		});
		const released = reduceTimedMediaState({
			state: watched.state,
			data: DATA,
			delivery: { ...delivery, correctnessByItemId: { q1: "correct" } },
			input: { kind: "delivery-changed" },
		});
		const slice = toTimedMediaSectionSlice(released.state);
		expect(restore(JSON.parse(JSON.stringify(slice)))).toEqual(released.state);
	});

	test("a clean state round trips as itself", () => {
		const slice = toTimedMediaSectionSlice(createTimedMediaState());
		expect(restore(slice)).toEqual(createTimedMediaState());
	});

	test("an unknown version is rejected whole", () => {
		const slice = {
			...toTimedMediaSectionSlice(createTimedMediaState()),
			version: 2,
			mediaCurrentTime: 42,
		};
		expect(restore(slice)).toBeNull();
	});

	test("an absent slice is indistinguishable from a pre-timed-media save", () => {
		expect(restore(undefined)).toBeNull();
		expect(restore(null)).toBeNull();
	});

	test("cue identifiers the section no longer holds are dropped", () => {
		expect(
			restore({
				version: 1,
				mediaCurrentTime: 40,
				maxPositionSeconds: 40,
				mediaCompleted: false,
				visitedCueIdentifiers: ["cue-gate", "cue-retired"],
				completedCueIdentifiers: ["cue-retired"],
				activeCueIdentifier: "cue-retired",
			}),
		).toMatchObject({
			visitedCueIdentifiers: ["cue-gate"],
			completedCueIdentifiers: [],
			activeCueIdentifier: undefined,
		});
	});

	test("a completed cue that was never visited is discarded", () => {
		expect(
			restore({
				version: 1,
				mediaCurrentTime: 10,
				maxPositionSeconds: 10,
				mediaCompleted: false,
				visitedCueIdentifiers: ["cue-gate"],
				completedCueIdentifiers: ["cue-gate", "cue-reveal"],
			})?.completedCueIdentifiers,
		).toEqual(["cue-gate"]);
	});

	test("the furthest position is never restored below the position itself", () => {
		expect(
			restore({
				version: 1,
				mediaCurrentTime: 55,
				mediaCompleted: false,
				visitedCueIdentifiers: [],
				completedCueIdentifiers: [],
			})?.maxPositionSeconds,
		).toBe(55);
	});

	test("nothing is restored into a section that carries no timed media", () => {
		expect(
			normalizeTimedMediaSectionSlice({
				slice: toTimedMediaSectionSlice(createTimedMediaState()),
				data: null,
			}),
		).toBeNull();
	});
});
