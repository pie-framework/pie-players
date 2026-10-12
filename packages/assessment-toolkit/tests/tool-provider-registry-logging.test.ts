/**
 * The registry traces provider lifecycle only while `window.PIE_DEBUG` is set,
 * and reads the flag on each line.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ToolProviderApi } from "../src/services/tool-providers/ToolProviderApi.js";
import { ToolProviderRegistry } from "../src/services/tool-providers/ToolProviderRegistry.js";

const consoleMethods = ["log", "debug", "info"] as const;
const originalConsole = consoleMethods.map((method) => console[method]);
const hadWindow = "window" in globalThis;
const originalWindow = (globalThis as { window?: unknown }).window;

let lines: string[];

beforeEach(() => {
	lines = [];
	for (const method of consoleMethods) {
		console[method] = (...args: unknown[]) => {
			lines.push(args.map(String).join(" "));
		};
	}
	(globalThis as { window?: unknown }).window = {};
});

afterEach(() => {
	consoleMethods.forEach((method, index) => {
		console[method] = originalConsole[index];
	});
	if (hadWindow) (globalThis as { window?: unknown }).window = originalWindow;
	else delete (globalThis as { window?: unknown }).window;
});

const provider = (): ToolProviderApi =>
	({
		providerName: "Stub",
		category: "tts",
		version: "0",
		requiresAuth: false,
		initialize: async () => {},
		createInstance: async () => ({}),
		isReady: () => true,
		destroy: () => {},
	}) as ToolProviderApi;

const registerInitializeAndDestroy = async () => {
	const registry = new ToolProviderRegistry();
	registry.register("tts", { provider: provider(), config: {} });
	await registry.initialize("tts");
	await registry.destroy();
};

describe("ToolProviderRegistry logging", () => {
	test("traces provider lifecycle only while PIE_DEBUG is set", async () => {
		await registerInitializeAndDestroy();
		expect(lines).toEqual([]);

		(globalThis as { window?: { PIE_DEBUG?: boolean } }).window = {
			PIE_DEBUG: true,
		};
		await registerInitializeAndDestroy();
		expect(lines.length).toBeGreaterThan(0);
		expect(
			lines.every((line) => line.startsWith("[ToolProviderRegistry]")),
		).toBeTrue();
	});
});
