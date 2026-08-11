import { describe, expect, test } from "bun:test";
import { ToolkitCoordinator } from "../src/services/ToolkitCoordinator.js";
import { ToolRegistry } from "../src/services/ToolRegistry.js";
import { createTestToolRegistration } from "./fixtures/test-tool-registry.js";

/**
 * A coordinator with no tool registry must not treat every tool id as wrong.
 *
 * Before the packaged capability set moved to the composition package, the
 * coordinator fell back to a registry that contained the ids its own
 * default-provider block installs. Afterwards a host that supplies no registry
 * gets an empty one, and validating against it turned every tool-config call
 * into an exception — including the ones the coordinator provokes itself, so a
 * host could not read the config it had just passed in.
 *
 * `normalizeAndValidateToolsConfig` reports the missing registry once, as
 * `tools.registryUnavailable`. That is the diagnostic; this is the behaviour.
 */
describe("ToolkitCoordinator tool ids without a registry", () => {
	test("an empty registry means unvalidated, not invalid", () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "registryless",
			lazyInit: true,
			tools: { providers: { textToSpeech: { enabled: true } } },
		} as never);

		expect(() => coordinator.isToolEnabled("textToSpeech")).not.toThrow();
		expect(() => coordinator.getToolConfig("textToSpeech")).not.toThrow();
		// An id nobody has ever shipped is equally unvalidatable here.
		expect(() => coordinator.isToolEnabled("hostOwnedCapability")).not.toThrow();
	});

	test("a supplied registry still rejects an id it does not carry", () => {
		const registry = new ToolRegistry();
		registry.register(
			createTestToolRegistration({
				toolId: "textToSpeech",
				supportedLevels: ["item"],
			}),
		);
		const coordinator = new ToolkitCoordinator({
			assessmentId: "registered",
			lazyInit: true,
			toolRegistry: registry,
		} as never);

		expect(() => coordinator.isToolEnabled("textToSpeech")).not.toThrow();
		expect(() => coordinator.isToolEnabled("notRegistered")).toThrow(
			/Unknown tool id "notRegistered"/,
		);
	});

	test("the tts rename error survives an empty registry", () => {
		const coordinator = new ToolkitCoordinator({
			assessmentId: "registryless-tts",
			lazyInit: true,
		});

		// Checked before the registry, so a host migrating off the old key gets the
		// migration message rather than silence.
		expect(() => coordinator.isToolEnabled("tts")).toThrow(
			/no longer supported/,
		);
		expect(() => coordinator.isToolEnabled("")).toThrow(/non-empty string/);
	});
});
