/**
 * The life of a read-aloud run: what a new speak, a pause, a provider limit and
 * dispose do to the run in progress.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	spyOn,
	test,
} from "bun:test";
import type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSConfig,
	TTSProviderCapabilities,
	TTSSpeechSegment,
} from "@pie-players/pie-tts";
import {
	bindTtsAudioHandoff,
	pauseTtsForMediaAudio,
} from "../src/services/audio-handoff";
import { PlaybackState, TTSService } from "../src/services/TTSService";
import { isTTSStartFailure } from "../src/services/tts/start-failure";
import { splitTextToLength } from "../src/services/tts/text-segmentation";
import { contentWith } from "./fixtures/read-aloud-content";

/**
 * A provider whose playback the test drives: each utterance reports its start
 * and first word, and can be held until the test finishes it. A new utterance
 * fails the one still held, as a server provider aborts superseded synthesis.
 */
class ScriptedImpl implements ITTSProviderImplementation {
	speakCalls: string[] = [];
	stopCalls = 0;
	pauseCalls = 0;
	holdSpeech = false;
	deferStart = false;
	startHeld: (() => void) | null = null;
	onPlaybackStart: (() => void) | undefined = undefined;
	onWordBoundary?: (word: string, position: number, length?: number) => void;
	private held: { resolve: () => void; reject: (error: Error) => void } | null =
		null;

	async speak(text: string): Promise<void> {
		this.failHeld("Synthesis superseded by a newer request");
		this.speakCalls.push(text);
		if (this.deferStart) {
			this.startHeld = () => this.onPlaybackStart?.();
		} else {
			this.onPlaybackStart?.();
		}
		const word = text.match(/\S+/)?.[0];
		if (word) this.onWordBoundary?.(word, text.indexOf(word), word.length);
		if (!this.holdSpeech) return;
		await new Promise<void>((resolve, reject) => {
			this.held = { resolve, reject };
		});
	}
	finish(): void {
		this.held?.resolve();
		this.held = null;
	}
	private failHeld(message: string): void {
		this.held?.reject(new Error(message));
		this.held = null;
	}
	pause(): void {
		this.pauseCalls += 1;
	}
	resume(): void {}
	stop(): void {
		this.stopCalls += 1;
		this.failHeld("aborted");
	}
	isPlaying(): boolean {
		return false;
	}
	isPaused(): boolean {
		return false;
	}
	updateSettings(): void {}
}

class ScriptedProvider implements ITTSProvider {
	readonly providerId = "scripted";
	readonly providerName = "Scripted";
	readonly version = "1.0.0";
	constructor(
		private impl: ITTSProviderImplementation,
		private maxTextLength?: number,
	) {}
	async initialize(_config: TTSConfig): Promise<ITTSProviderImplementation> {
		return this.impl;
	}
	supportsFeature(): boolean {
		return true;
	}
	getCapabilities(): TTSProviderCapabilities {
		return {
			supportsPause: true,
			supportsResume: true,
			supportsWordBoundary: true,
			supportsVoiceSelection: true,
			supportsRateControl: true,
			supportsPitchControl: true,
			maxTextLength: this.maxTextLength,
		};
	}
	destroy(): void {}
}

const newService = async (maxTextLength?: number) => {
	const impl = new ScriptedImpl();
	const provider = new ScriptedProvider(impl, maxTextLength);
	const service = new TTSService();
	await service.initialize(provider);
	return { impl, provider, service };
};

const usePlan = (service: TTSService, segments: TTSSpeechSegment[]) => {
	expect(typeof (service as any).createSpeechPlan).toBe("function");
	(service as any).createSpeechPlan = () => segments;
};

const waitFor = async (condition: () => boolean): Promise<void> => {
	for (let attempt = 0; attempt < 200 && !condition(); attempt++) {
		await new Promise((resolve) => setTimeout(resolve, 1));
	}
	expect(condition()).toBeTrue();
};

