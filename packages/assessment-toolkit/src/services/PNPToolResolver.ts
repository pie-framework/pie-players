/**
 * PNP Tool Resolver
 *
 * Resolves tool availability from QTI 3.0 Personal Needs Profile (PNP) and
 * assessment settings. Implements precedence hierarchy for tool configuration.
 *
 * Precedence (highest to lowest):
 * 1. District block (absolute veto)
 * 2. Test administration override
 * 3. Item restriction (per-item block)
 * 4. Item requirement (forces enable)
 * 5. District requirement
 * 6. PNP supports (student needs)
 *
 * Part of PIE Assessment Toolkit.
 */

import type {
	AssessmentEntity,
	AssessmentItemRef,
	AssessmentSettings,
	ItemSettings,
	PersonalNeedsProfile,
} from "@pie-players/pie-players-shared/types";
import { mapPNPSupportToToolId } from "./PNPMapper";

/**
 * Resolved tool configuration with source tracking
 */
export interface ResolvedToolConfig {
	id: string; // PIE tool ID
	enabled: boolean;
	required?: boolean; // Must be available (item/district requirement)
	alwaysAvailable?: boolean; // PNP support (can't be toggled off)
	settings?: any; // Tool-specific configuration
	source: "district" | "item" | "pnp" | "settings"; // Configuration source
}

/**
 * Internal context for tool resolution
 */
interface ResolutionContext {
	pnp?: PersonalNeedsProfile;
	districtPolicy?: AssessmentSettings["districtPolicy"];
	testAdmin?: AssessmentSettings["testAdministration"];
	itemSettings?: ItemSettings;
	toolConfigs?: AssessmentSettings["toolConfigs"];
}

/**
 * Resolves tool availability from QTI 3.0 assessment structure
 */
export class PNPToolResolver {
	/**
	 * Resolve all tools from QTI 3.0 assessment + optional item context
	 *
	 * @param assessment QTI 3.0 assessment with personalNeedsProfile
	 * @param currentItemRef Current item for item-specific requirements (optional)
	 * @returns Array of resolved tool configurations
	 *
	 * @example
	 * const resolver = new PNPToolResolver();
	 * const tools = resolver.resolveTools(assessment, itemRef);
	 * tools.forEach(tool => {
	 *   console.log(`${tool.id}: ${tool.enabled ? 'enabled' : 'disabled'}`);
	 * });
	 */
	resolveTools(
		assessment: AssessmentEntity,
		currentItemRef?: AssessmentItemRef,
	): ResolvedToolConfig[] {
		const pnp = assessment.personalNeedsProfile;
		const settings = assessment.settings as AssessmentSettings;
		const itemSettings = currentItemRef?.settings as ItemSettings;

		// Collect all PNP support IDs mentioned anywhere
		const allSupports = new Set<string>();
		pnp?.supports?.forEach((s) => allSupports.add(s));
		settings?.districtPolicy?.blockedTools?.forEach((s) => allSupports.add(s));
		settings?.districtPolicy?.requiredTools?.forEach((s) => allSupports.add(s));
		itemSettings?.requiredTools?.forEach((s) => allSupports.add(s));
		itemSettings?.restrictedTools?.forEach((s) => allSupports.add(s));

		const resolved: ResolvedToolConfig[] = [];

		for (const supportId of allSupports) {
			const config = this.resolveSupport(supportId, {
				pnp,
				districtPolicy: settings?.districtPolicy,
				testAdmin: settings?.testAdministration,
				itemSettings,
				toolConfigs: settings?.toolConfigs,
			});

			if (config) {
				resolved.push(config);
			}
		}

		return resolved;
	}

	/**
	 * Resolve availability of a single PNP support
	 *
	 * Applies precedence rules to determine if support should be enabled.
	 *
	 * @param supportId PNP support identifier
	 * @param context Resolution context with all configuration sources
	 * @returns Resolved config or null if blocked/disabled
	 */
	private resolveSupport(
		supportId: string,
		context: ResolutionContext,
	): ResolvedToolConfig | null {
		// Precedence (highest to lowest):

		// 1. District block (absolute veto)
		if (context.districtPolicy?.blockedTools?.includes(supportId)) {
			return null; // Blocked
		}

		// 2. Test administration override
		if (context.testAdmin?.toolOverrides?.[supportId] === false) {
			return null; // Blocked
		}

		// 3. Item restriction
		if (context.itemSettings?.restrictedTools?.includes(supportId)) {
			return null; // Blocked for this item
		}

		// 4. Item requirement (forces enable)
		if (context.itemSettings?.requiredTools?.includes(supportId)) {
			return this.buildToolConfig(supportId, context, {
				required: true,
				source: "item",
			});
		}

		// 5. District requirement
		if (context.districtPolicy?.requiredTools?.includes(supportId)) {
			return this.buildToolConfig(supportId, context, {
				required: true,
				source: "district",
			});
		}

		// 6. PNP supports (student needs)
		if (context.pnp?.supports?.includes(supportId)) {
			// Check if prohibited
			const isProhibited = context.pnp.prohibitedSupports?.includes(supportId);

			if (!isProhibited) {
				return this.buildToolConfig(supportId, context, {
					alwaysAvailable: true,
					source: "pnp",
				});
			}
		}

		// Not enabled
		return null;
	}

