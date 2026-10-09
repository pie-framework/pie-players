/**
 * Pure helpers for `PnpPanel.svelte` panel data derivation.
 *
 * Extracted out of the Svelte component so the panel's read of the
 * coordinator's `ToolPolicyEngine` provenance can be unit-tested without
 * instantiating the custom element. Everything here is synchronous,
 * side-effect-free, and operates on plain objects — see
 * `tests/derive-panel-data.test.ts`.
 *
 * The panel renders PNP-centric chrome (panel title, "PNP Profile" card), but
 * the decision payload it displays is multi-source: placement, host policy,
 * provider veto, PNP/profile gates and custom sources all fold into the same
 * `ToolPolicyProvenance`, so naming here uses "policy" / "decision" /
 * "feature trail".
 */

import type {
	PnpEnforcementMode,
	ResolvedEngineInputs,
	ToolPolicyDecision,
	ToolPolicyDiagnostic,
	ToolPolicyFeatureTrail,
	ToolPolicyProvenance,
} from "@pie-players/pie-assessment-toolkit/policy/engine";

export type ToolPlacementLevel = "section" | "item" | "passage";
export type PnpEnforcementSelection = "auto" | "on" | "off";

export const TOOL_PLACEMENT_LEVELS: ToolPlacementLevel[] = [
	"section",
	"item",
	"passage",
];

/**
 * Minimal subset of the toolkit-coordinator surface that the panel
 * actually consumes. Defined inline (rather than imported as
 * `ToolkitCoordinatorApi`) so the helper stays usable in tests with
 * a hand-rolled stub.
 */
export interface PolicyPanelCoordinator {
	decideToolPolicy?: (request: {
		level: ToolPlacementLevel;
		scope: { level: ToolPlacementLevel; scopeId: string };
	}) => ToolPolicyDecision;
	getPolicyInputs?: () => Readonly<ResolvedEngineInputs>;
	getToolRegistry?: () => ToolRegistryLike;
	updateToolsPlacement?: (
		partial: Partial<Record<ToolPlacementLevel, string[]>>,
	) => void;
	updateToolConfig?: (toolId: string, updates: Record<string, unknown>) => void;
	updateAssessment?: (assessment: unknown) => void;
	setPnpEnforcement?: (mode: PnpEnforcementMode | null) => void;
	/** Set on the coordinator `<pie-assessment-toolkit>` builds for itself. */
	config?: { assessmentOptional?: boolean };
	catalogResolver?: {
		getStatistics?: () => {
			totalCatalogs?: number;
			assessmentCatalogs?: number;
			itemCatalogs?: number;
		};
	};
}

export interface ToolRegistrationLike {
	toolId: string;
	name?: string;
	description?: string;
	supportedLevels?: readonly string[];
	/**
	 * How the capability reaches the learner. `"region"` capabilities are the
	 * reason this panel cannot treat every row alike: they render into a host
	 * surface, so they have no placement to toggle and never appear in a
	 * placement-scoped decision's `visibleTools`.
	 */
	activation?: string;
	/** Whether the capability needs authored content to show anything. */
	requiresAuthoredContent?: unknown;
	/** What has to be authored, when the capability says. */
	contentDependencyDescription?: string;
}

export interface ToolRegistryLike {
	getAllTools?: () => ToolRegistrationLike[];
}

export interface PnpPanelInputs {
	sectionData: {
		id?: string;
		identifier?: string;
		assessmentItemRefs?: Array<{
			identifier?: string;
			item?: { id?: string } | null;
			settings?: Record<string, unknown> | null;
		}>;
		rubricBlocks?: Array<{
			class?: string;
			passage?: { id?: string } | null;
		}>;
	} | null;
	roleType: "candidate" | "scorer";
	floatingTools: string[];
	defaultPnpProfile: unknown;
	coordinator: PolicyPanelCoordinator | null;
}

