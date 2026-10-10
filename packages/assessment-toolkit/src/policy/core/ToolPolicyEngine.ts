/**
 * Tool Policy Engine — facade class. See
 * `docs/tools-and-accomodations/architecture.md`.
 *
 * Wraps `composeDecision(...)` with engine-instance state:
 *   - bound inputs (`tools`, `assessment`, `pnpEnforcement`) and the
 *     settings of the mounted items
 *   - registered custom `PolicySource`s
 *   - `onPolicyChange` subscriber bus
 *   - `dispose()` clean-up
 *
 * The class has no DOM dependency and no Svelte runes. It is safe to
 * instantiate inside a worker, in a Node test, or inside a CE
 * connectedCallback. `ToolkitCoordinator` owns the instance, and
 * `<pie-item-toolbar>` reads its decisions through the coordinator.
 */

import type {
	AssessmentEntity,
	ItemSettings,
	ToolParametersFor,
} from "@pie-players/pie-players-shared/types";

import type {
	CanonicalToolsConfig,
	PnpEnforcementMode,
	ToolPlacementLevel,
} from "../../services/tools-config-normalizer.js";
import {
	normalizeToolList,
	normalizeToolsConfig,
} from "../../services/tools-config-normalizer.js";
import type { ToolRegistry } from "../../services/ToolRegistry.js";

import type {
	ToolPolicyDecision,
	ToolPolicyDecisionRequest,
	ToolPolicyDiagnostic,
	ToolScope,
} from "./decision-types.js";
import type { PolicySource } from "./PolicySource.js";
import type { FeaturePolicyDecision } from "./feature-decision.js";
import {
	hostFeatureDenial,
	interpretFeatureResult,
} from "./feature-decision.js";
import {
	composeDecision,
	unknownSupportIdDiagnostic,
} from "./compose-decision.js";
import { resolveDefaultPnpEnforcement } from "./pnp-policy-inputs.js";
import { resolveToolParameters } from "./tool-parameters.js";
import { structurallyEqual } from "../../utils/structural-equality.js";
import {
	type PnpPolicyItem,
	PnpPolicySource,
} from "../sources/PnpPolicySource.js";

export type { PnpEnforcementMode };

export interface ToolPolicyEngineInputs {
	tools?: CanonicalToolsConfig | null;
	assessment?: AssessmentEntity | null;
	/**
	 * Explicit PNP/profile override; `null` or omitted is auto-mode. Auto-mode
	 * resolves per decision through {@link resolveDefaultPnpEnforcement}: `"on"`
	 * when the bound `assessment` carries PNP/profile policy material (PNP,
	 * district policy, test administration), and for a decision scoped to an item
	 * also when that item's settings require or restrict a tool;
	 * `"off"` otherwise. `tests/policy/pnp-default-on.test.ts` locks the rule.
	 *
	 * Hosts that want to force a mode pass `"on"` or `"off"`
	 * explicitly. Embedded under `<pie-section-player-*>` the preferred
	 * override flows through `runtime.tools.pnpEnforcement`.
	 */
	pnpEnforcement?: PnpEnforcementMode | null;
}

export interface ToolPolicyEngineArgs {
	toolRegistry: ToolRegistry;
	inputs?: ToolPolicyEngineInputs;
	customSources?: readonly PolicySource[];
	/** Stable context label used in provenance trails. Defaults to "tool-policy". */
	contextId?: string;
	/**
	 * Whether the host may leave the assessment unbound without that being a
	 * misconfiguration; see {@link ResolvedEngineInputs.assessmentExpected}.
	 * Defaults to `false`.
	 */
	assessmentOptional?: boolean;
}

export interface ToolPolicyChangeEvent {
	/**
	 * What changed in this update. `"item-settings"` is a mounted item's
	 * settings changing: it can change which tools that item's own toolbar
	 * shows, and nothing else a toolbar renders.
	 */
	reason:
		| "inputs"
		| "item-settings"
		| "policy-source-added"
		| "policy-source-removed"
		| "pnp-enforcement"
		| "disposed";
	/** Snapshot of the engine's inputs after the change. */
	inputs: Readonly<ResolvedEngineInputs>;
}

