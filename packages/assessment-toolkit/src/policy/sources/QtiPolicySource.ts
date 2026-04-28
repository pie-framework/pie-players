/**
 * QTI Policy Source — refactor of `PnpToolResolver` for the M8 engine
 * (see `.cursor/plans/m8-design.md` § 3 step 5 and § 5 §).
 *
 * This source applies the QTI 6-level precedence rules used by today's
 * `PnpToolResolver` but exposes them as a `(candidates, qtiInputs) →
 * (refinedCandidates, perToolFlags, mandates, decisions)` function the
 * engine can call once per `decide(...)` request, with all results
 * routed through the unified `ToolPolicyProvenanceBuilder`.
 *
 * **Why this lives next to the legacy resolver instead of replacing
 * it.** PR 1 introduces the engine without callers; the legacy
 * `PnpToolResolver` is still in active use by `<pie-item-toolbar>`
 * and by external tests. PR 5 deletes the legacy class once the
 * toolbar (PR 3) and the QTI default flip (PR 4) have landed and the
 * caller list is empty. Until then this source is the *canonical*
 * implementation and the legacy class is the deprecated mirror.
 */

import type {
	AssessmentEntity,
	AssessmentItemRef,
	AssessmentSettings,
	ItemSettings,
	PersonalNeedsProfile,
} from "@pie-players/pie-players-shared/types";

import type { ToolRegistry } from "../../services/ToolRegistry.js";
import type {
	ToolPolicyResolutionDecision,
	ToolPolicySourceType,
} from "../core/provenance.js";
import type { QtiPolicySourceRule } from "../core/policy-source-tag.js";

/** Per-tool flags QTI may attach to a surviving entry. */
export interface QtiToolFlags {
	/** QTI mandates this tool (item or district `requiredTools`). */
	required: boolean;
	/** QTI marks this tool as a PNP support (host UI cannot toggle off). */
	alwaysAvailable: boolean;
	/** Tool-specific settings derived from item / assessment settings. */
	settings?: unknown;
	/** Which QTI rule contributed the surviving verdict. */
	rule: QtiPolicySourceRule;
	/** Source attribution for `ToolPolicyEntry.sources`. */
	sourceType: ToolPolicySourceType;
}

export interface QtiPolicyApplyArgs {
	assessment: AssessmentEntity;
	currentItemRef?: AssessmentItemRef;
}

/**
 * Provenance event the engine should append to its builder. Pre-baked
 * here so the source has a single allocation pattern and the engine
 * keeps a uniform `addDecision(...)` shape.
 */
export interface QtiPolicyDecisionEvent {
	precedence: 1 | 2 | 3 | 4 | 5 | 6;
	rule:
		| "district-block"
		| "test-admin-override"
		| "item-restriction"
		| "item-requirement"
		| "district-requirement"
		| "pnp-support"
		| "pnp-prohibited";
	featureId: string;
	action: ToolPolicyResolutionDecision["action"];
	sourceType: ToolPolicySourceType;
	reason: string;
	value?: unknown;
}

export interface QtiPolicyResult {
	/**
	 * Tool IDs QTI explicitly blocked. Engine removes these from the
	 * candidate set in step 5.
	 */
	blockedToolIds: Set<string>;
	/**
	 * Tool IDs QTI mandates (item or district `requiredTools`). Used
	 * by the engine to detect `tool-policy.qtiRequiredBlocked`
	 * diagnostics for tools removed by host policy.
	 */
	mandatedToolIds: Set<string>;
	/**
	 * Per-tool flags merged into surviving `ToolPolicyEntry`s.
	 */
	perToolFlags: Map<string, QtiToolFlags>;
	/**
	 * Decision log entries the engine must record. Order matches the
	 * order rules fired internally (highest precedence first per
	 * support id).
	 */
	decisions: QtiPolicyDecisionEvent[];
	/** Configuration sources the engine should attach to its provenance. */
	sources: {
		assessment?: { id: string; name: string; config?: unknown };
		student?: { id: string; name: string; config?: unknown };
		item?: { id: string; name: string; config?: unknown };
	};
}

/**
 * Internal context: every QTI input bundled together for the rule
 * evaluation loop.
 */
interface QtiResolutionContext {
	pnp?: PersonalNeedsProfile;
	districtPolicy?: AssessmentSettings["districtPolicy"];
	testAdmin?: AssessmentSettings["testAdministration"];
	itemSettings?: ItemSettings;
	toolConfigs?: AssessmentSettings["toolConfigs"];
}

export class QtiPolicySource {
	readonly id = "qti";
	private readonly toolRegistry: ToolRegistry;

