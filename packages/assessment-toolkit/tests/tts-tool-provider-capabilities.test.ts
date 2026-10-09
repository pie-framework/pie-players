import { afterEach, describe, expect, test } from "bun:test";
import type {
	ITTSProvider,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";
import { TTSToolProvider } from "../src/services/tool-providers/TTSToolProvider";

const originalWindow = (globalThis as any).window;

afterEach(() => {
	(globalThis as any).window = originalWindow;
});

const serverCapabilities: TTSProviderCapabilities = {
	supportsPause: true,
	supportsResume: true,
	supportsWordBoundary: true,
	supportsVoiceSelection: true,
	supportsRateControl: true,
	supportsPitchControl: false,
};

class StubServerProvider {
	readonly providerId = "server-tts";
	readonly providerName = "Stub";
	readonly version = "0";
	initialize = async () => ({}) as never;
	getCapabilities = () => serverCapabilities;
	destroy = () => {};
}

describe("TTSToolProvider capabilities", () => {
	test("report the speech provider's own features", async () => {
		(globalThis as any).window = { speechSynthesis: {} };
		const browser = new TTSToolProvider("browser");
		await browser.initialize({});
		const server = new TTSToolProvider("server", {
			loadServerProvider: async () =>
				StubServerProvider as unknown as new () => ITTSProvider,
		});
		await server.initialize({ apiEndpoint: "/api/tts" });

		expect(browser.getCapabilities().features).toMatchObject({
			wordBoundary: true,
			pitchControl: true,
		});
		expect(server.getCapabilities().features).toMatchObject({
			wordBoundary: true,
			pitchControl: false,
		});
	});

	test("claim no features before a speech provider exists", () => {
		const features = new TTSToolProvider("browser").getCapabilities().features;

		expect(Object.values(features).some(Boolean)).toBeFalse();
	});
});