const elapse = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(() => {
	if (!GlobalRegistrator.isRegistered) {
		GlobalRegistrator.register();
	}
});

afterEach(() => {
	document.body.replaceChildren();
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

describe("a new speak", () => {
	test("ends a superseded run quietly, without reporting its abort", async () => {
		const { impl, service } = await newService();
		const errors = spyOn(console, "error").mockImplementation(() => {});
		try {
			impl.holdSpeech = true;
			const first = service.speak(contentWith("First passage."));
			await waitFor(() => impl.speakCalls.length === 1);

			impl.holdSpeech = false;
			await service.speak(contentWith("Second passage."));
			await first;

			expect(impl.speakCalls).toEqual(["First passage.", "Second passage."]);
			expect(errors).not.toHaveBeenCalled();
			expect(service.getState()).toBe(PlaybackState.IDLE);
		} finally {
			errors.mockRestore();
		}
	});

	test("leaves playback running when the new target holds nothing to speak", async () => {
		const { impl, service } = await newService();
		const warnings = spyOn(console, "warn").mockImplementation(() => {});
		try {
			impl.holdSpeech = true;
			const first = service.speak(contentWith("Still reading."));
			await waitFor(() => impl.speakCalls.length === 1);

			await service.speak(contentWith("   "));

			expect(service.getState()).toBe(PlaybackState.PLAYING);
			expect(impl.stopCalls).toBe(0);
			impl.finish();
			await first;
		} finally {
			warnings.mockRestore();
		}
	});
});

describe("a pause between the parts of a run", () => {
	test("holds the next segment through a structural gap, and media the learner starts keeps playing", async () => {
		const { impl, service } = await newService();
		usePlan(service, [
			{ text: "First.", startOffset: 0, pauseMsAfter: 15 },
			{ text: "Second.", startOffset: 7, pauseMsAfter: 0 },
		]);
		let mediaSilenced = 0;
		const unbind = bindTtsAudioHandoff({
			ttsService: service,
			listenerId: "media-surface",
			silence: () => {
				mediaSilenced += 1;
			},
		});
		const states: PlaybackState[] = [];
		service.onStateChange("probe", (state) => states.push(state));

		const playback = service.speak(contentWith("First. Second."));
		await waitFor(() => impl.speakCalls.length === 1);
		// The learner starts media in the gap.
		pauseTtsForMediaAudio(service);
		const silencedAtPause = mediaSilenced;
		const statesAtPause = states.length;
		await elapse(40);

		expect(impl.speakCalls).toEqual(["First."]);
		expect(service.getState()).toBe(PlaybackState.PAUSED);
		expect(states.slice(statesAtPause)).toEqual([]);
		expect(mediaSilenced).toBe(silencedAtPause);

		service.resume();
		await playback;
		expect(impl.speakCalls).toEqual(["First.", "Second."]);
		unbind();
	});

	test("keeps a part paused that starts after the learner paused", async () => {
		const { impl, service } = await newService();
		usePlan(service, [
			{ text: "First.", startOffset: 0, pauseMsAfter: 5 },
			{ text: "Second.", startOffset: 7, pauseMsAfter: 0 },
		]);
		let mediaSilenced = 0;
		const unbind = bindTtsAudioHandoff({
			ttsService: service,
			listenerId: "media-surface",
			silence: () => {
				mediaSilenced += 1;
			},
		});

		const playback = service.speak(contentWith("First. Second."));
		await waitFor(() => impl.speakCalls.length === 1);
		impl.deferStart = true;
		impl.holdSpeech = true;
		await waitFor(() => impl.speakCalls.length === 2);
		pauseTtsForMediaAudio(service);
		const pausesBeforeStart = impl.pauseCalls;
		const silencedAtPause = mediaSilenced;

		impl.startHeld?.();

		expect(service.getState()).toBe(PlaybackState.PAUSED);
		expect(impl.pauseCalls).toBe(pausesBeforeStart + 1);
		expect(mediaSilenced).toBe(silencedAtPause);

		service.resume();
		impl.finish();
		await playback;
		unbind();
	});

	test("a stop while held ends the run", async () => {
		const { impl, service } = await newService();
		usePlan(service, [
			{ text: "First.", startOffset: 0, pauseMsAfter: 15 },
			{ text: "Second.", startOffset: 7, pauseMsAfter: 0 },
		]);

		const playback = service.speak(contentWith("First. Second."));
		await waitFor(() => impl.speakCalls.length === 1);
		service.pause();
		service.stop();
		await playback;

		expect(impl.speakCalls).toEqual(["First."]);
		expect(service.getState()).toBe(PlaybackState.IDLE);
	});
});

describe("a pause or stop while the read loads", () => {
	/** A service whose provider starts when the test opens its readiness gate. */
	const gatedService = () => {
		const impl = new ScriptedImpl();
		const service = new TTSService();
		let openGate: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			openGate = resolve;
		});
		service.setReadinessGate(async () => {
			await gate;
			await service.initialize(new ScriptedProvider(impl));
		});
		return { impl, service, openGate };
	};

	test("a pause while the provider starts holds the read until resume", async () => {
		const { impl, service, openGate } = gatedService();

		const playback = service.speak(contentWith("Held passage."));
		expect(service.getState()).toBe(PlaybackState.LOADING);
		service.pause();
		openGate();
		await elapse(10);

		expect(impl.speakCalls).toEqual([]);
		expect(service.getState()).toBe(PlaybackState.PAUSED);

		service.resume();
		await playback;
		expect(impl.speakCalls).toEqual(["Held passage."]);
	});

	test("a stop while the provider starts ends the read unspoken", async () => {
		const { impl, service, openGate } = gatedService();

		const playback = service.speak(contentWith("Stopped passage."));
		service.stop();
		openGate();
		await playback;

		expect(impl.speakCalls).toEqual([]);
		expect(service.getState()).toBe(PlaybackState.IDLE);
	});

	for (const path of ["one speak", "segmented speak"] as const) {
		test(`a pause while the content resolves holds the read until resume (${path})`, async () => {
			const { impl, service } = await newService();
			if (path === "one speak") {
				// No plan: the text goes to the provider in one speak.
				usePlan(service, []);
			} else {
				usePlan(service, [
					{ text: "Resolved passage.", startOffset: 0, pauseMsAfter: 0 },
				]);
				(impl as ITTSProviderImplementation).speakSegments = async (
					segments,
				) => {
					impl.speakCalls.push(
						segments.map((segment) => segment.text).join(" "),
					);
				};
			}
			let releaseContent: () => void = () => {};
			const contentHeld = new Promise<void>((resolve) => {
				releaseContent = resolve;
			});
			const resolveSpeechContent = (service as any).resolveSpeechContent.bind(
				service,
			);
			(service as any).resolveSpeechContent = async (...args: unknown[]) => {
				await contentHeld;
				return resolveSpeechContent(...args);
			};

			const playback = service.speak(contentWith("Resolved passage."));
			expect(service.getState()).toBe(PlaybackState.LOADING);
			service.pause();
			releaseContent();
			await elapse(10);

			expect(impl.speakCalls).toEqual([]);
			expect(service.getState()).toBe(PlaybackState.PAUSED);

			service.resume();
			await playback;
			expect(impl.speakCalls).toEqual(["Resolved passage."]);
		});
	}

	test("media started while the audio loads pauses the read, and stays playing when the audio arrives", async () => {
		const { impl, service } = await newService();
		impl.deferStart = true;
		impl.holdSpeech = true;
		let mediaSilenced = 0;
		const unbind = bindTtsAudioHandoff({
			ttsService: service,
			listenerId: "media-surface",
			silence: () => {
				mediaSilenced += 1;
			},
		});

		const playback = service.speak(contentWith("Loading passage."));
		await waitFor(() => impl.speakCalls.length === 1);
		expect(service.getState()).toBe(PlaybackState.LOADING);
		// The learner starts media before the read sounds.
		pauseTtsForMediaAudio(service);
		const silencedAtPause = mediaSilenced;
		expect(service.getState()).toBe(PlaybackState.PAUSED);

		// The provider's audio arrives regardless: the read keeps holding.
		const pausesBeforeStart = impl.pauseCalls;
		impl.startHeld?.();
		expect(service.getState()).toBe(PlaybackState.PAUSED);
		expect(impl.pauseCalls).toBe(pausesBeforeStart + 1);
		expect(mediaSilenced).toBe(silencedAtPause);

		service.resume();
		expect(service.getState()).toBe(PlaybackState.PLAYING);
		impl.finish();
		await playback;
		unbind();
	});

	test("a resume before the audio arrives returns to loading", async () => {
		const { impl, service } = await newService();
		impl.deferStart = true;
		impl.holdSpeech = true;

		const playback = service.speak(contentWith("Loading passage."));
		await waitFor(() => impl.speakCalls.length === 1);
		service.pause();
		service.resume();
		expect(service.getState()).toBe(PlaybackState.LOADING);

		impl.startHeld?.();
		expect(service.getState()).toBe(PlaybackState.PLAYING);
		impl.finish();
		await playback;
	});
});

