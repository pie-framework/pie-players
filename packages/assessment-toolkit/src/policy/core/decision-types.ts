/**
 * Tool Policy Engine — decision input/output types.
 *
 * These types describe the *request/response* contract for
 * `ToolPolicyEngine.decide(...)`. The engine itself, plus the
 * composition pipeline that produces the response, lives in sibling
 * modules.
 *
 * `docs/tools-and-accomodations/architecture.md` covers the engine shape,
 * the composition rule, and the provenance contract.
 */

import type { ToolPlacementLevel } from "../../services/tools-config-normalizer.js";
import type { ToolContext, ToolLevel } from "../../services/tool-context.js";
import type {
	PnpPolicySourceRule,
	ToolPolicyProvenance,
} from "./provenance.js";

/**
 * Scope identifier for a `decide(...)` request. The engine uses
 * `level` to pick which placement bucket to read; `scopeId` is opaque
 * to the engine (it is round-tripped into provenance for human-readable
 * trails) and is typically the section-id, item-id, or passage-id of
 * the surface asking the question. `contentKind` mirrors the
 * `ToolbarContext.scope.contentKind` field `<pie-item-toolbar>` reads for
 * content relevance.
 */
export interface ToolScope {
	level: ToolLevel;
	scopeId: string;
	assessmentId?: string;
	sectionId?: string;
	itemId?: string;
	canonicalItemId?: string;
	contentKind?: string;
}

export interface ToolPolicyDecisionRequest {
	/**
	 * Placement bucket the engine reads from
	 * (`tools.placement[level]`). Stays narrow (`section | item |
	 * passage`) — broader `ToolLevel` values from `tool-context.ts`
	 * are surfaced through `scope.level` only.
	 */
	level: ToolPlacementLevel;
	scope: ToolScope;
	/**
	 * Optional tool context. The engine does not call
	 * `isVisibleInContext(...)`: content relevance is applied at the toolbar
	 * boundary. The context is forwarded to custom `PolicySource` instances so
	 * they can refine the candidate set.
	 */
	context?: ToolContext;
}

/**
 * Diagnostic codes the engine may emit alongside a decision.
 * `tool-policy.requiredToolBlocked` fires when a host policy gate
 * (`policy.blocked`, the allowlist, a provider veto, or placement at no level)
 * removed a tool that item or district `requiredTools` mandates. A tool placed
 * at another level is served there, so its absence from this level's placement
 * is no conflict. `details` is {@link RequiredToolBlockedDetails}.
 *
 * `tool-policy.placementMissing` fires when a custom `PolicySource`
 * references a tool ID that is not present in `tools.placement[level]`
 * for the resolved level. `details` is {@link PlacementMissingDetails}.
 * The host-side `ToolConfigDiagnostic` channel
 * (already used by `tool-config-validation.ts`) covers config-time
 * misconfiguration; this channel covers per-decision conflicts.
 *
 * `tool-policy.unknownSupportId` fires for each id a profile, district
 * policy, test administration or item names that no tool is registered under.
 * It describes the inputs, so the engine reports it on its resolved inputs'
 * `diagnostics` rather than on a decision. `details` is
 * {@link UnknownSupportIdDetails}.
 *
 * `tool-policy.itemSettingNotApplied` fires on a section-, assessment- or
 * passage-level decision for each tool on that toolbar a mounted item's
 * `restrictedTools` or `requiredTools` names, once per tool and item: item
 * settings govern only the item's own toolbar. `details` is
 * {@link ItemSettingNotAppliedDetails}.
 *
 * `tool-policy.overrideBlocked` fires for each tool a `true`
 * `settings.testAdministration.toolOverrides` entry grants that an item's
 * `restrictedTools` or the profile's `prohibitedSupports` withdraws instead.
 * `details` is {@link OverrideBlockedDetails}.
 *
 * The toolkit coordinator logs each diagnostic once per code, tool and item,
 * and hands the same ones to its `onPolicyDiagnostic` listeners.
 */
export type ToolPolicyDiagnosticCode = keyof ToolPolicyDiagnosticDetails;

