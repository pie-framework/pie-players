import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import type {
	TTSHighlightContext,
	TTSHighlightTargetResolver,
} from "../src/index";
import { TTSService } from "../src/services/TTSService";
import type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSConfig,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";

class MockTTSImpl implements ITTSProviderImplementation {
	public speakCalls: string[] = [];
	public boundariesByText = new Map<
		string,
		Array<{ word: string; position: number; length?: number }>
	>();
	public onWordBoundary?: (
		word: string,
		position: number,
		length?: number,
	) => void;

	async speak(text: string): Promise<void> {
		this.speakCalls.push(text);
		for (const boundary of this.boundariesByText.get(text) || []) {
			this.onWordBoundary?.(
				boundary.word,
				boundary.position,
				boundary.length,
			);
		}
	}
	pause(): void {}
	resume(): void {}
	stop(): void {}
	isPlaying(): boolean {
		return false;
	}
	isPaused(): boolean {
		return false;
	}
}

class MockTTSProvider implements ITTSProvider {
	readonly providerId = "mock";
	readonly providerName = "Mock Provider";
	readonly version = "1.0.0";

	constructor(
		private impl: ITTSProviderImplementation,
		private supportsWordBoundary = true,
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
			supportsWordBoundary: this.supportsWordBoundary,
			supportsVoiceSelection: true,
			supportsRateControl: true,
			supportsPitchControl: true,
		};
	}
	destroy(): void {}
}

function textRange(textNode: Text, start: number, end: number): Range {
	const range = document.createRange();
	range.setStart(textNode, start);
	range.setEnd(textNode, end);
	return range;
}

function createRecordingCoordinator() {
	const wordHighlights: string[] = [];
	const sentenceHighlights: string[] = [];
	const sentenceElementHighlights: string[] = [];
	const clearTypes: string[] = [];

	return {
		wordHighlights,
		sentenceHighlights,
		sentenceElementHighlights,
		clearTypes,
		coordinator: {
			highlightTTSWord: (node: Text, start: number, end: number) => {
				wordHighlights.push(node.textContent?.slice(start, end) || "");
			},
			highlightRange: (range: Range) => {
				wordHighlights.push(range.toString());
			},
			highlightTTSWordElement: (element: Element) => {
				wordHighlights.push(element.textContent || "");
			},
			highlightTTSSentence: (ranges: Range[]) => {
				sentenceHighlights.push(
					ranges.map((range) => range.toString()).join("|"),
				);
			},
			highlightTTSSentenceElements: (elements: Element[]) => {
				sentenceElementHighlights.push(
					elements
						.map((element) => element.getAttribute("data-test-id") || "")
						.join("|"),
				);
			},
			clearHighlights: (type: unknown) => {
				clearTypes.push(String(type));
			},
			clearTTS: () => {},
			clearAll: () => {},
			isSupported: () => true,
			updateTTSHighlightStyle: () => {},
		},
	};
}

