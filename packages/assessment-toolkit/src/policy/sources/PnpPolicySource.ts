/**
 * PNP Policy Source: step 5 of `composeDecision` (see
 * `docs/tools-and-accomodations/architecture.md`).
 *
 * This source applies the PNP/profile precedence rules as a `(candidates, pnpPolicyInputs) →
 * (refinedCandidates, perToolFlags, mandates, decisions)` function the
 * engine can call once per `decide(...)` request, with all results
 * routed through the unified `ToolPolicyProvenanceBuilder`.
 */

import type {
	AssessmentEntity,
	AssessmentSettings,
	ItemSettings,
	PersonalNeedsProfile,
} from "@pie-players/pie-players-shared/types";

import type { ToolRegistry } from "../../services/ToolRegistry.js";
import type {
	PnpPolicySourceRule,
	ToolPolicyResolutionDecision,
	ToolPolicySourceType,
} from "../core/provenance.js";
import type { OverrideBlockedDetails } from "../core/decision-types.js";

/** Per-tool flags PNP/profile policy may attach to a surviving entry. */
export interface PnpPolicyToolFlags {
	/** PNP/profile policy mandates this tool (item or district `requiredTools`). */
	required: boolean;
	/**
	 * The student's profile supports this tool, or a test-administration
	 * override grants it (host UI cannot toggle off).
	 */
	alwaysAvailable: boolean;
	/** Tool-specific settings derived from item / assessment settings. */
	settings?: unknown;
	/** Which PNP/profile rule contributed the surviving verdict. */
	rule: PnpPolicySourceRule;
}

/** An item a decision is scoped to, by its canonical id, with its settings. */
export interface PnpPolicyItem {
	id: string;
	settings: ItemSettings;
}

export interface PnpPolicyApplyArgs {
	assessment?: AssessmentEntity | null;
	/**
	 * The item the decision is scoped to. Only a decision for the item's own
	 * toolbar or content carries one: an item's settings do not reach a section-
	 * or assessment-level decision.
	 */
	item?: PnpPolicyItem;
}

/**
 * Provenance event the engine should append to its builder. Pre-baked
 * here so the source has a single allocation pattern and the engine
 * keeps a uniform `addDecision(...)` shape.
 */
export interface PnpPolicyDecisionEvent {
	precedence: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
	rule: PnpPolicySourceRule;
	featureId: string;
	action: ToolPolicyResolutionDecision["action"];
	sourceType: ToolPolicySourceType;
	reason: string;
	value?: unknown;
}

export interface PnpPolicyResult {
	/**
	 * Tool IDs PNP/profile policy explicitly blocked. Engine removes these from the
	 * candidate set in step 5.
	 */
	blockedToolIds: Set<string>;
	/**
	 * Tool IDs PNP/profile policy mandates (item or district `requiredTools`). Used
	 * by the engine to detect `tool-policy.requiredToolBlocked`
	 * diagnostics for tools removed by host policy.
	 */
	mandatedToolIds: Set<string>;
	/**
	 * Per-tool flags merged into surviving `ToolPolicyEntry`s.
	 */
	perToolFlags: Map<string, PnpPolicyToolFlags>;
	/**
	 * Decision log entries the engine must record. Order matches the
	 * order rules fired internally (highest precedence first per
	 * support id).
	 */
	decisions: PnpPolicyDecisionEvent[];
	/**
	 * Ids named by a profile, district policy, test administration or item that
	 * no tool is registered under, each with the rules whose lists name it, in
	 * precedence order. Nothing resolves them; the engine turns each into a
	 * `tool-policy.unknownSupportId` diagnostic. Empty when the registry is: an
	 * empty registry has nothing to check an id against, and
	 * `tool-config-validation` already reports it once.
	 */
	unmappedSupportIds: Map<string, PnpPolicySourceRule[]>;
	/**
	 * Ids a `true` test-administration override names that an item restriction
	 * or a PNP prohibition withdrew instead, each with the rule that did. The
	 * engine turns each into a `tool-policy.overrideBlocked` diagnostic.
	 */
	blockedOverrides: Map<string, OverrideBlockedDetails["rule"]>;
	/** Configuration sources the engine should attach to its provenance. */
	sources: {
		assessment?: { id: string; name: string; config?: unknown };
		student?: { id: string; name: string; config?: unknown };
		item?: { id: string; name: string; config?: unknown };
	};
}

/**
 * Internal context: every PNP/profile policy input bundled together for the rule
 * evaluation loop.
 */
interface PnpResolutionContext {
	pnp?: PersonalNeedsProfile;
	districtPolicy?: AssessmentSettings["districtPolicy"];
	testAdmin?: AssessmentSettings["testAdministration"];
	itemSettings?: ItemSettings;
	toolConfigs?: AssessmentSettings["toolConfigs"];
}

export class PnpPolicySource {
	readonly id = "pnp";
	private readonly toolRegistry: ToolRegistry;

	constructor(toolRegistry: ToolRegistry) {
		this.toolRegistry = toolRegistry;
	}