export interface ResolvedEngineInputs {
	tools: CanonicalToolsConfig;
	assessment: AssessmentEntity | null;
	/**
	 * The mode a decision not scoped to an item applies. In auto-mode an
	 * item-scoped decision also turns on for its item's settings.
	 */
	pnpEnforcement: PnpEnforcementMode;
	/** The host's override of auto-mode, or `null` in auto-mode. */
	pnpEnforcementOverride: PnpEnforcementMode | null;
	/**
	 * Whether an unbound assessment is a misconfiguration: always, unless the
	 * engine was built `assessmentOptional`, and then only while enforcement is
	 * overridden `"on"`.
	 */
	assessmentExpected: boolean;
	/**
	 * Conflicts in the inputs themselves, independent of any decision: a
	 * `tool-policy.unknownSupportId` for each id the assessment or a mounted
	 * item's settings name that no registered tool carries. Recomputed when the
	 * assessment, an item's settings or the registry's tools change.
	 */
	diagnostics: readonly ToolPolicyDiagnostic[];
}

export type ToolPolicyChangeListener = (event: ToolPolicyChangeEvent) => void;

const DEFAULT_TOOLS: CanonicalToolsConfig = normalizeToolsConfig({
	policy: { allowed: [], blocked: [] },
	placement: { section: [], item: [], passage: [] },
	providers: {},
});

export class ToolPolicyEngine {
	private toolRegistry: ToolRegistry;
	private unsubscribeRegistry: () => void;
	private readonly contextId: string;
	private readonly assessmentOptional: boolean;
	private pnpPolicySource: PnpPolicySource;
	private readonly customSources: PolicySource[];
	private readonly listeners = new Set<ToolPolicyChangeListener>();

	private tools: CanonicalToolsConfig;
	private assessment: AssessmentEntity | null;
	private pnpEnforcementOverride: PnpEnforcementMode | null;
	/**
	 * Mounted items' settings by canonical item id, newest registration last;
	 * see {@link registerItemSettings}.
	 */
	private readonly itemSettings = new Map<
		string,
		Array<{ settings: ItemSettings }>
	>();
	private inputDiagnostics: readonly ToolPolicyDiagnostic[] = Object.freeze([]);
	private disposed = false;

	constructor(args: ToolPolicyEngineArgs) {
		this.toolRegistry = args.toolRegistry;
		this.contextId = args.contextId ?? "tool-policy";
		this.assessmentOptional = args.assessmentOptional === true;
		this.pnpPolicySource = new PnpPolicySource(this.toolRegistry);
		this.customSources = args.customSources ? [...args.customSources] : [];

		const inputs = args.inputs ?? {};
		this.tools = inputs.tools ?? DEFAULT_TOOLS;
		this.assessment = inputs.assessment ?? null;
		this.pnpEnforcementOverride = inputs.pnpEnforcement ?? null;
		this.refreshInputDiagnostics();
		this.unsubscribeRegistry = this.watchRegistry();
	}

	/**
	 * Resolve the visible tool set for a given placement level and
	 * scope.
	 *
	 * `visibleTools` and `diagnostics` are deterministic with respect
	 * to the engine's currently-bound inputs — calling `decide(...)`
	 * twice with identical inputs returns structurally equal
	 * `visibleTools` and `diagnostics`. The returned `provenance`
	 * carries call-time `evaluatedAt` timestamps generated by
	 * `ToolPolicyProvenanceBuilder` (one per `decide(...)`); two
	 * back-to-back calls therefore produce different `evaluatedAt`
	 * values even though the policy decision itself is identical.
	 * Hosts that want timestamp-stable provenance should reuse a
	 * cached `ToolPolicyDecision` rather than re-call `decide(...)`.
	 *
	 * An item's registered settings apply to the item's own toolbar: a request
	 * at item level whose scope is the item. Every other request — a section,
	 * assessment or passage toolbar — is shared by the items it sits beside, so
	 * it leaves every item's settings out and reports each tool on its toolbar
	 * that one restricts or requires as `tool-policy.itemSettingNotApplied`.
	 */
	decide(request: ToolPolicyDecisionRequest): ToolPolicyDecision {
		this.assertNotDisposed();
		const requestContextId = request.scope.scopeId
			? `${this.contextId}:${request.level}:${request.scope.scopeId}`
			: `${this.contextId}:${request.level}`;
		const item =
			request.level === "item" ? this.itemForScope(request.scope) : undefined;
		const shared =
			request.level !== "item" ||
			request.scope.level === "section" ||
			request.scope.level === "assessment";
		return composeDecision({
			request,
			tools: this.tools,
			pnpPolicy: {
				source: this.pnpPolicySource,
				assessment: this.assessment ?? undefined,
				item,
				enforcement: this.enforcementFor(item),
			},
			unappliedItems: shared ? this.enforcedItems() : undefined,
			customSources: this.customSources,
			contextId: requestContextId,
		});
	}

