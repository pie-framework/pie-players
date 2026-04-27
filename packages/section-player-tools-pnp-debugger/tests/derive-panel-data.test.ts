import { describe, expect, test } from "bun:test";
import type {
	ToolPolicyDecision,
	ToolPolicyProvenance,
	ToolPolicyResolutionDecision,
} from "@pie-players/pie-assessment-toolkit/policy/engine";
import {
	derivePnpPanelData,
	fetchSectionPolicyDecision,
	flattenFeatureTrails,
	resolveFloatingTools,
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
		const winning = allDecisions.find((_, idx) => feature.decisions[idx].isWinning);
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
			sources: [],
		})),
		diagnostics: [],
		provenance,
	};
}

describe("resolvePnpProfile", () => {
	test("uses section.personalNeedsProfile when present", () => {
		const result = resolvePnpProfile(
			{ personalNeedsProfile: { id: "explicit" } },
			DEFAULT_PNP,
		);
		expect(result.profile).toEqual({ id: "explicit" });
		expect(result.source).toBe("section.personalNeedsProfile");
		expect(result.note).toContain("directly from section payload");
	});

	test("falls back to section.settings.personalNeedsProfile", () => {
		const result = resolvePnpProfile(
			{ settings: { personalNeedsProfile: { id: "settings" } } },
			DEFAULT_PNP,
		);
		expect(result.profile).toEqual({ id: "settings" });
		expect(result.source).toBe("section.settings.personalNeedsProfile");
	});

	test("falls back to default when neither path is set", () => {
		const result = resolvePnpProfile({}, DEFAULT_PNP);
		expect(result.profile).toBe(DEFAULT_PNP);
		expect(result.source).toBe("toolkit default profile (derived)");
		expect(result.note).toContain("default PNP profile is applied");
	});

	test("handles null section data", () => {
		const result = resolvePnpProfile(null, DEFAULT_PNP);
		expect(result.profile).toBe(DEFAULT_PNP);
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

describe("resolveFloatingTools", () => {
	test("prefers live floating tools when non-empty", () => {
		const result = resolveFloatingTools(
			{ getFloatingTools: () => ["a", "b"] },
			["live-1"],
		);
		expect(result).toEqual(["live-1"]);
	});

	test("falls back to coordinator.getFloatingTools()", () => {
		const result = resolveFloatingTools(
			{ getFloatingTools: () => ["a", "b"] },
			[],
		);
		expect(result).toEqual(["a", "b"]);
	});

	test("falls back to tools.placement.section config", () => {
		const result = resolveFloatingTools(
			{
				config: { tools: { placement: { section: ["calculator"] } } },
				getFloatingTools: () => [],
			},
			[],
		);
		expect(result).toEqual(["calculator"]);
	});

	test("returns empty array when nothing is configured", () => {
		expect(resolveFloatingTools(null, [])).toEqual([]);
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
			sectionData: { id: "s1", personalNeedsProfile: { id: "p" } },
			roleType: "scorer",
			floatingTools: [],
			defaultPnpProfile: DEFAULT_PNP,
			coordinator: {
				decideToolPolicy: () => makeDecision(["calculator"], provenance),
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
		expect(data.determination.source).toBe("section.personalNeedsProfile");
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
			coordinator: { decideToolPolicy: () => makeDecision([], makeProvenance([])) },
		});
		expect(data.determination.runtimeContext.hasCatalogResolver).toBe(false);
		expect(data.determination.runtimeContext.catalogCount).toBe(0);
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