describe("a provider's maxTextLength", () => {
	const text =
		"Alpha beta gamma. Delta epsilon zeta eta theta iota kappa lambda.";

	test("reads text over the limit in pieces, each word highlighted where it is", async () => {
		const { impl, service } = await newService(20);
		const highlighted: string[] = [];
		service.setHighlightCoordinator({
			highlightTTSWord: (ranges: Range[]) => {
				highlighted.push(ranges.join(""));
			},
			highlightTTSSentence: () => {},
			clearTTS: () => {},
			isSupported: () => true,
			updateTTSHighlightStyle: () => {},
		} as any);

		await service.speak(contentWith(text));

		expect(impl.speakCalls.length).toBeGreaterThan(1);
		for (const piece of impl.speakCalls) {
			expect(piece.length).toBeLessThanOrEqual(20);
		}
		expect(impl.speakCalls.join(" ")).toBe(text);
		expect(highlighted).toEqual(
			impl.speakCalls.map((piece) => piece.split(" ")[0]),
		);
	});

	test("splits at sentences, then words, then characters, keeping offsets", () => {
		const pieces = splitTextToLength(`${text} Supercalifragilistic.`, 20);

		expect(pieces.map((piece) => piece.text)).toEqual([
			"Alpha beta gamma.",
			"Delta epsilon zeta",
			"eta theta iota kappa",
			"lambda.",
			"Supercalifragilistic",
			".",
		]);
		const whole = `${text} Supercalifragilistic.`;
		for (const piece of pieces) {
			expect(whole.slice(piece.offset, piece.offset + piece.text.length)).toBe(
				piece.text,
			);
		}
	});
});

describe("TTSService dispose", () => {
	test("stops the run, drops its listeners and refuses to speak again", async () => {
		const { impl, provider, service } = await newService();
		let notified = 0;
		impl.holdSpeech = true;
		const playback = service.speak(contentWith("Read this."));
		await waitFor(() => impl.speakCalls.length === 1);
		service.onStateChange("probe", () => {
			notified += 1;
		});

		service.dispose();
		await playback;
		const notifiedAtDispose = notified;

		expect(impl.stopCalls).toBeGreaterThan(0);
		const error = await service
			.speak(contentWith("Again."))
			.catch((caught: unknown) => caught);
		expect(isTTSStartFailure(error)).toBeTrue();
		expect((error as Error).message).toContain("TTS service disposed");
		await expect(service.initialize(provider)).rejects.toThrow(
			"TTS service disposed",
		);
		service.stop();
		expect(notified).toBe(notifiedAtDispose);
		expect(impl.speakCalls).toEqual(["Read this."]);
	});
});