	/**
	 * Whether some surface is granted `featureId`: a decision with no item scope,
	 * or one scoped to a registered item. A provider serves every surface, so its
	 * failure denies the accommodation wherever one surface is granted it.
	 *
	 * `enforced` counts only scopes whose `pnpEnforcement` is on, as a toolbar
	 * tool's decisions do; a feature with no placement leaves it unset.
	 */
	grantsFeatureAnywhere(
		featureId: string,
		options: { enforced?: boolean } = {},
	): boolean {
		const counts = (item?: PnpPolicyItem) =>
			!options.enforced || this.enforcementFor(item) === "on";
		if (counts() && this.decideFeature(featureId).granted) return true;
		for (const id of this.itemSettings.keys()) {
			const settings = this.itemSettingsFor(id);
			if (!counts(settings ? { id, settings } : undefined)) continue;
			if (this.decideFeature(featureId, { level: "item", scopeId: id }).granted) {
				return true;
			}
		}
		return false;
	}

	/**
	 * File a mounted item's settings under its canonical id. They govern the
	 * decisions scoped to that item: its own toolbar, and a feature its content
	 * asks about with the item's scope. See {@link decide}.
	 *
	 * The same item mounted twice registers twice; the newest registration
	 * applies, and its cleanup hands the item back to the one before. Emits an
	 * `"item-settings"` change whenever the settings that apply to the item
	 * change.
	 */
	registerItemSettings(itemId: string, settings: ItemSettings): () => void {
		this.assertNotDisposed();
		const entry = { settings };
		const before = this.itemSettingsFor(itemId);
		const entries = this.itemSettings.get(itemId) ?? [];
		entries.push(entry);
		this.itemSettings.set(itemId, entries);
		this.emitIfItemSettingsChanged(itemId, before);
		return () => {
			if (this.disposed) return;
			const current = this.itemSettings.get(itemId);
			const index = current?.indexOf(entry) ?? -1;
			if (!current || index < 0) return;
			const previous = this.itemSettingsFor(itemId);
			current.splice(index, 1);
			if (current.length === 0) this.itemSettings.delete(itemId);
			this.emitIfItemSettingsChanged(itemId, previous);
		};
	}

	/**
	 * Resolve eligibility for one PNP/AfA feature id through the eight-level
	 * precedence, independent of toolbar placement.
	 *
	 * For capabilities that render as their own surface rather than a toolbar
	 * button — a signed alternate's region, for example — `decide(...)` cannot
	 * answer the question, because such a capability is deliberately absent from
	 * `tools.placement` and would read as "removed by policy" when nothing of
	 * the sort happened. See {@link FeaturePolicyDecision}.
	 *
	 * `pnpEnforcement` is deliberately **not** consulted here. That flag governs
	 * whether PNP/profile policy *refines* an otherwise-visible tool set; a
	 * feature with no placement has no unrefined baseline to fall back to, so
	 * skipping the PNP read would make the capability permanently unavailable
	 * rather than merely unrefined. Auto-mode already flips enforcement on
	 * whenever profile material exists, so this only diverges for a host that
	 * explicitly forces `"off"` while supplying a profile that grants the
	 * feature — and there, honouring the profile is the safer failure.
	 *
	 * The decision reports whether an assessment was bound, which is the engine's
	 * to answer rather than the policy source's — see
	 * {@link FeaturePolicyDecision.assessmentBound}.
	 *
	 * `scope` is the surface asking. An item's scope brings in the item's
	 * registered settings, as {@link decide} does for the item's toolbar.
	 */
	decideFeature<K extends string>(
		featureId: K,
		scope?: ToolScope,
	): FeaturePolicyDecision<ToolParametersFor<K>> {
		this.assertNotDisposed();
		const hostDenial = this.hostFeatureGate(featureId);
		if (hostDenial) return hostDenial;
		const item = this.itemForScope(scope);
		return interpretFeatureResult(
			featureId,
			this.pnpPolicySource.resolveFeature(featureId, {
				assessment: this.assessment ?? undefined,
				item,
			}),
			// `resolveFeature` takes the assessment as `undefined` either way, so the
			// source cannot tell an unbound host from one whose profile is silent.
			// The engine can.
			{ assessmentBound: this.assessment !== null },
			resolveToolParameters(featureId, this.assessment, item),
		);
	}

