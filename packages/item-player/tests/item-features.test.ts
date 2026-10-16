import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, describe, expect, test } from "bun:test";
import {
	applyItemFeatures,
	applyMarkupRules,
	ITEM_FEATURE_APPLIERS,
	type ItemFeatureApplier,
	itemFeaturesSignature,
	mergeAppliedFeatures,
	readItemFeatureDecisions,
	sameItemFeatureDecisions,
} from "../src/utils/item-features";

const ownsDom = typeof window === "undefined";
if (ownsDom) GlobalRegistrator.register();

afterAll(() => {
	if (ownsDom && GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

/** A feature that writes its verdict to a `demo` field on every model. */
const demoApplier: ItemFeatureApplier<string> = {
	featureId: "demo",
	markupRules: [{ kind: "attribute", name: "data-demo" }],
	apply(config, setting, decision) {
		return {
			config: {
				...config,
				models: config.models.map((model) => ({
					...(model as object),
					demo: decision ? decision.granted : setting,
				})),
			} as typeof config,
			...(decision && setting !== undefined ? { overrode: "attribute" as const } : {}),
		};
	},
};

const config = (markup = "<p></p>") =>
	({ markup, elements: {}, models: [{ id: "1", element: "x" }] }) as any;

describe("readItemFeatureDecisions", () => {
	test("keeps the decisions the appliers apply", () => {
		expect(
			readItemFeatureDecisions(
				{
					features: {
						demo: { granted: true, rule: "host-allowed" },
						other: { granted: false, rule: "host-blocked" },
					},
				},
				[demoApplier],
			),
		).toEqual({ demo: { granted: true, rule: "host-allowed" } });
	});

	test("drops absent, unnamed and malformed decisions", () => {
		expect(readItemFeatureDecisions(null, [demoApplier])).toEqual({});
		expect(
			readItemFeatureDecisions(
				{ features: { demo: { granted: false, rule: "none" } } },
				[demoApplier],
			),
		).toEqual({});
		expect(
			readItemFeatureDecisions({ features: { demo: {} } } as any, [demoApplier]),
		).toEqual({});
	});

	test("the registry applies autoplayAudio", () => {
		expect(
			readItemFeatureDecisions(
				{ features: { autoplayAudio: { granted: false, rule: "support-conflict" } } },
				ITEM_FEATURE_APPLIERS,
			),
		).toEqual({ autoplayAudio: { granted: false, rule: "support-conflict" } });
	});
});

describe("sameItemFeatureDecisions", () => {
	test("compares verdicts and rules per feature", () => {
		const a = { demo: { granted: true, rule: "host-allowed" } };
		expect(sameItemFeatureDecisions(a, { ...a })).toBe(true);
		expect(
			sameItemFeatureDecisions(a, { demo: { granted: true, rule: "pnp-support" } }),
		).toBe(false);
		expect(sameItemFeatureDecisions(a, {})).toBe(false);
	});
});

describe("itemFeaturesSignature", () => {
	test("changes with a setting or a verdict, and not with a rule alone", () => {
		const base = { mode: "view", settings: {}, decisions: {} } as const;
		const sign = (inputs: Parameters<typeof itemFeaturesSignature>[0]) =>
			itemFeaturesSignature(inputs, [demoApplier]);
		const signatures = new Set([
			sign(base),
			sign({ ...base, settings: { demo: "on" } }),
			sign({ ...base, decisions: { demo: { granted: true, rule: "a" } } }),
			sign({ ...base, decisions: { demo: { granted: false, rule: "a" } } }),
		]);
		expect(signatures.size).toBe(4);
		expect(sign({ ...base, decisions: { demo: { granted: true, rule: "a" } } })).toBe(
			sign({ ...base, decisions: { demo: { granted: true, rule: "b" } } }),
		);
	});

	test("ignores every input in author mode", () => {
		expect(
			itemFeaturesSignature(
				{
					mode: "author",
					settings: { demo: "on" },
					decisions: { demo: { granted: true, rule: "a" } },
				},
				[demoApplier],
			),
		).toBe(
			itemFeaturesSignature(
				{ mode: "author", settings: {}, decisions: {} },
				[demoApplier],
			),
		);
	});
});

describe("applyItemFeatures", () => {
	test("skips a feature with neither a setting nor a decision", () => {
		const source = config();
		const result = applyItemFeatures(
			source,
			{ mode: "view", settings: {}, decisions: {} },
			[demoApplier],
		);
		expect(result.config).toBe(source);
		expect(result.applied).toEqual([]);
	});

	test("reports one detail per decision written, with what it overrode", () => {
		const result = applyItemFeatures(
			config(),
			{
				mode: "view",
				settings: { demo: "on" },
				decisions: { demo: { granted: false, rule: "host-blocked" } },
			},
			[demoApplier],
		);
		expect((result.config.models[0] as any).demo).toBe(false);
		expect(result.applied).toEqual([
			{ featureId: "demo", granted: false, rule: "host-blocked", overrode: "attribute" },
		]);
	});

	test("a setting alone writes the models and reports nothing", () => {
		const result = applyItemFeatures(
			config(),
			{ mode: "view", settings: { demo: "on" }, decisions: {} },
			[demoApplier],
		);
		expect((result.config.models[0] as any).demo).toBe("on");
		expect(result.applied).toEqual([]);
	});

	test("removes markup rules in view mode whatever the inputs", () => {
		const result = applyItemFeatures(
			config('<p data-demo="1">a</p>'),
			{ mode: "view", settings: {}, decisions: {} },
			[demoApplier],
		);
		expect(result.config.markup).toBe("<p>a</p>");
		expect(result.applied).toEqual([]);
	});

	test("removes markup rules from a config without models", () => {
		const source = { markup: '<p data-demo="1">a</p>', elements: {} } as any;
		const result = applyItemFeatures(
			source,
			{ mode: "view", settings: {}, decisions: {} },
			[demoApplier],
		);
		expect(result.config.markup).toBe("<p>a</p>");
	});

	test("author mode receives neither models nor markup changes", () => {
		const source = config('<p data-demo="1">a</p>');
		const result = applyItemFeatures(
			source,
			{
				mode: "author",
				settings: { demo: "on" },
				decisions: { demo: { granted: true, rule: "a" } },
			},
			[demoApplier],
		);
		expect(result.config).toBe(source);
		expect(result.applied).toEqual([]);
	});
});

describe("applyMarkupRules", () => {
	const autoplay = [{ kind: "attribute", name: "autoplay" }] as const;

	test("removes the attribute and keeps the element", () => {
		expect(
			applyMarkupRules(
				'<audio autoplay src="a.mp3"></audio><div><video AUTOPLAY="" src="v.mp4"></video></div>',
				autoplay,
			),
		).toBe('<audio src="a.mp3"></audio><div><video src="v.mp4"></video></div>');
	});

	test("returns markup that no rule applies to as given", () => {
		const markup = "<p>Autoplay&nbsp;is a word<br></p><pie-x id=1></pie-x>";
		expect(applyMarkupRules(markup, autoplay)).toBe(markup);
		const mentioned = "<p>autoplay</p><audio src=a.mp3>";
		expect(applyMarkupRules(mentioned, autoplay)).toBe(mentioned);
	});

	test("returns markup as given without a document", () => {
		const markup = "<audio autoplay></audio>";
		expect(applyMarkupRules(markup, autoplay, null)).toBe(markup);
	});
});

describe("mergeAppliedFeatures", () => {
	test("keeps one detail per feature, the attribute outranking authored", () => {
		const held = { granted: false, rule: "support-conflict" };
		expect(
			mergeAppliedFeatures(
				[
					{ featureId: "autoplayAudio", ...held, overrode: "authored" },
					{ featureId: "demo", granted: true, rule: "a" },
				],
				[{ featureId: "autoplayAudio", ...held, overrode: "attribute" }],
			),
		).toEqual([
			{ featureId: "autoplayAudio", ...held, overrode: "attribute" },
			{ featureId: "demo", granted: true, rule: "a" },
		]);
		expect(mergeAppliedFeatures([], [])).toEqual([]);
	});
});
