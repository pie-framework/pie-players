import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSConfig,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";
import { TTSService } from "../src/services/TTSService";

class CapturingTTSImpl implements ITTSProviderImplementation {
	public speakCalls: string[] = [];
	public rejectSsml = false;
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
		if (this.rejectSsml && text.includes("<speak")) {
			throw new Error("SSML rejected by provider");
		}
		for (const boundary of this.boundariesByText.get(text) || []) {
			this.onWordBoundary?.(boundary.word, boundary.position, boundary.length);
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

class CapturingTTSProvider implements ITTSProvider {
	readonly providerId = "server-tts";
	readonly providerName = "Capturing Provider";
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
			supportsPitchControl: false,
			supportsSSML: true,
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

describe("TTSService automatic math speech", () => {
	test("converts MathML to natural-language speech without host configuration", async () => {
		const impl = new CapturingTTSImpl();
		const service = new TTSService();
		await service.initialize(new CapturingTTSProvider(impl), {});
		const content = document.createElement("div");
		content.innerHTML = `
			<p>
				Solve
				<math><msup><mi>x</mi><mn>2</mn></msup></math>
				now.
			</p>
		`;

		await service.speak(content.textContent || "", {
			contentElement: content,
			language: "en-US",
		});

		expect(impl.speakCalls.length).toBeGreaterThan(1);
		const spoken = impl.speakCalls.join(" ").toLowerCase();
		expect(spoken).toContain("solve");
		expect(spoken).toContain("squared");
		expect(spoken).toContain("now");
		expect(spoken).not.toContain("<math");
		expect(spoken).not.toBe("solve x 2 now.");
	});

	test("keeps prose word highlighting around generated MathML speech", async () => {
		const impl = new CapturingTTSImpl();
		const service = new TTSService();
		const highlightedWords: string[] = [];
		service.setHighlightCoordinator({
			highlightTTSWord(node: Text, start: number, end: number) {
				highlightedWords.push(node.textContent?.slice(start, end) || "");
			},
			highlightTTSSentence() {},
			highlightRange(range: Range) {
				highlightedWords.push(range.toString());
			},
			clearTTS() {},
			clearHighlights() {},
		} as any);
		await service.initialize(new CapturingTTSProvider(impl), {});
		const content = document.createElement("div");
		content.innerHTML = `
			<p>
				Solve
				<math><msup><mi>x</mi><mn>2</mn></msup></math>
				now.
			</p>
		`;
		impl.boundariesByText.set("Solve", [
			{ word: "Solve", position: 0, length: "Solve".length },
		]);

		await service.speak(content.textContent || "", {
			contentElement: content,
			language: "en-US",
		});

		expect(highlightedWords).toContain("Solve");
	});

	test("emits SRE SSML to SSML-capable (non-browser) providers for math", async () => {
		const impl = new CapturingTTSImpl();
		const service = new TTSService();
		await service.initialize(new CapturingTTSProvider(impl), {});
		const content = document.createElement("div");
		content.innerHTML = `<p>Solve <math><msup><mi>x</mi><mn>2</mn></msup></math> now.</p>`;

		await service.speak(content.textContent || "", {
			contentElement: content,
			language: "en-US",
		});

		// The math chunk is voiced as SSML; prose chunks remain plain text.
		expect(impl.speakCalls.some((text) => text.includes("<speak"))).toBe(true);
		expect(impl.speakCalls.some((text) => text === "Solve")).toBe(true);
	});

	test("falls back to plain text when the provider rejects SSML", async () => {
		const impl = new CapturingTTSImpl();
		impl.rejectSsml = true;
		const service = new TTSService();
		await service.initialize(new CapturingTTSProvider(impl), {});
		const content = document.createElement("div");
		content.innerHTML = `<p>Solve <math><msup><mi>x</mi><mn>2</mn></msup></math> now.</p>`;

		await service.speak(content.textContent || "", {
			contentElement: content,
			language: "en-US",
		});

		// It attempted SSML, was rejected, then retried the plain math variant.
		expect(impl.speakCalls.some((text) => text.includes("<speak"))).toBe(true);
		expect(
			impl.speakCalls.some(
				(text) => text.toLowerCase().includes("squared") && !text.includes("<speak"),
			),
		).toBe(true);
	});
});
