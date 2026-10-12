import { describe, expect, test } from "bun:test";
import type {
	ToolPolicyDecision,
	ToolPolicyDiagnostic,
	ToolPolicyProvenance,
	ToolPolicyResolutionDecision,
} from "@pie-players/pie-assessment-toolkit/policy/engine";
import {
	buildEditableToolRows,
	createPatchedPnpProfile,
	createSimulatedAssessment,
	derivePnpPanelData,
	deriveAllAvailablePlacement,
	fetchSectionPolicyDecision,
	flattenFeatureTrails,
	resolveSectionToolIds,
	resolvePnpProfile,
	type PolicyPanelCoordinator,
} from "../derive-panel-data.js";

const DEFAULT_PNP = { __default: true };

function makeProvenance(
	features: Array<{
		featureId: string;
		finalState: "enabled" | "blocked" | "advisory-only" | "not-configured";
		decisions: Array<{
			rule: ToolPolicyResolutionDecision["rule"];
			action: ToolPolicyResolutionDecision["action"];
			sourceType: ToolPolicyResolutionDecision["source"]["type"];
			sourceName?: string;
			isWinning?: boolean;
		}>;
		explanation?: string;
	}>,
): ToolPolicyProvenance {
	const featuresMap = new Map();
	const decisionLog: ToolPolicyResolutionDecision[] = [];
	let step = 0;
	for (const feature of features) {
		const allDecisions: ToolPolicyResolutionDecision[] = feature.decisions.map(
			(d) => ({
				step: ++step,
				precedence: 1,
				rule: d.rule,
				featureId: feature.featureId,
				action: d.action,
				source: { type: d.sourceType, name: d.sourceName ?? d.sourceType },
				reason: `synthetic ${d.rule}`,
				timestamp: new Date(0),
			}),
		);
		decisionLog.push(...allDecisions);
		const winning = allDecisions.find(
			(_, idx) => feature.decisions[idx].isWinning,
		);
		featuresMap.set(feature.featureId, {
			featureId: feature.featureId,
			finalState: feature.finalState,
			winningDecision: winning,
			allDecisions,
			explanation: feature.explanation ?? "",
		});
	}
	return {
		contextId: "test-context",
		resolvedAt: new Date(0),
		sources: { host: { id: "test-host" } },
		features: featuresMap,
		decisionLog,
		summary: {
			totalFeatures: features.length,
			enabled: features.filter((f) => f.finalState === "enabled").length,
			blocked: features.filter((f) => f.finalState === "blocked").length,
			notConfigured: features.filter((f) => f.finalState === "not-configured")
				.length,
			bySource: {},
			byRule: {},
		},
	};
}

function makeDecision(
	visibleToolIds: string[],
	provenance: ToolPolicyProvenance,
): ToolPolicyDecision {
	return {
		visibleTools: visibleToolIds.map((toolId) => ({
			toolId,
			required: false,
			alwaysAvailable: false,
		})),
		diagnostics: [],
		provenance,
	};
}

describe("resolvePnpProfile", () => {
	test("shows the bound assessment's profile, which is the one policy reads", () => {
		const result = resolvePnpProfile(DEFAULT_PNP, {
			id: "a1",
			personalNeedsProfile: { id: "bound" },
		});
		expect(result.profile).toEqual({ id: "bound" });
		expect(result.source).toBe("assessment.personalNeedsProfile");
	});

	test("falls back to the panel's own profile when the bound assessment carries none", () => {
		// Named as the panel's fallback, not as a derived default: nothing derives a
		// profile any more, and labelling an empty `supports` array "derived" read as
		// a broken derivation rather than as an unconfigured assessment.
		for (const bound of [undefined, null, { id: "a1" }]) {
			const result = resolvePnpProfile(DEFAULT_PNP, bound);
			expect(result.profile).toBe(DEFAULT_PNP);
			expect(result.source).toBe("panel fallback (no profile bound)");
			expect(result.note).toContain("Nothing derives one");
		}
	});
});

