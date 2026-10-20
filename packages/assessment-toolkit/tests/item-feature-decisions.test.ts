/**
 * The toolkit's `autoplayAudio` decision on an item, as `<pie-item-scope>`
 * provides it to the item player: one decision per policy input, republished
 * on a policy or settings change, and the `support-conflict` diagnostic raised
 * when the item player reports a hold that displaced the attribute or the
 * authored setting.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	spyOn,
	test,
} from "bun:test";

import type { AssessmentEntity } from "@pie-players/pie-players-shared/types";

import {
	itemFeatureScope,
	provideItemFeatureDecisions,
	resolveItemFeatureDecisions,
} from "../src/runtime/item-feature-decisions.js";
import { ToolkitCoordinator } from "../src/services/ToolkitCoordinator.js";
import { createTestToolRegistry } from "./fixtures/test-tool-registry.js";

beforeAll(() => {
	if (typeof (globalThis as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) GlobalRegistrator.unregister();
});

let warn: ReturnType<typeof spyOn>;
beforeEach(() => {
	warn = spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
});

const conflictWarnings = () =>
	warn.mock.calls
		.map((call: unknown[]) => String(call[0]))
		.filter((message: string) => message.includes("withholds"));

type ItemSettings = { requiredTools?: string[]; restrictedTools?: string[] };

function makeCoordinator(
	assessment: Partial<AssessmentEntity> = {},
	options: { policy?: { allowed?: string[]; blocked?: string[] } } = {},
) {
	const coord = new ToolkitCoordinator({
		assessmentId: "item-feature-decisions",
		lazyInit: true,
		toolRegistry: createTestToolRegistry(),
		tools: {
			...(options.policy
				? {
						policy: {
							allowed: options.policy.allowed ?? [],
							blocked: options.policy.blocked ?? [],
						},
					}
				: {}),
			placement: { item: ["calculator"] },
		},
	});
	coord.updateAssessment({ id: "a1", ...assessment } as AssessmentEntity);
	return coord;
}

const I1 = itemFeatureScope({ itemId: "i1" });

const autoplay = (coord: ToolkitCoordinator, settings?: ItemSettings) => {
	if (settings) coord.registerItemSettings("i1", settings);
	return resolveItemFeatureDecisions(coord, I1).features.autoplayAudio;
};

const pnp = (profile: Record<string, unknown>) => ({
	personalNeedsProfile: { supports: [], ...profile },
});

describe("resolveItemFeatureDecisions", () => {
	const cases: Array<
		[
			string,
			() => ToolkitCoordinator,
			ItemSettings | undefined,
			{ granted: boolean; rule: string },
		]
	> = [
		[
			"tools.policy.blocked",
			() => makeCoordinator({}, { policy: { blocked: ["autoplayAudio"] } }),
			undefined,
			{ granted: false, rule: "host-blocked" },
		],
		[
			"a tools.policy.allowed that omits it",
			() => makeCoordinator({}, { policy: { allowed: ["calculator"] } }),
			undefined,
			{ granted: false, rule: "host-allowlist" },
		],
		[
			"districtPolicy.blockedTools",
			() =>
				makeCoordinator({
					settings: { districtPolicy: { blockedTools: ["autoplayAudio"] } },
				} as Partial<AssessmentEntity>),
			undefined,
			{ granted: false, rule: "district-block" },
		],
		[
			"a test-administration override set off",
			() =>
				makeCoordinator({
					settings: {
						testAdministration: { toolOverrides: { autoplayAudio: false } },
					},
				} as Partial<AssessmentEntity>),
			undefined,
			{ granted: false, rule: "test-admin-override" },
		],
		[
			"the item's restrictedTools",
			() => makeCoordinator(),
			{ restrictedTools: ["autoplayAudio"] },
			{ granted: false, rule: "item-restriction" },
		],
		[
			"personalNeedsProfile.prohibitedSupports",
			() => makeCoordinator(pnp({ prohibitedSupports: ["autoplayAudio"] })),
			undefined,
			{ granted: false, rule: "pnp-prohibited" },
		],
		[
			"a screenReader support",
			() => makeCoordinator(pnp({ supports: ["screenReader"] })),
			undefined,
			{ granted: false, rule: "support-conflict" },
		],
		[
			"a test-administration override set on",
			() =>
				makeCoordinator({
					settings: {
						testAdministration: { toolOverrides: { autoplayAudio: true } },
					},
				} as Partial<AssessmentEntity>),
			undefined,
			{ granted: true, rule: "test-admin-override" },
		],
		[
			"the item's requiredTools",
			() => makeCoordinator(),
			{ requiredTools: ["autoplayAudio"] },
			{ granted: true, rule: "item-requirement" },
		],
		[
			"districtPolicy.requiredTools",
			() =>
				makeCoordinator({
					settings: { districtPolicy: { requiredTools: ["autoplayAudio"] } },
				} as Partial<AssessmentEntity>),
			undefined,
			{ granted: true, rule: "district-requirement" },
		],
		[
			"personalNeedsProfile.supports",
			() => makeCoordinator(pnp({ supports: ["autoplayAudio"] })),
			undefined,
			{ granted: true, rule: "pnp-support" },
		],
	];

	for (const [input, coordinator, settings, expected] of cases) {
		test(`${input} decides ${expected.rule}`, () => {
			expect(autoplay(coordinator(), settings)).toEqual(expected);
		});
	}

	test("no input leaves autoplayAudio out of the value", () => {
		expect(resolveItemFeatureDecisions(makeCoordinator(), I1)).toEqual({
			features: {},
		});
	});

	test("an item's settings govern only that item", () => {
		const coord = makeCoordinator();
		coord.registerItemSettings("i2", { requiredTools: ["autoplayAudio"] });
		expect(autoplay(coord)).toBeUndefined();
		expect(
			resolveItemFeatureDecisions(coord, itemFeatureScope({ itemId: "i2" }))
				.features.autoplayAudio,
		).toEqual({ granted: true, rule: "item-requirement" });
	});

	test("no coordinator or no item decides nothing", () => {
		expect(resolveItemFeatureDecisions(null, I1)).toEqual({ features: {} });
		expect(
			resolveItemFeatureDecisions(
				makeCoordinator(pnp({ supports: ["screenReader"] })),
				null,
			),
		).toEqual({ features: {} });
	});
});

describe("provideItemFeatureDecisions", () => {
	const settle = async () => {
		for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
	};

	async function subscribe(host: HTMLElement) {
		const { connectContextWithRetry, itemFeatureDecisionsContext } =
			await import("@pie-players/pie-context");
		const child = host.appendChild(document.createElement("div"));
		const values: unknown[] = [];
		const stop = connectContextWithRetry(
			child,
			itemFeatureDecisionsContext,
			(value) => values.push(value),
		);
		await settle();
		return { child, values, stop };
	}

	test("answers no decision until a coordinator and an item are set", async () => {
		const host = document.body.appendChild(document.createElement("div"));
		const decisions = provideItemFeatureDecisions(host);
		const { values, stop } = await subscribe(host);

		decisions.setCoordinator(
			makeCoordinator(pnp({ supports: ["screenReader"] })),
		);
		expect(values.at(-1)).toEqual({ features: {} });

		decisions.setItem({ itemId: "i1" });
		expect(values.at(-1)).toEqual({
			features: { autoplayAudio: { granted: false, rule: "support-conflict" } },
		});

		stop();
		decisions.disconnect();
		host.remove();
	});

	test("republishes on a settings change and an input change, and only then", async () => {
		const host = document.body.appendChild(document.createElement("div"));
		const coord = makeCoordinator();
		const decisions = provideItemFeatureDecisions(host);
		decisions.setCoordinator(coord);
		decisions.setItem({ itemId: "i1" });
		const { values, stop } = await subscribe(host);
		const initial = values.length;

		coord.registerItemSettings("i1", { requiredTools: ["autoplayAudio"] });
		expect(values.at(-1)).toEqual({
			features: { autoplayAudio: { granted: true, rule: "item-requirement" } },
		});

		coord.registerItemSettings("i1", { requiredTools: ["autoplayAudio"] });
		decisions.setItem({ itemId: "i1" });
		expect(values).toHaveLength(initial + 1);

		coord.updateAssessment({
			id: "a1",
			...pnp({ prohibitedSupports: ["autoplayAudio"] }),
		} as AssessmentEntity);
		expect(values.at(-1)).toEqual({
			features: { autoplayAudio: { granted: false, rule: "pnp-prohibited" } },
		});

		stop();
		decisions.disconnect();
		host.remove();
	});

	test("relays feature-decision-applied to the coordinator with the item's scope", async () => {
		const { FEATURE_DECISION_APPLIED_EVENT } = await import(
			"@pie-players/pie-context"
		);
		const host = document.body.appendChild(document.createElement("div"));
		const reported: unknown[] = [];
		const coord = makeCoordinator();
		coord.reportFeatureDecisionApplied = (detail, scope) => {
			reported.push({ detail, scope });
		};
		const decisions = provideItemFeatureDecisions(host);
		decisions.setCoordinator(coord);
		decisions.setItem({ itemId: "i1", canonicalItemId: "c1" });
		const child = host.appendChild(document.createElement("div"));
		const detail = {
			featureId: "autoplayAudio",
			granted: false,
			rule: "support-conflict",
			overrode: "authored",
		};

		child.dispatchEvent(
			new CustomEvent(FEATURE_DECISION_APPLIED_EVENT, {
				bubbles: true,
				composed: true,
				detail,
			}),
		);
		decisions.disconnect();
		child.dispatchEvent(
			new CustomEvent(FEATURE_DECISION_APPLIED_EVENT, {
				bubbles: true,
				composed: true,
				detail,
			}),
		);

		expect(reported).toEqual([
			{
				detail,
				scope: {
					level: "item",
					scopeId: "c1",
					itemId: "i1",
					canonicalItemId: "c1",
				},
			},
		]);
		host.remove();
	});

	test("stops following a disposed coordinator", async () => {
		const host = document.body.appendChild(document.createElement("div"));
		const coord = makeCoordinator(pnp({ supports: ["screenReader"] }));
		const decisions = provideItemFeatureDecisions(host);
		decisions.setCoordinator(coord);
		decisions.setItem({ itemId: "i1" });
		const { values, stop } = await subscribe(host);

		await coord.dispose();
		expect(values.at(-1)).toEqual({ features: {} });

		stop();
		decisions.disconnect();
		host.remove();
	});
});

describe("reportFeatureDecisionApplied", () => {
	const held = (overrode?: "attribute" | "authored") => ({
		featureId: "autoplayAudio",
		granted: false,
		rule: "support-conflict",
		...(overrode ? { overrode } : {}),
	});

	test("a support-conflict hold that displaced authored autoplay warns once", () => {
		const coord = makeCoordinator(pnp({ supports: ["screenReader"] }));
		const diagnostics: unknown[] = [];
		coord.onPolicyDiagnostic((d) => diagnostics.push(d));

		coord.reportFeatureDecisionApplied(held("authored"), I1);
		coord.reportFeatureDecisionApplied(held("authored"), I1);

		expect(diagnostics).toEqual([
			{
				code: "tool-policy.supportConflict",
				toolId: "autoplayAudio",
				message: expect.stringContaining("The item's authored content"),
				details: { support: "screenReader", servedBy: "authored" },
			},
		]);
		expect(conflictWarnings()).toHaveLength(1);
	});

	test("names the attribute when the hold displaced it", () => {
		const coord = makeCoordinator(pnp({ supports: ["screenReader"] }));
		coord.reportFeatureDecisionApplied(held("attribute"), I1);
		expect(conflictWarnings()).toEqual([
			expect.stringContaining("The item player's attribute"),
		]);
	});

	test("a hold that displaced nothing, or another rule's hold, raises nothing", () => {
		const coord = makeCoordinator(
			pnp({ supports: ["screenReader"], prohibitedSupports: ["autoplayAudio"] }),
		);
		coord.reportFeatureDecisionApplied(held(), I1);
		coord.reportFeatureDecisionApplied(
			{ ...held("authored"), rule: "pnp-prohibited" },
			I1,
		);
		coord.reportFeatureDecisionApplied(
			{ ...held("authored"), granted: true },
			I1,
		);
		expect(conflictWarnings()).toEqual([]);
	});

	test("a report the current decision no longer backs raises nothing", () => {
		const coord = makeCoordinator();
		coord.reportFeatureDecisionApplied(held("authored"), I1);
		expect(conflictWarnings()).toEqual([]);
	});

	test("the feature decision names the withholding support", () => {
		const coord = makeCoordinator(pnp({ supports: ["screenReader"] }));
		expect(coord.decideFeaturePolicy("autoplayAudio", I1)).toMatchObject({
			rule: "support-conflict",
			withheldBy: "screenReader",
		});
		expect(
			makeCoordinator().decideFeaturePolicy("autoplayAudio", I1),
		).not.toHaveProperty("withheldBy");
	});
});
