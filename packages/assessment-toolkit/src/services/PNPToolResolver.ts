/**
 * PNP Tool Resolver
 *
 * Resolves tool availability from QTI 3.0 Personal Needs Profile (PNP) and
 * assessment settings. Implements a precedence hierarchy for tool configuration
 * based on common assessment platform governance patterns.
 *
 * PRECEDENCE HIERARCHY (highest to lowest):
 * ==========================================
 *
 * Standards-Based (QTI 3.0):
 * - PNP supports (#6): Student's documented accessibility needs (accessibilityInfo.accessFeature)
 * - Item-level settings (#3, #4): Per-item accessibility requirements/restrictions
 *
 * Implementation-Specific (Common Practice):
 * - District policy (#1, #5): Institutional governance and legal compliance
 * - Test administration (#2): Session-level operational control
 *
 * The hierarchy itself is NOT defined by QTI 3.0 standards but follows common
 * patterns in K-12 assessment platforms, aligning with US IEP/504 accommodation
 * hierarchies where legal requirements and institutional policies take precedence.
 *
 * Precedence Order:
 * 1. District block (absolute veto) - Legal/policy requirements
 * 2. Test administration override - Proctor/administrator operational control
 * 3. Item restriction (per-item block) - Content author can disable for specific items
 * 4. Item requirement (forces enable) - Required by IEP/504 or content needs
 * 5. District requirement - Institutional accessibility requirements
 * 6. PNP supports (student needs) - QTI 3.0 standard student preferences
 *
 * Governance Context:
 * - Institutional veto (district) trumps individual preferences (legal compliance)
 * - Session control (test admin) enables operational flexibility
 * - Content restrictions (item) prevent tools that invalidate assessment
 * - Required accommodations (IEP/504) ensure legal compliance
 * - Student preferences (PNP) are honored when not overridden
 *
 * References:
 * - QTI 3.0: https://www.imsglobal.org/spec/qti/v3p0
 * - IMS AfA 3.0: https://www.imsglobal.org/spec/afa/v3p0
 * - Common assessment platform governance patterns (not standardized)
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
import type { ToolRegistry } from "./ToolRegistry";
import {
	PNPProvenanceBuilder,
	type PNPResolutionProvenance,
} from "./pnp-provenance";

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
 * Resolution result with provenance tracking
 */
export interface ToolResolutionResult {
	/** Resolved tool configurations */
	tools: ResolvedToolConfig[];

	/** Complete provenance trail (for debugging/display) */
	provenance: PNPResolutionProvenance;
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
	private toolRegistry: ToolRegistry;
	private enableProvenance: boolean;

	/**
	 * Create a PNPToolResolver
	 *
	 * @param toolRegistry Tool registry for PNP support mapping
	 * @param enableProvenance Enable detailed provenance tracking (default: true)
	 */
	constructor(toolRegistry: ToolRegistry, enableProvenance = true) {
		this.toolRegistry = toolRegistry;
		this.enableProvenance = enableProvenance;
	}

	/**
	 * Resolve all tools from QTI 3.0 assessment + optional item context
	 *
	 * @param assessment QTI 3.0 assessment with personalNeedsProfile
	 * @param currentItemRef Current item for item-specific requirements (optional)
	 * @returns Array of resolved tool configurations (for backward compatibility)
	 *
	 * @deprecated Use resolveToolsWithProvenance() to get provenance tracking
	 *
	 * @example
	 * const resolver = new PNPToolResolver(registry);
	 * const tools = resolver.resolveTools(assessment, itemRef);
	 * tools.forEach(tool => {
	 *   console.log(`${tool.id}: ${tool.enabled ? 'enabled' : 'disabled'}`);
	 * });
	 */
	resolveTools(
		assessment: AssessmentEntity,
		currentItemRef?: AssessmentItemRef,
	): ResolvedToolConfig[] {
		const result = this.resolveToolsWithProvenance(assessment, currentItemRef);
		return result.tools;
	}

