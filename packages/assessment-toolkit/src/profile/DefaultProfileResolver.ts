/**
 * Default Profile Resolver
 *
 * Provides a default implementation of ProfileResolver with sensible defaults
 * and common precedence rules. Products can:
 * 1. Use this directly
 * 2. Extend this and override specific methods
 * 3. Implement ProfileResolver from scratch
 */

import type {
	AssessmentContextProfile,
	ProfileResolver,
	ResolutionContext,
	ResolutionExplanation,
	ResolvedAccessibilitySettings,
	ResolvedLayoutPreferences,
	ResolvedThemeConfig,
	ResolvedToolSet,
	ToolAvailability,
	ToolResolution,
	ToolSpecificConfig,
} from "./interfaces";

export class DefaultProfileResolver implements ProfileResolver {
	/**
	 * Resolve a complete profile from the given context
	 */
	async resolve(context: ResolutionContext): Promise<AssessmentContextProfile> {
		const tools = await this.resolveTools(context);
		const theme = await this.resolveTheme(context);
		const layout = await this.resolveLayout(context);
		const accessibility = await this.resolveAccessibility(context);

		return {
			profileId: this.generateProfileId(context),
			studentId: context.student?.id,
			assessmentId: context.assessment.id,
			administrationId: context.administration?.id,
			tools,
			theme,
			layout,
			accessibility,
			metadata: {
				createdAt: new Date(),
				createdBy: "DefaultProfileResolver",
				version: "1.0.0",
				inputSources: this.getInputSources(context),
			},
		};
	}

	/**
	 * Resolve tools with default precedence rules
	 *
	 * Default precedence (highest to lowest):
	 * 1. District block (absolute veto)
	 * 2. Administration override
	 * 3. Item restriction
	 * 4. Item requirement
	 * 5. Student IEP/504
	 * 6. Student accommodation profile
	 * 7. Assessment default
	 * 8. System default
	 */
	async resolveTools(context: ResolutionContext): Promise<ResolvedToolSet> {
		const allToolIds = this.collectAllToolIds(context);
		const available: ToolAvailability[] = [];
		const resolutionTrace = new Map<string, ResolutionExplanation>();

		for (const toolId of allToolIds) {
			const resolution = this.resolveToolAvailability(toolId, context);

			if (resolution.enabled || resolution.required) {
				available.push({
					toolId,
					enabled: resolution.enabled,
					required: resolution.required,
					alwaysAvailable: resolution.alwaysAvailable,
					restricted: resolution.restricted,
					config: resolution.config,
				});
			}

			if (resolution.explanation) {
				resolutionTrace.set(toolId, resolution.explanation);
			}
		}

		return {
			available,
			resolutionTrace,
		};
	}

	/**
	 * Resolve theme configuration
	 *
	 * Precedence:
	 * 1. Student IEP/504 requirements
	 * 2. Student preferences
	 * 3. Administration overrides
	 * 4. Assessment defaults
	 * 5. Organization defaults
	 * 6. System defaults
	 */
	async resolveTheme(context: ResolutionContext): Promise<ResolvedThemeConfig> {
		const theme: ResolvedThemeConfig = {};

		// Start with system defaults
		Object.assign(theme, this.getSystemDefaultTheme());

		// Apply organization defaults
		if (context.organization?.defaultTheme) {
			Object.assign(theme, context.organization.defaultTheme);
		}

		// Apply assessment defaults
		if (context.assessment.defaultTheme) {
			Object.assign(theme, context.assessment.defaultTheme);
		}

		// Apply administration overrides
		if (context.administration?.themeOverrides) {
			Object.assign(theme, context.administration.themeOverrides);
		}

		// Apply student preferences
		if (context.student?.preferences?.preferredTheme) {
			Object.assign(theme, context.student.preferences.preferredTheme);
		}

		// Apply IEP/504 requirements (highest priority)
		if (context.student?.iep?.themeRequirements) {
			Object.assign(theme, context.student.iep.themeRequirements);
		}
		if (context.student?.section504?.themeRequirements) {
			Object.assign(theme, context.student.section504.themeRequirements);
		}

		return theme;
	}

