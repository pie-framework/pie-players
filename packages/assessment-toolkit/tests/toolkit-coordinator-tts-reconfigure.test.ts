import { describe, expect, test } from "bun:test";
import { ToolkitCoordinator } from "../src/services/ToolkitCoordinator.js";

describe("ToolkitCoordinator TTS reconfigure sequencing", () => {
	test("ensureTTSReady waits for in-flight TTS reconfigure", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-reconfigure-sequencing-test",
			lazyInit: true,
		});

		const internals = coordinator as any;
		internals.ttsInitialized = true;

		let reconfigureFinished = false;
		internals._reconfigureTTSProvider = async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			reconfigureFinished = true;
			internals.ttsInitialized = false;
		};

		let initializedAfterReconfigure = false;
		internals._initializeTTS = async () => {
			initializedAfterReconfigure = reconfigureFinished;
			internals.ttsInitialized = true;
		};

		coordinator.updateToolConfig("tts", {
			enabled: true,
			backend: "polly",
			apiEndpoint: "/api/tts",
		} as any);

		await coordinator.ensureTTSReady(coordinator.getToolConfig("tts") as any);

		expect(initializedAfterReconfigure).toBe(true);
		expect(internals.ttsInitialized).toBe(true);
	});

	test("updates legacy textToSpeech config when UI writes tts key", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-alias-key-test",
			lazyInit: true,
			tools: {
				providers: {
					textToSpeech: {
						enabled: true,
						backend: "browser",
					},
				},
			},
		} as any);

		const internals = coordinator as any;
		let reconfigureCalls = 0;
		internals._reconfigureTTSProvider = async () => {
			reconfigureCalls += 1;
		};

		coordinator.updateToolConfig("tts", {
			backend: "polly",
			apiEndpoint: "/api/tts",
		} as any);
		await new Promise((resolve) => setTimeout(resolve, 0));

		const effective = coordinator.getToolConfig("tts") as any;
		const providers = internals.config.tools.providers as Record<string, unknown>;
		expect(effective?.backend).toBe("polly");
		expect((providers.textToSpeech as any)?.backend).toBe("polly");
		expect((providers.tts as any)?.backend).toBe("browser");
		expect(reconfigureCalls).toBe(1);
	});

	test("supports reverse alias updates from textToSpeech to tts key", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-alias-reverse-key-test",
			lazyInit: true,
			tools: {
				providers: {
					tts: {
						enabled: true,
						backend: "browser",
					},
				},
			},
		} as any);

		const internals = coordinator as any;
		let reconfigureCalls = 0;
		internals._reconfigureTTSProvider = async () => {
			reconfigureCalls += 1;
		};

		coordinator.updateToolConfig("textToSpeech", {
			backend: "google",
			apiEndpoint: "/api/tts",
		} as any);
		await new Promise((resolve) => setTimeout(resolve, 0));

		const effective = coordinator.getToolConfig("textToSpeech") as any;
		const providers = internals.config.tools.providers as Record<string, unknown>;
		expect(effective?.backend).toBe("google");
		expect((providers.tts as any)?.backend).toBe("google");
		expect(providers.textToSpeech).toBeUndefined();
		expect(reconfigureCalls).toBe(1);
	});

	test("waitUntilReady initializes TTS from textToSpeech-only config", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-alias-wait-until-ready-test",
			lazyInit: true,
			tools: {
				providers: {
					textToSpeech: {
						enabled: true,
						backend: "polly",
						apiEndpoint: "/api/tts",
					},
				},
			},
		} as any);

		const internals = coordinator as any;
		let capturedConfig: any = null;
		internals._initializeTTS = async (config: unknown) => {
			capturedConfig = config;
			internals.ttsInitialized = true;
		};

		await coordinator.waitUntilReady();

		expect(capturedConfig?.backend).toBe("polly");
		expect(capturedConfig?.apiEndpoint).toBe("/api/tts");
		expect(coordinator.getInitStatus().coordinator).toBe(true);
	});
});
