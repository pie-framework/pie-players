import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { AccessibilityCatalogResolver } from "../src/services/AccessibilityCatalogResolver";
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
	public rejectOnText: string | null = null;
	public deferOnText: string | null = null;
	private deferredSpeakResolve: (() => void) | null = null;
	public onWordBoundary?: (
		word: string,
		position: number,
		length?: number,
	) => void;

	async speak(text: string): Promise<void> {
		this.speakCalls.push(text);
		if (this.rejectOnText === text) {
			throw new Error("mock speak failed");
		}
		if (this.deferOnText === text) {
			await new Promise<void>((resolve) => {
				this.deferredSpeakResolve = resolve;
			});
		}
		const scripted = this.boundariesByText.get(text);
		if (scripted) {
			for (const boundary of scripted) {
				this.onWordBoundary?.(
					boundary.word,
					boundary.position,
					boundary.length,
				);
			}
			return;
		}
		const firstWord = text.match(/\S+/)?.[0] || "word";
		this.onWordBoundary?.(firstWord, 0, firstWord.length);
	}
	resolveDeferredSpeak(): void {
		this.deferredSpeakResolve?.();
		this.deferredSpeakResolve = null;
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

	constructor(private impl: ITTSProviderImplementation) {}

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
		};
	}
	destroy(): void {}
}

