/**
 * Read-aloud suppression: content that is shown but must never be spoken.
 *
 * The cases that matter are the ones where a *second* path could speak what the
 * first refused. Suppression is a construct guard — on a decoding or spelling
 * item, speaking the node hands over the answer — so a route around it is not a
 * cosmetic bug, it invalidates the score. Every speech-producing entry point
 * therefore gets its own test here.
 */
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
	public onWordBoundary?: (
		word: string,
		position: number,
		length?: number,
	) => void;

	async speak(text: string): Promise<void> {
		this.speakCalls.push(text);
		const firstWord = text.match(/\S+/)?.[0] || "word";
		this.onWordBoundary?.(firstWord, 0, firstWord.length);
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

const newService = async () => {
	const impl = new MockTTSImpl();
	const service = new TTSService();
	await service.initialize(new MockTTSProvider(impl));
	return { impl, service };
};

const silenceWarnings = async (run: () => Promise<void>) => {
	const original = console.warn;
	console.warn = () => {};
	try {
		await run();
	} finally {
		console.warn = original;
	}
};

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

describe("read-aloud suppression across every speech path", () => {
	test("generated speech skips a suppressed node", async () => {
		const { impl, service } = await newService();
		const root = document.createElement("div");
		root.innerHTML = `<p>Which word begins with the same sound as <span data-tts-suppress="all">cake</span>?</p>`;

		await service.speak(root.textContent || "", {
			contentElement: root,
			language: "en-US",
		} as any);

		expect(impl.speakCalls).toHaveLength(1);
		expect(impl.speakCalls[0]).not.toContain("cake");
		expect(impl.speakCalls[0]).toContain("Which word begins");
	});

	test("suppression overrides an authored spoken card on the same node", async () => {
		const { impl, service } = await newService();
		const resolver = new AccessibilityCatalogResolver([
			{
				identifier: "choice-a",
				cards: [
					{
						catalog: "spoken",
						language: "en-US",
						content: "the word cake",
					},
				],
			},
		]);
		service.setCatalogResolver(resolver);
		const root = document.createElement("div");
		root.innerHTML = `<p>Pick one: <span data-catalog-idref="choice-a" data-tts-suppress="all">cake</span> or not.</p>`;

		await service.speak(root.textContent || "", {
			contentElement: root,
			language: "en-US",
		} as any);

		// The card says *how* to speak the node; suppression says it is not spoken
		// at all. A card that won an authored-SSML race here would be a leak with
		// an audit trail that looks deliberate.
		expect(impl.speakCalls.join(" | ")).not.toContain("cake");
		// One utterance, not two: a skipped node contributes no chunk boundary, so
		// the text either side of it coalesces and the gap leaves no audible seam
		// for a candidate to notice.
		expect(impl.speakCalls).toEqual(["Pick one: or not."]);
	});

	test("a suppressed sibling does not silence the rest of the composed item", async () => {
		const { impl, service } = await newService();
		const resolver = new AccessibilityCatalogResolver([
			{
				identifier: "prompt",
				cards: [
					{ catalog: "spoken", language: "en-US", content: "authored prompt" },
				],
			},
		]);
		service.setCatalogResolver(resolver);
		const root = document.createElement("div");
		root.innerHTML = `<p><span data-catalog-idref="prompt">Prompt</span> <span data-tts-suppress="computer-read-aloud">cake</span> tail.</p>`;

		await service.speak(root.textContent || "", {
			contentElement: root,
			language: "en-US",
		} as any);

		expect(impl.speakCalls).toEqual(["authored prompt", "tail."]);
	});

	test("selection read-aloud refuses a selection inside suppressed content", async () => {
		const { impl, service } = await newService();
		const root = document.createElement("div");
		root.innerHTML = `<p>Rhymes with <span data-tts-suppress="all">cake</span>?</p>`;
		const suppressedText = root.querySelector("span")?.firstChild as Text;
		const range = document.createRange();
		range.setStart(suppressedText, 0);
		range.setEnd(suppressedText, "cake".length);

		await silenceWarnings(async () => {
			await service.speakRange(range, { contentRoot: root });
		});

		// Selecting the word and pressing read-aloud is the obvious way around a
		// filter applied only to the DOM walk: this path never walks the DOM, it
		// passes `range.toString()` straight through.
		expect(impl.speakCalls).toEqual([]);
	});

	test("selection read-aloud speaks the rest of a selection that spans suppressed content", async () => {
		const { impl, service } = await newService();
		const root = document.createElement("div");
		root.innerHTML = `<p>Read <span data-tts-suppress="all">cake</span> now.</p>`;
		const paragraph = root.querySelector("p") as Element;
		const range = document.createRange();
		range.setStart(paragraph.firstChild as Text, 0);
		range.setEnd(paragraph.lastChild as Text, " now.".length);

		await service.speakRange(range, { contentRoot: root });

		expect(impl.speakCalls).toEqual(["Read now."]);
	});

	test("word highlighting stays aligned when suppressed text precedes the selection", async () => {
		const { impl, service } = await newService();
		const root = document.createElement("div");
		root.innerHTML = `<p>Say <span data-tts-suppress="all">cake</span> then these words.</p>`;
		const tail = root.querySelector("p")?.lastChild as Text;
		const range = document.createRange();
		range.setStart(tail, " then ".length);
		range.setEnd(tail, " then these".length);
		const highlighted: string[] = [];
		service.setHighlightCoordinator({
			highlightTTSWord: (node: Text, start: number, end: number) => {
				highlighted.push(node.textContent?.slice(start, end) || "");
			},
			highlightTTSSentence: () => {},
			clearTTS: () => {},
			isSupported: () => true,
			updateTTSHighlightStyle: () => {},
		} as any);

		await service.speakRange(range, { contentRoot: root });

		expect(impl.speakCalls).toEqual(["these"]);
		// The offset the highlighter uses indexes into the highlight text, which
		// excludes the suppressed node. Counting "cake" while the highlight text
		// omits it would land this on a different word.
		expect(highlighted).toEqual(["these"]);
	});
});