	/**
	 * Resolve all tools with full provenance tracking
	 *
	 * Returns both resolved tools and complete provenance trail showing:
	 * - All configuration sources consulted
	 * - Decision steps at each precedence level
	 * - Reasons for enabling/blocking each feature
	 * - Human-readable explanations
	 *
	 * @param assessment QTI 3.0 assessment with personalNeedsProfile
	 * @param currentItemRef Current item for item-specific requirements (optional)
	 * @returns Resolution result with tools and provenance
	 *
	 * @example
	 * const resolver = new PNPToolResolver(registry);
	 * const result = resolver.resolveToolsWithProvenance(assessment, itemRef);
	 *
	 * // Use resolved tools
	 * result.tools.forEach(tool => console.log(tool.id, tool.enabled));
	 *
	 * // Display provenance to user
	 * console.log(result.provenance.summary);
	 * result.provenance.features.forEach((trail, featureId) => {
	 *   console.log(`${featureId}: ${trail.explanation}`);
	 * });
	 */
	resolveToolsWithProvenance(
		assessment: AssessmentEntity,
		currentItemRef?: AssessmentItemRef,
	): ToolResolutionResult {
		const pnp = assessment.personalNeedsProfile;
		const settings = assessment.settings as AssessmentSettings;
		const itemSettings = currentItemRef?.settings as ItemSettings;

		// Initialize provenance builder
		const contextId = `assessment-${assessment.id || "unknown"}${currentItemRef ? `-item-${currentItemRef.identifier}` : ""}`;
		const provenanceBuilder = this.enableProvenance
			? new PNPProvenanceBuilder(contextId)
			: null;

		// Record configuration sources
		if (provenanceBuilder) {
			if (settings?.districtPolicy || settings?.testAdministration) {
				provenanceBuilder.addSource("assessment", {
					id: assessment.id || "unknown",
					name: assessment.name || assessment.id || "Assessment",
					config: settings,
				});
			}

			if (pnp) {
				provenanceBuilder.addSource("student", {
					id: "student", // Would come from session context
					name: "Student PNP Profile",
					config: pnp,
				});
			}

			if (currentItemRef && itemSettings) {
				provenanceBuilder.addSource("item", {
					id: currentItemRef.identifier,
					name: currentItemRef.identifier,
					config: itemSettings,
				});
			}
		}

		// Collect all PNP support IDs mentioned anywhere
		const allSupports = new Set<string>();
		pnp?.supports?.forEach((s) => allSupports.add(s));
		settings?.districtPolicy?.blockedTools?.forEach((s) => allSupports.add(s));
		settings?.districtPolicy?.requiredTools?.forEach((s) => allSupports.add(s));
		itemSettings?.requiredTools?.forEach((s) => allSupports.add(s));
		itemSettings?.restrictedTools?.forEach((s) => allSupports.add(s));

		const resolved: ResolvedToolConfig[] = [];
		const context: ResolutionContext = {
			pnp,
			districtPolicy: settings?.districtPolicy,
			testAdmin: settings?.testAdministration,
			itemSettings,
			toolConfigs: settings?.toolConfigs,
		};

		for (const supportId of allSupports) {
			const config = this.resolveSupport(supportId, context, provenanceBuilder);

			if (config) {
				resolved.push(config);
			}
		}

		return {
			tools: resolved,
			provenance: provenanceBuilder
				? provenanceBuilder.build()
				: this.createEmptyProvenance(contextId),
		};
	}