	apply(args: PnpPolicyApplyArgs): PnpPolicyResult {
		const { ctx, result } = this.prepare(args);
		const { pnp, districtPolicy, testAdmin, itemSettings } = ctx;

		const allSupports = new Set<string>();
		pnp?.supports?.forEach((s) => allSupports.add(s));
		pnp?.prohibitedSupports?.forEach((s) => allSupports.add(s));
		districtPolicy?.blockedTools?.forEach((s) => allSupports.add(s));
		districtPolicy?.requiredTools?.forEach((s) => allSupports.add(s));
		for (const s of Object.keys(testAdmin?.toolOverrides ?? {})) {
			allSupports.add(s);
		}
		itemSettings?.requiredTools?.forEach((s) => allSupports.add(s));
		itemSettings?.restrictedTools?.forEach((s) => allSupports.add(s));

		for (const supportId of allSupports) {
			this.resolveSupport(supportId, ctx, result);
		}

		return result;
	}

	/**
	 * Evaluate exactly one PNP support id through the same eight-level
	 * precedence `apply(...)` uses.
	 *
	 * This exists for **policy-addressable capabilities that are not toolbar
	 * tools** — a signed alternate rendered as its own region, for example.
	 * `apply(...)` only evaluates support ids that appear somewhere in the
	 * bound policy inputs. Evaluating one id in isolation answers for any
	 * feature: the returned result carries exactly one decision, and
	 * `decisions[0].action` is the verdict.
	 *
	 * Reusing `resolveSupport(...)` rather than re-walking the precedence rules
	 * is the point — a second copy of the eight levels would drift.
	 */
	resolveFeature(featureId: string, args: PnpPolicyApplyArgs): PnpPolicyResult {
		const { ctx, result } = this.prepare(args);
		this.resolveSupport(featureId, ctx, result);
		return result;
	}

