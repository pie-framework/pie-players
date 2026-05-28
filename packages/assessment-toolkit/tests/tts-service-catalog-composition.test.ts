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
});
