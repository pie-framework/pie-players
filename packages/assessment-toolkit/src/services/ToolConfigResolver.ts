/**
 * ToolConfigResolver
 *
 * Implements 3-tier hierarchy for tool configuration:
 * Item requirements > Roster allowances > Student accommodations
 *
 * Ensures IEP/504 compliance by properly handling accommodation requirements
 * while respecting item-level and test-level restrictions.
 *
 * Features:
 * - 3-tier configuration hierarchy
 * - IEP/504 accommodation support
 * - Item-specific tool requirements
 * - Test-level tool restrictions
 * - Type-safe configuration
 *
 * Part of PIE Assessment Toolkit.
 */

/**
 * Tool allowance: "0" = blocked, "1" = allowed
 */
export type ToolAllowance = "0" | "1";

/**
 * Item-level tool configuration (most specific)
 */
export interface ItemToolConfig {
	[toolId: string]: {
		type?: string; // e.g., 'scientific' for calculator
		required?: boolean; // true = must be available
		settings?: any; // tool-specific settings
	};
}

/**
 * Roster/Test-level tool allowances (assessment-wide rules)
 */
export interface RosterToolConfig {
	[toolId: string]: ToolAllowance;
}

/**
 * Student accommodation profile (least specific)
 */
export interface StudentAccommodations {
	accommodations: string[]; // e.g., ['tts', 'calculator', 'extended-time']
}

/**
 * Resolved tool configuration
 */
export interface ResolvedToolConfig {
	enabled: boolean;
	type?: string;
	required?: boolean;
	settings?: any;
	source: "item" | "roster" | "student" | "default";
}

/**
 * Full configuration input
 */
export interface ToolConfigInput {
	itemConfig?: ItemToolConfig;
	rosterConfig?: RosterToolConfig;
	studentProfile?: StudentAccommodations;
}

export class ToolConfigResolver {
	/**
	 * Resolve configuration for a specific tool
	 *
	 * Hierarchy (highest to lowest priority):
	 * 1. Item level: Item requires scientific calculator → must provide
	 * 2. Roster level: Test blocks a tool → blocked regardless of accommodation
	 * 3. Student level: IEP requires TTS → enabled unless blocked above
	 *
	 * @param toolId Tool identifier
	 * @param itemConfig Item-level tool configuration
	 * @param rosterConfig Roster-level tool allowances
	 * @param studentProfile Student accommodation profile
	 * @returns Resolved configuration or null if tool not available
	 */
	resolveTool(
		toolId: string,
		itemConfig?: ItemToolConfig,
		rosterConfig?: RosterToolConfig,
		studentProfile?: StudentAccommodations,
	): ResolvedToolConfig | null {
		// Check item level (highest priority)
		const itemTool = itemConfig?.[toolId];
		if (itemTool) {
			// Item explicitly configures this tool
			return {
				enabled: true,
				type: itemTool.type,
				required: itemTool.required ?? false,
				settings: itemTool.settings,
				source: "item",
			};
		}

		// Check roster level (blocks take precedence)
		const rosterAllowance = rosterConfig?.[toolId];
		if (rosterAllowance === "0") {
			// Roster explicitly blocks this tool
			return null;
		}

		if (rosterAllowance === "1") {
			// Roster allows this tool
			return {
				enabled: true,
				required: false,
				source: "roster",
			};
		}

		// Check student level (lowest priority)
		const hasAccommodation =
			studentProfile?.accommodations.includes(toolId) ?? false;
		if (hasAccommodation) {
			// Student has accommodation for this tool
			return {
				enabled: true,
				required: false,
				source: "student",
			};
		}

		// Tool not configured at any level
		return null;
	}

	/**
	 * Resolve all tools from configuration
	 *
	 * @param input Configuration input
	 * @returns Map of tool ID to resolved configuration
	 */
	resolveAll(input: ToolConfigInput): Map<string, ResolvedToolConfig> {
		const resolved = new Map<string, ResolvedToolConfig>();

		// Collect all tool IDs from all levels
		const allToolIds = new Set<string>();

		// From item config
		if (input.itemConfig) {
			Object.keys(input.itemConfig).forEach((id) => allToolIds.add(id));
		}

		// From roster config
		if (input.rosterConfig) {
			Object.keys(input.rosterConfig).forEach((id) => allToolIds.add(id));
		}

		// From student accommodations
		if (input.studentProfile) {
			input.studentProfile.accommodations.forEach((id) => allToolIds.add(id));
		}

		// Resolve each tool
		for (const toolId of allToolIds) {
			const config = this.resolveTool(
				toolId,
				input.itemConfig,
				input.rosterConfig,
				input.studentProfile,
			);

			if (config) {
				resolved.set(toolId, config);
			}
		}

		return resolved;
	}

