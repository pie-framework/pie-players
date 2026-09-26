import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { ToolkitCoordinator } from "../src/services/ToolkitCoordinator.js";
import { ToolRegistry } from "../src/services/ToolRegistry.js";
import {
	createFailingAuthProviderDescriptor,
	createTestToolRegistration,
} from "./fixtures/test-tool-registry.js";

/**
 * A coordinator registers tool providers only from its own `toolRegistry`. One
 * built without it has no `tts` provider, so a server-backend text-to-speech
 * config falls back to browser speech; the fallback says so once.
 */

const FALLBACK_WARNING = "falls back to browser speech";
const REGISTRY_FAILURE_WARNING = "Failed to initialize TTS via registry";

const globals = globalThis as Record<string, unknown>;
const originalWindow = globals.window;
let warnSpy: ReturnType<typeof spyOn>;

const warnings = (): string[] =>
	warnSpy.mock.calls.map((args: unknown[]) => args.map(String).join(" "));
const countWarnings = (fragment: string): number =>
	warnings().filter((line) => line.includes(fragment)).length;

beforeEach(() => {
	globals.window = {
		setTimeout,
		clearTimeout,
		speechSynthesis: {
			getVoices: () => [{ name: "Test Voice", lang: "en-US" }],
		},
	};
	warnSpy = spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	warnSpy.mockRestore();
	if (originalWindow === undefined) {
		delete globals.window;
	} else {
		globals.window = originalWindow;
	}
});

const serverTTSTools = {
	providers: {
		textToSpeech: {
			enabled: true,
			backend: "server" as const,
			apiEndpoint: "/api/tts",
		},
	},
	placement: { item: ["textToSpeech"] },
};

describe("ToolkitCoordinator text-to-speech without a tts provider", () => {
	test("a server backend falls back to browser speech and says why", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "missing-tts-provider",
			lazyInit: true,
			tools: serverTTSTools,
		});
		const successProviders: unknown[] = [];
		coordinator.subscribeTelemetry(({ eventName, payload }) => {
			if (eventName === "pie-toolkit-tts-init-success") {
				successProviders.push(payload?.provider);
			}
		});

		await coordinator.waitUntilReady();

		expect(successProviders).toEqual(["browser-fallback"]);
		const fallback = warnings().filter((line) =>
			line.includes(FALLBACK_WARNING),
		);
		expect(fallback).toHaveLength(1);
		expect(fallback[0]).toContain('"server" backend');
		expect(fallback[0]).toContain("createPackagedToolRegistry()");
		expect(
			warnings().some(
				(line) =>
					line.startsWith(
						"[tool-config-validation:ToolkitCoordinator.init] tools - ",
					) && line.includes("registers no tool providers"),
			),
		).toBe(true);
	});

	test("reports the fallback once per coordinator across reconfiguration", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "missing-tts-provider-reconfigure",
			lazyInit: true,
			tools: serverTTSTools,
		});
		await coordinator.waitUntilReady();

		coordinator.updateToolConfig("textToSpeech", {
			apiEndpoint: "/api/tts/v2",
		});
		await coordinator.ensureTTSReady();

		expect(countWarnings(FALLBACK_WARNING)).toBe(1);
	});

	test("a browser backend stays silent", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "missing-tts-provider-browser",
			lazyInit: true,
			tools: {
				providers: { textToSpeech: { enabled: true, backend: "browser" } },
				placement: { item: ["textToSpeech"] },
			},
		});

		await coordinator.waitUntilReady();

		expect(countWarnings(FALLBACK_WARNING)).toBe(0);
	});

	test("a tts provider that fails keeps its own warning and adds none", async () => {
		const toolRegistry = new ToolRegistry();
		toolRegistry.register(
			createTestToolRegistration({
				toolId: "textToSpeech",
				supportedLevels: ["item", "passage"],
				pnpSupportIds: ["textToSpeech"],
				provider: createFailingAuthProviderDescriptor("tts"),
			}),
		);
		const coordinator = new ToolkitCoordinator({
			assessmentId: "failing-tts-provider",
			lazyInit: true,
			toolRegistry,
			tools: serverTTSTools,
		});

		await coordinator.waitUntilReady();

		expect(countWarnings(REGISTRY_FAILURE_WARNING)).toBe(1);
		expect(countWarnings(FALLBACK_WARNING)).toBe(0);
	});
});