	/**
	 * Resolve availability of a single PNP support
	 *
	 * Applies precedence rules to determine if support should be enabled.
	 *
	 * @param supportId PNP support identifier
	 * @param context Resolution context with all configuration sources
	 * @param provenanceBuilder Provenance tracking (optional)
	 * @returns Resolved config or null if blocked/disabled
	 */
	private resolveSupport(
		supportId: string,
		context: ResolutionContext,
		provenanceBuilder: PNPProvenanceBuilder | null,
	): ResolvedToolConfig | null {
		// Precedence (highest to lowest):

		// 1. District block (absolute veto)
		if (context.districtPolicy?.blockedTools?.includes(supportId)) {
			provenanceBuilder?.addDecision({
				precedence: 1,
				rule: "district-block",
				featureId: supportId,
				action: "block",
				sourceType: "assessment",
				reason: `District policy blocks "${supportId}" for all assessments`,
				value: context.districtPolicy.blockedTools,
			});
			return null; // Blocked
		}

		// 2. Test administration override
		if (context.testAdmin?.toolOverrides?.[supportId] === false) {
			provenanceBuilder?.addDecision({
				precedence: 2,
				rule: "test-admin-override",
				featureId: supportId,
				action: "block",
				sourceType: "assessment",
				reason: `Test administrator disabled "${supportId}" for this session`,
				value: context.testAdmin.toolOverrides,
			});
			return null; // Blocked
		}

		// 3. Item restriction
		if (context.itemSettings?.restrictedTools?.includes(supportId)) {
			provenanceBuilder?.addDecision({
				precedence: 3,
				rule: "item-restriction",
				featureId: supportId,
				action: "block",
				sourceType: "item",
				reason: `Item restricts "${supportId}" (e.g., mental math question blocks calculator)`,
				value: context.itemSettings.restrictedTools,
			});
			return null; // Blocked for this item
		}

		// 4. Item requirement (forces enable)
		if (context.itemSettings?.requiredTools?.includes(supportId)) {
			provenanceBuilder?.addDecision({
				precedence: 4,
				rule: "item-requirement",
				featureId: supportId,
				action: "enable",
				sourceType: "item",
				reason: `Item requires "${supportId}" for this question`,
				value: context.itemSettings.requiredTools,
			});
			return this.buildToolConfig(supportId, context, {
				required: true,
				source: "item",
			});
		}

		// 5. District requirement
		if (context.districtPolicy?.requiredTools?.includes(supportId)) {
			provenanceBuilder?.addDecision({
				precedence: 5,
				rule: "district-requirement",
				featureId: supportId,
				action: "enable",
				sourceType: "assessment",
				reason: `District policy requires "${supportId}" for all assessments`,
				value: context.districtPolicy.requiredTools,
			});
			return this.buildToolConfig(supportId, context, {
				required: true,
				source: "district",
			});
		}

		// 6. PNP supports (student needs)
		if (context.pnp?.supports?.includes(supportId)) {
			// Check if prohibited
			const isProhibited = context.pnp.prohibitedSupports?.includes(supportId);

			if (isProhibited) {
				provenanceBuilder?.addDecision({
					precedence: 6,
					rule: "pnp-support",
					featureId: supportId,
					action: "block",
					sourceType: "student",
					reason: `Student PNP profile prohibits "${supportId}"`,
					value: context.pnp.prohibitedSupports,
				});
				return null;
			}

			provenanceBuilder?.addDecision({
				precedence: 6,
				rule: "pnp-support",
				featureId: supportId,
				action: "enable",
				sourceType: "student",
				reason: `Student PNP profile requests "${supportId}"`,
				value: context.pnp.supports,
			});

			return this.buildToolConfig(supportId, context, {
				alwaysAvailable: true,
				source: "pnp",
			});
		}

		// Not enabled - log as skipped
		provenanceBuilder?.addDecision({
			precedence: 6,
			rule: "pnp-support",
			featureId: supportId,
			action: "skip",
			sourceType: "system",
			reason: `Feature "${supportId}" not configured at any level`,
		});

		return null;
	}