export interface PnpPanelData {
	pnpProfile: unknown;
	resolvedTools: string[];
	provenance: {
		summary: ToolPolicyProvenance["summary"] | null;
		featureCount: number;
		sourceCount: number;
	};
	featureTrails: PnpFeatureTrailEntry[];
	toolRows: EditableToolRow[];
	allAvailablePlacement: Record<ToolPlacementLevel, string[]>;
	pnpEnforcement: {
		effective: "on" | "off" | "unknown";
		/** The host's override, or `"auto"` when none is set. */
		selection: PnpEnforcementSelection;
	};
	/**
	 * Diagnostics of the section, item and passage decisions the panel made,
	 * one per code, tool and item.
	 */
	diagnostics: ToolPolicyDiagnostic[];
	determination: {
		source: string;
		/** The policy input locations present on the bound assessment and items. */
		checked: string[];
		note: string;
		runtimeContext: {
			role: "candidate" | "scorer";
			floatingToolsEnabled: string[];
			hasCatalogResolver: boolean;
			catalogCount: number;
			assessmentCatalogCount: number;
			itemCatalogCount: number;
			/**
			 * Whether an assessment is bound. `undefined` when the coordinator does
			 * not expose its policy inputs, which is not the same as nothing bound.
			 *
			 * `false` where {@link assessmentExpected} holds is the deployment defect
			 * this panel exists to make findable: profile, district and
			 * test-administration policy decline for want of an input, with the
			 * verdict a properly-declined student gets.
			 */
			assessmentBound?: boolean;
			/**
			 * Whether an unbound assessment is a misconfiguration. The coordinator
			 * `<pie-assessment-toolkit>` builds for itself binds only the assessment
			 * its host passes, so there it is one only while enforcement is `"on"`.
			 */
			assessmentExpected: boolean;
		};
	};
}

export interface PnpFeatureTrailEntry {
	featureId: string;
	finalState: ToolPolicyFeatureTrail["finalState"];
	winningRule: string | null;
	winningSource: string | null;
	decisionCount: number;
	explanation: string;
}

export interface EditableToolRow {
	toolId: string;
	name: string;
	description: string;
	supportedLevels: ToolPlacementLevel[];
	providerEnabled: boolean;
	placement: Record<ToolPlacementLevel, boolean>;
	visible: Record<ToolPlacementLevel, boolean>;
	pnpSupported: boolean;
	pnpProhibited: boolean;
	/**
	 * Whether this capability can be placed on a toolbar at all.
	 *
	 * `false` for `activation: "region"`. The panel offered placement toggles for
	 * those, and writing one produces a `tools.unplaceableActivation` diagnostic at
	 * `error` severity — so the control could only ever break the config it was
	 * editing. The `visible` flags are meaningless for the same reason: they read a
	 * placement-scoped decision, which a region capability is never in, so they
	 * reported "not visible" while it was correctly rendering.
	 */
	placeable: boolean;
	/** What has to be authored for this capability to show anything, if anything. */
	contentDependency: string | null;
}

/**
 * Resolve the PNP profile to show and the source label that explains where it
 * came from: the bound assessment's, which is the one policy reads, or the
 * panel's own fallback.
 */
export function resolvePnpProfile(
	defaultPnpProfile: unknown,
	boundAssessment?: unknown,
): { profile: unknown; source: string; note: string } {
	const boundProfile = isRecord(boundAssessment)
		? boundAssessment.personalNeedsProfile
		: undefined;
	if (boundProfile) {
		return {
			profile: boundProfile,
			source: "assessment.personalNeedsProfile",
			note: "Profile of the bound assessment, which is the profile policy reads.",
		};
	}
	return {
		profile: defaultPnpProfile,
		source: "panel fallback (no profile bound)",
		note: "The bound assessment carries no PNP profile. Nothing derives one — a player grants no support the host did not configure, so placement alone decides which tools appear. This panel is showing its own fallback profile so the rows below have something to read.",
	};
}

/**
 * The assessment to bind when the panel edits the profile: the bound assessment
 * with `profile` in place of its own, keeping its settings (district policy,
 * test administration, tool configs). With nothing bound, a minimal assessment
 * named after the section.
 */
export function createSimulatedAssessment(
	boundAssessment: unknown,
	sectionData: PnpPanelInputs["sectionData"],
	profile: Record<string, unknown>,
): Record<string, unknown> {
	const base = isRecord(boundAssessment)
		? boundAssessment
		: { id: sectionData?.id || sectionData?.identifier || "debug-section" };
	return { ...base, personalNeedsProfile: profile };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object";
}

/**
 * Ask the coordinator's policy engine for the section-level decision
 * driving panel display. Engine errors are swallowed so a panel
 * mount never crashes the host shell — instead we surface
 * `decision: null` and the UI renders an empty state.
 */
export function fetchSectionPolicyDecision(
	coordinator: PolicyPanelCoordinator | null,
	scopeId: string,
): ToolPolicyDecision | null {
	return fetchPolicyDecision(coordinator, "section", scopeId);
}

