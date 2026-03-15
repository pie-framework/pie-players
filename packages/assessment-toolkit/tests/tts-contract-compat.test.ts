import { describe, expect, test } from "bun:test";
import type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSSpeechSegment,
} from "@pie-players/pie-tts";
import type { TtsServiceApi } from "../src/services/interfaces";
import { TTSService } from "../src/services/TTSService";
import { BrowserTTSProvider } from "../src/services/tts/browser-provider";
import { ServerTTSProvider } from "@pie-players/tts-client-server";

describe("TTS contract compatibility", () => {
	test("browser and server providers satisfy canonical ITTSProvider", () => {
		const providers: ITTSProvider[] = [
			new BrowserTTSProvider(),
			new ServerTTSProvider(),
		];

		const providerIds = providers.map((p) => p.providerId);
		expect(providerIds).toContain("browser");
		expect(providerIds).toContain("server-tts");
	});

	test("onWordBoundary callback accepts optional length", () => {
		let receivedLength: number | undefined;
		const callback: NonNullable<ITTSProviderImplementation["onWordBoundary"]> = (
			_word,
			_position,
			length,
		) => {
			receivedLength = length;
		};

		callback("alpha", 10);
		expect(receivedLength).toBeUndefined();
		callback("beta", 20, 4);
		expect(receivedLength).toBe(4);
	});

	test("segmented and non-segmented provider implementations are both valid", async () => {
		const withSegments: ITTSProviderImplementation = {
			async speak(_text: string) {},
			async speakSegments(_segments: TTSSpeechSegment[]) {},
			pause() {},
			resume() {},
			stop() {},
			isPlaying() {
				return false;
			},
			isPaused() {
				return false;
			},
		};

		const withoutSegments: ITTSProviderImplementation = {
			async speak(_text: string) {},
			pause() {},
			resume() {},
			stop() {},
			isPlaying() {
				return false;
			},
			isPaused() {
				return false;
			},
		};

		await withSegments.speak("one");
		await withSegments.speakSegments?.([
			{ text: "segment", startOffset: 0, pauseMsAfter: 100 },
		]);
		await withoutSegments.speak("two");
		expect(typeof withSegments.speakSegments).toBe("function");
		expect(withoutSegments.speakSegments).toBeUndefined();
	});

test("TTSService satisfies seek-capable TtsServiceApi contract", () => {
		const service: TtsServiceApi = new TTSService();
		expect(typeof service.seekForward).toBe("function");
		expect(typeof service.seekBackward).toBe("function");
	});
});
