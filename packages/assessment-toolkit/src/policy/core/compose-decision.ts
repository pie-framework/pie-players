/**
 * Compose-decision pipeline (M8 — see `.cursor/plans/m8-design.md` § 3).
 *
 * Pure function: given a decision request, the host's tools config,
 * an optional PNP policy source, and the registered custom sources, returns
 * a `ToolPolicyDecision`. The function performs no I/O, holds no
 * mutable state, and never reaches into Svelte / DOM — that is the
 * `ToolPolicyEngine` class's job.
 *
 * The six steps below mirror the design doc exactly. The tests in
 * `tests/policy/compose-decision.test.ts` lock the orchestration in.
 */

import type {
	AssessmentEntity,
	AssessmentItemRef,
} from "@pie-players/pie-players-shared/types";

import {
	type CanonicalToolsConfig,
	normalizeToolList,
} from "../../services/tools-config-normalizer.js";
import type {
	RequiredToolBlockedDetails,
	ToolPolicyDecision,
	ToolPolicyDecisionRequest,
	ToolPolicyDiagnostic,
	ToolPolicyEntry,
	ToolPolicyHostGate,
} from "./decision-types.js";
import type { PolicySource } from "./PolicySource.js";
import type { PolicySourceTag } from "./policy-source-tag.js";
import { ToolPolicyProvenanceBuilder } from "./provenance.js";
import type { PnpPolicySource } from "../sources/PnpPolicySource.js";

export interface ComposeDecisionInputs {
	request: ToolPolicyDecisionRequest;
	tools: CanonicalToolsConfig;
	pnpPolicy: {
		source: PnpPolicySource | null;
		assessment?: AssessmentEntity;
		currentItemRef?: AssessmentItemRef;
		/**
		 * "on" applies the PNP/profile precedence rules; "off" skips step 5
		 * entirely. Defaults to "on" when an assessment is present
		 * and the source is non-null (see M8 design Q5).
		 */
		enforcement: "on" | "off";
	};
	customSources: readonly PolicySource[];
	/** Stable identifier used as the provenance `contextId`. */
	contextId: string;
}

