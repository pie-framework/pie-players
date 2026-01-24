/**
 * Accommodation Resolver Service
 * Resolves final tool configuration by merging roster, student, and item configs
 *
 * Precedence (highest to lowest):
 * 1. Roster block ("0" = blocked)
 * 2. Item restriction
 * 3. Item requirement
 * 4. Student accommodation
 * 5. Roster default
 * 6. System default
 *
 * Based on production platform patterns and architectural enhancements
 */

import type {
	AccommodationProfile,
	AccommodationResolver,
	ConfigurationSource,
	ItemToolConfig,
	ResolutionStep,
	ResolutionTrace,
	ResolvedToolConfig,
	RosterToolConfiguration,
	ToolConfig,
	ToolResolutionResult,
} from "./types";

export class AccommodationResolverImpl implements AccommodationResolver {
	/**
	 * Resolve final tools for an item
	 */
	resolveToolsForItem(
		student: AccommodationProfile,
		roster: RosterToolConfiguration,
		item: ItemToolConfig,
	): ResolvedToolConfig[] {
		const resolved: ResolvedToolConfig[] = [];

		// Collect all tool types mentioned in any config
		const allToolTypes = this._collectAllToolTypes(student, roster, item);

		for (const toolType of allToolTypes) {
			const result = this.isToolAllowed(toolType, student, roster, item);

			if (result.allowed && result.config) {
				resolved.push({
					...result.config,
					resolvedFrom: result.source,
					required: item.requiredTools?.includes(toolType) || false,
					reason: result.reason,
				});
			}
		}

		return resolved;
	}

	/**
	 * Check if a specific tool is allowed
	 */
	isToolAllowed(
		toolType: string,
		student: AccommodationProfile,
		roster: RosterToolConfiguration,
		item: ItemToolConfig,
	): ToolResolutionResult {
		// 1. Check roster block (highest precedence)
		if (roster.toolAllowances[toolType] === "0") {
			return {
				allowed: false,
				reason: "Tool blocked at roster/test level",
				source: "roster-block",
			};
		}

		// 2. Check item restriction
		if (item.restrictedTools?.includes(toolType)) {
			return {
				allowed: false,
				reason: "Tool restricted for this specific item",
				source: "item-restriction",
			};
		}

		// 3. Check item requirement (forces tool to be enabled)
		if (item.requiredTools?.includes(toolType)) {
			const config = this._buildToolConfig(toolType, item, roster);
			return {
				allowed: true,
				reason: "Tool required for this item",
				source: "item-requirement",
				config,
			};
		}

		// 4. Check student accommodation
		if (student.accommodations[toolType] === true) {
			const config = this._buildToolConfig(toolType, item, roster);
			return {
				allowed: true,
				reason: "Tool enabled via student accommodation profile",
				source: "student-accommodation",
				config,
			};
		}

		// 5. Check roster default
		if (roster.toolAllowances[toolType] === "1") {
			const config = this._buildToolConfig(toolType, item, roster);
			return {
				allowed: true,
				reason: "Tool allowed at roster/test level",
				source: "roster-default",
				config,
			};
		}

		// 6. System default (not allowed unless explicitly configured)
		return {
			allowed: false,
			reason: "Tool not configured in any source",
			source: "system-default",
		};
	}

	/**
	 * Get resolution trace for debugging
	 */
	getResolutionTrace(
		toolType: string,
		student: AccommodationProfile,
		roster: RosterToolConfiguration,
		item: ItemToolConfig,
	): ResolutionTrace {
		const steps: ResolutionStep[] = [];

		// Step 1: Roster block check
		if (roster.toolAllowances[toolType] === "0") {
			steps.push({
				source: "roster-block",
				decision: "block",
				reason: "Tool blocked at roster/test level",
			});
		} else {
			steps.push({
				source: "roster-block",
				decision: "skip",
				reason: "No roster block for this tool",
			});
		}

		// Step 2: Item restriction check
		if (item.restrictedTools?.includes(toolType)) {
			steps.push({
				source: "item-restriction",
				decision: "block",
				reason: "Tool restricted for this item",
			});
		} else {
			steps.push({
				source: "item-restriction",
				decision: "skip",
				reason: "No item restriction for this tool",
			});
		}

		// Step 3: Item requirement check
		if (item.requiredTools?.includes(toolType)) {
			steps.push({
				source: "item-requirement",
				decision: "require",
				reason: "Tool required for this item",
				config: item.toolParameters?.[toolType]?.config,
			});
		} else {
			steps.push({
				source: "item-requirement",
				decision: "skip",
				reason: "Tool not required for this item",
			});
		}

		// Step 4: Student accommodation check
		if (student.accommodations[toolType] === true) {
			steps.push({
				source: "student-accommodation",
				decision: "allow",
				reason: "Tool enabled via student accommodation",
			});
		} else {
			steps.push({
				source: "student-accommodation",
				decision: "skip",
				reason: "Tool not in student accommodation profile",
			});
		}

		// Step 5: Roster default check
		if (roster.toolAllowances[toolType] === "1") {
			steps.push({
				source: "roster-default",
				decision: "allow",
				reason: "Tool allowed at roster level",
				config: roster.defaultToolConfigs?.[toolType],
			});
		} else {
			steps.push({
				source: "roster-default",
				decision: "skip",
				reason: "Tool not allowed at roster level",
			});
		}

		// Final decision
		const finalDecision = this.isToolAllowed(toolType, student, roster, item);

		return {
			toolType,
			steps,
			finalDecision,
		};
	}

	/**
	 * Build tool config from available sources
	 */
	private _buildToolConfig(
		toolType: string,
		item: ItemToolConfig,
		roster: RosterToolConfiguration,
	): ToolConfig {
		// Start with roster default config
		const baseConfig: ToolConfig = roster.defaultToolConfigs?.[toolType] || {
			id: toolType,
			name: this._humanizeName(toolType),
			enabled: true,
		};

		// Merge with item-specific config
		const itemConfig = item.toolParameters?.[toolType]?.config;
		if (itemConfig) {
			return {
				...baseConfig,
				...itemConfig,
			};
		}

		return baseConfig;
	}

	/**
	 * Collect all tool types mentioned in any config source
	 */
	private _collectAllToolTypes(
		student: AccommodationProfile,
		roster: RosterToolConfiguration,
		item: ItemToolConfig,
	): Set<string> {
		const types = new Set<string>();

		// From roster
		Object.keys(roster.toolAllowances).forEach((type) => types.add(type));
		if (roster.defaultToolConfigs) {
			Object.keys(roster.defaultToolConfigs).forEach((type) => types.add(type));
		}

		// From student
		Object.keys(student.accommodations).forEach((type) => types.add(type));

		// From item
		item.requiredTools?.forEach((type) => types.add(type));
		item.restrictedTools?.forEach((type) => types.add(type));
		if (item.toolParameters) {
			Object.keys(item.toolParameters).forEach((type) => types.add(type));
		}

		return types;
	}

	/**
	 * Convert tool type to human-readable name
	 */
	private _humanizeName(toolType: string): string {
		return toolType
			.replace(/[-_]/g, " ")
			.replace(/\b\w/g, (char) => char.toUpperCase());
	}
}

/**
 * Singleton instance (deprecated)
 * @deprecated Instantiate AccommodationResolverImpl directly instead:
 *   const resolver = new AccommodationResolverImpl();
 */
export const accommodationResolver = new AccommodationResolverImpl();