	constructor(toolRegistry: ToolRegistry) {
		this.toolRegistry = toolRegistry;
	}

	apply(args: QtiPolicyApplyArgs): QtiPolicyResult {
		const { assessment, currentItemRef } = args;
		const pnp = assessment.personalNeedsProfile;
		const settings = assessment.settings as AssessmentSettings | undefined;
		const itemSettings = currentItemRef?.settings as ItemSettings | undefined;

		const result: QtiPolicyResult = {
			blockedToolIds: new Set(),
			mandatedToolIds: new Set(),
			perToolFlags: new Map(),
			decisions: [],
			sources: {},
		};

		if (settings?.districtPolicy || settings?.testAdministration) {
			result.sources.assessment = {
				id: assessment.id || "unknown",
				name: assessment.name || assessment.id || "Assessment",
				config: settings,
			};
		}
		if (pnp) {
			result.sources.student = {
				id: "student",
				name: "Student PNP Profile",
				config: pnp,
			};
		}
		if (currentItemRef && itemSettings) {
			result.sources.item = {
				id: currentItemRef.identifier,
				name: currentItemRef.identifier,
				config: itemSettings,
			};
		}

		const allSupports = new Set<string>();
		pnp?.supports?.forEach((s) => allSupports.add(s));
		settings?.districtPolicy?.blockedTools?.forEach((s) => allSupports.add(s));
		settings?.districtPolicy?.requiredTools?.forEach((s) => allSupports.add(s));
		itemSettings?.requiredTools?.forEach((s) => allSupports.add(s));
		itemSettings?.restrictedTools?.forEach((s) => allSupports.add(s));

		const ctx: QtiResolutionContext = {
			pnp,
			districtPolicy: settings?.districtPolicy,
			testAdmin: settings?.testAdministration,
			itemSettings,
			toolConfigs: settings?.toolConfigs,
		};

		for (const supportId of allSupports) {
			this.resolveSupport(supportId, ctx, result);
		}

		return result;
	}

	private resolveSupport(
		supportId: string,
		ctx: QtiResolutionContext,
		out: QtiPolicyResult,
	): void {
		// 1. District block (absolute veto)
		if (ctx.districtPolicy?.blockedTools?.includes(supportId)) {
			const toolId = this.mapSupportToToolId(supportId);
			out.blockedToolIds.add(toolId);
			out.decisions.push({
				precedence: 1,
				rule: "district-block",
				featureId: toolId,
				action: "block",
				sourceType: "assessment",
				reason: `District policy blocks "${supportId}" for all assessments`,
				value: ctx.districtPolicy.blockedTools,
			});
			return;
		}

		// 2. Test administration override
		if (ctx.testAdmin?.toolOverrides?.[supportId] === false) {
			const toolId = this.mapSupportToToolId(supportId);
			out.blockedToolIds.add(toolId);
			out.decisions.push({
				precedence: 2,
				rule: "test-admin-override",
				featureId: toolId,
				action: "block",
				sourceType: "assessment",
				reason: `Test administrator disabled "${supportId}" for this session`,
				value: ctx.testAdmin.toolOverrides,
			});
			return;
		}

		// 3. Item restriction (per-item block)
		if (ctx.itemSettings?.restrictedTools?.includes(supportId)) {
			const toolId = this.mapSupportToToolId(supportId);
			out.blockedToolIds.add(toolId);
			out.decisions.push({
				precedence: 3,
				rule: "item-restriction",
				featureId: toolId,
				action: "block",
				sourceType: "item",
				reason: `Item restricts "${supportId}" (e.g., mental math question blocks calculator)`,
				value: ctx.itemSettings.restrictedTools,
			});
			return;
		}

		// 4. Item requirement (forces enable)
		if (ctx.itemSettings?.requiredTools?.includes(supportId)) {
			const toolId = this.mapSupportToToolId(supportId);
			out.mandatedToolIds.add(toolId);
			out.perToolFlags.set(toolId, {
				required: true,
				alwaysAvailable: false,
				settings: this.resolveToolSettings(supportId, ctx),
				rule: "item-requirement",
				sourceType: "item",
			});
			out.decisions.push({
				precedence: 4,
				rule: "item-requirement",
				featureId: toolId,
				action: "enable",
				sourceType: "item",
				reason: `Item requires "${supportId}" for this question`,
				value: ctx.itemSettings.requiredTools,
			});
			return;
		}

		// 5. District requirement
		if (ctx.districtPolicy?.requiredTools?.includes(supportId)) {
			const toolId = this.mapSupportToToolId(supportId);
			out.mandatedToolIds.add(toolId);
			out.perToolFlags.set(toolId, {
				required: true,
				alwaysAvailable: false,
				settings: this.resolveToolSettings(supportId, ctx),
				rule: "district-requirement",
				sourceType: "assessment",
			});
			out.decisions.push({
				precedence: 5,
				rule: "district-requirement",
				featureId: toolId,
				action: "enable",
				sourceType: "assessment",
				reason: `District policy requires "${supportId}" for all assessments`,
				value: ctx.districtPolicy.requiredTools,
			});
			return;
		}

		// 6. PNP supports (student needs)
		if (ctx.pnp?.supports?.includes(supportId)) {
			const toolId = this.mapSupportToToolId(supportId);
			const isProhibited = ctx.pnp.prohibitedSupports?.includes(supportId);
			if (isProhibited) {
				out.blockedToolIds.add(toolId);
				out.decisions.push({
					precedence: 6,
					rule: "pnp-prohibited",
					featureId: toolId,
					action: "block",
					sourceType: "student",
					reason: `Student PNP profile prohibits "${supportId}"`,
					value: ctx.pnp.prohibitedSupports,
				});
				return;
			}
			out.perToolFlags.set(toolId, {
				required: false,
				alwaysAvailable: true,
				settings: this.resolveToolSettings(supportId, ctx),
				rule: "pnp-support",
				sourceType: "student",
			});
			out.decisions.push({
				precedence: 6,
				rule: "pnp-support",
				featureId: toolId,
				action: "enable",
				sourceType: "student",
				reason: `Student PNP profile requests "${supportId}"`,
				value: ctx.pnp.supports,
			});
			return;
		}

		// 6 (skip): support-id mentioned somewhere but no rule fired.
		// Use the mapped tool id as `featureId` so the trail is keyed
		// the same way as every other branch — PR 5's debugger surfaces
		// index provenance trails by tool id and would otherwise show
		// orphaned support-id entries here (M8 PR 1 R3 S1).
		const toolId = this.mapSupportToToolId(supportId);
		out.decisions.push({
			precedence: 6,
			rule: "pnp-support",
			featureId: toolId,
			action: "skip",
			sourceType: "system",
			reason: `Feature "${supportId}" not configured at any level`,
			value: { supportId },
		});
	}