beforeAll(() => {
	if (!GlobalRegistrator.isRegistered) {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

describe("TTSService highlight target resolver", () => {
	test("exposes public resolver types and accepts a late-bound resolver provider", async () => {
		const impl = new MockTTSImpl();
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		const root = document.createElement("div");
		const context: TTSHighlightContext = { scopeElement: root, itemId: "item-1" };
		const resolver: TTSHighlightTargetResolver = {
			resolveWordRange: (range) => range,
			resolveSentenceRanges: (ranges) => ranges,
		};

		service.setHighlightTargetResolverProvider(() => ({ context, resolver }));

		expect(typeof service.speak).toBe("function");
	});

	test("uses the default identity resolver when no host resolver is present", async () => {
		const impl = new MockTTSImpl();
		impl.boundariesByText.set("spoken visible", [
			{ word: "spoken", position: 0, length: "spoken".length },
		]);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		const root = document.createElement("div");
		root.textContent = "spoken visible";
		const recording = createRecordingCoordinator();
		service.setHighlightCoordinator(recording.coordinator as any);
		service.setHighlightTargetResolverProvider(() => ({
			context: { scopeElement: root },
		}));

		await service.speak(root.textContent || "", { contentElement: root } as any);

		expect(recording.wordHighlights).toContain("spoken");
	});

	test("lets a host resolver remap the active word range before painting", async () => {
		const impl = new MockTTSImpl();
		impl.boundariesByText.set("spoken visible", [
			{ word: "spoken", position: 0, length: "spoken".length },
		]);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		const root = document.createElement("div");
		root.innerHTML = `<span id="spoken">spoken</span> <span id="visible">visible</span>`;
		const visibleText = root.querySelector("#visible")?.firstChild as Text;
		const recording = createRecordingCoordinator();
		service.setHighlightCoordinator(recording.coordinator as any);
		service.setHighlightTargetResolverProvider(() => ({
			context: { scopeElement: root },
			resolver: {
				resolveWordRange: () => textRange(visibleText, 0, "visible".length),
			},
		}));

		await service.speak(root.textContent || "", { contentElement: root } as any);

		expect(recording.wordHighlights).toContain("visible");
		expect(recording.wordHighlights).not.toContain("spoken");
	});

	test("lets a host resolver remap sentence ranges to visible elements", async () => {
		const impl = new MockTTSImpl();
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl, false));
		const root = document.createElement("div");
		root.innerHTML = `<p>native sentence.</p><section data-test-id="visible-block">Visible block</section>`;
		const visibleBlock = root.querySelector("section") as HTMLElement;
		const recording = createRecordingCoordinator();
		service.setHighlightCoordinator(recording.coordinator as any);
		service.setHighlightTargetResolverProvider(() => ({
			context: { scopeElement: root },
			resolver: {
				resolveSentenceRanges: () => [visibleBlock],
			},
		}));

		await service.speak("native sentence.", {
			contentElement: root.querySelector("p")!,
			highlightModeOverride: "sentence",
		} as any);

		expect(recording.sentenceElementHighlights).toContain("visible-block");
		expect(recording.sentenceHighlights).not.toContain("native sentence.");
	});

	test("falls open to identity when a host word resolver throws", async () => {
		const impl = new MockTTSImpl();
		impl.boundariesByText.set("spoken visible", [
			{ word: "spoken", position: 0, length: "spoken".length },
		]);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		const root = document.createElement("div");
		root.textContent = "spoken visible";
		const recording = createRecordingCoordinator();
		service.setHighlightCoordinator(recording.coordinator as any);
		service.setHighlightTargetResolverProvider(() => ({
			context: { scopeElement: root },
			resolver: {
				resolveWordRange: () => {
					throw new Error("resolver failed");
				},
			},
		}));

		await service.speak(root.textContent || "", { contentElement: root } as any);

		expect(recording.wordHighlights).toContain("spoken");
	});

	test("falls open to identity when a resolver returns a detached range", async () => {
		const impl = new MockTTSImpl();
		impl.boundariesByText.set("spoken visible", [
			{ word: "spoken", position: 0, length: "spoken".length },
		]);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		const root = document.createElement("div");
		root.textContent = "spoken visible";
		const detachedText = document.createTextNode("detached");
		const recording = createRecordingCoordinator();
		service.setHighlightCoordinator(recording.coordinator as any);
		service.setHighlightTargetResolverProvider(() => ({
			context: { scopeElement: root },
			resolver: {
				resolveWordRange: () => textRange(detachedText, 0, "detached".length),
			},
		}));

		await service.speak(root.textContent || "", { contentElement: root } as any);

		expect(recording.wordHighlights).toContain("spoken");
		expect(recording.wordHighlights).not.toContain("detached");
	});

	test("uses the latest resolver context after the scope changes", async () => {
		const impl = new MockTTSImpl();
		impl.boundariesByText.set("spoken one", [
			{ word: "spoken", position: 0, length: "spoken".length },
		]);
		impl.boundariesByText.set("spoken two", [
			{ word: "spoken", position: 0, length: "spoken".length },
		]);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		const firstRoot = document.createElement("div");
		firstRoot.innerHTML = `<span>spoken</span> <span id="first">one</span>`;
		const secondRoot = document.createElement("div");
		secondRoot.innerHTML = `<span>spoken</span> <span id="second">two</span>`;
		let currentRoot = firstRoot;
		const recording = createRecordingCoordinator();
		service.setHighlightCoordinator(recording.coordinator as any);
		service.setHighlightTargetResolverProvider(() => ({
			context: { scopeElement: currentRoot },
			resolver: {
				resolveWordRange: () => {
					const target = currentRoot.querySelector("#first, #second")
						?.firstChild as Text;
					return textRange(target, 0, target.textContent?.length || 0);
				},
			},
		}));

		await service.speak(firstRoot.textContent || "", {
			contentElement: firstRoot,
		} as any);
		currentRoot = secondRoot;
		await service.speak(secondRoot.textContent || "", {
			contentElement: secondRoot,
		} as any);

		expect(recording.wordHighlights).toContain("one");
		expect(recording.wordHighlights).toContain("two");
	});

	test("does not let an older resolver disposer clear a newer provider", async () => {
		const impl = new MockTTSImpl();
		impl.boundariesByText.set("spoken first", [
			{ word: "spoken", position: 0, length: "spoken".length },
		]);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		const root = document.createElement("div");
		root.innerHTML = `<span>spoken</span> <span id="first">first</span>`;
		const firstText = root.querySelector("#first")?.firstChild as Text;
		const recording = createRecordingCoordinator();
		service.setHighlightCoordinator(recording.coordinator as any);
		const disposeOld = service.setHighlightTargetResolverProvider(() => ({
			context: { scopeElement: root },
			resolver: {
				resolveWordRange: () => {
					throw new Error("stale resolver should not be called");
				},
			},
		}));
		const disposeCurrent = service.setHighlightTargetResolverProvider(() => ({
			context: { scopeElement: root },
			resolver: {
				resolveWordRange: () => textRange(firstText, 0, "first".length),
			},
		}));

		disposeOld();
		await service.speak(root.textContent || "", { contentElement: root } as any);
		disposeCurrent();

		expect(recording.wordHighlights).toContain("first");
	});

	test("clears the resolver provider when playback is stopped externally", async () => {
		const impl = new MockTTSImpl();
		impl.boundariesByText.set("spoken first", [
			{ word: "spoken", position: 0, length: "spoken".length },
		]);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		const root = document.createElement("div");
		root.innerHTML = `<span>spoken</span> <span id="first">first</span>`;
		const firstText = root.querySelector("#first")?.firstChild as Text;
		const recording = createRecordingCoordinator();
		service.setHighlightCoordinator(recording.coordinator as any);
		service.setHighlightTargetResolverProvider(() => ({
			context: { scopeElement: root },
			resolver: {
				resolveWordRange: () => textRange(firstText, 0, "first".length),
			},
		}));

		service.stop();
		await service.speak(root.textContent || "", { contentElement: root } as any);

		expect(recording.wordHighlights).toContain("spoken");
		expect(recording.wordHighlights).not.toContain("first");
	});

});
