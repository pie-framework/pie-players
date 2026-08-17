import { describe, expect, test } from "bun:test";
import type {
	AssessmentSection,
	ItemEntity,
} from "@pie-players/pie-players-shared";
import type {
	MediaTimeSource,
	MediaTimeSourceNotification,
	TimedMediaCue,
} from "@pie-players/pie-players-shared/timed-media";
import { SectionController } from "../src/controllers/SectionController";
import type { SectionControllerChangeEvent } from "../src/controllers/types";

/**
 * The controller half of timed media: the port, the live cue state, the session
 * slice, and the events layouts and hosts read. The reduction itself is covered
 * in `players-shared`; what is exercised here is the wiring the reduction has no
 * access to — item completion answering a `responded` gate, formative correctness
 * answering a `correct` gate, and the port being driven rather than assumed.
 */

function makeItem(id: string): ItemEntity {
	return {
		id,
		name: id,
		config: { elements: {}, models: [], markup: "<div></div>" },
	} as unknown as ItemEntity;
}

function makeSection(args: {
	cues: TimedMediaCue[];
	stimulusRef?: string;
	items?: string[];
	allowSeekAhead?: boolean;
	requireMediaCompletion?: boolean;
	unlimitedTries?: boolean;
}): AssessmentSection {
	const items = args.items ?? ["q1", "q2"];
	return {
		identifier: "timed-media-section",
		sectionType: "timed-media",
		formative: {
			enabled: true,
			maxTries: args.unlimitedTries === false ? 2 : "unlimited",
			feedback: "correctness",
		},
		rubricBlocks: [
			{
				identifier: "video-stimulus-1",
				class: "stimulus",
				view: ["candidate"],
				passage: {
					id: "passage-video",
					name: "Stimulus",
					config: { elements: {}, models: [], markup: "<video></video>" },
				},
			},
		],
		assessmentItemRefs: items.map((identifier) => ({
			identifier,
			item: makeItem(`${identifier}-item`),
		})),
		timedMedia: {
			stimulusRef: args.stimulusRef ?? "video-stimulus-1",
			cues: args.cues,
			playbackPolicy: {
				allowSeekAhead: args.allowSeekAhead ?? false,
				pauseOnRequiredCue: true,
				requireMediaCompletion: args.requireMediaCompletion ?? false,
			},
		},
	} as unknown as AssessmentSection;
}

const revealCue = (startSeconds: number, itemRefs: string[]): TimedMediaCue => ({
	identifier: `cue-reveal-${startSeconds}`,
	range: { startSeconds },
	itemRefs,
	policy: { activation: "reveal" },
});

const gateCue = (args: {
	startSeconds: number;
	itemRefs: string[];
	releaseOn: "responded" | "correct" | "partial-or-better";
	onUnknownCorrectness?: "release" | "hold";
}): TimedMediaCue => ({
	identifier: "cue-gate",
	range: { startSeconds: args.startSeconds },
	itemRefs: args.itemRefs,
	policy: {
		activation: "gate",
		releaseOn: args.releaseOn,
		onUnknownCorrectness: args.onUnknownCorrectness,
	},
});

