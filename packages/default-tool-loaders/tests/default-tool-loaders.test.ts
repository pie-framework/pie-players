import { describe, expect, test } from "bun:test";
import {
	DEFAULT_TOOL_MODULE_LOADERS,
	registerDefaultToolModuleLoaders,
	type ToolModuleLoader,
	type ToolRegistryLike,
} from "../src/index";

class CapturingRegistry implements ToolRegistryLike {
	loaders: Partial<Record<string, ToolModuleLoader>> | null = null;

	setToolModuleLoaders(
		loaders: Partial<Record<string, ToolModuleLoader>>,
	): void {
		this.loaders = loaders;
	}
}

describe("default tool module loaders", () => {
	test("uses theme as the only color-scheme tool id", () => {
		expect("theme" in DEFAULT_TOOL_MODULE_LOADERS).toBe(true);
		expect("colorScheme" in DEFAULT_TOOL_MODULE_LOADERS).toBe(false);
	});

	test("loads every packaged element-backed capability", () => {
		expect(Object.keys(DEFAULT_TOOL_MODULE_LOADERS).sort()).toEqual([
			"annotationToolbar",
			"answerEliminator",
			"calculator",
			"dictionary",
			// A language variant loads the same module as its base capability: one element,
			// two capability ids.
			"dictionarySpanish",
			"graph",
			"lineReader",
			"periodicTable",
			"pictureDictionary",
			"pictureDictionarySpanish",
			"protractor",
			"ruler",
			"textToSpeech",
			"theme",
		]);
	});

	test("loads inline TTS controls for the textToSpeech tool", () => {
		const loaderSource = DEFAULT_TOOL_MODULE_LOADERS.textToSpeech.toString();

		expect(loaderSource).toContain("@pie-players/pie-tool-tts-inline");
	});

	test("loads the one provider-neutral calculator element", () => {
		expect(DEFAULT_TOOL_MODULE_LOADERS.calculator.toString()).toContain(
			"pie-tool-calculator-shared/calculator-element",
		);
	});

	test("registers default loaders with host overrides", () => {
		const registry = new CapturingRegistry();
		const overrideLoader = () => Promise.resolve();

		registerDefaultToolModuleLoaders(registry, {
			loaders: { calculator: overrideLoader },
		});

		expect(registry.loaders?.calculator).toBe(overrideLoader);
		expect(registry.loaders?.textToSpeech).toBe(
			DEFAULT_TOOL_MODULE_LOADERS.textToSpeech,
		);
		expect(registry.loaders?.ruler).toBe(DEFAULT_TOOL_MODULE_LOADERS.ruler);
	});
});