	/**
	 * Build resolved tool configuration
	 *
	 * Maps PNP support ID to PIE tool ID and merges tool-specific settings.
	 *
	 * @param supportId PNP support identifier
	 * @param context Resolution context for settings lookup
	 * @param flags Availability flags (required, alwaysAvailable, source)
	 * @returns Complete resolved tool configuration
	 */
	private buildToolConfig(
		supportId: string,
		context: ResolutionContext,
		flags: {
			required?: boolean;
			alwaysAvailable?: boolean;
			source: string;
		},
	): ResolvedToolConfig {
		// Map PNP support ID to PIE tool ID
		const pieToolId = mapPNPSupportToToolId(supportId) || supportId;

		// Get tool-specific config from settings (item takes precedence)
		const toolConfig =
			context.itemSettings?.toolParameters?.[supportId] ||
			context.toolConfigs?.[supportId];

		return {
			id: pieToolId,
			enabled: true,
			required: flags.required || false,
			alwaysAvailable: flags.alwaysAvailable || false,
			settings: toolConfig,
			source: flags.source as any,
		};
	}

	/**
	 * Check if a specific tool is enabled
	 *
	 * @param toolId PIE tool identifier (e.g., 'pie-tool-calculator')
	 * @param assessment Assessment with PNP
	 * @param itemRef Optional item context
	 * @returns true if tool is enabled
	 */
	isToolEnabled(
		toolId: string,
		assessment: AssessmentEntity,
		itemRef?: AssessmentItemRef,
	): boolean {
		const resolved = this.resolveTools(assessment, itemRef);
		return resolved.some((t) => t.id === toolId && t.enabled);
	}

	/**
	 * Check if a tool is required (cannot be disabled)
	 *
	 * @param toolId PIE tool identifier
	 * @param assessment Assessment with PNP
	 * @param itemRef Optional item context
	 * @returns true if tool is required or always available
	 */
	isToolRequired(
		toolId: string,
		assessment: AssessmentEntity,
		itemRef?: AssessmentItemRef,
	): boolean {
		const resolved = this.resolveTools(assessment, itemRef);
		const tool = resolved.find((t) => t.id === toolId);
		return tool?.required || tool?.alwaysAvailable || false;
	}

	/**
	 * Get list of auto-activate tools from PNP
	 *
	 * Returns PIE tool IDs that should be automatically opened/activated
	 * when the assessment starts, based on PNP activateAtInit field.
	 *
	 * @param assessment Assessment with PNP
	 * @returns Array of PIE tool IDs to auto-activate
	 *
	 * @example
	 * const autoActivate = resolver.getAutoActivateTools(assessment);
	 * // Returns: ['pie-tool-text-to-speech', 'pie-tool-line-reader']
	 */
	getAutoActivateTools(assessment: AssessmentEntity): string[] {
		const pnp = assessment.personalNeedsProfile;
		if (!pnp?.activateAtInit) return [];

		return pnp.activateAtInit
			.map((supportId) => mapPNPSupportToToolId(supportId))
			.filter(Boolean) as string[];
	}

	/**
	 * Get all enabled tools
	 *
	 * @param assessment Assessment with PNP
	 * @param itemRef Optional item context
	 * @returns Array of PIE tool IDs that are enabled
	 */
	getEnabledTools(
		assessment: AssessmentEntity,
		itemRef?: AssessmentItemRef,
	): string[] {
		const resolved = this.resolveTools(assessment, itemRef);
		return resolved.filter((t) => t.enabled).map((t) => t.id);
	}

	/**
	 * Get all required tools
	 *
	 * @param assessment Assessment with PNP
	 * @param itemRef Optional item context
	 * @returns Array of PIE tool IDs that are required
	 */
	getRequiredTools(
		assessment: AssessmentEntity,
		itemRef?: AssessmentItemRef,
	): string[] {
		const resolved = this.resolveTools(assessment, itemRef);
		return resolved
			.filter((t) => t.required || t.alwaysAvailable)
			.map((t) => t.id);
	}

	/**
	 * Get tool configuration settings
	 *
	 * @param toolId PIE tool identifier
	 * @param assessment Assessment with PNP
	 * @param itemRef Optional item context
	 * @returns Tool-specific settings or null if not found
	 */
	getToolSettings(
		toolId: string,
		assessment: AssessmentEntity,
		itemRef?: AssessmentItemRef,
	): any | null {
		const resolved = this.resolveTools(assessment, itemRef);
		const tool = resolved.find((t) => t.id === toolId);
		return tool?.settings || null;
	}
}
