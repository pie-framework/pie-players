/**
 * Pure helpers for `PnpPanel.svelte` panel data derivation.
 *
 * Extracted out of the Svelte component so the panel's read of the
 * coordinator's `ToolPolicyEngine` provenance shape (M8 PR 3) can be
 * unit-tested without instantiating the custom element. Everything
 * here is synchronous, side-effect-free, and operates on plain
 * objects — see `tests/derive-panel-data.test.ts`.
 *
 * The panel still renders PNP-centric chrome at the UI level (panel
 * title, "PNP Profile" card), but the policy-decision payload it
 * displays is multi-source: every Pass-1 contributor (placement,
 * host policy, provider veto, PNP/profile gates, custom sources) is folded
 * into the same `ToolPolicyProvenance` and the panel surfaces all of
 * it. Naming inside this helper deliberately uses "policy" /
 * "decision" / "feature trail" rather than "PNP" to reflect that.
 */

import type {
	ResolvedEngineInputs,
	ToolPolicyDecision,
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
	getFloatingTools?: () => string[];
	getPolicyInputs?: () => Readonly<ResolvedEngineInputs>;
	updateToolPlacement?: (level: ToolPlacementLevel, toolIds: string[]) => void;
	updateFloatingTools?: (toolIds: string[]) => void;
	updateToolConfig?: (toolId: string, updates: Record<string, unknown>) => void;
	updateAssessment?: (assessment: unknown) => void;
	setPnpEnforcement?: (mode: "on" | "off" | null) => void;
	config?: {
		tools?: {
			placement?: Partial<Record<ToolPlacementLevel, string[]>>;
			providers?: Record<string, { enabled?: boolean } | undefined>;
		};
		toolRegistry?: ToolRegistryLike | null;
	};
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
	pnpSupportIds?: readonly string[];
}

export interface ToolRegistryLike {
	getAllTools?: () => ToolRegistrationLike[];
}