	/**
	 * Resolve layout preferences
	 */
	async resolveLayout(
		context: ResolutionContext,
	): Promise<ResolvedLayoutPreferences> {
		const layout: ResolvedLayoutPreferences = {};

		// Start with assessment default
		if (context.assessment.defaultLayout) {
			layout.preferredTemplate = context.assessment.defaultLayout;
		}

		// Apply student preferences
		if (context.student?.preferences?.preferredLayout) {
			layout.preferredTemplate = context.student.preferences.preferredLayout;
		}

		// Default: allow template selection unless explicitly disabled
		layout.allowTemplateSelection = true;

		return layout;
	}

	/**
	 * Resolve accessibility settings
	 */
	async resolveAccessibility(
		context: ResolutionContext,
	): Promise<ResolvedAccessibilitySettings> {
		const accessibility: ResolvedAccessibilitySettings = {
			screenReaderOptimized: false,
			keyboardNavigationEnhanced: false,
			focusIndicatorStyle: "default",
			skipLinks: true,
			ariaLiveRegions: true,
		};

		// Check for IEP/504 accessibility requirements
		if (context.student?.iep || context.student?.section504) {
			accessibility.screenReaderOptimized = true;
			accessibility.keyboardNavigationEnhanced = true;
			accessibility.focusIndicatorStyle = "enhanced";
		}

		return accessibility;
	}

	/**
	 * Resolve availability for a specific tool
	 *
	 * Override this method to customize tool resolution logic
	 */
	protected resolveToolAvailability(
		toolId: string,
		context: ResolutionContext,
	): ToolResolution {
		const reasons: string[] = [];
		const sources: string[] = [];
		const precedenceOrder: string[] = [];

		// 1. Check district block (absolute veto)
		if (context.district?.blockedTools?.includes(toolId)) {
			return {
				enabled: false,
				restricted: true,
				explanation: {
					toolId,
					decision: "blocked",
					reasons: ["Tool blocked by district policy"],
					sources: ["District Policy"],
					precedenceOrder: ["district-block"],
				},
			};
		}

		// 2. Check administration override
		if (context.administration?.toolOverrides?.[toolId] === false) {
			return {
				enabled: false,
				restricted: true,
				explanation: {
					toolId,
					decision: "blocked",
					reasons: ["Tool disabled for this administration"],
					sources: ["Administration Override"],
					precedenceOrder: ["district-block", "administration-override"],
				},
			};
		}

		// 3. Check item restriction
		if (context.item?.restrictedTools?.includes(toolId)) {
			return {
				enabled: false,
				restricted: true,
				explanation: {
					toolId,
					decision: "blocked",
					reasons: ["Tool restricted for this specific item"],
					sources: ["Item Configuration"],
					precedenceOrder: [
						"district-block",
						"administration-override",
						"item-restriction",
					],
				},
			};
		}

		// 4. Check item requirement (forces tool to be enabled)
		if (context.item?.requiredTools?.includes(toolId)) {
			const config = this.buildToolConfig(toolId, context);
			return {
				enabled: true,
				required: true,
				config,
				explanation: {
					toolId,
					decision: "required",
					reasons: ["Tool required for this item"],
					sources: ["Item Configuration"],
					precedenceOrder: [
						"district-block",
						"administration-override",
						"item-restriction",
						"item-requirement",
					],
				},
			};
		}

		// 5. Check student IEP/504
		if (
			context.student?.iep?.requiredTools?.includes(toolId) ||
			context.student?.section504?.requiredTools?.includes(toolId)
		) {
			const config = this.buildToolConfig(toolId, context);
			return {
				enabled: true,
				required: true,
				alwaysAvailable: true,
				config,
				explanation: {
					toolId,
					decision: "required",
					reasons: ["Tool required by IEP/504 plan"],
					sources: ["IEP/504"],
					precedenceOrder: [
						"district-block",
						"administration-override",
						"item-restriction",
						"item-requirement",
						"iep-504",
					],
				},
			};
		}

		// 6. Check student accommodation profile
		if (context.student?.accommodations?.[toolId] === true) {
			const config = this.buildToolConfig(toolId, context);
			return {
				enabled: true,
				config,
				explanation: {
					toolId,
					decision: "allowed",
					reasons: ["Tool enabled via student accommodation profile"],
					sources: ["Student Accommodations"],
					precedenceOrder: [
						"district-block",
						"administration-override",
						"item-restriction",
						"item-requirement",
						"iep-504",
						"student-accommodation",
					],
				},
			};
		}

		// 7. Check assessment default
		if (context.assessment.defaultTools?.includes(toolId)) {
			const config = this.buildToolConfig(toolId, context);
			return {
				enabled: true,
				config,
				explanation: {
					toolId,
					decision: "allowed",
					reasons: ["Tool enabled by assessment default configuration"],
					sources: ["Assessment Configuration"],
					precedenceOrder: [
						"district-block",
						"administration-override",
						"item-restriction",
						"item-requirement",
						"iep-504",
						"student-accommodation",
						"assessment-default",
					],
				},
			};
		}

		// 8. System default (not enabled unless explicitly configured)
		return {
			enabled: false,
			explanation: {
				toolId,
				decision: "blocked",
				reasons: ["Tool not configured in any source"],
				sources: ["System Default"],
				precedenceOrder: [
					"district-block",
					"administration-override",
					"item-restriction",
					"item-requirement",
					"iep-504",
					"student-accommodation",
					"assessment-default",
					"system-default",
				],
			},
		};
	}