describe("createSimulatedAssessment", () => {
	test("replaces only the profile of the bound assessment", () => {
		const bound = {
			id: "a1",
			personalNeedsProfile: { supports: ["calculator"] },
			settings: {
				districtPolicy: { blockedTools: ["graph"] },
				testAdministration: { toolOverrides: { textToSpeech: false } },
			},
		};
		const profile = { supports: ["calculator", "ruler"] };
		expect(
			createSimulatedAssessment(bound, { id: "s1" }, profile),
		).toEqual({ ...bound, personalNeedsProfile: profile });
	});

	test("binds a minimal assessment named after the section when nothing is bound", () => {
		const profile = { supports: ["ruler"] };
		expect(
			createSimulatedAssessment(null, { identifier: "s1" }, profile),
		).toEqual({ id: "s1", personalNeedsProfile: profile });
	});
});

describe("fetchSectionPolicyDecision", () => {
	test("returns null when coordinator is missing", () => {
		expect(fetchSectionPolicyDecision(null, "section-1")).toBeNull();
	});

	test("returns null when coordinator lacks decideToolPolicy", () => {
		expect(fetchSectionPolicyDecision({}, "section-1")).toBeNull();
	});

	test("calls decideToolPolicy with section-level scope", () => {
		const calls: unknown[] = [];
		const coord: PolicyPanelCoordinator = {
			decideToolPolicy: (req) => {
				calls.push(req);
				return makeDecision([], makeProvenance([]));
			},
		};
		fetchSectionPolicyDecision(coord, "my-section");
		expect(calls).toHaveLength(1);
		expect(calls[0]).toEqual({
			level: "section",
			scope: { level: "section", scopeId: "my-section" },
		});
	});

	test("swallows engine errors and returns null", () => {
		const coord: PolicyPanelCoordinator = {
			decideToolPolicy: () => {
				throw new Error("boom");
			},
		};
		expect(fetchSectionPolicyDecision(coord, "section")).toBeNull();
	});
});

describe("flattenFeatureTrails", () => {
	test("returns empty array for null provenance", () => {
		expect(flattenFeatureTrails(null)).toEqual([]);
	});

	test("flattens map entries with winning rule and source", () => {
		const provenance = makeProvenance([
			{
				featureId: "calculator",
				finalState: "enabled",
				decisions: [
					{
						rule: "placement-membership",
						action: "skip",
						sourceType: "host",
					},
					{
						rule: "host-allowlist",
						action: "enable",
						sourceType: "host",
						sourceName: "host-policy",
						isWinning: true,
					},
				],
				explanation: "calculator enabled via host allow",
			},
		]);
		const trails = flattenFeatureTrails(provenance);
		expect(trails).toHaveLength(1);
		expect(trails[0]).toEqual({
			featureId: "calculator",
			finalState: "enabled",
			winningRule: "host-allowlist",
			winningSource: "host-policy",
			decisionCount: 2,
			explanation: "calculator enabled via host allow",
		});
	});

	test("sorts by state (enabled > advisory-only > blocked > not-configured) then featureId", () => {
		const provenance = makeProvenance([
			{ featureId: "z-blocked", finalState: "blocked", decisions: [] },
			{ featureId: "a-blocked", finalState: "blocked", decisions: [] },
			{
				featureId: "m-enabled",
				finalState: "enabled",
				decisions: [],
			},
			{
				featureId: "advice",
				finalState: "advisory-only",
				decisions: [],
			},
			{
				featureId: "missing",
				finalState: "not-configured",
				decisions: [],
			},
		]);
		const order = flattenFeatureTrails(provenance).map((e) => e.featureId);
		expect(order).toEqual([
			"m-enabled",
			"advice",
			"a-blocked",
			"z-blocked",
			"missing",
		]);
	});

	test("emits null winning fields when no decision is marked winning", () => {
		const provenance = makeProvenance([
			{
				featureId: "skipped",
				finalState: "not-configured",
				decisions: [
					{ rule: "placement-membership", action: "skip", sourceType: "host" },
				],
			},
		]);
		const trails = flattenFeatureTrails(provenance);
		expect(trails[0].winningRule).toBeNull();
		expect(trails[0].winningSource).toBeNull();
		expect(trails[0].decisionCount).toBe(1);
	});
});

