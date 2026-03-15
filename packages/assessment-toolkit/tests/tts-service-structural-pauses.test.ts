import { describe, expect, test } from "bun:test";
import {
	TTSService,
	type PlaybackState,
} from "../src/services/TTSService";
import type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSSpeechSegment,
	TTSConfig,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";

class MockTTSImpl implements ITTSProviderImplementation {
	public speakCalls: string[] = [];
	public segmentCalls: TTSSpeechSegment[][] = [];
	public stopCalls = 0;
	public onWordBoundary?: (word: string, position: number, length?: number) => void;

	constructor(private supportsSegments = true) {}

	async speak(text: string): Promise<void> {
		this.speakCalls.push(text);
		this.onWordBoundary?.("word", 0, 4);
	}

	async speakSegments(segments: TTSSpeechSegment[]): Promise<void> {
		if (!this.supportsSegments) {
			throw new Error("speakSegments is not supported by this mock");
		}
		this.segmentCalls.push(segments);
		const first = segments[0];
		if (first) {
			this.onWordBoundary?.("word", first.startOffset, 4);
		}
	}

	pause(): void {}
	resume(): void {}
	stop(): void {
		this.stopCalls += 1;
	}
	isPlaying(): boolean {
		return false;
	}
	isPaused(): boolean {
		return false;
	}
}

class MockTTSProvider implements ITTSProvider {
	readonly providerId: string;
	readonly providerName = "Mock Provider";
	readonly version = "1.0.0";

	constructor(
		private impl: ITTSProviderImplementation,
		providerId = "mock",
		private supportsWordBoundary = true,
	) {
		this.providerId = providerId;
	}

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
			supportsWordBoundary: this.supportsWordBoundary,
			supportsVoiceSelection: true,
			supportsRateControl: true,
			supportsPitchControl: true,
		};
	}
	destroy(): void {}
}

