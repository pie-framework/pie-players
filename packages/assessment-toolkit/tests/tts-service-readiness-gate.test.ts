import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";
import { TTSService } from "../src/services/TTSService";
import { isTTSStartFailure } from "../src/services/tts/start-failure";
import { contentWith } from "./fixtures/read-aloud-content";

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

/**
 * A speak before the service has a provider waits for the readiness gate, so a
 * caller that never started speech itself still speaks.
 */

const spoken: string[] = [];

const impl: ITTSProviderImplementation = {
	async speak(text: string) {
		spoken.push(text);
	},
	pause() {},
	resume() {},
	stop() {},
	updateSettings: () => {},
};

const provider: ITTSProvider = {
	providerId: "mock",
	initialize: async () => impl,
	getCapabilities: () =>
		({
			supportsWordBoundary: false,
		}) as TTSProviderCapabilities,
	destroy() {},
};

describe("TTSService readiness gate", () => {
	test("a speak before initialization starts the service through the gate", async () => {
		spoken.length = 0;
		const service = new TTSService();
		let gateCalls = 0;
		service.setReadinessGate(async () => {
			gateCalls += 1;
			await service.initialize(provider);
		});

		await service.speak(contentWith("hello"));

		expect(gateCalls).toBe(1);
		expect(spoken).toEqual(["hello"]);

		await service.speak(contentWith("again"));
		expect(gateCalls).toBe(1);
	});

	test("a gate that rejects fails the speak with its error", async () => {
		const service = new TTSService();
		service.setReadinessGate(async () => {
			throw new Error("speech unavailable");
		});

		const failure = await service
			.speak(contentWith("hello"))
			.catch((error) => error);
		expect((failure as Error).message).toBe("speech unavailable");
		expect(isTTSStartFailure(failure)).toBe(true);
	});

	test("without a gate an uninitialized service still refuses to speak", async () => {
		const service = new TTSService();

		const failure = await service
			.speak(contentWith("hello"))
			.catch((error) => error);
		expect((failure as Error).message).toBe("TTS service not initialized");
		expect(isTTSStartFailure(failure)).toBe(true);
	});

	test("a failure while speaking is not a start failure", async () => {
		const service = new TTSService();
		await service.initialize({
			...provider,
			initialize: async () => ({
				...impl,
				speak: async () => {
					throw new Error("playback failed");
				},
			}),
		});

		const failure = await service
			.speak(contentWith("hello"))
			.catch((error) => error);
		expect(isTTSStartFailure(failure)).toBe(false);
	});
});