beforeAll(() => {
	if (typeof (globalThis as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

describe("TTSService catalog speech composition", () => {
	test("speaks full-region catalog chunks in DOM order with uncataloged text", async () => {
		const impl = new MockTTSImpl();
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		const resolver = new AccessibilityCatalogResolver();
		resolver.registerCatalogs(
			{
				ownerKind: "itemModel",
				itemId: "item-1",
				canonicalItemId: "item-1",
				modelId: "q1",
			},
			[
				{
					identifier: "q1-prompt",
					cards: [
						{
							catalog: "spoken",
							language: "en-US",
							content: "authored prompt speech",
						},
					],
				},
				{
					identifier: "q1-choice-a",
					cards: [
						{
							catalog: "spoken",
							language: "en-US",
							content: "<speak><emphasis>choice A</emphasis></speak>",
						},
					],
				},
			],
		);
		service.setCatalogResolver(resolver);
		const root = document.createElement("div");
		root.innerHTML = `
			<p>Before <span data-catalog-idref="q1-prompt">visible prompt</span> between
			<span data-catalog-idref="q1-choice-a">A</span> after.</p>
		`;

		await service.speak(root.textContent || "", {
			contentElement: root,
			language: "en-US",
			catalogContext: {
				ownerKind: "itemModel",
				itemId: "item-1",
				canonicalItemId: "item-1",
				modelId: "q1",
			},
		} as any);

		expect(impl.speakCalls).toEqual([
			"Before",
			"authored prompt speech",
			"between",
			"<speak><emphasis>choice A</emphasis></speak>",
			"after.",
		]);
	});

	test("selection speech remains selected visible text only", async () => {
		const impl = new MockTTSImpl();
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		const resolver = new AccessibilityCatalogResolver([
			{
				identifier: "global-prompt",
				cards: [
					{
						catalog: "spoken",
						language: "en-US",
						content: "whole prompt should not be used",
					},
				],
			},
		]);
		service.setCatalogResolver(resolver);
		const root = document.createElement("div");
		root.innerHTML = `<p data-catalog-idref="global-prompt">Select only these words.</p>`;
		const textNode = root.querySelector("p")?.firstChild as Text;
		const range = document.createRange();
		range.setStart(textNode, "Select only ".length);
		range.setEnd(textNode, "Select only these".length);

		await service.speakRange(range, { contentRoot: root });

		expect(impl.speakCalls).toEqual(["these"]);
	});

	test("selection speech keeps word highlighting while ignoring catalogs", async () => {
		const impl = new MockTTSImpl();
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		const resolver = new AccessibilityCatalogResolver([
			{
				identifier: "global-prompt",
				cards: [
					{
						catalog: "spoken",
						language: "en-US",
						content: "whole prompt should not be used",
					},
				],
			},
		]);
		service.setCatalogResolver(resolver);
		const root = document.createElement("div");
		root.innerHTML = `<p data-catalog-idref="global-prompt">Select only these words.</p>`;
		const textNode = root.querySelector("p")?.firstChild as Text;
		const range = document.createRange();
		range.setStart(textNode, "Select only ".length);
		range.setEnd(textNode, "Select only these".length);
		const highlightedWords: string[] = [];
		service.setHighlightCoordinator({
			highlightTTSWord: (node: Text, start: number, end: number) => {
				highlightedWords.push(node.textContent?.slice(start, end) || "");
			},
			highlightTTSSentence: () => {},
			clearTTS: () => {},
			isSupported: () => true,
			updateTTSHighlightStyle: () => {},
		} as any);

		await service.speakRange(range, { contentRoot: root });

		expect(impl.speakCalls).toEqual(["these"]);
		expect(highlightedWords).toEqual(["these"]);
	});

	test("uses exact words and anchor spans for mixed catalog chunks", async () => {
		const impl = new MockTTSImpl();
		const formulaSpeech =
			"x equals negative b plus or minus square root of b squared minus four a c all over two a";
		impl.boundariesByText.set("Start here.", [
			{ word: "Start", position: 0, length: 5 },
		]);
		impl.boundariesByText.set(formulaSpeech, [
			{
				word: "plus",
				position: formulaSpeech.indexOf("plus"),
				length: "plus".length,
			},
			{
				word: "root",
				position: formulaSpeech.indexOf("root"),
				length: "root".length,
			},
		]);
		const promptSsml = `<speak xml:lang="en-US">
			Based on the passage, which method should you use to solve
			<prosody rate="slow">X squared, minus 5 X, plus 6,
			equals zero</prosody>?
		</speak>`;
		const promptSpoken =
			"Based on the passage, which method should you use to solve X squared, minus 5 X, plus 6, equals zero?";
		impl.boundariesByText.set(promptSsml, [
			{ word: "X", position: promptSpoken.indexOf("X"), length: 1 },
		]);
		impl.boundariesByText.set("End here.", [
			{ word: "End", position: 0, length: 3 },
		]);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		const resolver = new AccessibilityCatalogResolver([
			{
				identifier: "intro",
				cards: [
					{ catalog: "spoken", language: "en-US", content: "Start here." },
				],
			},
			{
				identifier: "formula",
				cards: [{ catalog: "spoken", language: "en-US", content: formulaSpeech }],
			},
			{
				identifier: "prompt",
				cards: [{ catalog: "spoken", language: "en-US", content: promptSsml }],
			},
			{
				identifier: "outro",
				cards: [
					{ catalog: "spoken", language: "en-US", content: "End here." },
				],
			},
		]);
		service.setCatalogResolver(resolver);
		const root = document.createElement("div");
		root.innerHTML = `
			<span data-catalog-idref="intro">Start here.</span>
			<span data-catalog-idref="formula">x = (-b ± √(b² - 4ac)) / 2a</span>
			<span data-catalog-idref="prompt">Based on the passage, which method should you use to solve x2-5⁢x+6=0?</span>
			<span data-catalog-idref="outro">End here.</span>
		`;
		const highlightedWords: string[] = [];
		const sentenceHighlights: string[] = [];
		service.setHighlightCoordinator({
			highlightTTSWord: (node: Text, start: number, end: number) => {
				highlightedWords.push(node.textContent?.slice(start, end) || "");
			},
			highlightTTSSentence: (ranges: Range[]) => {
				sentenceHighlights.push(
					ranges.map((range) => range.toString()).join("|"),
				);
			},
			clearTTS: () => {},
			isSupported: () => true,
			updateTTSHighlightStyle: () => {},
		} as any);

		await service.speak(root.textContent || "", {
			contentElement: root,
			language: "en-US",
		} as any);

		expect(impl.speakCalls).toEqual([
			"Start here.",
			formulaSpeech,
			promptSsml,
			"End here.",
		]);
		expect(highlightedWords).toContain("Start");
		expect(highlightedWords).toContain("±");
		expect(highlightedWords).toContain("√");
		expect(highlightedWords).toContain("x");
		expect(highlightedWords).toContain("End");
		expect(sentenceHighlights).not.toContain("±");
		expect(sentenceHighlights).not.toContain("√");
		expect(
			sentenceHighlights.some((highlight) =>
				highlight.includes("x = (-b ± √(b² - 4ac)) / 2a"),
			),
		).toBe(true);
	});

	test("maps raw SSML provider offsets for exact catalog chunks", async () => {
		const impl = new MockTTSImpl();
		const ssml = '<speak><break time="250ms"/>Hello world</speak>';
		impl.boundariesByText.set(ssml, [
			{
				word: "Hello",
				position: ssml.indexOf("Hello"),
				length: "Hello".length,
			},
		]);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		service.setCatalogResolver(
			new AccessibilityCatalogResolver([
				{
					identifier: "prompt",
					cards: [{ catalog: "spoken", language: "en-US", content: ssml }],
				},
			]),
		);
		const root = document.createElement("div");
		root.innerHTML = `<span data-catalog-idref="prompt">Hello world</span>`;
		const highlightedWords: string[] = [];
		service.setHighlightCoordinator({
			highlightTTSWord: (node: Text, start: number, end: number) => {
				highlightedWords.push(node.textContent?.slice(start, end) || "");
			},
			highlightTTSSentence: () => {},
			clearTTS: () => {},
			isSupported: () => true,
			updateTTSHighlightStyle: () => {},
		} as any);

		await service.speak(root.textContent || "", {
			contentElement: root,
			language: "en-US",
		} as any);

		expect(highlightedWords).toEqual(["Hello"]);
	});

	test("uses math alignment for catalog MathML operator boundaries", async () => {
		const impl = new MockTTSImpl();
		const speech = "2 times 7";
		impl.boundariesByText.set(speech, [
			{ word: "times", position: speech.indexOf("times"), length: 5 },
		]);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		service.setCatalogResolver(
			new AccessibilityCatalogResolver([
				{
					identifier: "formula",
					cards: [{ catalog: "spoken", language: "en-US", content: speech }],
				},
			]),
		);
		const root = document.createElement("div");
		root.innerHTML = `
			<span data-catalog-idref="formula">
				<math xmlns="http://www.w3.org/1998/Math/MathML"><mn>2</mn><mo>&#215;</mo><mn>7</mn></math>
			</span>
		`;
		const highlightedWords: string[] = [];
		const highlightedRanges: string[] = [];
		service.setHighlightCoordinator({
			highlightTTSWord: (node: Text, start: number, end: number) => {
				highlightedWords.push(node.textContent?.slice(start, end) || "");
			},
			highlightRange: (range: Range) => {
				highlightedRanges.push(range.toString());
			},
			// Whole-expression fallbacks paint the element itself, not a range.
			highlightTTSWordElement: (element: Element) => {
				highlightedRanges.push(element.textContent || "");
			},
			highlightTTSSentence: () => {},
			clearHighlights: () => {},
			clearTTS: () => {},
			isSupported: () => true,
			updateTTSHighlightStyle: () => {},
		} as any);

		await service.speak(root.textContent || "", {
			contentElement: root,
			language: "en-US",
		} as any);

		expect(highlightedWords).toEqual(["×"]);
		// Native MathML is token-capable, so the operator highlights as a token
		// and the whole expression is never painted as a word-layer block.
		expect(highlightedRanges).not.toContain("2×7");
	});

	test("does not route prose boundaries in mixed catalog regions to the first MathML expression", async () => {
		const impl = new MockTTSImpl();
		const speech = "Before 2 times 7 after.";
		impl.boundariesByText.set(speech, [
			{ word: "Before", position: 0, length: "Before".length },
			{ word: "times", position: speech.indexOf("times"), length: 5 },
		]);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		service.setCatalogResolver(
			new AccessibilityCatalogResolver([
				{
					identifier: "mixed",
					cards: [{ catalog: "spoken", language: "en-US", content: speech }],
				},
			]),
		);
		const root = document.createElement("div");
		root.innerHTML = `
			<div data-catalog-idref="mixed">
				Before
				<math xmlns="http://www.w3.org/1998/Math/MathML"><mn>2</mn><mo>&#215;</mo><mn>7</mn></math>
				after.
			</div>
		`;
		const highlightedWords: string[] = [];
		const sentenceHighlights: string[] = [];
		service.setHighlightCoordinator({
			highlightTTSWord: (node: Text, start: number, end: number) => {
				highlightedWords.push(node.textContent?.slice(start, end) || "");
			},
			highlightRange: (range: Range) => {
				highlightedWords.push(range.toString());
			},
			highlightTTSSentence: (ranges: Range[]) => {
				sentenceHighlights.push(
					ranges.map((range) => range.toString()).join("|"),
				);
			},
			clearHighlights: () => {},
			clearTTS: () => {},
			isSupported: () => true,
			updateTTSHighlightStyle: () => {},
		} as any);

		await service.speak(root.textContent || "", {
			contentElement: root,
			language: "en-US",
		} as any);

		expect(highlightedWords).toContain("Before");
		expect(highlightedWords).toContain("×");
		expect(sentenceHighlights.at(-1)).not.toBe("2×7");
	});

	test("does not claim repeated prose math words as mixed MathML boundaries", async () => {
		const impl = new MockTTSImpl();
		const speech = "Review 2 times 7, then solve 2 times 7.";
		const firstTimes = speech.indexOf("times");
		const secondTimes = speech.indexOf("times", firstTimes + 1);
		impl.boundariesByText.set(speech, [
			{ word: "times", position: firstTimes, length: "times".length },
			{ word: "times", position: secondTimes, length: "times".length },
		]);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		service.setCatalogResolver(
			new AccessibilityCatalogResolver([
				{
					identifier: "mixed",
					cards: [{ catalog: "spoken", language: "en-US", content: speech }],
				},
			]),
		);
		const root = document.createElement("div");
		root.innerHTML = `
			<div data-catalog-idref="mixed">
				Review 2 times 7, then solve
				<math xmlns="http://www.w3.org/1998/Math/MathML"><mn>2</mn><mo>&#215;</mo><mn>7</mn></math>.
			</div>
		`;
		const highlightedWords: string[] = [];
		service.setHighlightCoordinator({
			highlightTTSWord: (node: Text, start: number, end: number) => {
				highlightedWords.push(node.textContent?.slice(start, end) || "");
			},
			highlightRange: (range: Range) => {
				highlightedWords.push(range.toString());
			},
			highlightTTSSentence: () => {},
			clearHighlights: () => {},
			clearTTS: () => {},
			isSupported: () => true,
			updateTTSHighlightStyle: () => {},
		} as any);

		await service.speak(root.textContent || "", {
			contentElement: root,
			language: "en-US",
		} as any);

		expect(highlightedWords).toEqual(["times", "×"]);
	});

	test("keeps the answer choice region highlighted while tracking split MathML catalogs", async () => {
		const impl = new MockTTSImpl();
		const proseSpeech = "Factoring, because this equation factors easily into";
		const formulaSpeech = "X minus 2, times X minus 3";
		impl.boundariesByText.set(proseSpeech, [
			{ word: "this", position: proseSpeech.indexOf("this"), length: 4 },
		]);
		impl.boundariesByText.set(formulaSpeech, []);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		service.setCatalogResolver(
			new AccessibilityCatalogResolver([
				{
					identifier: "choice-text",
					cards: [{ catalog: "spoken", language: "en-US", content: proseSpeech }],
				},
				{
					identifier: "choice-equation",
					cards: [
						{ catalog: "spoken", language: "en-US", content: formulaSpeech },
					],
				},
			]),
		);
		const root = document.createElement("div");
		root.innerHTML = `
			<div>
				<span data-catalog-idref="choice-text">Factoring, because this equation factors easily into</span>
				<span data-catalog-idref="choice-equation">
					<math xmlns="http://www.w3.org/1998/Math/MathML">
						<mrow>
							<mo>(</mo><mi>x</mi><mo>-</mo><mn>2</mn><mo>)</mo>
							<mo>&#x2062;</mo>
							<mo>(</mo><mi>x</mi><mo>-</mo><mn>3</mn><mo>)</mo>
						</mrow>
					</math>
				</span>
			</div>
		`;
		const highlightedWords: string[] = [];
		const sentenceHighlights: string[] = [];
		service.setHighlightCoordinator({
			highlightTTSWord: (node: Text, start: number, end: number) => {
				highlightedWords.push(node.textContent?.slice(start, end) || "");
			},
			highlightRange: (range: Range) => {
				highlightedWords.push(range.toString());
			},
			// Whole-expression fallbacks paint the element itself, not a range.
			highlightTTSWordElement: (element: Element) => {
				highlightedWords.push(element.textContent || "");
			},
			highlightTTSSentence: (ranges: Range[]) => {
				sentenceHighlights.push(
					ranges
						.map((range) => range.toString().replace(/\s+/g, " ").trim())
						.join("|"),
				);
			},
			clearHighlights: () => {},
			clearTTS: () => {},
			isSupported: () => true,
			updateTTSHighlightStyle: () => {},
		} as any);

		await service.speak(root.textContent || "", {
			contentElement: root,
			language: "en-US",
		} as any);

		expect(
			sentenceHighlights.some(
				(highlight) =>
					highlight.startsWith(
						"Factoring, because this equation factors easily into",
					) &&
					highlight.includes("(x-2)") &&
					highlight.includes("(x-3)"),
			),
		).toBe(true);
		expect(highlightedWords).toContain("this");
		// The equation catalog emits no word boundaries and the equation is
		// token-capable, so the whole expression is NOT painted as a word-layer
		// block; the answer-choice region (asserted above) keeps it visible.
		expect(
			highlightedWords
				.map((highlight) => highlight.replace(/\s+/g, ""))
				.includes("(x-2)⁢(x-3)"),
		).toBe(false);
	});

	test("keeps whole-region fallback for unsupported semantic SSML", async () => {
		const impl = new MockTTSImpl();
		const ssml = '<speak>Listen <audio src="tone.mp3"/> now.</speak>';
		impl.boundariesByText.set(ssml, [
			{ word: "Listen", position: ssml.indexOf("Listen"), length: 6 },
		]);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		service.setCatalogResolver(
			new AccessibilityCatalogResolver([
				{
					identifier: "prompt",
					cards: [{ catalog: "spoken", language: "en-US", content: ssml }],
				},
			]),
		);
		const root = document.createElement("div");
		root.innerHTML = `<span data-catalog-idref="prompt">Listen now.</span>`;
		const highlightedWords: string[] = [];
		const sentenceHighlights: string[] = [];
		service.setHighlightCoordinator({
			highlightTTSWord: (node: Text, start: number, end: number) => {
				highlightedWords.push(node.textContent?.slice(start, end) || "");
			},
			highlightTTSSentence: (ranges: Range[]) => {
				sentenceHighlights.push(
					ranges.map((range) => range.toString()).join("|"),
				);
			},
			clearTTS: () => {},
			isSupported: () => true,
			updateTTSHighlightStyle: () => {},
		} as any);

		await service.speak(root.textContent || "", {
			contentElement: root,
			language: "en-US",
		} as any);

		expect(highlightedWords).toEqual([]);
		expect(sentenceHighlights).toContain("Listen now.");
	});

	test("uses word-layer formula fallback for an expression-mode MathJax fraction", async () => {
		const impl = new MockTTSImpl();
		const speech = "fifteen eighths";
		impl.boundariesByText.set(speech, [
			{ word: "fifteen", position: 0, length: "fifteen".length },
		]);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		service.setCatalogResolver(
			new AccessibilityCatalogResolver([
				{
					identifier: "fraction",
					cards: [{ catalog: "spoken", language: "en-US", content: speech }],
				},
			]),
		);
		const root = document.createElement("div");
		// A MathJax 2D layout (mjx-mfrac) cannot be tracked per token, so the
		// equation is classified expression-mode and is painted as one stable
		// block at the word layer.
		root.innerHTML = `
			<span data-catalog-idref="fraction">
				<mjx-container>
					<mjx-math aria-hidden="true"><mjx-mfrac></mjx-mfrac></mjx-math>
					<mjx-assistive-mml>
						<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mn>15</mn><mn>8</mn></mfrac></math>
					</mjx-assistive-mml>
				</mjx-container>
			</span>
		`;
		const wordRanges: string[] = [];
		const sentenceHighlights: string[] = [];
		service.setHighlightCoordinator({
			highlightTTSWord: () => {},
			highlightRange: (range: Range, type: unknown) => {
				if (String(type) === "tts-word") wordRanges.push(range.toString());
			},
			// Low-confidence math falls back to painting the whole formula element
			// at the word layer (no text node to range over).
			highlightTTSWordElement: (element: Element) => {
				wordRanges.push(element.textContent || "");
			},
			highlightTTSSentence: (ranges: Range[]) => {
				sentenceHighlights.push(
					ranges.map((range) => range.toString()).join("|"),
				);
			},
			clearHighlights: () => {},
			clearTTS: () => {},
			isSupported: () => true,
			updateTTSHighlightStyle: () => {},
		} as any);

		await service.speak(root.textContent || "", {
			contentElement: root,
			language: "en-US",
		} as any);

		// The whole formula is painted at the word layer (element textContent
		// carries surrounding markup whitespace, so compare without it).
		expect(wordRanges.map((range) => range.replace(/\s+/g, ""))).toContain(
			"158",
		);
		expect((sentenceHighlights.at(-1) || "").replace(/\s+/g, "")).toContain(
			"158",
		);
	});

	test("restores whole-region highlight when anchor boundary cannot resolve", async () => {
		const impl = new MockTTSImpl();
		const speech = "alpha beta trailing";
		impl.boundariesByText.set(speech, [
			{ word: "beta", position: speech.indexOf("beta"), length: 4 },
			{
				word: "trailing",
				position: speech.indexOf("trailing"),
				length: "trailing".length,
			},
		]);
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		service.setCatalogResolver(
			new AccessibilityCatalogResolver([
				{
					identifier: "prompt",
					cards: [{ catalog: "spoken", language: "en-US", content: speech }],
				},
			]),
		);
		const root = document.createElement("div");
		root.innerHTML = `<span data-catalog-idref="prompt">alpha beta</span>`;
		const sentenceHighlights: string[] = [];
		service.setHighlightCoordinator({
			highlightTTSWord: () => {},
			highlightTTSSentence: (ranges: Range[]) => {
				sentenceHighlights.push(
					ranges.map((range) => range.toString()).join("|"),
				);
			},
			clearHighlights: () => {},
			clearTTS: () => {},
			isSupported: () => true,
			updateTTSHighlightStyle: () => {},
		} as any);

		await service.speak(root.textContent || "", {
			contentElement: root,
			language: "en-US",
		} as any);

		expect(sentenceHighlights.at(-1)).toBe("alpha beta");
	});

	test("restores chunk word-boundary handler after provider rejection", async () => {
		const impl = new MockTTSImpl();
		impl.rejectOnText = "authored prompt speech";
		impl.onWordBoundary = () => {};
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		const resolver = new AccessibilityCatalogResolver([
			{
				identifier: "prompt",
				cards: [
					{
						catalog: "spoken",
						language: "en-US",
						content: "authored prompt speech",
					},
				],
			},
		]);
		service.setCatalogResolver(resolver);
		const root = document.createElement("div");
		root.innerHTML = `<span data-catalog-idref="prompt">visible prompt</span>`;
		service.setHighlightCoordinator({
			highlightTTSWord: () => {},
			highlightTTSSentence: () => {},
			clearTTS: () => {},
			isSupported: () => true,
			updateTTSHighlightStyle: () => {},
		} as any);

		await expect(
			service.speak(root.textContent || "", {
				contentElement: root,
				language: "en-US",
			} as any),
		).rejects.toThrow("mock speak failed");

		expect(impl.onWordBoundary).toBeUndefined();
	});

	test("restores chunk word-boundary handler after interrupted playback", async () => {
		const impl = new MockTTSImpl();
		const ssml = "<p>Hello</p>";
		impl.deferOnText = ssml;
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		service.setCatalogResolver(
			new AccessibilityCatalogResolver([
				{
					identifier: "prompt",
					cards: [{ catalog: "spoken", language: "en-US", content: ssml }],
				},
			]),
		);
		const root = document.createElement("div");
		root.innerHTML = `<span data-catalog-idref="prompt">Hello</span>`;
		service.setHighlightCoordinator({
			highlightTTSWord: () => {},
			highlightTTSSentence: () => {},
			clearTTS: () => {},
			isSupported: () => true,
			updateTTSHighlightStyle: () => {},
		} as any);

		const speakPromise = service.speak(root.textContent || "", {
			contentElement: root,
			language: "en-US",
		} as any);
		await Promise.resolve();
		await Promise.resolve();
		expect(impl.onWordBoundary).toBeDefined();

		service.stop();
		impl.resolveDeferredSpeak();
		await speakPromise;

		expect(impl.onWordBoundary).toBeUndefined();
	});
});
