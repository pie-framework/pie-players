/**
 * Recorded audio as a `spoken` alternate, played inside the composed chunk
 * sequence.
 *
 * The behaviours worth pinning are the ones a recording introduces that
 * synthesis never had: a second playback engine that can fail (and must fall
 * back to the reading script rather than going silent), a clip that must stop
 * when the learner stops read-aloud, and a suppressed node that must not be
 * played from a file any more than it is spoken by a voice.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	test,
} from "bun:test";

import type { CatalogCard } from "@pie-players/pie-players-shared";
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

const scriptCard = (content = "authored prompt speech"): CatalogCard => ({
	catalog: "spoken",
	language: "en-US",
	content,
});

const audioCard = (fragment?: {
	startSeconds: number;
	endSeconds?: number;
}): CatalogCard => ({
	catalog: "spoken",
	language: "en-US",
	payload: {
		media: {
			version: 1,
			id: "prompt-audio",
			kind: "audio",
			sources: [{ src: "/audio/prompt.mp3", type: "audio/mpeg" }],
		},
		...(fragment ? { fragment } : {}),
	} as CatalogCard["payload"],
});

let createdAudio: HTMLAudioElement[] = [];
let realCreateElement: typeof document.createElement | null = null;

const captureAudioElements = () => {
	createdAudio = [];
	realCreateElement = document.createElement.bind(document);
	document.createElement = ((tag: string, ...rest: unknown[]) => {
		const element = (
			realCreateElement as (tag: string, ...rest: unknown[]) => Element
		)(tag, ...rest);
		if (String(tag).toLowerCase() === "audio") {
			createdAudio.push(element as HTMLAudioElement);
		}
		return element;
	}) as typeof document.createElement;
};

/** Wait for the service to create and start an audio element. */
const nextAudioElement = async (): Promise<HTMLAudioElement> => {
	for (let attempt = 0; attempt < 200; attempt++) {
		const element = createdAudio.at(-1);
		if (element?.getAttribute("src")) return element;
		await new Promise((resolve) => setTimeout(resolve, 1));
	}
	throw new Error("no audio element was created");
};

const newService = async (cards: CatalogCard[]) => {
	const impl = new MockTTSImpl();
	const service = new TTSService();
	await service.initialize(new MockTTSProvider(impl));
	service.setCatalogResolver(
		new AccessibilityCatalogResolver([{ identifier: "prompt", cards }]),
	);
	return { impl, service };
};

const itemRoot = (suppress = false) => {
	const root = document.createElement("div");
	root.innerHTML = `<p>Before <span data-catalog-idref="prompt"${
		suppress ? ' data-tts-suppress="all"' : ""
	}>the prompt</span> after.</p>`;
	return root;
};

const speakItem = (service: TTSService, root: Element) =>
	service.speak(root.textContent || "", {
		contentElement: root,
		language: "en-US",
	} as never);

beforeAll(() => {
	if (typeof (globalThis as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterEach(() => {
	if (realCreateElement) {
		document.createElement = realCreateElement;
		realCreateElement = null;
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

describe("recorded audio as a spoken alternate", () => {
	test("plays the recording instead of synthesizing that node", async () => {
		const { impl, service } = await newService([audioCard()]);
		captureAudioElements();
		const speaking = speakItem(service, itemRoot());

		const element = await nextAudioElement();
		expect(element.getAttribute("src")).toBe("/audio/prompt.mp3");
		element.dispatchEvent(new Event("ended"));
		await speaking;

		// The docked node came from the file; its neighbours were still synthesized.
		expect(impl.speakCalls).toEqual(["Before", "after."]);
	});

	test("prefers the recording when the node carries both forms", async () => {
		const { impl, service } = await newService([scriptCard(), audioCard()]);
		captureAudioElements();
		const speaking = speakItem(service, itemRoot());

		const element = await nextAudioElement();
		element.dispatchEvent(new Event("ended"));
		await speaking;

		expect(impl.speakCalls).not.toContain("authored prompt speech");
	});

	test("falls back to the reading script when the recording will not play", async () => {
		const { impl, service } = await newService([scriptCard(), audioCard()]);
		captureAudioElements();
		const speaking = speakItem(service, itemRoot());

		const element = await nextAudioElement();
		// This is why QTI's guidance keeps the script beside the audio: a clip that
		// 404s must degrade to synthesized speech, not to silence.
		element.dispatchEvent(new Event("error"));
		await speaking;

		expect(impl.speakCalls).toContain("authored prompt speech");
	});

	test("goes quiet for that node when there is no script to fall back to", async () => {
		const { impl, service } = await newService([audioCard()]);
		captureAudioElements();
		const speaking = speakItem(service, itemRoot());

		const element = await nextAudioElement();
		element.dispatchEvent(new Event("error"));
		await expect(speaking).rejects.toThrow("recorded audio failed to play");

		expect(impl.speakCalls).toEqual(["Before"]);
	});

	test("applies a time range as a media fragment", async () => {
		const { service } = await newService([
			audioCard({ startSeconds: 4, endSeconds: 9 }),
		]);
		captureAudioElements();
		const speaking = speakItem(service, itemRoot());

		const element = await nextAudioElement();
		expect(element.getAttribute("src")).toBe("/audio/prompt.mp3#t=4,9");
		element.dispatchEvent(new Event("ended"));
		await speaking;
	});

	test("suppression beats a recording, as it beats a script", async () => {
		const { impl, service } = await newService([audioCard()]);
		captureAudioElements();

		await speakItem(service, itemRoot(true));

		// Nothing to settle: no element was ever created, so read-aloud never had a
		// file to play for a node marked not-to-be-spoken.
		expect(createdAudio).toHaveLength(0);
		expect(impl.speakCalls).toEqual(["Before after."]);
	});

	test("stop() ends a playing recording without wedging playback", async () => {
		const { service } = await newService([audioCard()]);
		captureAudioElements();
		const speaking = speakItem(service, itemRoot());

		const element = await nextAudioElement();
		service.stop();

		// The pending play must settle on cancellation. If it did not, this await
		// would hang forever and every later stop would leak a live clip.
		await speaking;
		expect(element.paused).toBe(true);
	});
});