	/**
	 * The host gates that hold for a feature id, or `null` when none fires.
	 *
	 * `policy.allowed` / `policy.blocked` name capabilities, not placements, so
	 * they are the one part of the host pipeline that is meaningful without a
	 * placement level — and the only lever a host has over a capability that
	 * renders as its own surface, since a `region` capability is rejected from
	 * `tools.placement` by configuration validation. `provider-disabled` and
	 * `placement-membership` are deliberately not applied: both are statements
	 * about a toolbar the feature was never on.
	 */
	private hostFeatureGate(
		featureId: string,
	): FeaturePolicyDecision<never> | null {
		const context = { assessmentBound: this.assessment !== null };
		const blocked = normalizeToolList(this.tools.policy.blocked);
		if (blocked.includes(featureId)) {
			return hostFeatureDenial(featureId, "host-blocked", blocked, context);
		}
		const allowed = normalizeToolList(this.tools.policy.allowed);
		if (allowed.length > 0 && !allowed.includes(featureId)) {
			return hostFeatureDenial(featureId, "host-allowlist", allowed, context);
		}
		return null;
	}

	/**
	 * Convenience wrapper for hosts that just want the visible tool
	 * IDs. Equivalent to `decide(...).visibleTools.map(e => e.toolId)`.
	 */
	getVisibleToolIds(level: ToolPlacementLevel, scopeId: string): string[] {
		return this.decide({
			level,
			scope: { level, scopeId },
		}).visibleTools.map((entry) => entry.toolId);
	}

	/**
	 * Apply a partial input update.
	 *
	 * A key that did not change does not fire `onPolicyChange` listeners.
	 * `tools` is diffed with `Object.is`. `assessment` is diffed structurally,
	 * because hosts rebuild it from their own state on every render; the latest
	 * reference is stored either way.
	 *
	 * `pnpEnforcement` sets the override, `null` or `undefined` returning to
	 * auto-mode, and emits with a distinct `"pnp-enforcement"` reason when no
	 * other key changed.
	 */
	updateInputs(patch: Partial<ToolPolicyEngineInputs>): void {
		this.assertNotDisposed();
		let changed = false;
		let pnpChanged = false;
		if ("tools" in patch) {
			const next = patch.tools ?? DEFAULT_TOOLS;
			if (!Object.is(this.tools, next)) {
				this.tools = next;
				changed = true;
			}
		}
		if ("assessment" in patch) {
			const next = patch.assessment ?? null;
			const assessmentChanged = !structurallyEqual(this.assessment, next);
			this.assessment = next;
			if (assessmentChanged) {
				changed = true;
				this.refreshInputDiagnostics();
			}
		}
		if ("pnpEnforcement" in patch) {
			const next = patch.pnpEnforcement ?? null;
			if (this.pnpEnforcementOverride !== next) {
				this.pnpEnforcementOverride = next;
				pnpChanged = true;
			}
		}
		if (changed || pnpChanged) {
			this.emit({
				reason: pnpChanged && !changed ? "pnp-enforcement" : "inputs",
				inputs: this.snapshotInputs(),
			});
		}
	}

	/**
	 * Swap the registry PNP support ids resolve against, together with the tools
	 * config validated against it, and emit an `"inputs"` change. For a
	 * coordinator adopting its toolkit's registry.
	 */
	replaceToolRegistry(
		toolRegistry: ToolRegistry,
		tools: CanonicalToolsConfig,
	): void {
		this.assertNotDisposed();
		this.unsubscribeRegistry();
		this.toolRegistry = toolRegistry;
		this.pnpPolicySource = new PnpPolicySource(toolRegistry);
		this.unsubscribeRegistry = this.watchRegistry();
		this.tools = tools;
		this.refreshInputDiagnostics();
		this.emit({ reason: "inputs", inputs: this.snapshotInputs() });
	}

	registerPolicySource(source: PolicySource): () => void {
		this.assertNotDisposed();
		this.customSources.push(source);
		this.emit({
			reason: "policy-source-added",
			inputs: this.snapshotInputs(),
		});
		return () => {
			const idx = this.customSources.indexOf(source);
			if (idx !== -1) {
				this.customSources.splice(idx, 1);
				if (!this.disposed) {
					this.emit({
						reason: "policy-source-removed",
						inputs: this.snapshotInputs(),
					});
				}
			}
		};
	}

