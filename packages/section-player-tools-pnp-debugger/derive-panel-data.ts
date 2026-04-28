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
 * host policy, provider veto, QTI gates, custom sources) is folded
 * into the same `ToolPolicyProvenance` and the panel surfaces all of
 * it. Naming inside this helper deliberately uses "policy" /
 * "decision" / "feature trail" rather than "PNP" to reflect that.
 */

import type {
	ToolPolicyDecision,
	ToolPolicyFeatureTrail,
	ToolPolicyProvenance,
} from "@pie-players/pie-assessment-toolkit/policy/engine";

/**
 * Minimal subset of the toolkit-coordinator surface that the panel
 * actually consumes. Defined inline (rather than imported as
 * `ToolkitCoordinatorApi`) so the helper stays usable in tests with
 * a hand-rolled stub.
 */
export interface PolicyPanelCoordinator {
	decideToolPolicy?: (request: {
		level: "section" | "item" | "passage";
		scope: { level: "section" | "item" | "passage"; scopeId: string };
	}) => ToolPolicyDecision;
	getFloatingTools?: () => string[];
	config?: {
		tools?: {
			placement?: { section?: string[] };
		};
	};
	catalogResolver?: {
		getStatistics?: () => {
			totalCatalogs?: number;
			assessmentCatalogs?: number;
			itemCatalogs?: number;
		};
	};
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
	if (!coordinator || typeof coordinator.decideToolPolicy !== "function") {
		return null;
	}
	try {
		return coordinator.decideToolPolicy({
			level: "section",
			scope: { level: "section", scopeId },
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
	if (liveFloatingTools.length > 0) return liveFloatingTools;
	const fromGetter = coordinator?.getFloatingTools?.();
	if (Array.isArray(fromGetter) && fromGetter.length > 0) return fromGetter;
	const fromConfig = coordinator?.config?.tools?.placement?.section;
	if (Array.isArray(fromConfig)) return fromConfig;
	return [];
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
	const decision = fetchSectionPolicyDecision(coordinator, scopeId);
	const provenance = decision?.provenance ?? null;
	const resolvedToolIds =
		decision?.visibleTools.map((entry) => entry.toolId) ?? [];

	const effectiveFloatingTools = resolveFloatingTools(coordinator, floatingTools);
	const hasCatalogResolver = Boolean(coordinator?.catalogResolver);
	const catalogStats = hasCatalogResolver
		? (coordinator?.catalogResolver?.getStatistics?.() ?? null)
		: null;

	return {
		pnpProfile: profile,
		resolvedTools: resolvedToolIds,
		provenance: {
			summary: provenance?.summary ?? null,
			featureCount: provenance?.features?.size ?? 0,
			sourceCount: Object.keys(provenance?.sources ?? {}).length,
		},
		featureTrails: flattenFeatureTrails(provenance),
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