	/**
	 * Create empty provenance when tracking is disabled
	 */
	private createEmptyProvenance(contextId: string): PNPResolutionProvenance {
		return {
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
		// Map PNP support ID to PIE tool ID via registry
		const toolIds = this.toolRegistry.getToolsByPNPSupport(supportId);

		// Use first matching tool (usually only one per PNP support)
		// If no mapping exists, use the support ID directly as tool ID
		const pieToolId = toolIds.size > 0 ? Array.from(toolIds)[0] : supportId;

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
	 * @param toolId Toolkit tool identifier (e.g., 'calculator')
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
	 * @param toolId Toolkit tool identifier
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
	 * // Returns: ['textToSpeech', 'lineReader']
	 */
	getAutoActivateTools(assessment: AssessmentEntity): string[] {
		const pnp = assessment.personalNeedsProfile;
		if (!pnp?.activateAtInit) return [];

		return pnp.activateAtInit
			.map((supportId) => {
				const toolIds = this.toolRegistry.getToolsByPNPSupport(supportId);
				return toolIds.size > 0 ? Array.from(toolIds)[0] : null;
			})
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
	 * Get allowed tool IDs (Pass 1 of two-pass visibility model)
	 *
	 * Returns tool IDs that pass orchestrator-level checks (PNP + policies + settings).
	 * This is the first gate - tools still need to pass Pass 2 (relevance check).
	 *
	 * This is the primary method to use with ToolRegistry.filterVisibleInContext()
	 *
	 * @param assessment Assessment with PNP
	 * @param itemRef Optional item context
	 * @returns Array of allowed tool IDs (Pass 1)
	 *
	 * @example
	 * // Two-pass visibility model
	 * const allowedToolIds = resolver.getAllowedToolIds(assessment, itemRef);
	 * const visibleTools = toolRegistry.filterVisibleInContext(allowedToolIds, context);
	 */
	getAllowedToolIds(
		assessment: AssessmentEntity,
		itemRef?: AssessmentItemRef,
	): string[] {
		return this.getEnabledTools(assessment, itemRef);
	}

	/**
	 * Resolve tools with a test/override PNP profile
	 *
	 * FOR TESTING/DEVELOPMENT ONLY
	 *
	 * Allows direct injection of a PNP profile for testing accessibility configurations
	 * without modifying the assessment entity. The override profile replaces the
	 * assessment's personalNeedsProfile entirely.
	 *
	 * Use cases:
	 * - Development/testing UI for trying different profiles
	 * - Automated testing with various accessibility configurations
	 * - Preview tools with profile simulation
	 * - Accessibility team testing and validation
	 *
	 * @param assessment Base assessment (settings, policies, etc.)
	 * @param overrideProfile PNP profile to inject (replaces assessment.personalNeedsProfile)
	 * @param itemRef Optional item context
	 * @returns Resolution result with tools and provenance
	 *
	 * @example
	 * // Test with low vision profile
	 * const testProfile = {
	 *   supports: ['magnification', 'textToSpeech', 'highContrastDisplay']
	 * };
	 * const result = resolver.resolveWithOverride(assessment, testProfile);
	 *
	 * @example
	 * // Test with null profile (no accessibility features)
	 * const result = resolver.resolveWithOverride(assessment, null);
	 */
	resolveWithOverride(
		assessment: AssessmentEntity,
		overrideProfile: PersonalNeedsProfile | null,
		itemRef?: AssessmentItemRef,
	): ToolResolutionResult {
		// Create assessment clone with overridden PNP
		const testAssessment: AssessmentEntity = {
			...assessment,
			personalNeedsProfile: overrideProfile || undefined,
		};

		return this.resolveToolsWithProvenance(testAssessment, itemRef);
	}

	/**
	 * Get allowed tool IDs with full provenance tracking
	 *
	 * Returns both tool IDs and complete resolution provenance for debugging,
	 * auditing, and displaying to users.
	 *
	 * @param assessment Assessment with PNP
	 * @param itemRef Optional item context
	 * @returns Object with tool IDs and provenance
	 *
	 * @example
	 * const result = resolver.getAllowedToolIdsWithProvenance(assessment, itemRef);
	 *
	 * // Use tool IDs
	 * const visibleTools = toolRegistry.filterVisibleInContext(result.toolIds, context);
	 *
	 * // Display provenance to user
	 * console.log('Resolution Summary:', result.provenance.summary);
	 * console.log('Explanation for calculator:', result.provenance.features.get('calculator')?.explanation);
	 */
	getAllowedToolIdsWithProvenance(
		assessment: AssessmentEntity,
		itemRef?: AssessmentItemRef,
	): { toolIds: string[]; provenance: PNPResolutionProvenance } {
		const result = this.resolveToolsWithProvenance(assessment, itemRef);
		return {
			toolIds: result.tools.map((t) => t.id),
			provenance: result.provenance,
		};
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
	 * @param toolId Toolkit tool identifier
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