	/**
	 * Map a QTI / PNP support id (e.g. `"calculator-basic"`) to the
	 * registered tool id that owns it.
	 *
	 * Resolution rules:
	 *
	 *   1. **Multiple tools register the same support id:** the
	 *      *first-registered* tool wins. `ToolRegistry.getToolsByPNPSupport`
	 *      returns a `Set<string>` whose iteration order matches the
	 *      `register(...)` insertion order, so the result is
	 *      deterministic across runs but order-sensitive at registration
	 *      time. This is an unusual configuration — the typical case is
	 *      one tool per support id — but it is reachable when an
	 *      integrator overrides a default tool with a replacement that
	 *      claims the same `pnpSupportIds`. In that case the integrator
	 *      should `unregister(...)` the default before registering the
	 *      replacement.
	 *
	 *   2. **No tool registers the support id:** the support id is
	 *      returned verbatim as the `featureId` for provenance trails
	 *      and `ToolPolicyEntry.toolId`. This lets hosts use raw QTI
	 *      strings for tools the registry does not (yet) carry without
	 *      losing them in policy evaluation.
	 *
	 * The legacy `PnpToolResolver.resolveTool` had the same behavior;
	 * see `tests/policy/QtiPolicySource.test.ts` for the regression
	 * lock.
	 */
	private mapSupportToToolId(supportId: string): string {
		const toolIds = this.toolRegistry.getToolsByPNPSupport(supportId);
		if (toolIds.size === 0) return supportId;
		return Array.from(toolIds)[0];
	}

	/**
	 * Resolve tool-specific settings, item-level taking precedence over
	 * assessment-level.
	 *
	 * Uses `??` (nullish-coalescing) rather than the legacy resolver's
	 * `||`. Tool config values are typed `unknown` and may legitimately
	 * be `false` / `0` / `""` (e.g. a tool whose canonical "off" config
	 * is the literal `false`). `||` would treat those as missing and
	 * silently fall through to the assessment-level config, masking the
	 * authored item-level intent. `??` only falls through on
	 * `null`/`undefined`, which matches the semantic of "value not
	 * provided." This is a deliberate behavior delta from the legacy
	 * `PnpToolResolver` (M8 PR 1).
	 */
	private resolveToolSettings(
		supportId: string,
		ctx: QtiResolutionContext,
	): unknown {
		return (
			ctx.itemSettings?.toolParameters?.[supportId] ??
			ctx.toolConfigs?.[supportId]
		);
	}
}
