/**
 * While the student's `screenReader` support is in effect, PIE's read-aloud and
 * item autoplay are withheld under `support-conflict` at precedence 4 (ADR
 * 0004). A block a person recorded outranks the conflict and keeps its rule.
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

import type { AssessmentEntity } from "@pie-players/pie-players-shared/types";

import type { SupportConflictServedBy } from "../../src/policy/core/decision-types.js";
import type { ToolPolicyDecisionRule } from "../../src/policy/core/provenance.js";
import { ToolkitCoordinator } from "../../src/services/ToolkitCoordinator.js";
import { createTestToolRegistry } from "../fixtures/test-tool-registry.js";

let warn: ReturnType<typeof spyOn>;
beforeEach(() => {
	warn = spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
});

const warnings = (fragment: string) =>
	warn.mock.calls
		.map((call: unknown[]) => String(call[0]))
		.filter((message: string) => message.includes(fragment));

type ItemSettings = { requiredTools?: string[]; restrictedTools?: string[] };
/** A label, the assessment, and the item's registered settings. */
type Case<L extends string = string> = [L, Partial<AssessmentEntity>, ItemSettings | undefined];

const ITEM_TOOLBAR = {
	level: "item",
	scope: { level: "item", scopeId: "i1" },
} as const;

function makeCoordinator(
	assessment: Partial<AssessmentEntity>,
	options: {
		placed?: string[];
		itemSettings?: ItemSettings;
	} = {},
) {
	const coord = new ToolkitCoordinator({
		assessmentId: "screen-reader",
		lazyInit: true,
		toolRegistry: createTestToolRegistry(),
		tools: {
			placement: { item: options.placed ?? ["calculator", "textToSpeech"] },
		},
	});
	coord.updateAssessment({ id: "a1", ...assessment } as AssessmentEntity);
	if (options.itemSettings) {
		coord.registerItemSettings("i1", options.itemSettings);
	}
	return coord;
}

const decide = (coord: ToolkitCoordinator) => coord.decideToolPolicy(ITEM_TOOLBAR);
const visible = (coord: ToolkitCoordinator) =>
	decide(coord).visibleTools.map((e) => e.toolId);
const conflicts = (coord: ToolkitCoordinator) =>
	decide(coord).diagnostics.filter(
		(d) => d.code === "tool-policy.supportConflict",
	);
const ttsDecision = (coord: ToolkitCoordinator) =>
	decide(coord).provenance.features.get("textToSpeech")?.winningDecision;

const screenReader = (extra: Record<string, unknown> = {}) => ({
	personalNeedsProfile: { supports: ["screenReader"], ...extra },
});

describe("screenReader and autoplayAudio are recognized ids", () => {
	test("neither raises unknownSupportId", () => {
		const coord = makeCoordinator({
			personalNeedsProfile: {
				supports: ["screenReader"],
				prohibitedSupports: ["autoplayAudio"],
			},
		});

		expect(coord.getPolicyInputs().diagnostics).toEqual([]);
		expect(warnings("No tool is registered")).toHaveLength(0);
	});
});

describe("a screenReader in effect withholds read-aloud", () => {
	test("a placed textToSpeech no input names is removed", () => {
		const coord = makeCoordinator(screenReader());

		expect(visible(coord)).toEqual(["calculator"]);
		expect(ttsDecision(coord)).toMatchObject({
			rule: "support-conflict",
			precedence: 4,
			action: "block",
		});
		expect(conflicts(coord)).toEqual([
			{
				code: "tool-policy.supportConflict",
				level: "item",
				toolId: "textToSpeech",
				message: expect.stringContaining("tools.placement"),
				details: { support: "screenReader", servedBy: "placement" },
			},
		]);
	});

	test.each([
		[
			"pnp-support",
			screenReader({ supports: ["screenReader", "textToSpeech"] }),
			undefined,
		],
		[
			"district-requirement",
			{
				...screenReader(),
				settings: { districtPolicy: { requiredTools: ["textToSpeech"] } },
			},
			undefined,
		],
		["item-requirement", screenReader(), { requiredTools: ["textToSpeech"] }],
	] as Case<SupportConflictServedBy>[])("a %s grant is displaced and named", (rule, assessment, itemSettings) => {
		const coord = makeCoordinator(assessment, {
			itemSettings,
		});

		expect(visible(coord)).not.toContain("textToSpeech");
		expect(conflicts(coord).map((d) => d.details)).toEqual([
			{ support: "screenReader", servedBy: rule },
		]);
		expect(
			decide(coord).diagnostics.filter(
				(d) => d.code === "tool-policy.requiredToolBlocked",
			),
		).toEqual([]);
	});

	test("an override true is withdrawn with one supportConflict and no overrideBlocked", () => {
		const coord = makeCoordinator({
			...screenReader(),
			settings: {
				testAdministration: { toolOverrides: { textToSpeech: true } },
			},
		});

		decide(coord);
		const decision = decide(coord);

		expect(decision.visibleTools.map((e) => e.toolId)).not.toContain(
			"textToSpeech",
		);
		expect(decision.diagnostics.map((d) => [d.code, d.details])).toEqual([
			[
				"tool-policy.supportConflict",
				{ support: "screenReader", servedBy: "test-admin-override" },
			],
		]);
		expect(warnings('"screenReader" support withholds')).toHaveLength(1);
		expect(warnings("toolOverrides grants")).toHaveLength(0);
	});

	test("a tool this level does not place raises no diagnostic", () => {
		const coord = makeCoordinator(
			screenReader({ supports: ["screenReader", "textToSpeech"] }),
			{ placed: ["calculator"] },
		);

		expect(ttsDecision(coord)?.rule).toBe("support-conflict");
		expect(conflicts(coord)).toEqual([]);
	});
});

