import { describe, expect, test } from "bun:test";
import type { ItemFeatureDecision } from "@pie-players/pie-context";
import { autoplayAudioApplier } from "../src/utils/autoplay-audio";
import { applyItemFeatures } from "../src/utils/item-features";

function configWithModels(models: Record<string, unknown>[]) {
	return {
		markup: "<p></p>",
		elements: {},
		models,
	} as any;
}

const held = { granted: false, rule: "support-conflict" } as const;
const enabled = { granted: true, rule: "item-requirement" } as const;

/** Applies the autoplay applier alone, as the registry runs it. */
function run(
	config: any,
	inputs: {
		mode: "view" | "author";
		attribute: boolean | undefined;
		decision: ItemFeatureDecision | null;
	},
) {
	const result = applyItemFeatures(
		config,
		{
			mode: inputs.mode,
			settings: { autoplayAudio: inputs.attribute },
			decisions: inputs.decision ? { autoplayAudio: inputs.decision } : {},
		},
		[autoplayAudioApplier],
	);
	return { config: result.config as any, applied: result.applied };
}

describe("autoplayAudioApplier", () => {
	test("leaves config untouched with neither attribute nor decision", () => {
		const config = configWithModels([
			{ id: "1", element: "mc-populated-blank", autoplayAudioEnabled: false },
		]);
		const result = run(config, {
			mode: "view",
			attribute: undefined,
			decision: null,
		});
		expect(result.config).toBe(config);
		expect(result.applied).toEqual([]);
	});

	test("the attribute overwrites autoplayAudioEnabled on every top-level model", () => {
		const config = configWithModels([
			{ id: "1", element: "mc-populated-blank", autoplayAudioEnabled: false },
			{ id: "2", element: "categorize-element" },
		]);
		const result = run(config, {
			mode: "view",
			attribute: true,
			decision: null,
		});
		expect(result.config.models[0].autoplayAudioEnabled).toBe(true);
		expect(result.config.models[1].autoplayAudioEnabled).toBe(true);
		expect(result.applied).toEqual([]);
	});

	test("the attribute never reaches a model's parts", () => {
		const config = configWithModels([
			{ id: "1", element: "ebsr", partA: { autoplayAudioEnabled: false } },
		]);
		const result = run(config, {
			mode: "view",
			attribute: true,
			decision: null,
		});
		expect(result.config.models[0].partA.autoplayAudioEnabled).toBe(false);
	});

	test("a hold writes autoplayAudioHeld and keeps autoplayAudioEnabled", () => {
		const config = configWithModels([
			{ id: "1", element: "multiple-choice", autoplayAudioEnabled: true },
			{ id: "2", element: "categorize-element" },
		]);
		const result = run(config, {
			mode: "view",
			attribute: undefined,
			decision: held,
		});
		expect(result.config.models[0]).toMatchObject({
			autoplayAudioEnabled: true,
			autoplayAudioHeld: true,
		});
		expect(result.config.models[1].autoplayAudioHeld).toBe(true);
		expect(result.applied).toEqual([
			{
				featureId: "autoplayAudio",
				granted: false,
				rule: "support-conflict",
				overrode: "authored",
			},
		]);
	});

	test("a grant writes autoplayAudioEnabled and no hold", () => {
		const config = configWithModels([
			{ id: "1", element: "multiple-choice", autoplayAudioEnabled: false },
		]);
		const result = run(config, {
			mode: "view",
			attribute: undefined,
			decision: enabled,
		});
		expect(result.config.models[0].autoplayAudioEnabled).toBe(true);
		expect(result.config.models[0]).not.toHaveProperty("autoplayAudioHeld");
		expect(result.applied[0]?.overrode).toBe("authored");
	});

	test("a decision lands on each direct child declaring autoplayAudioEnabled", () => {
		const config = configWithModels([
			{
				id: "1",
				element: "ebsr",
				partA: { autoplayAudioEnabled: true },
				partB: { choices: [] },
				choices: [{ autoplayAudioEnabled: true }],
			},
		]);
		const result = run(config, {
			mode: "view",
			attribute: undefined,
			decision: held,
		});
		const model = result.config.models[0];
		expect(model.partA).toEqual({
			autoplayAudioEnabled: true,
			autoplayAudioHeld: true,
		});
		expect(model.partB).toEqual({ choices: [] });
		expect(model.choices).toEqual([{ autoplayAudioEnabled: true }]);
		expect(config.models[0].partA).toEqual({ autoplayAudioEnabled: true });
	});

	test("overrode names the attribute when it was set to the opposite value", () => {
		const config = configWithModels([
			{ id: "1", element: "multiple-choice", autoplayAudioEnabled: false },
		]);
		expect(
			run(config, { mode: "view", attribute: true, decision: held })
				.applied[0]?.overrode,
		).toBe("attribute");
		expect(
			run(config, {
				mode: "view",
				attribute: false,
				decision: enabled,
			}).applied[0]?.overrode,
		).toBe("attribute");
	});

	test("overrode is absent when the decision displaced nothing", () => {
		const config = configWithModels([
			{ id: "1", element: "multiple-choice", autoplayAudioEnabled: false },
			{ id: "2", element: "categorize-element" },
		]);
		const result = run(config, {
			mode: "view",
			attribute: undefined,
			decision: held,
		});
		expect(result.applied).toEqual([
			{ featureId: "autoplayAudio", granted: false, rule: "support-conflict" },
		]);
	});

	test("an attribute set off hides authored autoplay from overrode", () => {
		const config = configWithModels([
			{ id: "1", element: "multiple-choice", autoplayAudioEnabled: true },
		]);
		const result = run(config, {
			mode: "view",
			attribute: false,
			decision: held,
		});
		expect(result.applied[0]).not.toHaveProperty("overrode");
	});

	test("author mode receives neither the attribute nor a decision", () => {
		const config = configWithModels([
			{ id: "1", element: "multiple-choice", autoplayAudioEnabled: false },
		]);
		const result = run(config, {
			mode: "author",
			attribute: true,
			decision: held,
		});
		expect(result.config).toBe(config);
		expect(result.applied).toEqual([]);
	});

	test("returns config unchanged when there are no models", () => {
		const config = { markup: "<p></p>", elements: {} } as any;
		const result = run(config, {
			mode: "view",
			attribute: true,
			decision: held,
		});
		expect(result.config).toBe(config);
		expect(result.applied).toEqual([]);
	});

	test("re-applying to written models is idempotent", () => {
		const config = configWithModels([
			{ id: "1", element: "ebsr", partA: { autoplayAudioEnabled: true } },
		]);
		const inputs = { mode: "view", attribute: undefined, decision: held } as const;
		const once = run(config, inputs).config;
		expect(run(once as any, inputs).config).toEqual(once);
	});
});
