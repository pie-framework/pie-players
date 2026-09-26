import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { ToolkitCoordinator } from "@pie-players/pie-assessment-toolkit";
import { createPackagedToolRegistry } from "../src/packaged-capability-composition.js";

/**
 * A coordinator registers tool providers only from its own `toolRegistry`, so
 * one built without it serves no packaged capability. The two warnings that say
 * so appear for a registry-less coordinator and not for one given the packaged
 * set.
 */

const FALLBACK_WARNING = "falls back to browser speech";
const REGISTRY_UNAVAILABLE =
	"[tool-config-validation:ToolkitCoordinator.init] tools - No tool registry was supplied";

// The server-backend configuration a host's section demos pass.
const tools = {
	providers: {
		textToSpeech: {
			enabled: true,
			backend: "server" as const,
			serverProvider: "custom" as const,
			transportMode: "custom" as const,
			endpointMode: "rootPost" as const,
			endpointValidationMode: "none" as const,
			apiEndpoint: "/api/tts/sc",
		},
	},
	placement: { item: ["textToSpeech"], passage: ["textToSpeech"] },
};

const silentSpeechSynthesis = {
	getVoices: () => [{ name: "Test Voice", lang: "en-US" }],
	speak: () => {},
	cancel: () => {},
	pause: () => {},
	resume: () => {},
};

const globals = globalThis as Record<string, unknown>;
const originals = {
	fetch: globalThis.fetch,
	window: globals.window,
	speechSynthesis: globals.speechSynthesis,
};
let requests: string[] = [];
let warnSpy: ReturnType<typeof spyOn>;

const warnings = (): string[] =>
	warnSpy.mock.calls.map((args: unknown[]) => args.map(String).join(" "));
const countWarnings = (fragment: string): number =>
	warnings().filter((line) => line.includes(fragment)).length;

beforeEach(() => {
	requests = [];
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		requests.push(String(input));
		return new Response("not found", { status: 404 });
	}) as typeof fetch;
	globals.speechSynthesis = silentSpeechSynthesis;
	globals.window = {
		setTimeout,
		clearTimeout,
		speechSynthesis: silentSpeechSynthesis,
	};
	warnSpy = spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	warnSpy.mockRestore();
	globalThis.fetch = originals.fetch;
	for (const key of ["window", "speechSynthesis"] as const) {
		if (originals[key] === undefined) {
			delete globals[key];
		} else {
			globals[key] = originals[key];
		}
	}
});

const readyCoordinator = async (
	toolRegistry?: ReturnType<typeof createPackagedToolRegistry>,
) => {
	const coordinator = new ToolkitCoordinator({
		assessmentId: "missing-tool-registry-diagnostics",
		toolConfigStrictness: "error",
		lazyInit: true,
		toolRegistry,
		tools,
	});
	const initProviders: unknown[] = [];
	coordinator.subscribeTelemetry(({ eventName, payload }) => {
		if (eventName === "pie-toolkit-tts-init-success") {
			initProviders.push(payload?.provider);
		}
	});
	await coordinator.waitUntilReady();
	return { coordinator, initProviders };
};

describe("a coordinator's tool registry and the warnings about its absence", () => {
	test("without toolRegistry: browser fallback, both warnings", async () => {
		const { coordinator, initProviders } = await readyCoordinator();

		expect(initProviders).toEqual(["browser-fallback"]);
		expect(coordinator.toolProviderRegistry.getProviderIds()).toEqual([]);
		expect(countWarnings(FALLBACK_WARNING)).toBe(1);
		const unavailable = warnings().filter((line) =>
			line.startsWith(REGISTRY_UNAVAILABLE),
		);
		expect(unavailable).toHaveLength(1);
		expect(unavailable[0]).toContain(
			"a coordinator built without one registers no tool providers",
		);
	});

	test("with createPackagedToolRegistry(): registry provider, neither warning", async () => {
		const { coordinator, initProviders } = await readyCoordinator(
			createPackagedToolRegistry(),
		);

		expect(initProviders).toEqual(["registry"]);
		expect(coordinator.toolProviderRegistry.has("tts")).toBe(true);
		expect(countWarnings(FALLBACK_WARNING)).toBe(0);
		expect(countWarnings("No tool registry was supplied")).toBe(0);
		expect(requests).toEqual([]);
	});
});