	onPolicyChange(listener: ToolPolicyChangeListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	getInputs(): Readonly<ResolvedEngineInputs> {
		return this.snapshotInputs();
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.unsubscribeRegistry();
		this.emit({
			reason: "disposed",
			inputs: this.snapshotInputs(),
		});
		this.listeners.clear();
		this.itemSettings.clear();
		this.customSources.length = 0;
	}

	private snapshotInputs(): Readonly<ResolvedEngineInputs> {
		return Object.freeze({
			tools: this.tools,
			assessment: this.assessment,
			pnpEnforcement: this.enforcementFor(),
			pnpEnforcementOverride: this.pnpEnforcementOverride,
			assessmentExpected:
				!this.assessmentOptional || this.pnpEnforcementOverride === "on",
			diagnostics: this.inputDiagnostics,
		});
	}

	/** The override, else auto-mode over the assessment and `item`'s settings. */
	private enforcementFor(item?: PnpPolicyItem): PnpEnforcementMode {
		return (
			this.pnpEnforcementOverride ??
			resolveDefaultPnpEnforcement({
				assessment: this.assessment,
				itemSettings: item?.settings,
			})
		);
	}

	/** The settings that apply to `itemId`: its newest registration's. */
	private itemSettingsFor(itemId: string): ItemSettings | undefined {
		return this.itemSettings.get(itemId)?.at(-1)?.settings;
	}

	private emitIfItemSettingsChanged(
		itemId: string,
		before: ItemSettings | undefined,
	): void {
		if (structurallyEqual(before, this.itemSettingsFor(itemId))) return;
		this.refreshInputDiagnostics();
		this.emit({ reason: "item-settings", inputs: this.snapshotInputs() });
	}

	/**
	 * Recompute {@link ResolvedEngineInputs.diagnostics} from the bound
	 * assessment, every mounted item's settings and the registry. Returns
	 * whether they changed.
	 */
	private refreshInputDiagnostics(): boolean {
		const items: ItemSettings[] = [];
		for (const id of this.itemSettings.keys()) {
			const settings = this.itemSettingsFor(id);
			if (settings) items.push(settings);
		}
		const next = Array.from(
			this.pnpPolicySource.unknownSupportIds(this.assessment, items),
			([supportId, origins]) => unknownSupportIdDiagnostic(supportId, origins),
		);
		if (structurallyEqual(this.inputDiagnostics, next)) return false;
		this.inputDiagnostics = Object.freeze(next);
		return true;
	}

	/**
	 * Registering a tool into the bound registry, or removing one, can make a
	 * named id known or unknown, so it emits an `"inputs"` change when the input
	 * diagnostics move.
	 */
	private watchRegistry(): () => void {
		return this.toolRegistry.onRegistryChange(() => {
			if (this.disposed) return;
			if (this.refreshInputDiagnostics()) {
				this.emit({ reason: "inputs", inputs: this.snapshotInputs() });
			}
		});
	}

	/**
	 * The registered item an item scope names, by its canonical id. A scope
	 * of any other level names none.
	 */
	private itemForScope(scope: ToolScope | undefined): PnpPolicyItem | undefined {
		if (scope?.level !== "item") return undefined;
		const id = scope.canonicalItemId || scope.itemId || scope.scopeId;
		const settings = id ? this.itemSettingsFor(id) : undefined;
		return settings ? { id, settings } : undefined;
	}

	/** The registered items whose settings their own toolbar enforces. */
	private enforcedItems(): PnpPolicyItem[] {
		const items: PnpPolicyItem[] = [];
		for (const id of this.itemSettings.keys()) {
			const settings = this.itemSettingsFor(id);
			if (!settings) continue;
			const item = { id, settings };
			if (this.enforcementFor(item) === "on") items.push(item);
		}
		return items;
	}

	private emit(event: ToolPolicyChangeEvent): void {
		for (const listener of Array.from(this.listeners)) {
			try {
				listener(event);
			} catch {
				// Subscriber errors must not break the engine. Hosts that
				// want error telemetry should wrap their listener.
			}
		}
	}

	private assertNotDisposed(): void {
		if (this.disposed) {
			throw new Error("ToolPolicyEngine has been disposed.");
		}
	}
}