	/**
	 * Build the rule-evaluation context and the empty result (with its
	 * configuration-source attribution) from the bound policy inputs.
	 */
	private prepare(args: PnpPolicyApplyArgs): {
		ctx: PnpResolutionContext;
		result: PnpPolicyResult;
	} {
		const { assessment, item } = args;
		const pnp = assessment?.personalNeedsProfile;
		const settings = assessment?.settings as AssessmentSettings | undefined;
		const itemSettings = item?.settings;

		const result: PnpPolicyResult = {
			blockedToolIds: new Set(),
			mandatedToolIds: new Set(),
			perToolFlags: new Map(),
			decisions: [],
			unmappedSupportIds: this.unmappedIds(
				pnp,
				settings,
				itemSettings,
			),
			blockedOverrides: new Map(),
			sources: {},
		};

		if (settings?.districtPolicy || settings?.testAdministration) {
			result.sources.assessment = {
				id: assessment?.id || "unknown",
				name: assessment?.name || assessment?.id || "Assessment",
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
		if (item) {
			result.sources.item = {
				id: item.id,
				name: item.id,
				config: item.settings,
			};
		}

		const ctx: PnpResolutionContext = {
			pnp,
			districtPolicy: settings?.districtPolicy,
			testAdmin: settings?.testAdministration,
			itemSettings,
			toolConfigs: settings?.toolConfigs,
		};

		return { ctx, result };
	}

	private resolveSupport(
		supportId: string,
		ctx: PnpResolutionContext,
		out: PnpPolicyResult,
	): void {
		// 1. District block (absolute veto)
		if (ctx.districtPolicy?.blockedTools?.includes(supportId)) {
			out.blockedToolIds.add(supportId);
			out.decisions.push({
				precedence: 1,
				rule: "district-block",
				featureId: supportId,
				action: "block",
				sourceType: "assessment",
				reason: `District policy blocks "${supportId}" for all assessments`,
				value: ctx.districtPolicy.blockedTools,
			});
			return;
		}

		// 2. Test administration override `false`: withdraws the support for the
		// session, outranking every level below.
		const override = ctx.testAdmin?.toolOverrides?.[supportId];
		if (override === false) {
			out.blockedToolIds.add(supportId);
			out.decisions.push({
				precedence: 2,
				rule: "test-admin-override",
				featureId: supportId,
				action: "block",
				sourceType: "assessment",
				reason: `Test administrator disabled "${supportId}" for this session`,
				value: ctx.testAdmin?.toolOverrides,
			});
			return;
		}

		// 3. Item restriction (per-item block)
		if (ctx.itemSettings?.restrictedTools?.includes(supportId)) {
			out.blockedToolIds.add(supportId);
			if (override === true) {
				out.blockedOverrides.set(supportId, "item-restriction");
			}
			out.decisions.push({
				precedence: 3,
				rule: "item-restriction",
				featureId: supportId,
				action: "block",
				sourceType: "item",
				reason: `Item restricts "${supportId}" (e.g., mental math question blocks calculator)`,
				value: ctx.itemSettings.restrictedTools,
			});
			return;
		}

		// 4. Profile prohibition: the student's profile withdraws the support,
		// outranking a `true` override and every requirement.
		if (ctx.pnp?.prohibitedSupports?.includes(supportId)) {
			out.blockedToolIds.add(supportId);
			if (override === true) {
				out.blockedOverrides.set(supportId, "pnp-prohibited");
			}
			out.decisions.push({
				precedence: 4,
				rule: "pnp-prohibited",
				featureId: supportId,
				action: "block",
				sourceType: "student",
				reason: `Student PNP profile prohibits "${supportId}"`,
				value: ctx.pnp.prohibitedSupports,
			});
			return;
		}

		// 5. Test administration override `true`: grants the support for the
		// session.
		if (override === true) {
			out.perToolFlags.set(supportId, {
				required: false,
				alwaysAvailable: true,
				settings: this.resolveToolSettings(supportId, ctx),
				rule: "test-admin-override",
			});
			out.decisions.push({
				precedence: 5,
				rule: "test-admin-override",
				featureId: supportId,
				action: "enable",
				sourceType: "assessment",
				reason: `Test administrator enabled "${supportId}" for this session`,
				value: ctx.testAdmin?.toolOverrides,
			});
			return;
		}

		// 6. Item requirement (forces enable)
		if (ctx.itemSettings?.requiredTools?.includes(supportId)) {
			out.mandatedToolIds.add(supportId);
			out.perToolFlags.set(supportId, {
				required: true,
				alwaysAvailable: false,
				settings: this.resolveToolSettings(supportId, ctx),
				rule: "item-requirement",
			});
			out.decisions.push({
				precedence: 6,
				rule: "item-requirement",
				featureId: supportId,
				action: "enable",
				sourceType: "item",
				reason: `Item requires "${supportId}" for this question`,
				value: ctx.itemSettings.requiredTools,
			});
			return;
		}

		// 7. District requirement
		if (ctx.districtPolicy?.requiredTools?.includes(supportId)) {
			out.mandatedToolIds.add(supportId);
			out.perToolFlags.set(supportId, {
				required: true,
				alwaysAvailable: false,
				settings: this.resolveToolSettings(supportId, ctx),
				rule: "district-requirement",
			});
			out.decisions.push({
				precedence: 7,
				rule: "district-requirement",
				featureId: supportId,
				action: "enable",
				sourceType: "assessment",
				reason: `District policy requires "${supportId}" for all assessments`,
				value: ctx.districtPolicy.requiredTools,
			});
			return;
		}

		// 8. Profile supports (student needs)
		if (ctx.pnp?.supports?.includes(supportId)) {
			out.perToolFlags.set(supportId, {
				required: false,
				alwaysAvailable: true,
				settings: this.resolveToolSettings(supportId, ctx),
				rule: "pnp-support",
			});
			out.decisions.push({
				precedence: 8,
				rule: "pnp-support",
				featureId: supportId,
				action: "enable",
				sourceType: "student",
				reason: `Student PNP profile requests "${supportId}"`,
				value: ctx.pnp.supports,
			});
			return;
		}

		// 8 (skip): no rule fired. The trail is keyed by tool id, as in every
		// other branch.
		out.decisions.push({
			precedence: 8,
			rule: "pnp-support",
			featureId: supportId,
			action: "skip",
			sourceType: "system",
			reason: `Feature "${supportId}" not configured at any level`,
			value: { supportId },
		});
	}

	/**
	 * The named ids no tool is registered under, with the rules naming each in
	 * precedence order. A support id is the id of the tool it grants, so an id
	 * missing from the registry matches nothing placed.
	 */
	private unmappedIds(
		pnp: PersonalNeedsProfile | undefined,
		settings: AssessmentSettings | undefined,
		itemSettings: ItemSettings | undefined,
	): Map<string, PnpPolicySourceRule[]> {
		const unmapped = new Map<string, PnpPolicySourceRule[]>();
		if (this.toolRegistry.getAllTools().length === 0) return unmapped;
		const named: Array<[PnpPolicySourceRule, readonly string[] | undefined]> = [
			["district-block", settings?.districtPolicy?.blockedTools],
			[
				"test-admin-override",
				Object.keys(settings?.testAdministration?.toolOverrides ?? {}),
			],
			["item-restriction", itemSettings?.restrictedTools],
			["pnp-prohibited", pnp?.prohibitedSupports],
			["item-requirement", itemSettings?.requiredTools],
			["district-requirement", settings?.districtPolicy?.requiredTools],
			["pnp-support", pnp?.supports],
		];
		for (const [rule, ids] of named) {
			for (const id of ids ?? []) {
				if (this.toolRegistry.has(id)) continue;
				const rules = unmapped.get(id) ?? [];
				if (!rules.includes(rule)) rules.push(rule);
				unmapped.set(id, rules);
			}
		}
		return unmapped;
	}

	/** Tool parameters: the item's entry, else the assessment's. */
	private resolveToolSettings(
		supportId: string,
		ctx: PnpResolutionContext,
	): Record<string, unknown> | undefined {
		return (
			ctx.itemSettings?.toolParameters?.[supportId] ??
			ctx.toolConfigs?.[supportId]
		);
	}
}
