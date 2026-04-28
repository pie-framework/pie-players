/**
 * Tool Policy Provenance — generalization of `PnpResolutionProvenance`
 * (M8 — see `.cursor/plans/m8-design.md` § 4).
 *
 * Today's `PnpResolutionProvenance` (in `services/pnp-provenance.ts`)
 * tracks decisions made by `PnpToolResolver` only. M8 generalizes the
 * shape to track decisions from every Pass-1 contributor — host
 * placement, host policy, provider veto, QTI gates, and custom policy
 * sources — without losing PNP debugger compatibility.
 *
 * **Compatibility posture.** This module is the new home of the shape;
 * the legacy `pnp-provenance.ts` module remains untouched in PR 1 and
 * is deleted in PR 5 (the rip-out PR) once every consumer has migrated
 * to the engine. The shape stays structurally compatible: existing
 * fields (`contextId`, `resolvedAt`, `sources`, `features`,
 * `decisionLog`, `summary`) are preserved verbatim. The rule
 * vocabulary expands, and `ResolutionDecision.precedence` widens from
 * `1 | 2 | 3 | 4 | 5 | 6` to a `number` so non-QTI rules can fit
 * (the QTI rules continue to use `1`–`6` exactly as before).
 */

/**
 * Expanded rule vocabulary for `ResolutionDecision.rule` in M8.
 *
 * The first six values map 1:1 onto `PnpResolutionProvenance`'s
 * existing rule names (the QTI 6-level precedence). The remaining
 * values capture the new contributors the M8 engine surfaces:
 * placement membership (step 1), provider veto (step 2), host policy
 * (steps 3 / 4), the QTI-conflict diagnostic (`qti-required-blocked`),
 * custom sources (step 6), and the catch-all `system-default` for the
 * "not configured at any level" fallback.
 */
export type ToolPolicyDecisionRule =
	| "district-block"
	| "test-admin-override"
	| "item-restriction"
	| "item-requirement"
	| "district-requirement"
	| "pnp-support"
	| "pnp-prohibited"
	| "placement-membership"
	| "provider-disabled"
	| "host-allowlist"
	| "host-blocked"
	| "qti-required-blocked"
	| "custom-source"
	| "system-default";

export type ToolPolicySourceType =
	| "organization"
	| "assessment"
	| "section"
	| "item"
	| "student"
	| "system"
	| "host"
	| "custom";

export interface ToolPolicyResolutionDecision {
	/** Monotonic step index across the entire decision log. */
	step: number;

	/**
	 * Precedence level. QTI rules use `1`–`6` exactly as in today's
	 * `PnpResolutionProvenance`. Non-QTI rules use `0` (host-side
	 * gates that always fire before QTI) or `7+` (custom sources that
	 * fire after QTI).
	 */
	precedence: number;

	rule: ToolPolicyDecisionRule;

	/** Tool ID being resolved (post-PNP-support-mapping where applicable). */
	featureId: string;

	action: "block" | "enable" | "skip" | "advisory";

	source: {
		type: ToolPolicySourceType;
		id?: string;
		name?: string;
	};

	reason: string;

	value?: unknown;

	timestamp: Date;
}

export interface ToolPolicyFeatureTrail {
	featureId: string;
	finalState: "enabled" | "blocked" | "not-configured" | "advisory-only";
	winningDecision?: ToolPolicyResolutionDecision;
	allDecisions: ToolPolicyResolutionDecision[];
	explanation: string;
}

export interface ToolPolicyProvenance {
	contextId: string;
	resolvedAt: Date;
	sources: {
		organization?: { id: string; name: string; pnpDefaults?: unknown };
		assessment?: { id: string; name: string; settings?: unknown };
		section?: { id: string; title?: string; settings?: unknown };
		item?: { id: string; name?: string; settings?: unknown };
		student?: { id: string; pnpProfile?: unknown };
		host?: { id: string; config?: unknown };
	};
	features: Map<string, ToolPolicyFeatureTrail>;
	decisionLog: ToolPolicyResolutionDecision[];
	summary: {
		totalFeatures: number;
		enabled: number;
		blocked: number;
		notConfigured: number;
		bySource: Record<string, number>;
		byRule: Record<string, number>;
	};
}