	/**
	 * Check if a tool is enabled
	 *
	 * @param toolId Tool identifier
	 * @param input Configuration input
	 * @returns true if tool is enabled
	 */
	isToolEnabled(toolId: string, input: ToolConfigInput): boolean {
		const config = this.resolveTool(
			toolId,
			input.itemConfig,
			input.rosterConfig,
			input.studentProfile,
		);
		return config?.enabled ?? false;
	}

	/**
	 * Check if a tool is required
	 *
	 * @param toolId Tool identifier
	 * @param input Configuration input
	 * @returns true if tool is required
	 */
	isToolRequired(toolId: string, input: ToolConfigInput): boolean {
		const config = this.resolveTool(
			toolId,
			input.itemConfig,
			input.rosterConfig,
			input.studentProfile,
		);
		return config?.required ?? false;
	}

	/**
	 * Get tool type (e.g., 'scientific' for calculator)
	 *
	 * @param toolId Tool identifier
	 * @param input Configuration input
	 * @returns Tool type or null
	 */
	getToolType(toolId: string, input: ToolConfigInput): string | null {
		const config = this.resolveTool(
			toolId,
			input.itemConfig,
			input.rosterConfig,
			input.studentProfile,
		);
		return config?.type ?? null;
	}

	/**
	 * Get tool settings
	 *
	 * @param toolId Tool identifier
	 * @param input Configuration input
	 * @returns Tool settings or null
	 */
	getToolSettings(toolId: string, input: ToolConfigInput): any | null {
		const config = this.resolveTool(
			toolId,
			input.itemConfig,
			input.rosterConfig,
			input.studentProfile,
		);
		return config?.settings ?? null;
	}

	/**
	 * Get list of all enabled tools
	 *
	 * @param input Configuration input
	 * @returns Array of enabled tool IDs
	 */
	getEnabledTools(input: ToolConfigInput): string[] {
		const resolved = this.resolveAll(input);
		return Array.from(resolved.entries())
			.filter(([_, config]) => config.enabled)
			.map(([toolId]) => toolId);
	}

	/**
	 * Get list of required tools
	 *
	 * @param input Configuration input
	 * @returns Array of required tool IDs
	 */
	getRequiredTools(input: ToolConfigInput): string[] {
		const resolved = this.resolveAll(input);
		return Array.from(resolved.entries())
			.filter(([_, config]) => config.required)
			.map(([toolId]) => toolId);
	}

	/**
	 * Validate that all required tools are available
	 *
	 * @param availableTools Set of available tool IDs
	 * @param input Configuration input
	 * @returns Object with validation result
	 */
	validate(
		availableTools: Set<string>,
		input: ToolConfigInput,
	): { valid: boolean; missingTools: string[] } {
		const requiredTools = this.getRequiredTools(input);
		const missingTools = requiredTools.filter(
			(toolId) => !availableTools.has(toolId),
		);

		return {
			valid: missingTools.length === 0,
			missingTools,
		};
	}

	/**
	 * Merge multiple roster configurations (for complex assessments)
	 *
	 * More restrictive settings win (blocked > allowed).
	 *
	 * @param configs Array of roster configurations
	 * @returns Merged configuration
	 */
	mergeRosterConfigs(...configs: RosterToolConfig[]): RosterToolConfig {
		const merged: RosterToolConfig = {};

		for (const config of configs) {
			for (const [toolId, allowance] of Object.entries(config)) {
				// If any config blocks the tool, it's blocked
				if (allowance === "0") {
					merged[toolId] = "0";
				} else if (!merged[toolId]) {
					// If not already set, use this allowance
					merged[toolId] = allowance;
				}
			}
		}

		return merged;
	}

	/**
	 * Merge multiple student accommodation profiles
	 *
	 * Union of all accommodations.
	 *
	 * @param profiles Array of student profiles
	 * @returns Merged profile
	 */
	mergeStudentProfiles(
		...profiles: StudentAccommodations[]
	): StudentAccommodations {
		const allAccommodations = new Set<string>();

		for (const profile of profiles) {
			profile.accommodations.forEach((acc) => allAccommodations.add(acc));
		}

		return {
			accommodations: Array.from(allAccommodations),
		};
	}
}
