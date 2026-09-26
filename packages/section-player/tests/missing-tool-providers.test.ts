import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import {
	ToolkitCoordinator,
	type ToolkitCoordinatorApi,
} from "@pie-players/pie-assessment-toolkit";
import { createPackagedToolRegistry } from "@pie-players/pie-default-tool-loaders";
import { watchMissingToolProviders } from "../src/components/shared/missing-tool-providers";

const PROVIDER_WARNING = "[pie-section-player] Placed tool";

const silentSpeechSynthesis = {
	getVoices: () => [{ name: "Test Voice", lang: "en-US" }],
	speak: () => {},
	cancel: () => {},
	pause: () => {},
	resume: () => {},
};

const globals = globalThis as Record<string, unknown>;
const originals = {
	window: globals.window,
	speechSynthesis: globals.speechSynthesis,
};
let warnSpy: ReturnType<typeof spyOn>;
const teardowns: Array<() => void> = [];

const providerWarnings = (): string[] =>
	warnSpy.mock.calls
		.map((args: unknown[]) => args.map(String).join(" "))
		.filter((line: string) => line.startsWith(PROVIDER_WARNING));

const nextPoll = () => new Promise((resolve) => setTimeout(resolve, 150));

beforeEach(() => {
	globals.speechSynthesis = silentSpeechSynthesis;
	globals.window = {
		setTimeout,
		clearTimeout,
		speechSynthesis: silentSpeechSynthesis,
	};
	warnSpy = spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	for (const teardown of teardowns.splice(0)) teardown();
	warnSpy.mockRestore();
	for (const key of ["window", "speechSynthesis"] as const) {
		if (originals[key] === undefined) {
			delete globals[key];
		} else {
			globals[key] = originals[key];
		}
	}
});

const tools = {
	providers: { textToSpeech: { enabled: true, backend: "browser" as const } },
	placement: { item: ["calculator", "textToSpeech"] },
};

const createCoordinator = (
	options: { toolRegistry?: ReturnType<typeof createPackagedToolRegistry> } = {},
) =>
	new ToolkitCoordinator({
		assessmentId: "missing-tool-providers",
		lazyInit: true,
		toolRegistry: options.toolRegistry,
		tools,
	});

const watch = (
	coordinator: ToolkitCoordinator,
	registry: ReturnType<typeof createPackagedToolRegistry>,
) => {
	const teardown = watchMissingToolProviders(
		coordinator as unknown as ToolkitCoordinatorApi,
		registry,
	);
	teardowns.push(teardown);
	return teardown;
};

describe("placed tools a host-supplied coordinator has no provider for", () => {
	test("each is reported once, after the coordinator is ready", async () => {
		const coordinator = createCoordinator();
		const playerRegistry = createPackagedToolRegistry();
		watch(coordinator, playerRegistry);
		await nextPoll();
		expect(providerWarnings()).toEqual([]);

		await coordinator.waitUntilReady();
		await nextPoll();
		const warnings = providerWarnings();
		expect(warnings).toHaveLength(2);
		expect(warnings[0]).toContain(
			'Placed tool "calculator" uses provider "calculator-desmos"',
		);
		expect(warnings[1]).toContain('Placed tool "textToSpeech" uses provider "tts"');
		expect(warnings[0]).toContain("createPackagedToolRegistry()");

		coordinator.updateToolsPlacement({
			item: ["calculator", "textToSpeech", "answerEliminator"],
		});
		await nextPoll();
		// A remount around the same coordinator.
		watch(coordinator, playerRegistry);
		await nextPoll();
		expect(providerWarnings()).toHaveLength(2);
	});

	test("waiting does not start initialization a lazy coordinator defers", async () => {
		const coordinator = createCoordinator();
		watch(coordinator, createPackagedToolRegistry());
		await nextPoll();

		expect(coordinator.getInitStatus().tts).toBe(false);
		expect(providerWarnings()).toEqual([]);
	});

	test("a disabled tool is not reported", async () => {
		const coordinator = createCoordinator();
		coordinator.updateToolConfig("calculator", { enabled: false });
		watch(coordinator, createPackagedToolRegistry());
		await coordinator.waitUntilReady();
		await nextPoll();

		expect(providerWarnings()).toHaveLength(1);
		expect(providerWarnings()[0]).toContain('Placed tool "textToSpeech"');
	});

	test("a coordinator built from the player's registry is silent, through a text-to-speech reconfiguration", async () => {
		const playerRegistry = createPackagedToolRegistry();
		const coordinator = createCoordinator({ toolRegistry: playerRegistry });
		watch(coordinator, playerRegistry);
		await coordinator.waitUntilReady();
		await nextPoll();

		coordinator.updateToolConfig("textToSpeech", { rate: 1.2 });
		await coordinator.waitUntilReady();
		await nextPoll();

		expect(coordinator.toolProviderRegistry.has("tts")).toBe(true);
		expect(providerWarnings()).toEqual([]);
	});
});