/**
 * Which host gate removed a profile-mandated tool. Surfaced inside
 * `ToolPolicyDiagnostic.details` for `tool-policy.requiredToolBlocked`
 * so consumers can render a single human-readable explanation
 * ("the proctor blocked the calculator that this student's IEP
 * requires") without re-deriving the host gate from
 * `provenance.features[toolId].allDecisions`.
 *
 * The four values mirror steps 1–4 of `composeDecision`:
 *   - `placement-missing` — no level of `tools.placement` lists the tool
 *   - `provider-disabled` — `tools.providers[id].enabled === false`
 *   - `host-allowlist`    — non-empty `tools.policy.allowed` excludes the id
 *   - `host-blocked`      — `tools.policy.blocked` lists the id
 */
export type ToolPolicyHostGate =
	| "placement-missing"
	| "provider-disabled"
	| "host-allowlist"
	| "host-blocked";

/** Payload of a `tool-policy.requiredToolBlocked` diagnostic. */
export interface RequiredToolBlockedDetails {
	/** The requirement that mandates the tool. */
	rule: "item-requirement" | "district-requirement";
	/** Which host gate removed the tool. */
	hostRule: ToolPolicyHostGate;
	/** The host configuration value that triggered the gate (best-effort, may be omitted). */
	hostValue?: unknown;
}

/** Payload of a `tool-policy.unknownSupportId` diagnostic. */
export interface UnknownSupportIdDetails {
	/** The rules whose lists name the id, in precedence order. */
	origins: PnpPolicySourceRule[];
}

/** Payload of a `tool-policy.placementMissing` diagnostic. */
export interface PlacementMissingDetails {
	/** The custom `PolicySource` that named the tool. */
	customSourceId: string;
}

/** Payload of a `tool-policy.overrideBlocked` diagnostic. */
export interface OverrideBlockedDetails {
	/** The rule that withdrew the granted tool. */
	rule: "item-restriction" | "pnp-prohibited";
}

/** Payload of a `tool-policy.itemSettingNotApplied` diagnostic. */
export interface ItemSettingNotAppliedDetails {
	/** Canonical id of the item whose setting names the tool. */
	itemId: string;
	/** The item settings that name it. */
	settings: Array<"restrictedTools" | "requiredTools">;
	/** The level of the toolbar the tool is on. */
	toolbarLevel: ToolLevel;
}

/** The payload each diagnostic code carries. */
export interface ToolPolicyDiagnosticDetails {
	"tool-policy.requiredToolBlocked": RequiredToolBlockedDetails;
	"tool-policy.placementMissing": PlacementMissingDetails;
	"tool-policy.unknownSupportId": UnknownSupportIdDetails;
	"tool-policy.itemSettingNotApplied": ItemSettingNotAppliedDetails;
	"tool-policy.overrideBlocked": OverrideBlockedDetails;
}

/** A policy diagnostic, its `details` typed by its `code`. */
export type ToolPolicyDiagnostic = {
	[C in ToolPolicyDiagnosticCode]: {
		code: C;
		/**
		 * The toolbar level decided; absent on a feature decision and on an input
		 * diagnostic.
		 */
		level?: ToolPlacementLevel;
		toolId: string;
		message: string;
		details: ToolPolicyDiagnosticDetails[C];
	};
}[ToolPolicyDiagnosticCode];

export interface ToolPolicyEntry {
	toolId: string;
	/**
	 * `true` when PNP/profile policy mandates this tool (item or district
	 * `requiredTools`). Advisory mandates that the host blocked do *not*
	 * surface here — they appear in `diagnostics` instead. Hosts that need
	 * to know about those should listen on the diagnostic channel.
	 */
	required: boolean;
	/**
	 * `true` for a tool the student's PNP `supports` or a
	 * `testAdministration.toolOverrides` entry grants — UI-level signal that
	 * the host cannot toggle this tool off in user preferences. Does NOT
	 * override host blocks (they would have removed the entry before this
	 * flag is read).
	 */
	alwaysAvailable: boolean;
	/**
	 * The tool's parameters: the item's `toolParameters` entry on the item's own
	 * toolbar, else the assessment's `toolParameters` entry. Set whether or not a
	 * grant admitted the tool.
	 */
	parameters?: Record<string, unknown>;
}

export interface ToolPolicyDecision {
	visibleTools: ToolPolicyEntry[];
	diagnostics: ToolPolicyDiagnostic[];
	provenance: ToolPolicyProvenance;
}