export function composeDecision(
	inputs: ComposeDecisionInputs,
): ToolPolicyDecision {
	const { request, tools, pnpPolicy, customSources, contextId } = inputs;
	const builder = new ToolPolicyProvenanceBuilder(contextId);

	builder.addSource("host", {
		id: request.scope.scopeId,
		name: `${request.level}:${request.scope.scopeId}`,
		config: {
			placement: tools.placement,
			policy: tools.policy,
		},
	});

	const placement = normalizeToolList(tools.placement[request.level]);
	const allowed = normalizeToolList(tools.policy.allowed);
	const blocked = new Set(normalizeToolList(tools.policy.blocked));

	// Step 1 — Membership filter.
	//
	// Logged with `action: "skip"` rather than `"enable"` because a
	// placement-membership entry is the pipeline's starting point, not
	// a winning decision. Subsequent steps may block the tool at the
	// same precedence (0); the builder's `decision.precedence <
	// winning.precedence` rule would otherwise let the placement entry
	// win equality and mask later blocks. Surviving tools are flipped
	// to `enabled` by `builder.reconcileFinalStates(...)` at the end of
	// the pipeline once the final candidate set is known.
	let candidates: string[] = [];
	for (const toolId of placement) {
		candidates.push(toolId);
		builder.addDecision({
			precedence: 0,
			rule: "placement-membership",
			featureId: toolId,
			action: "skip",
			sourceType: "host",
			reason: `Listed in tools.placement.${request.level}`,
		});
	}

	// Step 2 — Provider veto.
	candidates = candidates.filter((toolId) => {
		const providerEnabled = tools.providers?.[toolId]?.enabled;
		if (providerEnabled === false) {
			builder.addDecision({
				precedence: 0,
				rule: "provider-disabled",
				featureId: toolId,
				action: "block",
				sourceType: "host",
				reason: `tools.providers.${toolId}.enabled === false`,
				value: false,
			});
			return false;
		}
		return true;
	});

	// Step 3 — Host whitelist (only when non-empty).
	if (allowed.length > 0) {
		const allowedSet = new Set(allowed);
		candidates = candidates.filter((toolId) => {
			if (!allowedSet.has(toolId)) {
				builder.addDecision({
					precedence: 0,
					rule: "host-allowlist",
					featureId: toolId,
					action: "block",
					sourceType: "host",
					reason: "Not present in tools.policy.allowed",
					value: allowed,
				});
				return false;
			}
			return true;
		});
	}

	// Step 4 — Host blocklist (absolute).
	candidates = candidates.filter((toolId) => {
		if (blocked.has(toolId)) {
			builder.addDecision({
				precedence: 0,
				rule: "host-blocked",
				featureId: toolId,
				action: "block",
				sourceType: "host",
				reason: "Listed in tools.policy.blocked",
				value: tools.policy.blocked,
			});
			return false;
		}
		return true;
	});

	// Step 5 — PNP/profile policy gates.
	const diagnostics: ToolPolicyDiagnostic[] = [];
	const sourcesByTool = new Map<string, PolicySourceTag[]>();
	for (const toolId of candidates) {
		sourcesByTool.set(toolId, ["placement"]);
	}

	// Snapshot the post-host candidate set so step 5b can distinguish
	// "host removed a required tool" (requiredToolBlocked fires)
	// from "profile policy's own precedence removed a required tool" (fix
	// per M8 PR 1 R1 S1 — multi-rule conflict on the same tool must
	// not blame the host).
	const postHostCandidates = new Set(candidates);

	let pnpPolicyResult: ReturnType<PnpPolicySource["apply"]> | null = null;
	if (
		pnpPolicy.enforcement === "on" &&
		pnpPolicy.source &&
		(pnpPolicy.assessment || pnpPolicy.currentItemRef)
	) {
		pnpPolicyResult = pnpPolicy.source.apply({
			assessment: pnpPolicy.assessment,
			currentItemRef: pnpPolicy.currentItemRef,
		});

		if (pnpPolicyResult.sources.assessment) {
			builder.addSource("assessment", pnpPolicyResult.sources.assessment);
		}
		if (pnpPolicyResult.sources.student) {
			builder.addSource("student", pnpPolicyResult.sources.student);
		}
		if (pnpPolicyResult.sources.item) {
			builder.addSource("item", pnpPolicyResult.sources.item);
		}

		for (const decision of pnpPolicyResult.decisions) {
			builder.addDecision({
				precedence: decision.precedence,
				rule: decision.rule,
				featureId: decision.featureId,
				action: decision.action,
				sourceType: decision.sourceType,
				reason: decision.reason,
				value: decision.value,
			});
		}

		// 5a — remove PNP/profile-blocked tools from the candidate set.
		candidates = candidates.filter((toolId) => {
			return !pnpPolicyResult!.blockedToolIds.has(toolId);
		});
		for (const toolId of Array.from(sourcesByTool.keys())) {
			if (pnpPolicyResult.blockedToolIds.has(toolId)) {
				sourcesByTool.delete(toolId);
			}
		}

		// 5b — surface requiredToolBlocked diagnostics ONLY for
		// PNP/profile-mandated tools that the host removed (i.e., the tool was
		// NOT in `postHostCandidates`). Mandated tools removed by
		// profile policy's own higher-precedence rule (e.g. `restrictedTools`
		// blocking a `requiredTools` mandate) are an internal policy
		// resolution and must not be reported as a host conflict — the
		// loser's `block` decision is already in the trail with full
		// provenance.
		//
		// `details` carries `{ rule, hostRule, hostValue }` so consumers
		// can render the conflict as a single sentence without
		// re-deriving the host gate from `provenance.features`. See
		// `RequiredToolBlockedDetails` for the typed shape.
		for (const mandatedToolId of pnpPolicyResult.mandatedToolIds) {
			const removedByHost = !postHostCandidates.has(mandatedToolId);
			if (!removedByHost) continue;
			const flag = pnpPolicyResult.perToolFlags.get(mandatedToolId);
			const ruleName = flag?.rule ?? "required-tool";
			const hostGate = detectHostRemovalGate(mandatedToolId, {
				placement,
				allowed,
				blocked,
				providers: tools.providers,
			});
			const details: RequiredToolBlockedDetails = {
				rule: ruleName,
				hostRule: hostGate.hostRule,
				hostValue: hostGate.hostValue,
			};
			diagnostics.push({
				code: "tool-policy.requiredToolBlocked",
				level: request.level,
				toolId: mandatedToolId,
				message: `Profile policy mandates "${mandatedToolId}" (${ruleName}) but host policy removed it from level "${request.level}" via ${hostGate.hostRule}.`,
				details,
			});
			builder.addDecision({
				precedence: 0,
				rule: "required-tool-blocked",
				featureId: mandatedToolId,
				action: "advisory",
				sourceType: "host",
				reason: `Host removed required tool "${mandatedToolId}" via ${hostGate.hostRule}`,
				value: details,
			});
		}

		// 5c — attach PNP policy source tags to surviving entries.
		for (const toolId of candidates) {
			const flag = pnpPolicyResult.perToolFlags.get(toolId);
			if (flag) {
				const tags = sourcesByTool.get(toolId) ?? [];
				tags.push(`pnp.${flag.rule}` satisfies PolicySourceTag);
				sourcesByTool.set(toolId, tags);
			}
		}
	}

	// Step 6 — Custom PolicySources.
	for (let i = 0; i < customSources.length; i++) {
		const source = customSources[i];
		const before = candidates.slice();
		const result = source.refine({
			request,
			candidates: before,
		});
		const refinedSet = new Set(result.refinedCandidates);
		// Reject any superset additions (custom sources can only narrow).
		for (const toolId of result.refinedCandidates) {
			if (!before.includes(toolId)) {
				diagnostics.push({
					code: "tool-policy.placementMissing",
					level: request.level,
					toolId,
					message: `Custom source "${source.id}" tried to add tool "${toolId}" that was not in candidates; ignored.`,
					source: `custom.${source.id}` satisfies PolicySourceTag,
				});
				refinedSet.delete(toolId);
			}
		}
		candidates = before.filter((id) => refinedSet.has(id));

		// Index the source's emitted block decisions by featureId so we
		// can detect "silent removals" — tools the source dropped from
		// the candidate set without logging an explicit block. Without
		// this auto-log, the provenance trail for a silently-removed
		// tool would show only the prior `enable` decisions and the
		// final-state reconciliation would have no evidence to mark it
		// `blocked` (M8 PR 1 R2 S1 / M1 case B).
		const explicitBlocks = new Set<string>();
		if (result.decisions) {
			for (const event of result.decisions) {
				builder.addDecision({
					precedence: event.precedence ?? 100 + i,
					rule: event.rule,
					featureId: event.featureId,
					action: event.action,
					sourceType: event.sourceType,
					reason: event.reason,
					value: event.value,
				});
				if (event.action === "block") {
					explicitBlocks.add(event.featureId);
				}
			}
		}

		// Auto-log a `custom-source / block` decision for silent removals.
		for (const toolId of before) {
			if (refinedSet.has(toolId)) continue;
			if (explicitBlocks.has(toolId)) continue;
			builder.addDecision({
				precedence: 100 + i,
				rule: "custom-source",
				featureId: toolId,
				action: "block",
				sourceType: "custom",
				reason: `Custom policy source "${source.id}" removed tool "${toolId}" from candidates without emitting a decision; auto-logged for trail completeness.`,
				value: { customSourceId: source.id },
			});
		}

		// Annotate surviving entries with `custom.<id>` so hosts can see
		// which custom source kept them in.
		for (const toolId of candidates) {
			const tags = sourcesByTool.get(toolId) ?? ["placement"];
			tags.push(`custom.${source.id}` satisfies PolicySourceTag);
			sourcesByTool.set(toolId, tags);
		}
		// And drop attribution for IDs the source removed.
		for (const toolId of before) {
			if (!refinedSet.has(toolId)) {
				sourcesByTool.delete(toolId);
			}
		}
	}

	const survivingIds = new Set(candidates);
	const visibleTools: ToolPolicyEntry[] = candidates.map((toolId) => {
		const flag = pnpPolicyResult?.perToolFlags.get(toolId);
		return {
			toolId,
			required: flag?.required ?? false,
			alwaysAvailable: flag?.alwaysAvailable ?? false,
			settings: flag?.settings,
			sources: sourcesByTool.get(toolId) ?? ["placement"],
		};
	});

	builder.reconcileFinalStates(survivingIds);

	return {
		visibleTools,
		diagnostics,
		provenance: builder.build(),
	};
}