export function fetchPolicyDecision(
	coordinator: PolicyPanelCoordinator | null,
	level: ToolPlacementLevel,
	scopeId: string,
): ToolPolicyDecision | null {
	if (!coordinator || typeof coordinator.decideToolPolicy !== "function") {
		return null;
	}
	try {
		return coordinator.decideToolPolicy({
			level,
			scope: { level, scopeId },
		});
	} catch {
		return null;
	}
}

/**
 * Flatten the engine's `Map<featureId, ToolPolicyFeatureTrail>` into
 * a stable, JSON-serializable list of per-tool trail entries that the
 * panel UI can render with a `<pre>JSON.stringify(...)</pre>` card.
 *
 * Sort order: enabled first, then advisory-only, then blocked, then
 * not-configured. Stable within a state by feature id.
 */
export function flattenFeatureTrails(
	provenance: ToolPolicyProvenance | null,
): PnpFeatureTrailEntry[] {
	if (!provenance) return [];
	const entries: PnpFeatureTrailEntry[] = [];
	for (const trail of provenance.features.values()) {
		entries.push({
			featureId: trail.featureId,
			finalState: trail.finalState,
			winningRule: trail.winningDecision?.rule ?? null,
			winningSource: trail.winningDecision
				? (trail.winningDecision.source.name ??
					trail.winningDecision.source.type)
				: null,
			decisionCount: trail.allDecisions.length,
			explanation: trail.explanation,
		});
	}
	const stateOrder: Record<ToolPolicyFeatureTrail["finalState"], number> = {
		enabled: 0,
		"advisory-only": 1,
		blocked: 2,
		"not-configured": 3,
	};
	entries.sort((a, b) => {
		const stateDiff = stateOrder[a.finalState] - stateOrder[b.finalState];
		if (stateDiff !== 0) return stateDiff;
		return a.featureId.localeCompare(b.featureId);
	});
	return entries;
}

/**
 * Resolve the section placement list shown in the panel. Order of
 * preference: live section tool ids, policy-engine decision, static
 * `tools.placement.section` config, empty list.
 */
export function resolveSectionToolIds(
	coordinator: PolicyPanelCoordinator | null,
	liveSectionToolIds: string[],
	scopeId = "section",
): string[] {
	if (liveSectionToolIds.length > 0) return [...liveSectionToolIds];
	const fromPolicy = fetchSectionPolicyDecision(coordinator, scopeId);
	const fromDecision = fromPolicy?.visibleTools.map((entry) => entry.toolId);
	if (Array.isArray(fromDecision)) {
		return fromDecision;
	}
	const fromConfig = coordinator?.getPolicyInputs?.()?.tools?.placement?.section;
	if (Array.isArray(fromConfig)) return [...fromConfig];
	return [];
}

function asStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((entry): entry is string => typeof entry === "string")
		: [];
}

function getPnpStringArray(profile: unknown, key: string): string[] {
	if (!profile || typeof profile !== "object") return [];
	return asStringArray((profile as Record<string, unknown>)[key]);
}

function normalizeSupportedLevels(
	tool: ToolRegistrationLike,
): ToolPlacementLevel[] {
	const rawLevels = Array.isArray(tool.supportedLevels)
		? tool.supportedLevels
		: [];
	return TOOL_PLACEMENT_LEVELS.filter((level) => rawLevels.includes(level));
}

function buildPlacementState(
	placement: Partial<Record<ToolPlacementLevel, readonly string[]>> | undefined,
	toolId: string,
): Record<ToolPlacementLevel, boolean> {
	return {
		section: Boolean(placement?.section?.includes(toolId)),
		item: Boolean(placement?.item?.includes(toolId)),
		passage: Boolean(placement?.passage?.includes(toolId)),
	};
}

/** Decisions per level: one per scope at that level, `null` where it failed. */
export type PanelDecisions = Partial<
	Record<ToolPlacementLevel, ReadonlyArray<ToolPolicyDecision | null>>
>;

function buildVisibleState(
	decisions: PanelDecisions,
	toolId: string,
): Record<ToolPlacementLevel, boolean> {
	const visibleAt = (level: ToolPlacementLevel) =>
		(decisions[level] ?? []).some((decision) =>
			decision?.visibleTools.some((entry) => entry.toolId === toolId),
		);
	return {
		section: visibleAt("section"),
		item: visibleAt("item"),
		passage: visibleAt("passage"),
	};
}

