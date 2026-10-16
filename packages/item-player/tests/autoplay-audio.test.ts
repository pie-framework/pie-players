import { describe, expect, test } from "bun:test";
import {
	applyAutoplayAudio,
	autoplayAudioSignature,
	mergeAppliedDecisions,
	resolveAutoplayAudioDecision,
} from "../src/utils/autoplay-audio";

function configWithModels(models: Record<string, unknown>[]) {
	return {
		markup: "<p></p>",
		elements: {},
		models,
	} as any;
}

const held = { effect: "held", rule: "support-conflict" } as const;
const enabled = { effect: "enabled", rule: "item-requirement" } as const;

describe("resolveAutoplayAudioDecision", () => {
	test("reads a grant as enabled and a denial as held", () => {
		expect(
			resolveAutoplayAudioDecision({
				features: { autoplayAudio: { granted: true, rule: "pnp-support" } },
			}),
		).toEqual({ effect: "enabled", rule: "pnp-support" });
		expect(
			resolveAutoplayAudioDecision({
				features: { autoplayAudio: { granted: false, rule: "host-blocked" } },
			}),
		).toEqual({ effect: "held", rule: "host-blocked" });
	});

	test("an absent, unnamed or malformed decision is no decision", () => {
		expect(resolveAutoplayAudioDecision(null)).toBeNull();
		expect(resolveAutoplayAudioDecision({ features: {} })).toBeNull();
		expect(
			resolveAutoplayAudioDecision({
				features: { autoplayAudio: { granted: false, rule: "none" } },
			}),
		).toBeNull();
		expect(
			resolveAutoplayAudioDecision({ features: { autoplayAudio: {} } } as any),
		).toBeNull();
	});
});

describe("applyAutoplayAudio", () => {
	test("leaves config untouched with neither attribute nor decision", () => {
		const config = configWithModels([
			{ id: "1", element: "mc-populated-blank", autoplayAudioEnabled: false },
		]);
		const result = applyAutoplayAudio(config, {
			mode: "view",
			attribute: undefined,
			decision: null,
		});
		expect(result.config).toBe(config);
		expect(result.applied).toBeNull();
	});

	test("the attribute overwrites autoplayAudioEnabled on every top-level model", () => {
		const config = configWithModels([
			{ id: "1", element: "mc-populated-blank", autoplayAudioEnabled: false },
			{ id: "2", element: "categorize-element" },
		]);
		const result = applyAutoplayAudio(config, {
			mode: "view",
			attribute: true,
			decision: null,
		});
		expect(result.config.models[0].autoplayAudioEnabled).toBe(true);
		expect(result.config.models[1].autoplayAudioEnabled).toBe(true);
		expect(result.applied).toBeNull();
	});

	test("the attribute never reaches a model's parts", () => {
		const config = configWithModels([
			{ id: "1", element: "ebsr", partA: { autoplayAudioEnabled: false } },
		]);
		const result = applyAutoplayAudio(config, {
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
		const result = applyAutoplayAudio(config, {
			mode: "view",
			attribute: undefined,
			decision: held,
		});
		expect(result.config.models[0]).toMatchObject({
			autoplayAudioEnabled: true,
			autoplayAudioHeld: true,
		});
		expect(result.config.models[1].autoplayAudioHeld).toBe(true);
		expect(result.applied).toEqual({
			featureId: "autoplayAudio",
			effect: "held",
			rule: "support-conflict",
			overrode: "authored",
		});
	});

	test("a grant writes autoplayAudioEnabled and no hold", () => {
		const config = configWithModels([
			{ id: "1", element: "multiple-choice", autoplayAudioEnabled: false },
		]);
		const result = applyAutoplayAudio(config, {
			mode: "view",
			attribute: undefined,
			decision: enabled,
		});
		expect(result.config.models[0].autoplayAudioEnabled).toBe(true);
		expect(result.config.models[0]).not.toHaveProperty("autoplayAudioHeld");
		expect(result.applied?.overrode).toBe("authored");
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
		const result = applyAutoplayAudio(config, {
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
			applyAutoplayAudio(config, { mode: "view", attribute: true, decision: held })
				.applied?.overrode,
		).toBe("attribute");
		expect(
			applyAutoplayAudio(config, {
				mode: "view",
				attribute: false,
				decision: enabled,
			}).applied?.overrode,
		).toBe("attribute");
	});

	test("overrode is absent when the decision displaced nothing", () => {
		const config = configWithModels([
			{ id: "1", element: "multiple-choice", autoplayAudioEnabled: false },
			{ id: "2", element: "categorize-element" },
		]);
		const result = applyAutoplayAudio(config, {
			mode: "view",
			attribute: undefined,
			decision: held,
		});
		expect(result.applied).toEqual({
			featureId: "autoplayAudio",
			effect: "held",
			rule: "support-conflict",
		});
	});

	test("an attribute set off hides authored autoplay from overrode", () => {
		const config = configWithModels([
			{ id: "1", element: "multiple-choice", autoplayAudioEnabled: true },
		]);
		const result = applyAutoplayAudio(config, {
			mode: "view",
			attribute: false,
			decision: held,
		});
		expect(result.applied).not.toHaveProperty("overrode");
	});

	test("author mode receives neither the attribute nor a decision", () => {
		const config = configWithModels([
			{ id: "1", element: "multiple-choice", autoplayAudioEnabled: false },
		]);
		const result = applyAutoplayAudio(config, {
			mode: "author",
			attribute: true,
			decision: held,
		});
		expect(result.config).toBe(config);
		expect(result.applied).toBeNull();
	});

	test("returns config unchanged when there are no models", () => {
		const config = { markup: "<p></p>", elements: {} } as any;
		const result = applyAutoplayAudio(config, {
			mode: "view",
			attribute: true,
			decision: held,
		});
		expect(result.config).toBe(config);
		expect(result.applied).toBeNull();
	});

	test("re-applying to written models is idempotent", () => {
		const config = configWithModels([
			{ id: "1", element: "ebsr", partA: { autoplayAudioEnabled: true } },
		]);
		const inputs = { mode: "view", attribute: undefined, decision: held } as const;
		const once = applyAutoplayAudio(config, inputs).config;
		expect(applyAutoplayAudio(once, inputs).config).toEqual(once);
	});
});

describe("autoplayAudioSignature", () => {
	test("changes with the attribute and the decision's effect", () => {
		const base = { mode: "view", attribute: undefined, decision: null } as const;
		const signatures = new Set([
			autoplayAudioSignature(base),
			autoplayAudioSignature({ ...base, attribute: true }),
			autoplayAudioSignature({ ...base, decision: held }),
			autoplayAudioSignature({ ...base, decision: enabled }),
		]);
		expect(signatures.size).toBe(4);
	});

	test("ignores both in author mode", () => {
		expect(
			autoplayAudioSignature({ mode: "author", attribute: true, decision: held }),
		).toBe(
			autoplayAudioSignature({
				mode: "author",
				attribute: undefined,
				decision: null,
			}),
		);
	});
});

describe("mergeAppliedDecisions", () => {
	test("the attribute outranks authored content across item and passage", () => {
		expect(
			mergeAppliedDecisions(
				{
					featureId: "autoplayAudio",
					effect: "held",
					rule: "support-conflict",
					overrode: "authored",
				},
				{
					featureId: "autoplayAudio",
					effect: "held",
					rule: "support-conflict",
					overrode: "attribute",
				},
			),
		).toEqual({
			featureId: "autoplayAudio",
			effect: "held",
			rule: "support-conflict",
			overrode: "attribute",
		});
		expect(mergeAppliedDecisions(null, null)).toBeNull();
	});
});
