import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { AccessibilityCatalogResolver } from "../src/services/AccessibilityCatalogResolver";
import { PlaybackState, TTSService } from "../src/services/TTSService";
import type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSConfig,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";

class HeldTTSImpl implements ITTSProviderImplementation {
	public speakCalls: string[] = [];
	private release: (() => void) | null = null;
	async speak(text: string): Promise<void> {
		this.speakCalls.push(text);
		this.events.push(`speak ${text}`);
		await new Promise<void>((resolve) => {
			this.release = resolve;
		});
	}
	finish(): void {
		this.release?.();
		this.release = null;
	}
	pause(): void {}
	resume(): void {}
	stop(): void {
		this.finish();
	}
	isPlaying(): boolean {
		return this.release !== null;
	}
	isPaused(): boolean {
		return false;
	}
	public events: string[] = [];
	updateSettings(settings: { rate?: number }): void {
		if (settings.rate !== undefined) this.events.push(`rate ${settings.rate}`);
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
	getCapabilities(): TTSProviderCapabilities {
		return {
			supportsPause: true,
			supportsResume: true,
			supportsWordBoundary: false,
			supportsVoiceSelection: false,
			supportsRateControl: true,
			supportsPitchControl: false,
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

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function textRoot(text: string): HTMLElement {
	const root = document.createElement("div");
	root.textContent = text;
	return root;
}

describe("TTSService run owner", () => {
	test("reports the owner the latest read started with", async () => {
		const impl = new HeldTTSImpl();
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		expect(service.getRunOwner()).toBeNull();

		const first = service.speak(textRoot("First passage to read."), {
			ownerId: "inline-a",
		});
		expect(service.getRunOwner()).toBe("inline-a");

		const second = service.speak(textRoot("Second passage to read."));
		expect(service.getRunOwner()).toBeNull();

		await flush();
		impl.finish();
		await Promise.all([first, second]);
	});

	test("a new read announces loading while another read is still loading", async () => {
		const impl = new HeldTTSImpl();
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		const seen: Array<[PlaybackState, string | null]> = [];
		service.onStateChange((state) => {
			seen.push([state, service.getRunOwner()]);
		});

		const first = service.speak(textRoot("First passage to read."), {
			ownerId: "inline-a",
		});
		const second = service.speak(textRoot("Second passage to read."), {
			ownerId: "inline-b",
		});

		expect(seen).toEqual([
			[PlaybackState.LOADING, "inline-a"],
			[PlaybackState.LOADING, "inline-b"],
		]);

		await flush();
		impl.finish();
		await Promise.all([first, second]);
	});

	test("an image with only a spoken card reads the card", async () => {
		const impl = new HeldTTSImpl();
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));
		service.setCatalogResolver(
			new AccessibilityCatalogResolver([
				{
					identifier: "diagram",
					cards: [
						{
							catalog: "spoken",
							language: "en-US",
							content: "A diagram of the water cycle.",
						},
					],
				},
			]),
		);
		const root = document.createElement("div");
		root.innerHTML = `<img data-catalog-idref="diagram" src="cycle.png" alt="">`;

		const read = service.speak(root, { language: "en-US" });
		expect(service.getState()).toBe(PlaybackState.LOADING);
		await flush();
		impl.finish();
		await read;

		expect(impl.speakCalls).toEqual(["A diagram of the water cycle."]);
	});

	test("a read's rate applies before it speaks", async () => {
		const impl = new HeldTTSImpl();
		const service = new TTSService();
		await service.initialize(new MockTTSProvider(impl));

		const read = service.speak(textRoot("Read at a faster rate."), { rate: 1.5 });
		await flush();
		impl.finish();
		await read;

		expect(impl.events).toEqual(["rate 1.5", "speak Read at a faster rate."]);
	});
});