/** A port under the test's control, recording what the controller did to it. */
function fakeMediaTimeSource(
	capabilities: { canPause?: boolean; canRestrictSeeking?: boolean } = {},
) {
	const listeners = new Set<(n: MediaTimeSourceNotification) => void>();
	const calls: string[] = [];
	let currentTime = 0;
	let paused = true;
	const source: MediaTimeSource = {
		get currentTime() {
			return currentTime;
		},
		get duration() {
			return 120;
		},
		get paused() {
			return paused;
		},
		get seekable() {
			return null;
		},
		capabilities: {
			canPause: capabilities.canPause ?? true,
			canRestrictSeeking: capabilities.canRestrictSeeking ?? true,
		},
		play() {
			paused = false;
		},
		pause() {
			calls.push("pause");
			paused = true;
		},
		seekTo(seconds) {
			calls.push(`seekTo:${seconds}`);
			currentTime = seconds;
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
	return {
		source,
		calls,
		playing() {
			paused = false;
		},
		notify(notification: MediaTimeSourceNotification) {
			currentTime = notification.currentTime;
			for (const listener of Array.from(listeners)) listener(notification);
		},
		advanceTo(seconds: number) {
			paused = false;
			this.notify({ type: "time", currentTime: seconds });
		},
	};
}

async function bootstrap(section: AssessmentSection) {
	const controller = new SectionController();
	await controller.initialize({
		section,
		sectionId: "timed-media-section",
		assessmentId: "assessment-1",
		view: ["candidate"],
	});
	const events: SectionControllerChangeEvent[] = [];
	controller.subscribe((event) => events.push(event));
	return { controller, events };
}

const eventTypes = (events: SectionControllerChangeEvent[]) =>
	events.map((event) => event.type);

describe("SectionController timed media", () => {
	test("a section that is not timed media produces no projection or slice", async () => {
		const section = makeSection({ cues: [revealCue(5, ["q1"])] });
		const { controller } = await bootstrap({
			...section,
			sectionType: undefined,
		} as unknown as AssessmentSection);
		expect(controller.getTimedMediaProjection()).toBeNull();
		expect(controller.getCompositionModel().timedMedia).toBeNull();
		expect(controller.getSession()).not.toHaveProperty("timedMedia");
	});

	test("a valid section resolves its stimulus to the rendered passage id", async () => {
		const { controller } = await bootstrap(
			makeSection({ cues: [revealCue(5, ["q1"])] }),
		);
		expect(controller.getTimedMediaProjection()).toMatchObject({
			version: 1,
			stimulusRenderableId: "passage-video",
			mediaAttached: false,
		});
	});

	test("an unresolvable stimulusRef reports and delivers without cues", async () => {
		const { controller, events } = await bootstrap(
			makeSection({
				cues: [revealCue(5, ["q1"])],
				stimulusRef: "no-such-renderable",
			}),
		);
		expect(controller.getTimedMediaProjection()).toBeNull();
		// Reported on initialize, before any subscriber exists, so the projection
		// being null is the durable signal; the event is for a host that subscribes
		// early.
		expect(eventTypes(events)).not.toContain("timed-media-cue-changed");
	});

	test("attaching a port and reaching a cue reveals its items once", async () => {
		const { controller, events } = await bootstrap(
			makeSection({ cues: [revealCue(5, ["q1"])] }),
		);
		const media = fakeMediaTimeSource();
		controller.attachMediaTimeSource(media.source);

		media.advanceTo(4.9);
		expect(
			controller.getTimedMediaProjection()?.revealedItemIds,
		).toEqual([]);

		media.advanceTo(5.2);
		const projection = controller.getTimedMediaProjection();
		expect(projection?.revealedItemIds).toEqual(["q1"]);
		expect(projection?.mediaAttached).toBe(true);

		const cueEvents = events.filter(
			(event) => event.type === "timed-media-cue-changed",
		);
		// Two: attaching a source is itself a projection change a layout renders
		// (`mediaAttached`), then the cue activation. Exactly one carries an
		// activation, because a cue fires once.
		expect(cueEvents).toHaveLength(2);
		const activations = cueEvents.filter(
			(event) =>
				event.type === "timed-media-cue-changed" && !!event.activatedCueIdentifier,
		);
		expect(activations).toHaveLength(1);
		expect(activations[0]).toMatchObject({
			activatedCueIdentifier: "cue-reveal-5",
			revealedItemIds: ["q1"],
			gateCueIdentifier: null,
		});
	});

	test("clock ticks that change no cue state emit nothing", async () => {
		const { controller, events } = await bootstrap(
			makeSection({ cues: [revealCue(5, ["q1"])] }),
		);
		const media = fakeMediaTimeSource();
		controller.attachMediaTimeSource(media.source);
		media.advanceTo(5.2);
		const afterFirst = events.length;
		media.advanceTo(5.5);
		media.advanceTo(6);
		media.advanceTo(6.5);
		// Position is recorded, but a republish per `timeupdate` would re-diff every
		// mounted item player four times a second for no visible change.
		expect(events).toHaveLength(afterFirst);
		expect(controller.getTimedMediaProjection()?.mediaCurrentTime).toBe(6.5);
	});

	test("a gate on responded holds until the item reports completion", async () => {
		const { controller } = await bootstrap(
			makeSection({
				cues: [gateCue({ startSeconds: 5, itemRefs: ["q1"], releaseOn: "responded" })],
			}),
		);
		const media = fakeMediaTimeSource();
		controller.attachMediaTimeSource(media.source);

		media.advanceTo(6);
		expect(media.calls).toContain("pause");
		expect(controller.getTimedMediaProjection()?.gate).toMatchObject({
			cueIdentifier: "cue-gate",
			holding: true,
			enforcement: "enforced",
		});

		controller.updateItemSession("q1", { id: "s1", data: [], complete: true });
		expect(controller.getTimedMediaProjection()?.gate).toBeNull();
		expect(
			controller.getTimedMediaProjection()?.completedCueIdentifiers,
		).toEqual(["cue-gate"]);
	});

	test("a gate on correct releases on a correct Try and not on an incorrect one", async () => {
		const { controller, events } = await bootstrap(
			makeSection({
				cues: [
					gateCue({
						startSeconds: 5,
						itemRefs: ["q1"],
						releaseOn: "correct",
						onUnknownCorrectness: "hold",
					}),
				],
			}),
		);
		const media = fakeMediaTimeSource();
		controller.attachMediaTimeSource(media.source);
		media.advanceTo(6);

		controller.recordFormativeTry({ itemId: "q1", outcomes: [{ score: 0, max: 1 }] });
		expect(controller.getTimedMediaProjection()?.gate?.holding).toBe(true);

		controller.retryFormativeItem({ itemId: "q1" });
		controller.recordFormativeTry({ itemId: "q1", outcomes: [{ score: 1, max: 1 }] });
		expect(controller.getTimedMediaProjection()?.gate).toBeNull();

		const released = events
			.filter((event) => event.type === "timed-media-cue-changed")
			.at(-1);
		expect(released).toMatchObject({ releasedCueIdentifier: "cue-gate" });
	});

	test("playback is not resumed for the learner when a gate releases", async () => {
		const { controller } = await bootstrap(
			makeSection({
				cues: [gateCue({ startSeconds: 5, itemRefs: ["q1"], releaseOn: "responded" })],
			}),
		);
		const media = fakeMediaTimeSource();
		controller.attachMediaTimeSource(media.source);
		media.advanceTo(6);
		controller.updateItemSession("q1", { id: "s1", data: [], complete: true });
		// Auto-resume would start audio the learner did not ask for, on top of the
		// announcement that the gate released.
		expect(media.calls.filter((call) => call === "play")).toHaveLength(0);
		expect(media.source.paused).toBe(true);
	});

	test("a source that cannot pause degrades to advisory and reports it", async () => {
		const { controller, events } = await bootstrap(
			makeSection({
				cues: [gateCue({ startSeconds: 5, itemRefs: ["q1"], releaseOn: "responded" })],
			}),
		);
		const media = fakeMediaTimeSource({ canPause: false });
		controller.attachMediaTimeSource(media.source);

		const degraded = events.find(
			(event) => event.type === "timed-media-policy-degraded",
		);
		expect(degraded).toMatchObject({
			degradations: [
				{ policy: "pause-on-required-cue", capability: "canPause" },
			],
		});

		media.advanceTo(6);
		// Cues still fire and state is still recorded; only enforcement is lost.
		expect(media.calls).not.toContain("pause");
		expect(controller.getTimedMediaProjection()).toMatchObject({
			revealedItemIds: ["q1"],
			enforcement: { pause: "advisory", seek: "enforced" },
		});
		expect(controller.getTimedMediaProjection()?.gate).toMatchObject({
			holding: true,
			enforcement: "advisory",
		});
	});

	test("a forward seek past the furthest position is clamped through the port", async () => {
		const { controller } = await bootstrap(
			makeSection({ cues: [revealCue(90, ["q2"])] }),
		);
		const media = fakeMediaTimeSource();
		controller.attachMediaTimeSource(media.source);
		media.advanceTo(12);
		media.notify({ type: "seek", currentTime: 95 });
		expect(media.calls).toContain("seekTo:12");
		expect(controller.getTimedMediaProjection()?.revealedItemIds).toEqual([]);
	});

	test("a source that cannot restrict seeking keeps the cue state but not the lock", async () => {
		const { controller, events } = await bootstrap(
			makeSection({ cues: [revealCue(90, ["q2"])] }),
		);
		const media = fakeMediaTimeSource({ canRestrictSeeking: false });
		controller.attachMediaTimeSource(media.source);
		media.advanceTo(12);
		media.notify({ type: "seek", currentTime: 95 });
		expect(media.calls.some((call) => call.startsWith("seekTo"))).toBe(false);
		expect(
			events.find((event) => event.type === "timed-media-policy-degraded"),
		).toMatchObject({
			degradations: [
				{ policy: "restrict-seek-ahead", capability: "canRestrictSeeking" },
			],
		});
	});

	test("aggregate completion needs cues, items and — when required — the media", async () => {
		const { controller } = await bootstrap(
			makeSection({
				cues: [revealCue(5, ["q1"])],
				items: ["q1"],
				requireMediaCompletion: true,
			}),
		);
		const media = fakeMediaTimeSource();
		controller.attachMediaTimeSource(media.source);
		media.advanceTo(6);
		expect(controller.getTimedMediaProjection()?.aggregateComplete).toBe(false);

		controller.updateItemSession("q1", { id: "s1", data: [], complete: true });
		expect(controller.getTimedMediaProjection()?.aggregateComplete).toBe(false);

		media.notify({ type: "ended", currentTime: 120 });
		expect(controller.getTimedMediaProjection()).toMatchObject({
			mediaCompleted: true,
			aggregateComplete: true,
		});
	});

	test("the slice round-trips through getSession / applySession", async () => {
		const section = makeSection({
			cues: [
				revealCue(5, ["q1"]),
				gateCue({ startSeconds: 40, itemRefs: ["q2"], releaseOn: "responded" }),
			],
		});
		const { controller } = await bootstrap(section);
		const media = fakeMediaTimeSource();
		controller.attachMediaTimeSource(media.source);
		media.advanceTo(12);

		const saved = controller.getSession();
		expect(saved?.timedMedia).toMatchObject({
			version: 1,
			visitedCueIdentifiers: ["cue-reveal-5"],
			maxPositionSeconds: 12,
		});

		const restored = await bootstrap(section);
		await restored.controller.applySession(
			JSON.parse(JSON.stringify(saved)),
			{ mode: "replace" },
		);
		expect(restored.controller.getTimedMediaProjection()).toMatchObject({
			revealedItemIds: ["q1"],
			mediaCurrentTime: 12,
			maxPositionSeconds: 12,
		});
	});

	test("a restored position seeks a freshly attached source forward", async () => {
		const section = makeSection({ cues: [revealCue(5, ["q1"])] });
		const { controller } = await bootstrap(section);
		const media = fakeMediaTimeSource();
		controller.attachMediaTimeSource(media.source);
		media.advanceTo(30);
		const saved = controller.getSession();

		const restored = await bootstrap(section);
		const freshMedia = fakeMediaTimeSource();
		restored.controller.attachMediaTimeSource(freshMedia.source);
		await restored.controller.applySession(saved, { mode: "replace" });
		expect(freshMedia.calls).toContain("seekTo:30");
	});

	test("an unknown-version slice restarts cue state and leaves item sessions alone", async () => {
		const section = makeSection({ cues: [revealCue(5, ["q1"])] });
		const { controller } = await bootstrap(section);
		await controller.applySession(
			{
				itemSessions: {
					q1: { itemIdentifier: "q1", session: { id: "s1", data: [] } },
				},
				timedMedia: {
					version: 2,
					mediaCurrentTime: 44,
					maxPositionSeconds: 44,
					mediaCompleted: true,
					visitedCueIdentifiers: ["cue-reveal-5"],
					completedCueIdentifiers: ["cue-reveal-5"],
				},
			} as never,
			{ mode: "replace" },
		);
		expect(controller.getTimedMediaProjection()).toMatchObject({
			visitedCueIdentifiers: [],
			mediaCurrentTime: 0,
		});
		expect(
			Object.keys(controller.getResolvedItemSessions()),
		).toContain("q1");
	});

	test("detaching leaves cue state in place and stops advancing it", async () => {
		const { controller } = await bootstrap(
			makeSection({ cues: [revealCue(5, ["q1"]), revealCue(50, ["q2"])] }),
		);
		const media = fakeMediaTimeSource();
		controller.attachMediaTimeSource(media.source);
		media.advanceTo(6);
		controller.detachMediaTimeSource();
		media.advanceTo(60);
		expect(controller.getTimedMediaProjection()).toMatchObject({
			revealedItemIds: ["q1"],
			mediaAttached: false,
		});
	});

	test("a correctness gate over a finite Try budget is refused, not silently released", async () => {
		const { controller } = await bootstrap(
			makeSection({
				cues: [
					gateCue({
						startSeconds: 5,
						itemRefs: ["q1"],
						releaseOn: "correct",
						onUnknownCorrectness: "hold",
					}),
				],
				unlimitedTries: false,
			}),
		);
		// A learner who spends the budget without getting it right could never
		// release playback again, so the section is malformed rather than delivered.
		expect(controller.getTimedMediaProjection()).toBeNull();
	});
});