export function buildEditableToolRows(args: {
	coordinator: PolicyPanelCoordinator | null;
	pnpProfile: unknown;
	/** A tool is visible at a level when any decision at that level shows it. */
	decisions: PanelDecisions;
}): EditableToolRow[] {
	const tools = args.coordinator?.getToolRegistry?.()?.getAllTools?.() ?? [];
	const inputs = args.coordinator?.getPolicyInputs?.();
	const placement: Partial<Record<ToolPlacementLevel, readonly string[]>> =
		inputs?.tools?.placement ?? {};
	const providers: Record<string, { enabled?: boolean } | undefined> =
		inputs?.tools?.providers ?? {};
	const supports = getPnpStringArray(args.pnpProfile, "supports");
	const prohibitedSupports = getPnpStringArray(
		args.pnpProfile,
		"prohibitedSupports",
	);

	return tools
		.map((tool) => {
			const supportedLevels = normalizeSupportedLevels(tool);
			const placeable = tool.activation !== "region";
			return {
				toolId: tool.toolId,
				name: tool.name || tool.toolId,
				description: tool.description || "",
				supportedLevels,
				providerEnabled: providers[tool.toolId]?.enabled !== false,
				placeable,
				contentDependency: tool.requiresAuthoredContent
					? tool.contentDependencyDescription || "authored content on the item"
					: null,
				placement: buildPlacementState(placement, tool.toolId),
				visible: buildVisibleState(args.decisions, tool.toolId),
				pnpSupported: supports.includes(tool.toolId),
				pnpProhibited: prohibitedSupports.includes(tool.toolId),
			};
		})
		.filter((row) => row.supportedLevels.length > 0)
		.sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * Placement naming every capability that can be placed.
 *
 * Region capabilities are excluded: placing one is a `tools.unplaceableActivation`
 * error, so an "all available tools" button that included them wrote a config the
 * validator rejects.
 */
export function deriveAllAvailablePlacement(
	rows: EditableToolRow[],
): Record<ToolPlacementLevel, string[]> {
	const placeable = rows.filter((row) => row.placeable);
	return {
		section: placeable
			.filter((row) => row.supportedLevels.includes("section"))
			.map((row) => row.toolId),
		item: placeable
			.filter((row) => row.supportedLevels.includes("item"))
			.map((row) => row.toolId),
		passage: placeable
			.filter((row) => row.supportedLevels.includes("passage"))
			.map((row) => row.toolId),
	};
}

export function createPatchedPnpProfile(
	profile: unknown,
	key: "supports" | "prohibitedSupports",
	supportId: string,
	enabled: boolean,
): Record<string, unknown> {
	const base =
		profile && typeof profile === "object"
			? { ...(profile as Record<string, unknown>) }
			: {};
	const next = new Set(getPnpStringArray(base, key));
	if (enabled) {
		next.add(supportId);
	} else {
		next.delete(supportId);
	}
	base[key] = Array.from(next).sort();
	return base;
}

/**
 * Top-level derivation: build the full {@link PnpPanelData} payload
 * the panel renders. The component owns reactivity (Svelte
 * `$derived.by`) — this helper is pure.
 */
export function derivePnpPanelData(inputs: PnpPanelInputs): PnpPanelData {
	const {
		sectionData,
		roleType,
		floatingTools,
		defaultPnpProfile,
		coordinator,
	} = inputs;

	const policyInputs = coordinator?.getPolicyInputs?.();
	const { profile, source, note } = resolvePnpProfile(
		defaultPnpProfile,
		policyInputs?.assessment,
	);

	const scopeId = sectionData?.id || sectionData?.identifier || "section";
	const decision = fetchPolicyDecision(coordinator, "section", scopeId);
	// Each item and passage toolbar decides under the item's or passage's own
	// id, which is what brings an item's registered settings in.
	const decisions: PanelDecisions = {
		section: [decision],
		item: sectionItemIds(sectionData).map((id) =>
			fetchPolicyDecision(coordinator, "item", id),
		),
		passage: sectionPassageIds(sectionData).map((id) =>
			fetchPolicyDecision(coordinator, "passage", id),
		),
	};
	const provenance = decision?.provenance ?? null;
	const resolvedToolIds =
		decision?.visibleTools.map((entry) => entry.toolId) ?? [];
	const toolRows = buildEditableToolRows({
		coordinator,
		pnpProfile: profile,
		decisions,
	});

	const effectiveFloatingTools = resolveSectionToolIds(
		coordinator,
		floatingTools,
		scopeId,
	);
	const hasCatalogResolver = Boolean(coordinator?.catalogResolver);
	const catalogStats = hasCatalogResolver
		? (coordinator?.catalogResolver?.getStatistics?.() ?? null)
		: null;
	// Distinguished from a profile that grants nothing, which looks identical in
	// every other field on this panel: with no assessment bound there is no
	// profile, district policy or test administration for policy to read.
	// `undefined` means the coordinator does not expose its inputs, which is not
	// the same claim as "nothing is bound".
	const assessmentBound = policyInputs
		? policyInputs.assessment != null
		: undefined;
	const assessmentExpected =
		coordinator?.config?.assessmentOptional !== true ||
		policyInputs?.pnpEnforcementOverride === "on";

	return {
		pnpProfile: profile,
		resolvedTools: resolvedToolIds,
		provenance: {
			summary: provenance?.summary ?? null,
			featureCount: provenance?.features?.size ?? 0,
			sourceCount: Object.keys(provenance?.sources ?? {}).length,
		},
		featureTrails: flattenFeatureTrails(provenance),
		toolRows,
		allAvailablePlacement: deriveAllAvailablePlacement(toolRows),
		pnpEnforcement: {
			effective: policyInputs?.pnpEnforcement ?? "unknown",
			selection: policyInputs?.pnpEnforcementOverride ?? "auto",
		},
		diagnostics: collectDiagnostics(decisions),
		determination: {
			source,
			checked: presentPolicyInputs(policyInputs?.assessment, sectionData),
			note,
			runtimeContext: {
				role: roleType,
				floatingToolsEnabled: effectiveFloatingTools,
				hasCatalogResolver,
				catalogCount: catalogStats?.totalCatalogs ?? 0,
				assessmentCatalogCount: catalogStats?.assessmentCatalogs ?? 0,
				itemCatalogCount: catalogStats?.itemCatalogs ?? 0,
				assessmentBound,
				assessmentExpected,
			},
		},
	};
}

/** The canonical ids of the section's items, as their toolbars scope them. */
function sectionItemIds(sectionData: PnpPanelInputs["sectionData"]): string[] {
	const ids = (sectionData?.assessmentItemRefs ?? []).map(
		(ref) => ref.identifier || ref.item?.id || "",
	);
	return [...new Set(ids.filter(Boolean))];
}

/** The ids of the section's passages, as their toolbars scope them. */
function sectionPassageIds(
	sectionData: PnpPanelInputs["sectionData"],
): string[] {
	const ids = (sectionData?.rubricBlocks ?? [])
		.filter((block) => block.class === "stimulus")
		.map((block) => block.passage?.id || "");
	return [...new Set(ids.filter(Boolean))];
}

function collectDiagnostics(decisions: PanelDecisions): ToolPolicyDiagnostic[] {
	const seen = new Set<string>();
	const out: ToolPolicyDiagnostic[] = [];
	for (const level of TOOL_PLACEMENT_LEVELS) {
		for (const decision of decisions[level] ?? []) {
			for (const diagnostic of decision?.diagnostics ?? []) {
				const itemId = isRecord(diagnostic.details)
					? String(diagnostic.details.itemId ?? "")
					: "";
				const key = `${diagnostic.code}\0${diagnostic.toolId}\0${itemId}`;
				if (seen.has(key)) continue;
				seen.add(key);
				out.push(diagnostic);
			}
		}
	}
	return out;
}

function presentPolicyInputs(
	assessment: unknown,
	sectionData: PnpPanelInputs["sectionData"],
): string[] {
	const checked: string[] = [];
	if (isRecord(assessment)) {
		if (assessment.personalNeedsProfile) {
			checked.push("assessment.personalNeedsProfile");
		}
		const settings = isRecord(assessment.settings) ? assessment.settings : {};
		if (settings.districtPolicy) {
			checked.push("assessment.settings.districtPolicy");
		}
		if (settings.testAdministration) {
			checked.push("assessment.settings.testAdministration");
		}
	}
	for (const ref of sectionData?.assessmentItemRefs ?? []) {
		const settings = ref.settings;
		if (
			settings &&
			(settings.requiredTools || settings.restrictedTools || settings.toolParameters)
		) {
			checked.push(`item ${ref.identifier || ref.item?.id} settings`);
		}
	}
	return checked;
}
