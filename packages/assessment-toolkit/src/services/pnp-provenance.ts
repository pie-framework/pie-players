/**
 * PNP Resolution Provenance Tracking
 *
 * Provides detailed tracking of how PNP profiles are resolved, including:
 * - Decision steps at each precedence level
 * - Sources of configuration (district, assessment, item, student)
 * - Reasons for tool enablement/blocking
 * - Merge operations and overrides
 *
 * This enables:
 * - Visual explanation components for users
 * - Debugging tool resolution issues
 * - Compliance auditing and reporting
 * - Developer troubleshooting
 *
 * Part of PIE Assessment Toolkit.
 */

/**
 * Decision made during PNP resolution
 */
export interface ResolutionDecision {
	/** Unique step identifier */
	step: number;

	/** Precedence level (1-6, lower = higher priority) */
	precedence: 1 | 2 | 3 | 4 | 5 | 6;

	/** Human-readable rule name */
	rule:
		| "district-block"
		| "test-admin-override"
		| "item-restriction"
		| "item-requirement"
		| "district-requirement"
		| "pnp-support"
		| "system-default";

	/** Tool or feature ID being resolved */
	featureId: string;

	/** Decision outcome */
	action: "block" | "enable" | "skip";

	/** Where the decision came from */
	source: {
		type: "organization" | "assessment" | "section" | "item" | "student" | "system";
		id?: string; // Entity ID (e.g., org ID, assessment ID)
		name?: string; // Human-readable name
	};

	/** Why this decision was made */
	reason: string;

	/** Configuration value that triggered this decision */
	value?: any;

	/** Timestamp of decision */
	timestamp: Date;
}

/**
 * Complete resolution trail for a single feature
 */
export interface FeatureResolutionTrail {
	/** Feature ID (QTI 3.0 or tool ID) */
	featureId: string;

	/** Final decision */
	finalState: "enabled" | "blocked" | "not-configured";

	/** Winning decision (highest precedence) */
	winningDecision?: ResolutionDecision;

	/** All decisions considered (in precedence order) */
	allDecisions: ResolutionDecision[];

	/** Human-readable explanation */
	explanation: string;
}

/**
 * Complete provenance for an entire PNP resolution
 */
export interface PNPResolutionProvenance {
	/** Session or resolution context ID */
	contextId: string;

	/** When resolution occurred */
	resolvedAt: Date;

	/** All configuration sources consulted */
	sources: {
		organization?: {
			id: string;
			name: string;
			pnpDefaults?: any;
		};
		assessment?: {
			id: string;
			name: string;
			settings?: any;
		};
		section?: {
			id: string;
			title?: string;
			settings?: any;
		};
		item?: {
			id: string;
			name?: string;
			settings?: any;
		};
		student?: {
			id: string;
			pnpProfile?: any;
		};
	};

	/** Resolution trail for each feature */
	features: Map<string, FeatureResolutionTrail>;

	/** All decisions in chronological order */
	decisionLog: ResolutionDecision[];

	/** Summary statistics */
	summary: {
		totalFeatures: number;
		enabled: number;
		blocked: number;
		notConfigured: number;
		bySource: Record<string, number>;
		byRule: Record<string, number>;
	};
}

/**
 * Provenance builder for tracking PNP resolution
 */
export class PNPProvenanceBuilder {
	private provenance: PNPResolutionProvenance;
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

	/**
	 * Add a configuration source
	 */
	addSource(
		type: "organization" | "assessment" | "section" | "item" | "student",
		data: { id: string; name?: string; config?: any },
	): this {
		this.provenance.sources[type] = {
			id: data.id,
			name: data.name || data.id,
			...(type === "organization" && { pnpDefaults: data.config }),
			...(type === "assessment" && { settings: data.config }),
			...(type === "section" && { settings: data.config }),
			...(type === "item" && { settings: data.config }),
			...(type === "student" && { pnpProfile: data.config }),
		} as any;
		return this;
	}

