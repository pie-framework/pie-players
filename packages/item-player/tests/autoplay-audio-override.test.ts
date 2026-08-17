import { describe, expect, test } from "bun:test";
import { applyAutoplayAudioOverride } from "../src/utils/autoplay-audio-override";

function configWithModels(models: Record<string, unknown>[]) {
	return {
		markup: "<p></p>",
		elements: {},
		models,
	} as any;
}

describe("applyAutoplayAudioOverride", () => {
	test("leaves config untouched when override is undefined", () => {
		const config = configWithModels([
			{ id: "1", element: "mc-populated-blank", autoplayAudioEnabled: false },
		]);
		expect(applyAutoplayAudioOverride(config, undefined)).toBe(config);
	});

	test("overwrites autoplayAudioEnabled on every model, even ones that never declared it", () => {
		const config = configWithModels([
			{ id: "1", element: "mc-populated-blank", autoplayAudioEnabled: false },
			{ id: "2", element: "categorize-element" },
		]);

		const result = applyAutoplayAudioOverride(config, true);

		expect(result.models[0].autoplayAudioEnabled).toBe(true);
		expect(result.models[1].autoplayAudioEnabled).toBe(true);
	});

	test("can force the override to false", () => {
		const config = configWithModels([
			{ id: "1", element: "mc-populated-blank", autoplayAudioEnabled: true },
		]);

		const result = applyAutoplayAudioOverride(config, false);

		expect(result.models[0].autoplayAudioEnabled).toBe(false);
	});

	test("returns config unchanged when there are no models", () => {
		const config = { markup: "<p></p>", elements: {} } as any;
		expect(applyAutoplayAudioOverride(config, true)).toBe(config);
	});
});
