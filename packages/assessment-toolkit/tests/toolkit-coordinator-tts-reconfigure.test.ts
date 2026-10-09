import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ToolkitCoordinator } from "../src/services/ToolkitCoordinator.js";
import { createTestToolRegistry } from "./fixtures/test-tool-registry.js";
import type { ToolRegistration } from "../src/services/ToolRegistry.js";
import { contentWith } from "./fixtures/read-aloud-content.js";

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

describe("ToolkitCoordinator TTS reconfigure sequencing", () => {
	test("the TTS service highlights through the coordinator's highlighter from construction", () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-highlight-wiring-test",
			lazyInit: true,
			toolRegistry: createTestToolRegistry(),
		});
		expect((coordinator.ttsService as any).highlightCoordinator).toBe(
			coordinator.highlightCoordinator,
		);
	});

	test("ensureTTSReady waits for in-flight TTS reconfigure", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-reconfigure-sequencing-test",
			lazyInit: true,
			toolRegistry: createTestToolRegistry(),
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
			backend: "server",
			serverProvider: "polly",
			apiEndpoint: "/api/tts",
		} as any);

		await coordinator.ensureTTSReady(
			coordinator.getToolConfig("textToSpeech") ?? undefined,
		);

		expect(initializedAfterReconfigure).toBe(true);
		expect(internals.ttsInitialized).toBe(true);
	});

	test("a speak after a reconfigure starts the reconfigured provider", async () => {
		// A default voice is left to the engine, so neither configured voice is one.
		const voices = ["System Voice", "Voice A", "Voice B"].map((name) => ({
			name,
			voiceURI: name,
			lang: "en-US",
			default: name === "System Voice",
			localService: true,
		}));
		const spokenWith: Array<string | undefined> = [];
		const synth = {
			getVoices: () => voices,
			speak: (utterance: {
				voice?: { name: string } | null;
				onstart?: () => void;
				onend?: () => void;
			}) => {
				spokenWith.push(utterance.voice?.name);
				utterance.onstart?.();
				utterance.onend?.();
			},
			cancel: () => {},
			pause: () => {},
			resume: () => {},
		};
		class FakeUtterance {
			voice: unknown = null;
			lang = "";
			rate = 1;
			pitch = 1;
			constructor(readonly text: string) {}
		}
		const globals = globalThis as Record<string, unknown>;
		const saved = {
			speechSynthesis: globals.speechSynthesis,
			SpeechSynthesisUtterance: globals.SpeechSynthesisUtterance,
		};
		// The registered window is `globalThis`, so this is `window.speechSynthesis`.
		globals.speechSynthesis = synth;
		globals.SpeechSynthesisUtterance = FakeUtterance;
		try {
			const coordinator = new ToolkitCoordinator({
				assessmentId: "tts-speak-after-reconfigure",
				lazyInit: true,
				toolRegistry: createTestToolRegistry(),
				tools: {
					providers: {
						textToSpeech: {
							enabled: true,
							backend: "browser",
							defaultVoice: "Voice A",
						},
					},
				},
			});
			await coordinator.ttsService.speak(contentWith("Before"));

			coordinator.updateToolConfig("textToSpeech", { defaultVoice: "Voice B" });
			await coordinator.ttsService.speak(contentWith("After"));

			expect(spokenWith).toEqual(["Voice A", "Voice B"]);
		} finally {
			for (const [key, value] of Object.entries(saved)) {
				if (value === undefined) delete globals[key];
				else globals[key] = value;
			}
		}
	});

	test("rejects a textToSpeech string provider selector", () => {
		expect(
			() =>
				new ToolkitCoordinator({
					assessmentId: "tts-string-provider-selector-test",
					lazyInit: true,
					tools: {
						providers: {
							textToSpeech: {
								enabled: true,
								provider: "polly",
							},
						},
					},
				} as any),
		).toThrow('"providers.textToSpeech.provider": expected an object');
	});

	test("waitUntilReady initializes TTS from textToSpeech-only config", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-alias-wait-until-ready-test",
			eagerInit: false,
			tools: {
				providers: {
					textToSpeech: {
						enabled: true,
						backend: "server",
						serverProvider: "polly",
						apiEndpoint: "/api/tts",
					},
				},
			},
			toolRegistry: createTestToolRegistry(),
		} as any);

		const internals = coordinator as any;
		let capturedConfig: any = null;
		internals._initializeTTS = async (config: unknown) => {
			capturedConfig = config;
			internals.ttsInitialized = true;
		};

		await coordinator.waitUntilReady();

		expect(capturedConfig?.backend).toBe("server");
		expect(capturedConfig?.serverProvider).toBe("polly");
		expect(capturedConfig?.apiEndpoint).toBe("/api/tts");
		expect(coordinator.isReady()).toBe(true);
	});

	test("initializes TTS with top-level mathSpeech in providerOptions", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-math-speech-settings-init-test",
			lazyInit: true,
			tools: {
				providers: {
					textToSpeech: {
						enabled: true,
						backend: "browser",
						mathSpeech: {
							domain: "clearspeak",
							style: "ImpliedTimes_MoreImpliedTimes:Paren_Silent",
						},
					},
				},
			},
			toolRegistry: createTestToolRegistry(),
		} as any);

		const internals = coordinator as any;
		let capturedConfig: any = null;
		internals.toolProviderRegistry = { has: () => false };
		internals.initializeTTSService = async (
			_provider: unknown,
			config: unknown,
		) => {
			capturedConfig = config;
			internals.ttsInitialized = true;
		};

		await internals._initializeTTS();

		expect(capturedConfig?.providerOptions?.mathSpeech).toEqual({
			domain: "clearspeak",
			style: "ImpliedTimes_MoreImpliedTimes:Paren_Silent",
		});
	});

	test("reinitializes TTS with updated mathSpeech after reconfigure", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-math-speech-settings-reconfigure-test",
			lazyInit: true,
			tools: {
				providers: {
					textToSpeech: {
						enabled: true,
						backend: "browser",
					},
				},
			},
			toolRegistry: createTestToolRegistry(),
		} as any);

		const internals = coordinator as any;
		let capturedConfig: any = null;
		internals.toolProviderRegistry = { has: () => false };
		internals._reconfigureTTSProvider = async () => {
			internals.ttsInitialized = false;
		};
		internals.initializeTTSService = async (
			_provider: unknown,
			config: unknown,
		) => {
			capturedConfig = config;
			internals.ttsInitialized = true;
		};

		coordinator.updateToolConfig("textToSpeech", {
			enabled: true,
			backend: "browser",
			mathSpeech: {
				domain: "clearspeak",
				style: "Paren_Silent",
			},
		} as any);
		await coordinator.ensureTTSReady(
			coordinator.getToolConfig("textToSpeech") ?? undefined,
		);

		expect(capturedConfig?.providerOptions?.mathSpeech).toEqual({
			domain: "clearspeak",
			style: "Paren_Silent",
		});
	});

	test("preserves mathSpeech across partial updates", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-math-speech-settings-partial-update-test",
			lazyInit: true,
			tools: {
				providers: {
					textToSpeech: {
						enabled: true,
						backend: "browser",
						mathSpeech: {
							domain: "clearspeak",
							style: "Paren_Silent",
						},
					},
				},
			},
			toolRegistry: createTestToolRegistry(),
		} as any);

		const internals = coordinator as any;
		let capturedConfig: any = null;
		internals.toolProviderRegistry = { has: () => false };
		internals._reconfigureTTSProvider = async () => {
			internals.ttsInitialized = false;
		};
		internals.initializeTTSService = async (
			_provider: unknown,
			config: unknown,
		) => {
			capturedConfig = config;
			internals.ttsInitialized = true;
		};

		coordinator.updateToolConfig("textToSpeech", {
			rate: 1.25,
		} as any);
		await coordinator.ensureTTSReady(
			coordinator.getToolConfig("textToSpeech") ?? undefined,
		);

		expect(capturedConfig?.rate).toBe(1.25);
		expect(capturedConfig?.providerOptions?.mathSpeech).toEqual({
			domain: "clearspeak",
			style: "Paren_Silent",
		});
	});

	test("deep-merges partial mathSpeech updates", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-math-speech-settings-nested-partial-update-test",
			lazyInit: true,
			tools: {
				providers: {
					textToSpeech: {
						enabled: true,
						backend: "browser",
						mathSpeech: {
							domain: "clearspeak",
							style: "Paren_Silent",
							engineOptions: { modality: "speech" },
						},
					},
				},
			},
			toolRegistry: createTestToolRegistry(),
		} as any);

		const internals = coordinator as any;
		let capturedConfig: any = null;
		internals.toolProviderRegistry = { has: () => false };
		internals._reconfigureTTSProvider = async () => {
			internals.ttsInitialized = false;
		};
		internals.initializeTTSService = async (
			_provider: unknown,
			config: unknown,
		) => {
			capturedConfig = config;
			internals.ttsInitialized = true;
		};

		coordinator.updateToolConfig("textToSpeech", {
			mathSpeech: {
				style: "ImpliedTimes_MoreImpliedTimes",
			},
		} as any);
		await coordinator.ensureTTSReady(
			coordinator.getToolConfig("textToSpeech") ?? undefined,
		);

		expect(capturedConfig?.providerOptions?.mathSpeech).toEqual({
			domain: "clearspeak",
			style: "ImpliedTimes_MoreImpliedTimes",
			engineOptions: { modality: "speech" },
		});
	});

	test("retries initialization after a failed ensureTTSReady attempt", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-retry-after-failure-test",
			lazyInit: true,
			toolRegistry: createTestToolRegistry(),
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

		await expect(coordinator.ensureTTSReady()).rejects.toThrow(
			"simulated init failure",
		);
		expect(internals.ttsInitialized).toBe(false);

		await coordinator.ensureTTSReady();
		expect(attempts).toBe(2);
		expect(internals.ttsInitialized).toBe(true);
	});

	test("dedupes concurrent ensureTTSReady calls to a single initialization", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-concurrent-ensure-dedupe-test",
			lazyInit: true,
			toolRegistry: createTestToolRegistry(),
		});

		const internals = coordinator as any;
		let initCalls = 0;
		internals._initializeTTS = async () => {
			initCalls += 1;
			await new Promise((resolve) => setTimeout(resolve, 10));
			internals.ttsInitialized = true;
		};

		await Promise.all([
			coordinator.ensureTTSReady(),
			coordinator.ensureTTSReady(),
		]);
		expect(initCalls).toBe(1);
		expect(internals.ttsInitialized).toBe(true);
	});

	test("accepts custom tool ids when coordinator receives matching toolRegistry", () => {
		const registry = createTestToolRegistry();
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

	test("rejects a tool id the registry does not know", () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "tts-method-id-rejection-test",
			lazyInit: true,
			toolRegistry: createTestToolRegistry(),
		});
		expect(() => coordinator.getToolConfig("tts")).toThrow(
			`Unknown tool id "tts"`,
		);
		expect(() =>
			coordinator.updateToolConfig("tts", { enabled: true } as any),
		).toThrow(`Unknown tool id "tts"`);
	});
});