describe("resolveSectionToolIds", () => {
	test("prefers live section tool ids when non-empty", () => {
		const result = resolveSectionToolIds(null, ["live-1"]);
		expect(result).toEqual(["live-1"]);
	});

	test("falls back to the coordinator policy decision", () => {
		const calls: unknown[] = [];
		const result = resolveSectionToolIds(
			{
				decideToolPolicy: (request) => {
					calls.push(request);
					return {
						visibleTools: [{ toolId: "a" }, { toolId: "b" }],
					} as ToolPolicyDecision;
				},
			},
			[],
			"section-1",
		);
		expect(result).toEqual(["a", "b"]);
		expect(calls).toEqual([
			{ level: "section", scope: { level: "section", scopeId: "section-1" } },
		]);
	});

	test("uses an empty policy decision instead of falling back to config", () => {
		const result = resolveSectionToolIds(
			{
				decideToolPolicy: () => makeDecision([], makeProvenance([])),
				getPolicyInputs: () =>
					({ tools: { placement: { section: ["calculator"] } } }) as never,
			},
			[],
		);
		expect(result).toEqual([]);
	});

	test("falls back to the bound tools.placement.section", () => {
		const result = resolveSectionToolIds(
			{
				getPolicyInputs: () =>
					({ tools: { placement: { section: ["calculator"] } } }) as never,
			},
			[],
		);
		expect(result).toEqual(["calculator"]);
	});

	test("returns empty array when nothing is configured", () => {
		expect(resolveSectionToolIds(null, [])).toEqual([]);
	});
});

describe("editable tool helpers", () => {
	const coordinator: PolicyPanelCoordinator = {
		getToolRegistry: () => ({
			getAllTools: () => [
				{
					toolId: "lineReader",
					name: "Line Reader",
					description: "Reading guide",
					supportedLevels: ["section", "item", "passage"],
				},
				{
					toolId: "answerEliminator",
					name: "Answer Eliminator",
					supportedLevels: ["item"],
				},
			],
		}),
		getPolicyInputs: () =>
			({
				tools: {
					placement: {
						section: ["lineReader"],
						item: ["answerEliminator"],
					},
					providers: {
						answerEliminator: { enabled: false },
					},
				},
			}) as never,
	};

	test("buildEditableToolRows merges registry, placement, provider, visibility, and PNP state", () => {
		const rows = buildEditableToolRows({
			coordinator,
			pnpProfile: {
				supports: ["lineReader"],
				prohibitedSupports: ["answerEliminator"],
			},
			decisions: {
				section: [makeDecision(["lineReader"], makeProvenance([]))],
				item: [
					makeDecision([], makeProvenance([])),
					makeDecision([], makeProvenance([])),
				],
			},
		});

		const lineReader = rows.find((row) => row.toolId === "lineReader");
		expect(lineReader).toMatchObject({
			providerEnabled: true,
			pnpSupported: true,
			pnpProhibited: false,
			placement: { section: true, item: false, passage: false },
			visible: { section: true, item: false, passage: false },
		});
		const answerEliminator = rows.find(
			(row) => row.toolId === "answerEliminator",
		);
		expect(answerEliminator).toMatchObject({
			providerEnabled: false,
			pnpSupported: false,
			pnpProhibited: true,
			placement: { section: false, item: true, passage: false },
		});
	});

	test("deriveAllAvailablePlacement maps tools to supported levels", () => {
		const rows = buildEditableToolRows({
			coordinator,
			pnpProfile: {},
			decisions: {},
		});

		expect(deriveAllAvailablePlacement(rows)).toEqual({
			section: ["lineReader"],
			item: ["answerEliminator", "lineReader"],
			passage: ["lineReader"],
		});
	});

	test("createPatchedPnpProfile toggles support ids without mutating the source", () => {
		const source = { supports: ["a"], prohibitedSupports: ["z"] };
		const added = createPatchedPnpProfile(source, "supports", "b", true);
		expect(added.supports).toEqual(["a", "b"]);
		expect(source.supports).toEqual(["a"]);

		const removed = createPatchedPnpProfile(added, "supports", "a", false);
		expect(removed.supports).toEqual(["b"]);
	});
});