interface AddDecisionParams {
	precedence: number;
	rule: ToolPolicyDecisionRule;
	featureId: string;
	action: ToolPolicyResolutionDecision["action"];
	sourceType: ToolPolicySourceType;
	sourceId?: string;
	sourceName?: string;
	reason: string;
	value?: unknown;
}

/**
 * Builder mirroring `PnpProvenanceBuilder` but emitting the expanded
 * `ToolPolicyProvenance` shape. Identical API where the field names
 * overlap so an `M8 PR 5` rename of the legacy builder is a near-pure
 * import-path swap.
 */
export class ToolPolicyProvenanceBuilder {
	private provenance: ToolPolicyProvenance;
	private stepCounter = 0;

	constructor(contextId: string) {
		this.provenance = {
			contextId,
			resolvedAt: new Date(),
			sources: {},
			features: new Map(),
			decisionLog: [],
			summary: {
				totalFeatures: 0,
				enabled: 0,
				blocked: 0,
				notConfigured: 0,
				bySource: {},
				byRule: {},
			},
		};
	}

	addSource(
		type: keyof ToolPolicyProvenance["sources"],
		data: { id: string; name?: string; config?: unknown },
	): this {
		const base = { id: data.id, name: data.name ?? data.id };
		switch (type) {
			case "organization":
				this.provenance.sources.organization = {
					...base,
					pnpDefaults: data.config,
				};
				break;
			case "assessment":
				this.provenance.sources.assessment = {
					...base,
					settings: data.config,
				};
				break;
			case "section":
				this.provenance.sources.section = { ...base, settings: data.config };
				break;
			case "item":
				this.provenance.sources.item = { ...base, settings: data.config };
				break;
			case "student":
				this.provenance.sources.student = {
					id: data.id,
					pnpProfile: data.config,
				};
				break;
			case "host":
				this.provenance.sources.host = { id: data.id, config: data.config };
				break;
		}
		return this;
	}

	addDecision(params: AddDecisionParams): this {
		const decision: ToolPolicyResolutionDecision = {
			step: ++this.stepCounter,
			precedence: params.precedence,
			rule: params.rule,
			featureId: params.featureId,
			action: params.action,
			source: {
				type: params.sourceType,
				id: params.sourceId,
				name: params.sourceName,
			},
			reason: params.reason,
			value: params.value,
			timestamp: new Date(),
		};

		this.provenance.decisionLog.push(decision);

		let trail = this.provenance.features.get(params.featureId);
		if (!trail) {
			trail = {
				featureId: params.featureId,
				finalState: "not-configured",
				allDecisions: [],
				explanation: "",
			};
			this.provenance.features.set(params.featureId, trail);
		}
		trail.allDecisions.push(decision);

		// "advisory" doesn't change finalState — it preserves the existing
		// blocked/enabled state and only flags a documented conflict.
		if (params.action === "advisory") {
			if (trail.finalState === "not-configured") {
				trail.finalState = "advisory-only";
			}
		} else if (params.action !== "skip") {
			const isWinning =
				!trail.winningDecision ||
				decision.precedence < trail.winningDecision.precedence;
			if (isWinning) {
				trail.winningDecision = decision;
				trail.finalState = decision.action === "enable" ? "enabled" : "blocked";
			}
		}

		this.provenance.summary.bySource[params.sourceType] =
			(this.provenance.summary.bySource[params.sourceType] || 0) + 1;
		this.provenance.summary.byRule[params.rule] =
			(this.provenance.summary.byRule[params.rule] || 0) + 1;

		return this;
	}

