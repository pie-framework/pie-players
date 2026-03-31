import { describe, expect, test } from "bun:test";
import { ToolkitCoordinator } from "../src/services/ToolkitCoordinator.js";
import { createPackagedToolRegistry } from "../src/services/createDefaultToolRegistry.js";
import type { ToolRegistration } from "../src/services/ToolRegistry.js";

describe("ToolkitCoordinator TTS reconfigure sequencing", () => {
	test("browser readiness waits for voiceschanged when voices are initially empty", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-browser-voice-prewarm-test",
			lazyInit: true,
		});

		let voices: SpeechSynthesisVoice[] = [];
		let voicesChangedListener: (() => void) | null = null;
		let listenerRegistered = false;
		const synthMock = {
			getVoices: () => voices,
			addEventListener: (_event: string, listener: () => void) => {
				listenerRegistered = true;
				voicesChangedListener = listener;
			},
			removeEventListener: (_event: string, listener: () => void) => {
				if (voicesChangedListener === listener) {
					voicesChangedListener = null;
				}
			},
		} as unknown as SpeechSynthesis;
		const previousWindow = (globalThis as any).window;
		(globalThis as any).window = {
			setTimeout,
			clearTimeout,
			speechSynthesis: synthMock,
		};

		try {
			let resolved = false;
			const readyPromise = (coordinator as any)
				.ensureBrowserVoicesReady({
					providerId: "browser",
				})
				.then(() => {
					resolved = true;
				});
			await new Promise((resolve) => setTimeout(resolve, 1));
			expect(listenerRegistered).toBe(true);
			expect(resolved).toBe(false);
			expect(typeof voicesChangedListener).toBe("function");
			setTimeout(() => {
				voices = [{ name: "Demo Voice" } as SpeechSynthesisVoice];
				voicesChangedListener?.();
			}, 5);
			await readyPromise;
			expect(resolved).toBe(true);
		} finally {
			(globalThis as any).window = previousWindow;
		}
	});

	test("browser readiness resolves on timeout and cleans up listeners", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-browser-voice-timeout-test",
			lazyInit: true,
		});
		const removeCalls: Array<() => void> = [];
		let voicesChangedListener: (() => void) | null = null;
		const synthMock = {
			getVoices: () => [] as SpeechSynthesisVoice[],
			addEventListener: (_event: string, listener: () => void) => {
				voicesChangedListener = listener;
			},
			removeEventListener: (_event: string, listener: () => void) => {
				removeCalls.push(listener);
				if (voicesChangedListener === listener) {
					voicesChangedListener = null;
				}
			},
		} as unknown as SpeechSynthesis;
		const previousWindow = (globalThis as any).window;
		(globalThis as any).window = {
			setTimeout,
			clearTimeout,
			speechSynthesis: synthMock,
		};
		try {
			await (coordinator as any).ensureBrowserVoicesReady(
				{
					providerId: "browser",
				},
				1,
			);
			expect(removeCalls.length).toBeGreaterThan(0);
			expect(voicesChangedListener).toBeNull();
		} finally {
			(globalThis as any).window = previousWindow;
		}
	});

	test("browser readiness is a no-op for non-browser providers", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-browser-voice-prewarm-noop-test",
			lazyInit: true,
		});

		await (coordinator as any).ensureBrowserVoicesReady({
			providerId: "polly",
		});
	});

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

		coordinator.updateToolConfig("textToSpeech", {
			enabled: true,
			backend: "polly",
			apiEndpoint: "/api/tts",
		} as any);

		await coordinator.ensureTTSReady(
			coordinator.getToolConfig("textToSpeech") as any,
		);

		expect(initializedAfterReconfigure).toBe(true);
		expect(internals.ttsInitialized).toBe(true);
	});

	test("rejects deprecated providers.tts in strict error mode", async () => {
		expect(
			() =>
				new ToolkitCoordinator({
					assessmentId: "tts-deprecated-provider-key-test",
					lazyInit: true,
					toolConfigStrictness: "error",
					tools: {
						providers: {
							tts: {
								enabled: true,
								backend: "browser",
							},
						},
					},
				} as any),
		).toThrow(`Provider key "tts" is no longer supported`);
	});

	test("rejects deprecated providers.tts by default strictness", () => {
		expect(
			() =>
				new ToolkitCoordinator({
					assessmentId: "tts-deprecated-default-strictness-test",
					lazyInit: true,
					tools: {
						providers: {
							tts: {
								enabled: true,
								backend: "browser",
							},
						},
					},
				} as any),
		).toThrow(`Provider key "tts" is no longer supported`);
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

	test("retries initialization after a failed ensureTTSReady attempt", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-retry-after-failure-test",
			lazyInit: true,
		});

		const internals = coordinator as any;
		let attempts = 0;
		internals._initializeTTS = async () => {
			attempts += 1;
			if (attempts === 1) {
				throw new Error("simulated init failure");
			}
			internals.ttsInitialized = true;
		};

		await expect(coordinator.ensureTTSReady()).rejects.toThrow("simulated init failure");
		expect(internals.ttsInitialized).toBe(false);

		await coordinator.ensureTTSReady();
		expect(attempts).toBe(2);
		expect(internals.ttsInitialized).toBe(true);
	});

	test("dedupes concurrent ensureTTSReady calls to a single initialization", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-concurrent-ensure-dedupe-test",
			lazyInit: true,
		});

		const internals = coordinator as any;
		let initCalls = 0;
		internals._initializeTTS = async () => {
			initCalls += 1;
			await new Promise((resolve) => setTimeout(resolve, 10));
			internals.ttsInitialized = true;
		};

		await Promise.all([coordinator.ensureTTSReady(), coordinator.ensureTTSReady()]);
		expect(initCalls).toBe(1);
		expect(internals.ttsInitialized).toBe(true);
	});

	test("accepts custom tool ids when coordinator receives matching toolRegistry", () => {
		const registry = createPackagedToolRegistry();
		const customRegistration: ToolRegistration = {
			toolId: "customRuntimeTool",
			name: "Custom Runtime Tool",
			description: "Custom tool for registry-aware validation coverage",
			icon: "custom",
			supportedLevels: ["section"],
			isVisibleInContext: () => true,
			renderToolbar: () => null,
		};
		registry.register(customRegistration);

		expect(
			() =>
				new ToolkitCoordinator({
					assessmentId: "custom-registry-tool-test",
					lazyInit: true,
					toolConfigStrictness: "error",
					toolRegistry: registry,
					tools: {
						placement: {
							section: ["customRuntimeTool"],
						},
					},
				} as any),
		).not.toThrow();
	});

	test("fails deprecated tts method ids deterministically", () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-method-id-rejection-test",
			lazyInit: true,
		});
		expect(() => coordinator.isToolEnabled("tts")).toThrow(
			`Tool id "tts" is no longer supported`,
		);
		expect(() => coordinator.getToolConfig("tts")).toThrow(
			`Tool id "tts" is no longer supported`,
		);
		expect(() =>
			coordinator.updateToolConfig("tts", { enabled: true } as any),
		).toThrow(`Tool id "tts" is no longer supported`);
	});
});
