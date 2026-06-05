import { describe, expect, test } from "bun:test";
import {
	DEFAULT_TOOL_MODULE_LOADERS,
	ITEM_TOOL_MODULE_LOADERS,
	registerDefaultToolModuleLoaders,
	registerSectionToolModuleLoaders,
	SECTION_TOOL_MODULE_LOADERS,
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

	test("exports stock item and section loader keys", () => {
		expect(Object.keys(ITEM_TOOL_MODULE_LOADERS).sort()).toEqual([
			"annotationToolbar",
			"answerEliminator",
			"calculator",
			"highlighter",
			"textToSpeech",
			"theme",
		]);
		expect(Object.keys(SECTION_TOOL_MODULE_LOADERS).sort()).toEqual([
			"calculator",
			"graph",
			"lineReader",
			"periodicTable",
			"protractor",
			"ruler",
		]);
		expect(DEFAULT_TOOL_MODULE_LOADERS.calculator).toBe(
			SECTION_TOOL_MODULE_LOADERS.calculator,
		);
		expect(DEFAULT_TOOL_MODULE_LOADERS.textToSpeech).toBe(
			ITEM_TOOL_MODULE_LOADERS.textToSpeech,
		);
	});

	test("loads inline TTS controls for the textToSpeech tool", () => {
		const loaderSource = ITEM_TOOL_MODULE_LOADERS.textToSpeech.toString();

		expect(loaderSource).toContain("@pie-players/pie-tool-tts-inline");
		expect(loaderSource).not.toContain("@pie-players/pie-tool-text-to-speech");
	});

	test("registers default loaders with host overrides", () => {
		const registry = new CapturingRegistry();
		const overrideLoader = () => Promise.resolve();

		registerDefaultToolModuleLoaders(registry, {
			loaders: { calculator: overrideLoader },
		});

		expect(registry.loaders?.calculator).toBe(overrideLoader);
		expect(registry.loaders?.textToSpeech).toBe(
			ITEM_TOOL_MODULE_LOADERS.textToSpeech,
		);
		expect(registry.loaders?.ruler).toBe(SECTION_TOOL_MODULE_LOADERS.ruler);
	});

	test("registers section-only loaders with host overrides", () => {
		const registry = new CapturingRegistry();
		const overrideLoader = () => Promise.resolve();

		registerSectionToolModuleLoaders(registry, {
			loaders: { graph: overrideLoader },
		});

		expect(registry.loaders?.graph).toBe(overrideLoader);
		expect(registry.loaders?.ruler).toBe(SECTION_TOOL_MODULE_LOADERS.ruler);
		expect(registry.loaders?.textToSpeech).toBeUndefined();
	});
});