export interface PnpPanelInputs {
	sectionData: {
		id?: string;
		identifier?: string;
		personalNeedsProfile?: unknown;
		settings?: { personalNeedsProfile?: unknown };
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
		selection: PnpEnforcementSelection;
	};
	determination: {
		source: string;
		checked: string[];
		note: string;
		runtimeContext: {
			role: "candidate" | "scorer";
			floatingToolsEnabled: string[];
			hasCatalogResolver: boolean;
			catalogCount: number;
			assessmentCatalogCount: number;
			itemCatalogCount: number;
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
	pnpSupportIds: string[];
	primaryPnpSupportId: string;
	providerEnabled: boolean;
	placement: Record<ToolPlacementLevel, boolean>;
	visible: Record<ToolPlacementLevel, boolean>;
	pnpSupported: boolean;
	pnpProhibited: boolean;
}

/**
 * Resolve the active PNP profile and the source label that explains
 * where it came from.
 */
export function resolvePnpProfile(
	sectionData: PnpPanelInputs["sectionData"],
	defaultPnpProfile: unknown,
): { profile: unknown; source: string; note: string } {
	const directProfile = sectionData?.personalNeedsProfile;
	const settingsProfile = sectionData?.settings?.personalNeedsProfile;
	const profile = directProfile ?? settingsProfile ?? defaultPnpProfile;
	const source = directProfile
		? "section.personalNeedsProfile"
		: settingsProfile
			? "section.settings.personalNeedsProfile"
			: "toolkit default profile (derived)";
	const note =
		directProfile || settingsProfile
			? "Profile was taken directly from section payload."
			: "No explicit PNP profile was found in section payload, so the toolkit default PNP profile is applied.";
	return { profile, source, note };
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
 * Resolve the floating-tools list shown in the panel. Order of
 * preference: live `floatingTools` from the `onFloatingToolsChange`
 * subscription → coordinator's `getFloatingTools()` → static
 * `tools.placement.section` config → empty list.
 */
export function resolveFloatingTools(
	coordinator: PolicyPanelCoordinator | null,
	liveFloatingTools: string[],
): string[] {
	if (liveFloatingTools.length > 0) return [...liveFloatingTools];
	const fromGetter = coordinator?.getFloatingTools?.();
	if (Array.isArray(fromGetter) && fromGetter.length > 0) return [...fromGetter];
	const fromConfig = coordinator?.config?.tools?.placement?.section;
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

function hasAnySupport(profileIds: string[], supportIds: string[]): boolean {
	return supportIds.some((supportId) => profileIds.includes(supportId));
}

function normalizeSupportedLevels(tool: ToolRegistrationLike): ToolPlacementLevel[] {
	const rawLevels = Array.isArray(tool.supportedLevels) ? tool.supportedLevels : [];
	return TOOL_PLACEMENT_LEVELS.filter((level) => rawLevels.includes(level));
}

function buildPlacementState(
	placement: Partial<Record<ToolPlacementLevel, string[]>> | undefined,
	toolId: string,
): Record<ToolPlacementLevel, boolean> {
	return {
		section: Boolean(placement?.section?.includes(toolId)),
		item: Boolean(placement?.item?.includes(toolId)),
		passage: Boolean(placement?.passage?.includes(toolId)),
	};
}

function buildVisibleState(
	decisions: Partial<Record<ToolPlacementLevel, ToolPolicyDecision | null>>,
	toolId: string,
): Record<ToolPlacementLevel, boolean> {
	return {
		section: Boolean(
			decisions.section?.visibleTools.some((entry) => entry.toolId === toolId),
		),
		item: Boolean(
			decisions.item?.visibleTools.some((entry) => entry.toolId === toolId),
		),
		passage: Boolean(
			decisions.passage?.visibleTools.some((entry) => entry.toolId === toolId),
		),
	};
}

export function buildEditableToolRows(args: {
	coordinator: PolicyPanelCoordinator | null;
	pnpProfile: unknown;
	decisions: Partial<Record<ToolPlacementLevel, ToolPolicyDecision | null>>;
}): EditableToolRow[] {
	const tools = args.coordinator?.config?.toolRegistry?.getAllTools?.() ?? [];
	const placement = args.coordinator?.config?.tools?.placement ?? {};
	const providers = args.coordinator?.config?.tools?.providers ?? {};
	const supports = getPnpStringArray(args.pnpProfile, "supports");
	const prohibitedSupports = getPnpStringArray(
		args.pnpProfile,
		"prohibitedSupports",
	);

	return tools
		.map((tool) => {
			const supportedLevels = normalizeSupportedLevels(tool);
			const pnpSupportIds = [
				...new Set([...(tool.pnpSupportIds ?? []), tool.toolId]),
			];
			return {
				toolId: tool.toolId,
				name: tool.name || tool.toolId,
				description: tool.description || "",
				supportedLevels,
				pnpSupportIds,
				primaryPnpSupportId: pnpSupportIds[0] || tool.toolId,
				providerEnabled: providers[tool.toolId]?.enabled !== false,
				placement: buildPlacementState(placement, tool.toolId),
				visible: buildVisibleState(args.decisions, tool.toolId),
				pnpSupported: hasAnySupport(supports, pnpSupportIds),
				pnpProhibited: hasAnySupport(prohibitedSupports, pnpSupportIds),
			};
		})
		.filter((row) => row.supportedLevels.length > 0)
		.sort((left, right) => left.name.localeCompare(right.name));
}

export function deriveAllAvailablePlacement(
	rows: EditableToolRow[],
): Record<ToolPlacementLevel, string[]> {
	return {
		section: rows
			.filter((row) => row.supportedLevels.includes("section"))
			.map((row) => row.toolId),
		item: rows
			.filter((row) => row.supportedLevels.includes("item"))
			.map((row) => row.toolId),
		passage: rows
			.filter((row) => row.supportedLevels.includes("passage"))
			.map((row) => row.toolId),
	};
}

export function createPatchedPnpProfile(
	profile: unknown,
	key: "supports" | "prohibitedSupports",
	supportIds: string[],
	enabled: boolean,
): Record<string, unknown> {
	const base =
		profile && typeof profile === "object"
			? { ...(profile as Record<string, unknown>) }
			: {};
	const next = new Set(getPnpStringArray(base, key));
	for (const supportId of supportIds) {
		if (enabled) {
			next.add(supportId);
		} else {
			next.delete(supportId);
		}
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
	const { sectionData, roleType, floatingTools, defaultPnpProfile, coordinator } =
		inputs;

	const { profile, source, note } = resolvePnpProfile(
		sectionData,
		defaultPnpProfile,
	);

	const scopeId = sectionData?.id || sectionData?.identifier || "section";
	const decision = fetchPolicyDecision(coordinator, "section", scopeId);
	const itemDecision = fetchPolicyDecision(coordinator, "item", `${scopeId}:item`);
	const passageDecision = fetchPolicyDecision(
		coordinator,
		"passage",
		`${scopeId}:passage`,
	);
	const provenance = decision?.provenance ?? null;
	const resolvedToolIds =
		decision?.visibleTools.map((entry) => entry.toolId) ?? [];
	const decisions = {
		section: decision,
		item: itemDecision,
		passage: passageDecision,
	};
	const toolRows = buildEditableToolRows({
		coordinator,
		pnpProfile: profile,
		decisions,
	});

	const effectiveFloatingTools = resolveFloatingTools(coordinator, floatingTools);
	const hasCatalogResolver = Boolean(coordinator?.catalogResolver);
	const catalogStats = hasCatalogResolver
		? (coordinator?.catalogResolver?.getStatistics?.() ?? null)
		: null;
	const policyInputs = coordinator?.getPolicyInputs?.() as
		| { pnpEnforcement?: "on" | "off" }
		| undefined;

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
			selection: "auto",
		},
		determination: {
			source,
			checked: [
				"section.personalNeedsProfile",
				"section.settings.personalNeedsProfile",
			],
			note,
			runtimeContext: {
				role: roleType,
				floatingToolsEnabled: effectiveFloatingTools,
				hasCatalogResolver,
				catalogCount: catalogStats?.totalCatalogs ?? 0,
				assessmentCatalogCount: catalogStats?.assessmentCatalogs ?? 0,
				itemCatalogCount: catalogStats?.itemCatalogs ?? 0,
			},
		},
	};
}
