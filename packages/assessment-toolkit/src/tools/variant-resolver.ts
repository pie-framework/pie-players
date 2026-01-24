/**
 * Variant Resolver Service
 * Resolves item configuration considering variants for A/B testing, scaffolding, and adaptations
 *
 * Based on architectural enhancements for item-level variant configuration
 */

import type {
	ItemToolConfig,
	ItemToolParameters,
	ResolvedItemConfig,
	ResolvedItemToolParameters,
	ToolConfig,
	VariantContext,
	VariantResolver,
} from "./types";

export class VariantResolverImpl implements VariantResolver {
	/**
	 * Resolve variant configuration for an item
	 */
	resolveVariant(
		itemConfig: ItemToolConfig,
		context: VariantContext,
	): ResolvedItemConfig {
		// If no variant config, return item as-is
		if (!itemConfig.variantConfig) {
			return this._buildResolvedConfig(itemConfig, null, []);
		}

		const { variantConfig } = itemConfig;
		const { variantId, toolOverrides, adaptations } = variantConfig;

		// Apply tool overrides if variant specified
		const resolvedToolParameters: Record<string, ResolvedItemToolParameters> =
			{};

		if (itemConfig.toolParameters) {
			for (const [toolType, params] of Object.entries(
				itemConfig.toolParameters,
			)) {
				resolvedToolParameters[toolType] = this._resolveToolParameters(
					toolType,
					params,
					toolOverrides,
					context,
				);
			}
		}

		// Apply tool overrides that aren't in original tool parameters
		if (toolOverrides) {
			for (const [toolType, override] of Object.entries(toolOverrides)) {
				if (!resolvedToolParameters[toolType]) {
					resolvedToolParameters[toolType] =
						this._createToolParametersFromOverride(toolType, override);
				}
			}
		}

		// Build final resolved config
		return {
			itemId: itemConfig.itemId,
			requiredTools: this._resolveRequiredTools(itemConfig, toolOverrides),
			restrictedTools: itemConfig.restrictedTools || [],
			toolParameters: resolvedToolParameters,
			appliedVariant: variantId,
			appliedAdaptations: this._filterAdaptations(adaptations, context),
		};
	}

	/**
	 * Resolve tool parameters considering variant and context
	 */
	private _resolveToolParameters(
		toolType: string,
		params: ItemToolParameters,
		toolOverrides: Record<string, any> | undefined,
		context: VariantContext,
	): ResolvedItemToolParameters {
		// Start with base parameters
		let finalConfig: Partial<ToolConfig> = params.config || {};
		let finalHint = params.hint;
		let finalPreOpen = params.preOpen;

		// Apply variant-specific parameters if they exist
		if (params.variants) {
			const variantParams = this._selectVariantParameters(
				params.variants,
				context,
			);
			if (variantParams) {
				finalConfig = { ...finalConfig, ...variantParams.config };
				if (variantParams.hint !== undefined) finalHint = variantParams.hint;
				if (variantParams.preOpen !== undefined)
					finalPreOpen = variantParams.preOpen;
			}
		}

		// Apply tool override from variant config
		if (toolOverrides && toolOverrides[toolType]) {
			const override = toolOverrides[toolType];
			if (override.config) {
				finalConfig = { ...finalConfig, ...override.config };
			}
			if (override.parameters) {
				// Merge additional parameters
				finalConfig = { ...finalConfig, ...override.parameters };
			}
		}

		return {
			config: params.config,
			hint: finalHint,
			preOpen: finalPreOpen,
			variants: params.variants,
			finalConfig: finalConfig as ToolConfig,
		};
	}

	/**
	 * Select variant parameters based on context
	 */
	private _selectVariantParameters(
		variants: Record<string, any>,
		context: VariantContext,
	): any | null {
		// Strategy: Select based on context properties

		// 1. Check for scaffolding level match
		if (context.scaffoldingLevel !== undefined) {
			const scaffoldKey = `scaffolding-${context.scaffoldingLevel}`;
			if (variants[scaffoldKey]) return variants[scaffoldKey];
		}

		// 2. Check for difficulty level match
		if (context.difficultyLevel) {
			const difficultyKey = `difficulty-${context.difficultyLevel}`;
			if (variants[difficultyKey]) return variants[difficultyKey];
		}

		// 3. Check for language match
		if (context.language) {
			const langKey = `lang-${context.language}`;
			if (variants[langKey]) return variants[langKey];
		}

		// 4. Check custom context keys
		if (context.custom) {
			for (const [key, value] of Object.entries(context.custom)) {
				const customKey = `${key}-${value}`;
				if (variants[customKey]) return variants[customKey];
			}
		}

		// 5. Check for default variant
		if (variants.default) return variants.default;

		return null;
	}

	/**
	 * Create tool parameters from override
	 */
	private _createToolParametersFromOverride(
		toolType: string,
		override: any,
	): ResolvedItemToolParameters {
		return {
			config: override.config,
			hint: override.hint,
			preOpen: override.preOpen,
			finalConfig: {
				id: toolType,
				name: this._humanizeName(toolType),
				enabled: true,
				...override.config,
			},
		};
	}

	/**
	 * Resolve required tools considering overrides
	 */
	private _resolveRequiredTools(
		itemConfig: ItemToolConfig,
		toolOverrides: Record<string, any> | undefined,
	): string[] {
		const required = new Set<string>(itemConfig.requiredTools || []);

		// Add tools that have replacements via overrides
		if (toolOverrides) {
			for (const [toolType, override] of Object.entries(toolOverrides)) {
				if (override.replacementTool) {
					required.delete(toolType);
					required.add(override.replacementTool);
				}
			}
		}

		return Array.from(required);
	}

	/**
	 * Filter adaptations based on context
	 */
	private _filterAdaptations(
		adaptations: any[] | undefined,
		context: VariantContext,
	): any[] {
		if (!adaptations) return [];

		return adaptations.filter((adaptation) => {
			// Check if adaptation matches context
			if (
				adaptation.type === "scaffolding" &&
				context.scaffoldingLevel !== undefined
			) {
				return adaptation.level === context.scaffoldingLevel;
			}

			if (adaptation.type === "difficulty" && context.difficultyLevel) {
				return adaptation.level === context.difficultyLevel;
			}

			if (adaptation.type === "language" && context.language) {
				return adaptation.level === context.language;
			}

			// Include custom adaptations by default
			return true;
		});
	}

	/**
	 * Build resolved config without variants
	 */
	private _buildResolvedConfig(
		itemConfig: ItemToolConfig,
		variantId: string | null,
		adaptations: any[],
	): ResolvedItemConfig {
		const resolvedToolParameters: Record<string, ResolvedItemToolParameters> =
			{};

		if (itemConfig.toolParameters) {
			for (const [toolType, params] of Object.entries(
				itemConfig.toolParameters,
			)) {
				resolvedToolParameters[toolType] = {
					...params,
					finalConfig: {
						id: toolType,
						name: this._humanizeName(toolType),
						enabled: true,
						...params.config,
					},
				};
			}
		}

		return {
			itemId: itemConfig.itemId,
			requiredTools: itemConfig.requiredTools || [],
			restrictedTools: itemConfig.restrictedTools || [],
			toolParameters: resolvedToolParameters,
			appliedVariant: variantId || undefined,
			appliedAdaptations: adaptations,
		};
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
 * @deprecated Instantiate VariantResolverImpl directly instead:
 *   const resolver = new VariantResolverImpl();
 */
export const variantResolver = new VariantResolverImpl();
