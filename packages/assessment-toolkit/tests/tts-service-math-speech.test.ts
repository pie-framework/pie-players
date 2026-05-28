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

		expect(impl.speakCalls).toHaveLength(1);
		const spoken = impl.speakCalls[0].toLowerCase();
		expect(spoken).toContain("solve");
		expect(spoken).toContain("squared");
		expect(spoken).toContain("now");
		expect(spoken).not.toContain("<math");
		expect(spoken).not.toBe("solve x 2 now.");
	});
});