	/**
	 * Record a decision during resolution
	 */
	addDecision(params: {
		precedence: 1 | 2 | 3 | 4 | 5 | 6;
		rule: ResolutionDecision["rule"];
		featureId: string;
		action: "block" | "enable" | "skip";
		sourceType: ResolutionDecision["source"]["type"];
		sourceId?: string;
		sourceName?: string;
		reason: string;
		value?: any;
	}): this {
		const decision: ResolutionDecision = {
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

		// Add to decision log
		this.provenance.decisionLog.push(decision);

		// Update feature trail
		if (!this.provenance.features.has(params.featureId)) {
			this.provenance.features.set(params.featureId, {
				featureId: params.featureId,
				finalState: "not-configured",
				allDecisions: [],
				explanation: "",
			});
		}

		const trail = this.provenance.features.get(params.featureId)!;
		trail.allDecisions.push(decision);

		// Update winning decision if this has higher precedence
		if (
			params.action !== "skip" &&
			(!trail.winningDecision ||
				decision.precedence < trail.winningDecision.precedence)
		) {
			trail.winningDecision = decision;
			trail.finalState = decision.action === "enable" ? "enabled" : "blocked";
		}

		// Update summary
		this.provenance.summary.bySource[params.sourceType] =
			(this.provenance.summary.bySource[params.sourceType] || 0) + 1;
		this.provenance.summary.byRule[params.rule] =
			(this.provenance.summary.byRule[params.rule] || 0) + 1;

		return this;
	}

	/**
	 * Build final provenance with explanations
	 */
	build(): PNPResolutionProvenance {
		// Generate explanations for each feature
		for (const [featureId, trail] of this.provenance.features.entries()) {
			trail.explanation = this.generateExplanation(trail);
		}

		// Update summary counts
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

	/**
	 * Generate human-readable explanation for a feature resolution
	 */
	private generateExplanation(trail: FeatureResolutionTrail): string {
		if (!trail.winningDecision) {
			return `Feature "${trail.featureId}" was not configured at any level.`;
		}

		const decision = trail.winningDecision;
		const source = decision.source;
		const sourceName = source.name || source.type;

		let explanation = `Feature "${trail.featureId}" is ${trail.finalState}.\n\n`;

		// Explain winning decision
		explanation += `**Primary Reason** (${this.getRuleName(decision.rule)}):\n`;
		explanation += `${decision.reason}\n`;
		explanation += `Source: ${sourceName} (${source.type})\n\n`;

		// Show overridden decisions if any
		const overridden = trail.allDecisions.filter(
			(d) =>
				d.step !== decision.step &&
				d.action !== "skip" &&
				d.precedence > decision.precedence,
		);

		if (overridden.length > 0) {
			explanation += `**Overridden Rules**:\n`;
			overridden.forEach((d) => {
				explanation += `- ${this.getRuleName(d.rule)}: ${d.reason} (overridden by higher precedence)\n`;
			});
		}

		return explanation;
	}

	/**
	 * Get human-readable rule name
	 */
	private getRuleName(rule: ResolutionDecision["rule"]): string {
		const names: Record<ResolutionDecision["rule"], string> = {
			"district-block": "District Block",
			"test-admin-override": "Test Administrator Override",
			"item-restriction": "Item Restriction",
			"item-requirement": "Item Requirement",
			"district-requirement": "District Requirement",
			"pnp-support": "Student PNP Support",
			"system-default": "System Default",
		};
		return names[rule];
	}

	/**
	 * Get current provenance (without explanations)
	 */
	getCurrent(): PNPResolutionProvenance {
		return this.provenance;
	}
}

/**
 * Format provenance as markdown for display
 */
export function formatProvenanceAsMarkdown(
	provenance: PNPResolutionProvenance,
): string {
	let md = `# PNP Resolution Report\n\n`;
	md += `**Context**: ${provenance.contextId}\n`;
	md += `**Resolved At**: ${provenance.resolvedAt.toISOString()}\n\n`;

	// Summary
	md += `## Summary\n\n`;
	md += `- Total Features: ${provenance.summary.totalFeatures}\n`;
	md += `- Enabled: ${provenance.summary.enabled}\n`;
	md += `- Blocked: ${provenance.summary.blocked}\n`;
	md += `- Not Configured: ${provenance.summary.notConfigured}\n\n`;

	// Sources
	md += `## Configuration Sources\n\n`;
	Object.entries(provenance.sources).forEach(([type, source]) => {
		const sourceName =
			(source as any).name || (source as any).title || source.id;
		md += `- **${type}**: ${sourceName} (${source.id})\n`;
	});
	md += `\n`;

	// Features
	md += `## Feature Resolution\n\n`;
	for (const trail of provenance.features.values()) {
		md += `### ${trail.featureId}\n\n`;
		md += `**Status**: ${trail.finalState}\n\n`;
		md += trail.explanation + `\n\n`;
	}

	// Decision log
	md += `## Decision Log\n\n`;
	provenance.decisionLog.forEach((decision) => {
		md += `${decision.step}. **${decision.rule}** (precedence ${decision.precedence})\n`;
		md += `   - Feature: ${decision.featureId}\n`;
		md += `   - Action: ${decision.action}\n`;
		md += `   - Source: ${decision.source.name || decision.source.type}\n`;
		md += `   - Reason: ${decision.reason}\n\n`;
	});

	return md;
}

/**
 * Format provenance as JSON (for APIs)
 */
export function formatProvenanceAsJSON(
	provenance: PNPResolutionProvenance,
): string {
	// Convert Map to object for JSON serialization
	const serializable = {
		...provenance,
		features: Array.from(provenance.features.entries()).map(
			([_featureId, trail]) => trail,
		),
	};
	return JSON.stringify(serializable, null, 2);
}

/**
 * Get simple explanation for a specific feature
 */
export function getFeatureExplanation(
	provenance: PNPResolutionProvenance,
	featureId: string,
): string | null {
	const trail = provenance.features.get(featureId);
	return trail?.explanation || null;
}
