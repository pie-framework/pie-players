import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { ToolkitCoordinator } from "../src/services/ToolkitCoordinator.js";
import type {
	ToolProviderDescriptor,
	ToolRegistry,
} from "../src/services/ToolRegistry.js";
import type { ToolProviderApi } from "../src/services/tool-providers/ToolProviderApi.js";
import {
	createTestToolRegistration,
	createTestToolRegistry,
} from "./fixtures/test-tool-registry.js";

/**
 * A coordinator constructed without `toolRegistry` takes the registry of the
 * toolkit it is bound to, so a host that builds one for a section player gets
 * the player's providers without passing the registry twice.
 */

let warnSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
	warnSpy = spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
	warnSpy.mockRestore();
});

const warnings = (): string[] =>
	warnSpy.mock.calls.map((args: unknown[]) => args.map(String).join(" "));

const calculatorProvider: ToolProviderDescriptor = {
	getProviderId: () => "calculator-stub",
	createProvider: () =>
		({
			providerId: "calculator-stub",
			providerName: "Stub calculator provider",
			category: "calculator",
			version: "0.0.0",
			requiresAuth: false,
			initialize: async () => undefined,
			createInstance: async () => ({}),
			getCapabilities: () => ({}) as never,
			isReady: () => true,
			destroy: () => undefined,
		}) as unknown as ToolProviderApi,
};

function toolkitRegistry(): ToolRegistry {
	const registry = createTestToolRegistry([
		"textToSpeech",
		"annotationToolbar",
		"ruler",
	]);
	registry.register(
		createTestToolRegistration({
			toolId: "calculator",
			supportedLevels: ["item", "section"],
			provider: calculatorProvider,
		}),
	);
	return registry;
}

const tools = { placement: { item: ["calculator"] } };

describe("ToolkitCoordinator.adoptToolRegistry", () => {
	test("registers the adopted registry's providers", () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "adopt-providers",
			lazyInit: true,
			tools,
		});
		expect(coordinator.toolProviderRegistry.has("calculator-stub")).toBe(false);

		expect(coordinator.adoptToolRegistry(toolkitRegistry())).toBe(true);

		expect(coordinator.toolProviderRegistry.has("calculator-stub")).toBe(true);
		expect(
			warnings().filter((line) => line.includes("No tool registry")),
		).toEqual([]);
	});

	test("validates against the adopted registry from then on", () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "adopt-validation",
			lazyInit: true,
			tools: { placement: { item: ["calculator", "notShipped"] } },
		});
		expect(() => coordinator.isToolEnabled("notShipped")).not.toThrow();

		coordinator.adoptToolRegistry(toolkitRegistry());

		// Reported, not thrown: the config was accepted at construction.
		expect(
			warnings().some(
				(line) =>
					line.includes("ToolkitCoordinator.adoptToolRegistry") &&
					line.includes("notShipped"),
			),
		).toBe(true);
		expect(() => coordinator.isToolEnabled("notShipped")).toThrow(
			/Unknown tool id "notShipped"/,
		);
	});

	test("re-decides policy against the adopted registry", () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "adopt-policy",
			lazyInit: true,
			tools,
		});
		const reasons: string[] = [];
		coordinator.onPolicyChange((event) => reasons.push(event.reason));

		coordinator.adoptToolRegistry(toolkitRegistry());

		expect(reasons).toEqual(["inputs"]);
	});

	test("keeps a registry passed at construction", () => {
		const own = createTestToolRegistry(["textToSpeech", "annotationToolbar"]);
		const coordinator = new ToolkitCoordinator({
			assessmentId: "adopt-explicit",
			lazyInit: true,
			toolRegistry: own,
		});

		expect(coordinator.adoptToolRegistry(toolkitRegistry())).toBe(false);
		expect(coordinator.toolProviderRegistry.has("calculator-stub")).toBe(false);
		expect(() => coordinator.isToolEnabled("calculator")).toThrow(
			/Unknown tool id "calculator"/,
		);
	});

	test("takes the first toolkit's registry", () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "adopt-first",
			lazyInit: true,
		});
		expect(coordinator.adoptToolRegistry(toolkitRegistry())).toBe(true);
		expect(
			coordinator.adoptToolRegistry(
				createTestToolRegistry(["textToSpeech", "annotationToolbar"]),
			),
		).toBe(false);
		expect(() => coordinator.isToolEnabled("calculator")).not.toThrow();
	});

	test("adopts a registry that arrives after a toolkit reported none", () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "adopt-after-none",
			lazyInit: true,
			tools,
		});
		expect(coordinator.adoptToolRegistry(null)).toBe(false);

		expect(coordinator.adoptToolRegistry(toolkitRegistry())).toBe(true);
		expect(coordinator.toolProviderRegistry.has("calculator-stub")).toBe(true);
		expect(
			coordinator.adoptToolRegistry(
				createTestToolRegistry(["textToSpeech", "annotationToolbar"]),
			),
		).toBe(false);
	});

	test("does nothing once disposed", async () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "adopt-disposed",
			lazyInit: true,
		});
		await coordinator.dispose();

		expect(coordinator.adoptToolRegistry(toolkitRegistry())).toBe(false);
		expect(coordinator.toolProviderRegistry.has("calculator-stub")).toBe(false);
	});
});