describe("a block a person recorded outranks the conflict", () => {
	test.each([
		[
			"district-block",
			{
				...screenReader(),
				settings: { districtPolicy: { blockedTools: ["textToSpeech"] } },
			},
			undefined,
		],
		[
			"test-admin-override",
			{
				...screenReader(),
				settings: {
					testAdministration: { toolOverrides: { textToSpeech: false } },
				},
			},
			undefined,
		],
		["item-restriction", screenReader(), { restrictedTools: ["textToSpeech"] }],
	] as Case<ToolPolicyDecisionRule>[])("a %s of textToSpeech keeps its own rule", (rule, assessment, itemSettings) => {
		const coord = makeCoordinator(assessment, {
			itemSettings,
		});

		expect(visible(coord)).not.toContain("textToSpeech");
		expect(ttsDecision(coord)?.rule).toBe(rule);
		expect(conflicts(coord)).toEqual([]);
	});
});

describe("a screenReader that is not in effect withholds nothing", () => {
	test.each([
		[
			"district-block",
			{
				...screenReader(),
				settings: { districtPolicy: { blockedTools: ["screenReader"] } },
			},
			undefined,
		],
		[
			"override false",
			{
				...screenReader(),
				settings: {
					testAdministration: { toolOverrides: { screenReader: false } },
				},
			},
			undefined,
		],
		["item-restriction", screenReader(), { restrictedTools: ["screenReader"] }],
		[
			"profile prohibition",
			{ personalNeedsProfile: { supports: [], prohibitedSupports: ["screenReader"] } },
			undefined,
		],
	] as Case[])("withdrawn by %s, textToSpeech stays", (_label, assessment, itemSettings) => {
		const coord = makeCoordinator(assessment, {
			itemSettings,
		});

		expect(visible(coord)).toContain("textToSpeech");
		expect(conflicts(coord)).toEqual([]);
	});

	test("PNP enforcement off leaves textToSpeech", () => {
		const coord = new ToolkitCoordinator({
			assessmentId: "screen-reader-off",
			lazyInit: true,
			toolRegistry: createTestToolRegistry(),
			tools: {
				placement: { item: ["textToSpeech"] },
				pnpEnforcement: "off",
			},
		});
		coord.updateAssessment({ id: "a1", ...screenReader() } as AssessmentEntity);

		expect(visible(coord)).toEqual(["textToSpeech"]);
	});
});

describe("feature decisions", () => {
	test("autoplayAudio is denied under support-conflict", () => {
		const coord = makeCoordinator(screenReader());

		expect(coord.decideFeaturePolicy("autoplayAudio")).toMatchObject({
			granted: false,
			rule: "support-conflict",
			precedence: 4,
			sourceType: "student",
			diagnostics: [],
		});
	});

	test("a displaced grant is reported on the feature decision", () => {
		const coord = makeCoordinator(
			screenReader({ supports: ["screenReader", "textToSpeech"] }),
		);

		const decision = coord.decideFeaturePolicy("textToSpeech");
		expect(decision).toMatchObject({ granted: false, rule: "support-conflict" });
		expect(decision.diagnostics).toEqual([
			{
				code: "tool-policy.supportConflict",
				toolId: "textToSpeech",
				message: expect.stringContaining("personalNeedsProfile.supports"),
				details: { support: "screenReader", servedBy: "pnp-support" },
			},
		]);
	});

	test("without a screenReader, autoplayAudio is not decided", () => {
		const coord = makeCoordinator({ personalNeedsProfile: { supports: [] } });

		expect(coord.decideFeaturePolicy("autoplayAudio")).toMatchObject({
			granted: false,
			rule: "none",
		});
	});
});