	/**
	 * Reconcile every feature's `finalState` against the post-pipeline
	 * candidate set.
	 *
	 * The eager `finalState` updates inside `addDecision` track the
	 * highest-precedence non-skip decision per feature, but a tool's
	 * *actual* visibility is only known after step 6 of the
	 * composition pipeline — earlier decisions can be reversed by
	 * later host gates, QTI gates, or custom sources. This method
	 * walks every feature trail and rewrites `finalState` from the
	 * final candidate set so callers can rely on
	 * `provenance.features.get(toolId)?.finalState` as the canonical
	 * "is this tool visible right now?" answer (M8 design § 4 + § 12).
	 *
	 * Semantics applied per feature:
	 *   - In `survivingIds`                                 → "enabled"
	 *   - Not in `survivingIds`, has any non-skip decision  → "blocked"
	 *   - Not in `survivingIds`, only advisory decisions    → "advisory-only"
	 *   - Otherwise                                         → "not-configured"
	 *
	 * Surviving features without any logged decisions get a synthetic
	 * "enabled" trail so the provenance is dense enough for hosts that
	 * iterate `provenance.features` to find the visible set.
	 */
	reconcileFinalStates(survivingIds: ReadonlySet<string>): this {
		for (const featureId of survivingIds) {
			let trail = this.provenance.features.get(featureId);
			if (!trail) {
				trail = {
					featureId,
					finalState: "enabled",
					allDecisions: [],
					explanation: "",
				};
				this.provenance.features.set(featureId, trail);
				continue;
			}
			trail.finalState = "enabled";
		}

		for (const trail of this.provenance.features.values()) {
			if (survivingIds.has(trail.featureId)) continue;
			const hasNonSkip = trail.allDecisions.some(
				(d) => d.action !== "skip" && d.action !== "advisory",
			);
			const hasAdvisory = trail.allDecisions.some(
				(d) => d.action === "advisory",
			);
			if (hasNonSkip) {
				trail.finalState = "blocked";
			} else if (hasAdvisory) {
				trail.finalState = "advisory-only";
			} else {
				trail.finalState = "not-configured";
			}
		}
		return this;
	}

	build(): ToolPolicyProvenance {
		for (const trail of this.provenance.features.values()) {
			trail.explanation = generateExplanation(trail);
		}
		for (const trail of this.provenance.features.values()) {
			this.provenance.summary.totalFeatures++;
			if (trail.finalState === "enabled") {
				this.provenance.summary.enabled++;
			} else if (trail.finalState === "blocked") {
				this.provenance.summary.blocked++;
			} else {
				this.provenance.summary.notConfigured++;
			}
		}
		return this.provenance;
	}
}

function generateExplanation(trail: ToolPolicyFeatureTrail): string {
	if (!trail.winningDecision) {
		if (trail.finalState === "advisory-only") {
			const advisory = trail.allDecisions.find((d) => d.action === "advisory");
			return advisory
				? `Feature "${trail.featureId}" was kept in its host-decided state; ${advisory.reason}`
				: `Feature "${trail.featureId}" carries an advisory note.`;
		}
		return `Feature "${trail.featureId}" was not configured at any level.`;
	}

	const decision = trail.winningDecision;
	const sourceName = decision.source.name || decision.source.type;
	let explanation = `Feature "${trail.featureId}" is ${trail.finalState}.\n\n`;
	explanation += `**Primary Reason** (${decision.rule}):\n`;
	explanation += `${decision.reason}\n`;
	explanation += `Source: ${sourceName} (${decision.source.type})\n`;
	const overridden = trail.allDecisions.filter(
		(d) =>
			d.step !== decision.step &&
			d.action !== "skip" &&
			d.action !== "advisory" &&
			d.precedence > decision.precedence,
	);
	if (overridden.length > 0) {
		explanation += `\n**Overridden Rules**:\n`;
		for (const d of overridden) {
			explanation += `- ${d.rule}: ${d.reason}\n`;
		}
	}
	return explanation;
}