/**
 * Identify which step-1-through-4 host gate removed a tool. Used by
 * step 5b to enrich `tool-policy.requiredToolBlocked` diagnostics. The
 * checks mirror the pipeline order — step 1 (placement) first, step 4
 * (blocklist) last — so the FIRST gate that would have matched wins,
 * which is the gate the pipeline actually invoked. Subsequent gates
 * never get to evaluate a tool that an earlier step already removed.
 */
function detectHostRemovalGate(
	toolId: string,
	args: {
		placement: string[];
		allowed: string[];
		blocked: Set<string>;
		providers: CanonicalToolsConfig["providers"];
	},
): { hostRule: ToolPolicyHostGate; hostValue: unknown } {
	if (!args.placement.includes(toolId)) {
		return { hostRule: "placement-missing", hostValue: args.placement };
	}
	if (args.providers?.[toolId]?.enabled === false) {
		return { hostRule: "provider-disabled", hostValue: false };
	}
	if (args.allowed.length > 0 && !args.allowed.includes(toolId)) {
		return { hostRule: "host-allowlist", hostValue: args.allowed };
	}
	if (args.blocked.has(toolId)) {
		return {
			hostRule: "host-blocked",
			hostValue: Array.from(args.blocked),
		};
	}
	// Defensive: `removedByHost` is true at the call site (the tool is
	// in `mandatedToolIds` but not in `postHostCandidates`), so one of
	// the four gates above MUST have fired. If none did, the host
	// pipeline has a bug; surface a best-effort rather than throwing.
	return { hostRule: "placement-missing", hostValue: args.placement };
}