describe("derivePnpPanelData", () => {
	test("returns empty resolvedTools when coordinator is null", () => {
		const data = derivePnpPanelData({
			sectionData: { id: "s1" },
			roleType: "candidate",
			floatingTools: [],
			defaultPnpProfile: DEFAULT_PNP,
			coordinator: null,
		});
		expect(data.resolvedTools).toEqual([]);
		expect(data.provenance.summary).toBeNull();
		expect(data.provenance.featureCount).toBe(0);
		expect(data.featureTrails).toEqual([]);
		expect(data.determination.runtimeContext.role).toBe("candidate");
		expect(data.pnpProfile).toBe(DEFAULT_PNP);
	});

	test("threads decision visibleTools through to resolvedTools", () => {
		const provenance = makeProvenance([
			{
				featureId: "calculator",
				finalState: "enabled",
				decisions: [
					{
						rule: "host-allowlist",
						action: "enable",
						sourceType: "host",
						isWinning: true,
					},
				],
			},
			{
				featureId: "answerEliminator",
				finalState: "blocked",
				decisions: [
					{
						rule: "host-blocked",
						action: "block",
						sourceType: "host",
						isWinning: true,
					},
				],
			},
		]);
		const data = derivePnpPanelData({
			sectionData: { id: "s1" },
			roleType: "scorer",
			floatingTools: [],
			defaultPnpProfile: DEFAULT_PNP,
			coordinator: {
				decideToolPolicy: () => makeDecision(["calculator"], provenance),
				getPolicyInputs: () =>
					({
						assessment: { id: "a1", personalNeedsProfile: { id: "p" } },
					}) as never,
			},
		});
		expect(data.resolvedTools).toEqual(["calculator"]);
		expect(data.provenance.featureCount).toBe(2);
		expect(data.featureTrails.map((e) => e.featureId)).toEqual([
			"calculator",
			"answerEliminator",
		]);
		expect(data.featureTrails[0].finalState).toBe("enabled");
		expect(data.featureTrails[1].finalState).toBe("blocked");
		expect(data.pnpProfile).toEqual({ id: "p" });
		expect(data.determination.source).toBe("assessment.personalNeedsProfile");
	});

	test("shows no profile a section carries, since policy reads none", () => {
		const data = derivePnpPanelData({
			sectionData: {
				id: "s1",
				personalNeedsProfile: { supports: ["calculator"] },
				settings: { personalNeedsProfile: { supports: ["ruler"] } },
			} as never,
			roleType: "candidate",
			floatingTools: [],
			defaultPnpProfile: DEFAULT_PNP,
			coordinator: {
				decideToolPolicy: () => makeDecision([], makeProvenance([])),
				getPolicyInputs: () => ({ assessment: { id: "a1" } }) as never,
			},
		});
		expect(data.pnpProfile).toBe(DEFAULT_PNP);
		expect(data.determination.source).toBe("panel fallback (no profile bound)");
		expect(data.determination.checked).toEqual([]);
	});

	test("lists the policy inputs present on the assessment and items as checked", () => {
		const data = derivePnpPanelData({
			sectionData: {
				id: "s1",
				assessmentItemRefs: [
					{ identifier: "i1", settings: { requiredTools: ["calculator"] } },
					{ identifier: "i2" },
				],
			},
			roleType: "candidate",
			floatingTools: [],
			defaultPnpProfile: DEFAULT_PNP,
			coordinator: {
				decideToolPolicy: () => makeDecision([], makeProvenance([])),
				getPolicyInputs: () =>
					({
						assessment: {
							id: "a1",
							personalNeedsProfile: { supports: [] },
							settings: { districtPolicy: { blockedTools: [] } },
						},
					}) as never,
			},
		});
		expect(data.determination.checked).toEqual([
			"assessment.personalNeedsProfile",
			"assessment.settings.districtPolicy",
			"item i1 settings",
		]);
	});

	test("decides item and passage levels under the section's real item and passage ids", () => {
		const calls: Array<{ level: string; scopeId: string }> = [];
		const data = derivePnpPanelData({
			sectionData: {
				id: "s1",
				assessmentItemRefs: [
					{ identifier: "ref-1", item: { id: "item-1" } },
					{ item: { id: "item-2" } },
				],
				rubricBlocks: [
					{ class: "stimulus", passage: { id: "passage-1" } },
					{ class: "rubric", passage: { id: "not-a-passage" } },
				],
			},
			roleType: "candidate",
			floatingTools: [],
			defaultPnpProfile: DEFAULT_PNP,
			coordinator: {
				decideToolPolicy: (req) => {
					calls.push({ level: req.level, scopeId: req.scope.scopeId });
					return makeDecision(
						req.scope.scopeId === "item-2" ? ["calculator"] : [],
						makeProvenance([]),
					);
				},
				getToolRegistry: () => ({
					getAllTools: () => [
						{
							toolId: "calculator",
							name: "Calculator",
							supportedLevels: ["item"],
						},
					],
				}),
			},
		});
		expect(calls.filter((call) => call.level !== "section")).toEqual([
			{ level: "item", scopeId: "ref-1" },
			{ level: "item", scopeId: "item-2" },
			{ level: "passage", scopeId: "passage-1" },
		]);
		expect(
			data.toolRows.find((row) => row.toolId === "calculator")?.visible,
		).toEqual({ section: false, item: true, passage: false });
	});

	test("surfaces each decision diagnostic once", () => {
		const diagnostic: ToolPolicyDiagnostic = {
			code: "tool-policy.unknownSupportId",
			toolId: "textToSpeach",
			message: "No tool is registered under \"textToSpeach\".",
			details: { origins: ["pnp-support"] },
		};
		const data = derivePnpPanelData({
			sectionData: { id: "s1", assessmentItemRefs: [{ identifier: "i1" }] },
			roleType: "candidate",
			floatingTools: [],
			defaultPnpProfile: DEFAULT_PNP,
			coordinator: {
				decideToolPolicy: () => ({
					...makeDecision([], makeProvenance([])),
					diagnostics: [diagnostic],
				}),
			},
		});
		expect(data.diagnostics).toEqual([diagnostic]);
	});

	test("shows the coordinator's enforcement override as the selection", () => {
		const data = derivePnpPanelData({
			sectionData: { id: "s1" },
			roleType: "candidate",
			floatingTools: [],
			defaultPnpProfile: DEFAULT_PNP,
			coordinator: {
				decideToolPolicy: () => makeDecision([], makeProvenance([])),
				getPolicyInputs: () =>
					({ pnpEnforcement: "off", pnpEnforcementOverride: "off" }) as never,
			},
		});
		expect(data.pnpEnforcement).toEqual({ effective: "off", selection: "off" });
	});

	test("uses sectionData.identifier as scopeId fallback", () => {
		const calls: Array<{ scopeId: string }> = [];
		derivePnpPanelData({
			sectionData: { identifier: "ident-only" },
			roleType: "candidate",
			floatingTools: [],
			defaultPnpProfile: DEFAULT_PNP,
			coordinator: {
				decideToolPolicy: (req) => {
					calls.push({ scopeId: req.scope.scopeId });
					return makeDecision([], makeProvenance([]));
				},
			},
		});
		expect(calls[0].scopeId).toBe("ident-only");
	});

	test("populates catalog stats when resolver is present", () => {
		const data = derivePnpPanelData({
			sectionData: { id: "s1" },
			roleType: "candidate",
			floatingTools: [],
			defaultPnpProfile: DEFAULT_PNP,
			coordinator: {
				catalogResolver: {
					getStatistics: () => ({
						totalCatalogs: 4,
						assessmentCatalogs: 1,
						itemCatalogs: 3,
					}),
				},
			},
		});
		expect(data.determination.runtimeContext.hasCatalogResolver).toBe(true);
		expect(data.determination.runtimeContext.catalogCount).toBe(4);
		expect(data.determination.runtimeContext.assessmentCatalogCount).toBe(1);
		expect(data.determination.runtimeContext.itemCatalogCount).toBe(3);
	});

	test("zeroes catalog stats when resolver is missing", () => {
		const data = derivePnpPanelData({
			sectionData: { id: "s1" },
			roleType: "candidate",
			floatingTools: [],
			defaultPnpProfile: DEFAULT_PNP,
			coordinator: {
				decideToolPolicy: () => makeDecision([], makeProvenance([])),
			},
		});
		expect(data.determination.runtimeContext.hasCatalogResolver).toBe(false);
		expect(data.determination.runtimeContext.catalogCount).toBe(0);
	});

	test("reports an unbound assessment, distinctly from a profile that grants nothing", () => {
		const withNothingBound = derivePnpPanelData({
			sectionData: { id: "s1" },
			roleType: "candidate",
			floatingTools: [],
			defaultPnpProfile: DEFAULT_PNP,
			coordinator: {
				getPolicyInputs: () =>
					({ pnpEnforcement: "off", assessment: null }) as never,
			},
		});
		expect(withNothingBound.determination.runtimeContext.assessmentBound).toBe(
			false,
		);

		const withOne = derivePnpPanelData({
			sectionData: { id: "s1" },
			roleType: "candidate",
			floatingTools: [],
			defaultPnpProfile: DEFAULT_PNP,
			coordinator: {
				getPolicyInputs: () =>
					({ pnpEnforcement: "off", assessment: { id: "a1" } }) as never,
			},
		});
		expect(withOne.determination.runtimeContext.assessmentBound).toBe(true);
	});

	test("expects an assessment as the engine's resolved inputs say", () => {
		const expected = (coordinator: PolicyPanelCoordinator) =>
			derivePnpPanelData({
				sectionData: { id: "s1" },
				roleType: "candidate",
				floatingTools: [],
				defaultPnpProfile: DEFAULT_PNP,
				coordinator,
			}).determination.runtimeContext.assessmentExpected;
		const withInputs = (assessmentExpected: boolean): PolicyPanelCoordinator => ({
			getPolicyInputs: () =>
				({ assessment: null, assessmentExpected }) as never,
		});
		expect(expected(withInputs(true))).toBe(true);
		expect(expected(withInputs(false))).toBe(false);
		expect(expected({})).toBe(true);
	});

	test("lists the engine's input diagnostics with the decisions'", () => {
		const unknown: ToolPolicyDiagnostic = {
			code: "tool-policy.unknownSupportId",
			toolId: "magnification",
			message: "unknown",
			details: { origins: ["pnp-support"] },
		};
		const data = derivePnpPanelData({
			sectionData: { id: "s1" },
			roleType: "candidate",
			floatingTools: [],
			defaultPnpProfile: DEFAULT_PNP,
			coordinator: {
				getPolicyInputs: () =>
					({ assessment: null, diagnostics: [unknown] }) as never,
				decideToolPolicy: () => makeDecision([], makeProvenance([])),
			},
		});
		expect(data.diagnostics).toEqual([unknown]);
	});

	test("leaves the binding unstated when the coordinator exposes no inputs", () => {
		// "Cannot tell" must not read as "nothing is bound", which would report a
		// wiring gap against a host that simply predates `getPolicyInputs`.
		const data = derivePnpPanelData({
			sectionData: { id: "s1" },
			roleType: "candidate",
			floatingTools: [],
			defaultPnpProfile: DEFAULT_PNP,
			coordinator: {
				decideToolPolicy: () => makeDecision([], makeProvenance([])),
			},
		});
		expect(data.determination.runtimeContext.assessmentBound).toBeUndefined();
	});

	test("survives a throwing engine and renders an empty decision", () => {
		const data = derivePnpPanelData({
			sectionData: { id: "s1" },
			roleType: "candidate",
			floatingTools: [],
			defaultPnpProfile: DEFAULT_PNP,
			coordinator: {
				decideToolPolicy: () => {
					throw new Error("engine boom");
				},
			},
		});
		expect(data.resolvedTools).toEqual([]);
		expect(data.featureTrails).toEqual([]);
		expect(data.provenance.summary).toBeNull();
	});
});