describe("TTSService structural pauses", () => {
	test("creates boundaries for each sibling list item", () => {
		const service = new TTSService();
		(service as any).ttsConfig = {
			providerOptions: {
				structuralPauses: {
					baseMs: 280,
					units: { section: 1 },
					minMs: 0,
					maxMs: 2000,
				},
			},
		};

		const originalDocument = (globalThis as any).document;
		const originalNodeFilter = (globalThis as any).NodeFilter;
		const originalWindow = (globalThis as any).window;

		const makeElement = (tag: string, parent: any = null) =>
			({
				tagName: tag,
				parentElement: parent,
				hidden: false,
				getAttribute: () => null,
				hasAttribute: () => false,
				classList: { contains: () => false },
			}) as unknown as Element;
		const root = makeElement("DIV");
		const li1 = makeElement("LI", root);
		const li2 = makeElement("LI", root);
		const li3 = makeElement("LI", root);
		const li4 = makeElement("LI", root);
		const nodes = [
			{ textContent: "A. Chlorophyll and carbon dioxide ", parentElement: li1 },
			{ textContent: "B. Oxygen and glucose ", parentElement: li2 },
			{ textContent: "C. Carbon dioxide and energy ", parentElement: li3 },
			{ textContent: "D. Oxygen and starch", parentElement: li4 },
		];
		(globalThis as any).NodeFilter = { SHOW_TEXT: 4 };
		(globalThis as any).document = {
			createTreeWalker: () => {
				let idx = 0;
				return {
					nextNode: () => (idx < nodes.length ? (nodes[idx++] as any) : null),
				};
			},
		};
		(globalThis as any).window = undefined;

		try {
			const text =
				"A. Chlorophyll and carbon dioxide B. Oxygen and glucose C. Carbon dioxide and energy D. Oxygen and starch";
			const segments = (service as any).createSpeechPlan(root, text);
			expect(segments.map((s: any) => s.text)).toEqual([
				"A. Chlorophyll and carbon dioxide",
				"B. Oxygen and glucose",
				"C. Carbon dioxide and energy",
				"D. Oxygen and starch",
			]);
		} finally {
			(globalThis as any).document = originalDocument;
			(globalThis as any).NodeFilter = originalNodeFilter;
			(globalThis as any).window = originalWindow;
		}
	});

	test("uses speech plan for generated content and scales pauses by rate", async () => {
		const impl = new MockTTSImpl(true);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl), {
			rate: 2,
			providerOptions: {
				structuralPauses: {
					baseMs: 320,
					units: { section: 1 },
				},
			},
		});

		const pauseMs = (service as any).resolvePauseMsFromUnits(1);
		expect(pauseMs).toBe(160);

		(service as any).createSpeechPlan = () =>
			[
				{ text: "Title", startOffset: 0, pauseMsAfter: pauseMs },
				{ text: "Body", startOffset: 6, pauseMsAfter: 0 },
			] as TTSSpeechSegment[];

		await service.speak("Title Body", {
			contentElement: {} as Element,
		});

		expect(impl.segmentCalls).toHaveLength(1);
		expect(impl.segmentCalls[0]).toEqual([
			{ text: "Title", startOffset: 0, pauseMsAfter: 160 },
			{ text: "Body", startOffset: 6, pauseMsAfter: 0 },
		]);
		expect(impl.speakCalls).toHaveLength(0);
		expect(service.getState()).toBe("idle" as PlaybackState);
	});

	test("preserves authored SSML breaks and bypasses generated speech plan", async () => {
		const impl = new MockTTSImpl(true);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		service.setCatalogResolver({
			getAlternative: () => ({
				content: "<speak>Hello<break time=\"300ms\"/>world</speak>",
				language: "en-US",
				type: "spoken",
				identifier: "demo",
			}),
		} as any);

		(service as any).createSpeechPlan = () => {
			throw new Error("Speech plan should not be used for authored SSML content");
		};

		await service.speak("Hello world", {
			catalogId: "demo",
			language: "en-US",
			contentElement: {} as Element,
		});

		expect(impl.speakCalls).toEqual([
			"<speak>Hello<break time=\"300ms\"/>world</speak>",
		]);
		expect(impl.segmentCalls).toHaveLength(0);
	});

	test("applies per-segment offsets when provider lacks speakSegments support", async () => {
		const impl = new MockTTSImpl(false);
		(impl as any).speakSegments = undefined;
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));

		let capturedHighlightIndex = -1;
		(service as any).buildPositionMap = () => {};
		(service as any).findHighlightRange = (charIndex: number) => {
			capturedHighlightIndex = charIndex;
			return null;
		};
		(service as any).createSpeechPlan = () =>
			[
				{ text: "Option B", startOffset: 12, pauseMsAfter: 0 },
			] as TTSSpeechSegment[];
		const originalDocument = (globalThis as any).document;
		(globalThis as any).document = {
			createRange: () => ({
				selectNodeContents: () => {},
			}),
		};

		service.setHighlightCoordinator({
			highlightRange: () => {},
			highlightTTSWord: () => {},
			highlightTTSSentence: () => {},
			clearTTS: () => {},
			clearHighlights: () => {},
			clearAll: () => {},
			isSupported: () => true,
			updateTTSHighlightStyle: () => {},
		} as any);

		try {
			await service.speak("Prompt Option B", {
				contentElement: {} as Element,
			});
		} finally {
			(globalThis as any).document = originalDocument;
		}

		expect(impl.speakCalls).toEqual(["Option B"]);
		expect(capturedHighlightIndex).toBe(12);
	});

	test("defaults browser provider to sentence highlight mode", async () => {
		const impl = new MockTTSImpl(true);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl, "browser"));
		expect((service as any).resolveHighlightMode()).toBe("sentence");
	});

	test("keeps non-browser provider on word highlight when supported", async () => {
		const impl = new MockTTSImpl(true);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl, "server-tts", true));
		expect((service as any).resolveHighlightMode()).toBe("word");
	});

	test("tracks sentence highlight progressively for browser plan segments", async () => {
		const impl = new MockTTSImpl(true);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl, "browser"));
		(service as any).extractVisibleText = () => "First segment Second segment";
		(service as any).buildPositionMap = () => {
			const textA = { textContent: "First segment" } as Text;
			const textB = { textContent: "Second segment" } as Text;
			(service as any).normalizedToDOM = new Map();
			for (let i = 0; i < "First segment".length; i++) {
				(service as any).normalizedToDOM.set(i, { node: textA, offset: i });
			}
			for (let i = 0; i < "Second segment".length; i++) {
				(service as any).normalizedToDOM.set("First segment ".length + i, {
					node: textB,
					offset: i,
				});
			}
		};
		(service as any).createSpeechPlan = () =>
			[
				{ text: "First segment", startOffset: 0, pauseMsAfter: 0 },
				{
					text: "Second segment",
					startOffset: "First segment ".length,
					pauseMsAfter: 0,
				},
			] as TTSSpeechSegment[];
		const sentenceCalls: Range[][] = [];
		const originalDocument = (globalThis as any).document;
		(globalThis as any).document = {
			createRange: () => ({
				selectNodeContents: () => {},
				setStart: () => {},
				setEnd: () => {},
			}),
		};
		service.setHighlightCoordinator({
			highlightRange: () => {},
			highlightTTSWord: () => {},
			highlightTTSSentence: (ranges: Range[]) => {
				sentenceCalls.push(ranges);
			},
			clearTTS: () => {},
			clearHighlights: () => {},
			clearAll: () => {},
			isSupported: () => true,
			updateTTSHighlightStyle: () => {},
		} as any);

		try {
			await service.speak("First segment Second segment", {
				contentElement: {} as Element,
			});
		} finally {
			(globalThis as any).document = originalDocument;
		}

		expect(impl.segmentCalls).toHaveLength(0);
		expect(impl.speakCalls).toEqual(["First segment", "Second segment"]);
		expect(sentenceCalls).toHaveLength(2);
	});

	test("seekForward restarts playback from the next sentence segment", async () => {
		const impl = new MockTTSImpl(true);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));

		(service as any).state = "playing";
		(service as any).currentText = "First sentence. Second sentence.";
		(service as any).seekSegments = [
			{ text: "First sentence.", startOffset: 0, pauseMsAfter: 0 },
			{ text: "Second sentence.", startOffset: 16, pauseMsAfter: 0 },
		] as TTSSpeechSegment[];
		(service as any).currentBoundaryOffset = 0;
		let restartedSegments: TTSSpeechSegment[] = [];
		(service as any).speakWithPlan = async (segments: TTSSpeechSegment[]) => {
			restartedSegments = segments;
		};

		await service.seekForward();

		expect(impl.stopCalls).toBe(1);
		expect(restartedSegments).toEqual([
			{ text: "Second sentence.", startOffset: 16, pauseMsAfter: 0 },
		]);
	});

	test("tracks seek offset and segment index from speakSegments boundary callbacks", async () => {
		const impl = new MockTTSImpl(true);
		impl.speakSegments = async (segments: TTSSpeechSegment[]) => {
			impl.segmentCalls.push(segments);
			const second = segments[1];
			if (second) {
				impl.onWordBoundary?.("word", second.startOffset, 4);
			}
		};
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		(service as any).seekSegments = [
			{ text: "First sentence.", startOffset: 0, pauseMsAfter: 0 },
			{ text: "Second sentence.", startOffset: 16, pauseMsAfter: 0 },
			{ text: "Third sentence.", startOffset: 33, pauseMsAfter: 0 },
		] as TTSSpeechSegment[];

		await (service as any).speakWithPlan((service as any).seekSegments, 1, {
			highlightMode: "word",
		});

		expect((service as any).currentBoundaryOffset).toBe(16);
		expect((service as any).currentSeekSegmentIndex).toBe(1);
	});

	test("seekForward uses boundary-updated position after segmented playback", async () => {
		const impl = new MockTTSImpl(true);
		impl.speakSegments = async (segments: TTSSpeechSegment[]) => {
			impl.segmentCalls.push(segments);
			const second = segments[1];
			if (second) {
				impl.onWordBoundary?.("word", second.startOffset, 4);
			}
		};
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		(service as any).state = "playing";
		(service as any).currentText = "First sentence. Second sentence. Third sentence.";
		(service as any).seekSegments = [
			{ text: "First sentence.", startOffset: 0, pauseMsAfter: 0 },
			{ text: "Second sentence.", startOffset: 16, pauseMsAfter: 0 },
			{ text: "Third sentence.", startOffset: 33, pauseMsAfter: 0 },
		] as TTSSpeechSegment[];

		await (service as any).speakWithPlan((service as any).seekSegments, 1, {
			highlightMode: "word",
		});

		let restartedSegments: TTSSpeechSegment[] = [];
		(service as any).speakWithPlan = async (segments: TTSSpeechSegment[]) => {
			restartedSegments = segments;
		};

		await service.seekForward();

		expect(impl.stopCalls).toBe(1);
		expect(restartedSegments).toEqual([
			{ text: "Third sentence.", startOffset: 33, pauseMsAfter: 0 },
		]);
	});

	test("seekBackward is a no-op at first sentence boundary", async () => {
		const impl = new MockTTSImpl(true);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));

		(service as any).state = "playing";
		(service as any).currentText = "Only sentence.";
		(service as any).seekSegments = [
			{ text: "Only sentence.", startOffset: 0, pauseMsAfter: 0 },
		] as TTSSpeechSegment[];
		(service as any).currentBoundaryOffset = 0;

		await service.seekBackward();

		expect(impl.stopCalls).toBe(0);
	});
});