	/**
	 * Build tool-specific configuration
	 *
	 * Override this to customize tool configuration logic
	 */
	protected buildToolConfig(
		toolId: string,
		context: ResolutionContext,
	): ToolSpecificConfig | undefined {
		const config: ToolSpecificConfig = {};

		// Get item-specific tool parameters if available
		if (context.item?.toolParameters?.[toolId]) {
			Object.assign(config, context.item.toolParameters[toolId]);
		}

		// Get student accommodation settings
		const studentConfig = context.student?.accommodations?.[toolId];
		if (typeof studentConfig === "object" && studentConfig !== null) {
			Object.assign(config, studentConfig);
		}

		return Object.keys(config).length > 0 ? config : undefined;
	}

	/**
	 * Collect all tool IDs mentioned in any configuration source
	 */
	protected collectAllToolIds(context: ResolutionContext): Set<string> {
		const toolIds = new Set<string>();

		// From district
		context.district?.blockedTools?.forEach((id) => toolIds.add(id));
		context.district?.requiredTools?.forEach((id) => toolIds.add(id));

		// From organization
		context.organization?.allowedTools?.forEach((id) => toolIds.add(id));

		// From assessment
		context.assessment.defaultTools?.forEach((id) => toolIds.add(id));

		// From administration
		if (context.administration?.toolOverrides) {
			Object.keys(context.administration.toolOverrides).forEach((id) =>
				toolIds.add(id),
			);
		}

		// From student
		if (context.student?.accommodations) {
			Object.keys(context.student.accommodations).forEach((id) =>
				toolIds.add(id),
			);
		}
		context.student?.iep?.requiredTools?.forEach((id) => toolIds.add(id));
		context.student?.section504?.requiredTools?.forEach((id) =>
			toolIds.add(id),
		);

		// From item
		context.item?.requiredTools?.forEach((id) => toolIds.add(id));
		context.item?.restrictedTools?.forEach((id) => toolIds.add(id));
		if (context.item?.toolParameters) {
			Object.keys(context.item.toolParameters).forEach((id) => toolIds.add(id));
		}

		return toolIds;
	}

	/**
	 * Generate a unique profile ID
	 */
	protected generateProfileId(context: ResolutionContext): string {
		const parts = [
			context.assessment.id,
			context.student?.id || "anonymous",
			context.administration?.id || "default",
			Date.now(),
		];
		return parts.join("-");
	}

	/**
	 * Get list of input sources used in resolution
	 */
	protected getInputSources(context: ResolutionContext): string[] {
		const sources: string[] = ["assessment"];

		if (context.student) sources.push("student");
		if (context.administration) sources.push("administration");
		if (context.item) sources.push("item");
		if (context.district) sources.push("district");
		if (context.organization) sources.push("organization");

		return sources;
	}

	/**
	 * Get system default theme
	 */
	protected getSystemDefaultTheme(): ResolvedThemeConfig {
		return {
			colorScheme: "default",
			fontSize: 16,
			fontFamily: "system-ui, -apple-system, sans-serif",
			lineHeight: 1.5,
			highContrast: false,
			reducedMotion: false,
		};
	}
}
