/**
 * Tool Context Types
 *
 * Defines the context types passed to tools for making visibility and behavior decisions.
 * Each context level provides increasingly specific information about where the tool is being used.
 */

import type {
	AssessmentEntity,
	AssessmentItemRef,
	AssessmentSection,
	ItemEntity,
	PassageEntity,
	RubricBlock,
} from "@pie-players/pie-players-shared/types";

/**
 * Tool placement levels - where a tool can appear in the UI
 */
export type ToolLevel =
	| "assessment" // Assessment-wide tools (e.g., global calculator)
	| "section" // Section toolbar tools
	| "item" // Item-level tools (question toolbar)
	| "passage" // Passage header tools (stimulus rubric blocks)
	| "rubric" // Rubric block tools (instructions, rubrics)
	| "element"; // Element-specific tools (inline with interaction)

/**
 * Base context available to all tools
 */
export interface BaseToolContext {
	/** The level at which this tool is being evaluated */
	level: ToolLevel;

	/** The full assessment entity */
	assessment: AssessmentEntity;

	/** Current section, if applicable */
	section?: AssessmentSection;

	/** Reference to the current item (always available except at assessment level) */
	itemRef?: AssessmentItemRef;

	/** DOM container where the tool will be rendered */
	container?: HTMLElement;
}

/**
 * Context for assessment-level tools
 */
export interface AssessmentToolContext extends BaseToolContext {
	level: "assessment";
}

/**
 * Context for section-level tools
 */
export interface SectionToolContext extends BaseToolContext {
	level: "section";
	section: AssessmentSection;
}

/**
 * Context for item-level tools (question toolbar)
 */
export interface ItemToolContext extends BaseToolContext {
	level: "item";
	itemRef: AssessmentItemRef;
	item: ItemEntity;

	/** Passage entity if this item is associated with a passage */
	passage?: PassageEntity;
}

/**
 * Context for passage-level tools (passage header)
 *
 * Passages can appear as:
 * - Standalone passage entities associated with items
 * - RubricBlock with class="stimulus" containing embedded passage
 */
export interface PassageToolContext extends BaseToolContext {
	level: "passage";
	itemRef?: AssessmentItemRef;
	passage: PassageEntity;

	/** Items associated with this passage (if applicable) */
	items?: ItemEntity[];

	/** RubricBlock containing this passage (if from rubric) */
	rubricBlock?: RubricBlock;
}

/**
 * Context for rubric block tools
 *
 * RubricBlocks can contain:
 * - Instructions (class="instructions")
 * - Rubrics (class="rubric")
 * - Stimulus/passages (class="stimulus" with embedded passage)
 * - Simple HTML content
 */
export interface RubricToolContext extends BaseToolContext {
	level: "rubric";
	rubricBlock: RubricBlock;

	/** Section containing this rubric block */
	section: AssessmentSection;

	/** If rubric contains a passage (class="stimulus") */
	passage?: PassageEntity;
}

/**
 * Context for element-level tools (inline with interaction)
 *
 * Note: Element-level context uses the PIE interaction element ID
 * and provides access to the full item config for content inspection.
 */
export interface ElementToolContext extends BaseToolContext {
	level: "element";
	itemRef: AssessmentItemRef;
	item: ItemEntity;

	/** The PIE element/interaction ID */
	elementId: string;

	/** Passage entity if this item is associated with a passage */
	passage?: PassageEntity;

	/** DOM element that triggered the tool (e.g., the specific input field) */
	triggerElement?: HTMLElement;
}

/**
 * Union type of all tool contexts
 */
export type ToolContext =
	| AssessmentToolContext
	| SectionToolContext
	| ItemToolContext
	| PassageToolContext
	| RubricToolContext
	| ElementToolContext;

/**
 * Type guard to check if context is at assessment level
 */
export function isAssessmentContext(
	context: ToolContext,
): context is AssessmentToolContext {
	return context.level === "assessment";
}

/**
 * Type guard to check if context is at section level
 */
export function isSectionContext(
	context: ToolContext,
): context is SectionToolContext {
	return context.level === "section";
}

/**
 * Type guard to check if context is at item level
 */
export function isItemContext(
	context: ToolContext,
): context is ItemToolContext {
	return context.level === "item";
}

/**
 * Type guard to check if context is at passage level
 */
export function isPassageContext(
	context: ToolContext,
): context is PassageToolContext {
	return context.level === "passage";
}

/**
 * Type guard to check if context is at rubric level
 */
export function isRubricContext(
	context: ToolContext,
): context is RubricToolContext {
	return context.level === "rubric";
}

/**
 * Type guard to check if context is at element level
 */
export function isElementContext(
	context: ToolContext,
): context is ElementToolContext {
	return context.level === "element";
}

/**
 * Helper to extract text content from an item or element for analysis
 */
export function extractTextContent(context: ToolContext): string {
	if (isElementContext(context)) {
		const config = context.item.config;
		if (!config) return "";
		const textChunks: string[] = [];
		const stripHtml = (value: string) => value.replace(/<[^>]*>/g, " ").trim();

		// Try to find element markup by element id.
		const elementMarkup = config.elements?.[context.elementId];
		if (elementMarkup) {
			if (typeof elementMarkup === "string") {
				textChunks.push(stripHtml(elementMarkup));
			}
		}

		// Also inspect model data keyed by this element id.
		// In many items, math appears in model.prompt/labels rather than elements[elementId].
		const modelsRaw = config.models;
		const models = Array.isArray(modelsRaw)
			? modelsRaw
			: modelsRaw && typeof modelsRaw === "object"
				? Object.values(modelsRaw as Record<string, unknown>)
				: [];
		const model = models.find(
			(m: any) => m && typeof m === "object" && m.id === context.elementId,
		) as Record<string, unknown> | undefined;
		if (model) {
			for (const value of Object.values(model)) {
				if (typeof value === "string") {
					textChunks.push(stripHtml(value));
				}
				if (Array.isArray(value)) {
					for (const entry of value) {
						if (entry && typeof entry === "object") {
							for (const nested of Object.values(
								entry as Record<string, unknown>,
							)) {
								if (typeof nested === "string") {
									textChunks.push(stripHtml(nested));
								}
							}
						}
					}
				}
			}
		}

		return textChunks.filter(Boolean).join(" ").trim();
	}

	if (isItemContext(context)) {
		const item = context.item;
		if (!item?.config) return "";

		const config = item.config as Record<string, unknown>;
		const textChunks: string[] = [];
		const stripHtml = (value: string) => value.replace(/<[^>]*>/g, " ").trim();

		// Primary item markup
		if (typeof config.markup === "string") {
			textChunks.push(stripHtml(config.markup));
		}

		// Element markup snippets
		const elements = config.elements as Record<string, unknown> | undefined;
		if (elements && typeof elements === "object") {
			for (const elementMarkup of Object.values(elements)) {
				if (typeof elementMarkup === "string") {
					textChunks.push(stripHtml(elementMarkup));
				}
			}
		}

		// Model-level text (prompts, labels, etc.)
		const modelsRaw = config.models;
		const models = Array.isArray(modelsRaw)
			? modelsRaw
			: modelsRaw && typeof modelsRaw === "object"
				? Object.values(modelsRaw as Record<string, unknown>)
				: [];
		for (const model of models) {
			if (!model || typeof model !== "object") continue;
			for (const value of Object.values(model as Record<string, unknown>)) {
				if (typeof value === "string") {
					textChunks.push(stripHtml(value));
				}
				if (Array.isArray(value)) {
					for (const entry of value) {
						if (entry && typeof entry === "object") {
							for (const nested of Object.values(
								entry as Record<string, unknown>,
							)) {
								if (typeof nested === "string") {
									textChunks.push(stripHtml(nested));
								}
							}
						}
					}
				}
			}
		}

		return textChunks.filter(Boolean).join(" ").trim();
	}

	if (isPassageContext(context)) {
		const passage = context.passage;
		if (!passage?.config) return "";

		// Extract markup from passage
		const markup = passage.config.markup || "";
		return markup.replace(/<[^>]*>/g, " ").trim();
	}

	if (isRubricContext(context)) {
		const rubric = context.rubricBlock;

		// If rubric has embedded passage, extract from passage config
		if (rubric.passage?.config) {
			const markup = rubric.passage.config.markup || "";
			return markup.replace(/<[^>]*>/g, " ").trim();
		}

		// Otherwise, use simple content string
		const content = rubric.content || "";
		return content.replace(/<[^>]*>/g, " ").trim();
	}

	return "";
}

/**
 * Helper to check if context contains mathematical content
 * (Basic heuristic - can be overridden by tools)
 */
export function hasMathContent(context: ToolContext): boolean {
	const text = extractTextContent(context);

	// Look for common math indicators
	const mathIndicators = [
		/<math[>\s]/i, // MathML
		/\\\[([^\]]+)\\\]/, // LaTeX display math
		/\$\$[^$]+\$\$/, // LaTeX display math ($$...$$)
		/\\\(/, // LaTeX inline math
		/[+\-*/=<>≤≥∑∫√π]/, // Math symbols
		/\d+\s*[+\-*/=]\s*\d+/, // Simple arithmetic
	];

	return mathIndicators.some((pattern) => pattern.test(text));
}

/**
 * Helper to check if context contains choice-based interactions
 */
export function hasChoiceInteraction(context: ToolContext): boolean {
	const interactionTypes = [
		"pie-multiple-choice",
		"pie-inline-choice",
		"pie-select-text",
		"multiple-choice",
		"inline-choice",
		"select-text",
	];

	if (isElementContext(context)) {
		const config = context.item.config;
		if (!config?.models) return false;

		// Find model for this element
		const models = Array.isArray(config.models)
			? config.models
			: Object.values(config.models as Record<string, unknown>);
		const model = models.find(
			(m: any) => m && typeof m === "object" && m.id === context.elementId,
		);
		if (!model) return false;

		const type = (model as any).element || "";
		return interactionTypes.includes(type);
	}

	if (isItemContext(context)) {
		const modelsRaw = context.item.config?.models;
		const models = Array.isArray(modelsRaw)
			? modelsRaw
			: modelsRaw && typeof modelsRaw === "object"
				? Object.values(modelsRaw as Record<string, unknown>)
				: [];
		return models.some((m: any) => {
			if (!m || typeof m !== "object") return false;
			const type = m.element || "";
			if (interactionTypes.includes(type)) return true;
			// Fallback for configs that don't provide canonical element names.
			return Array.isArray(m.choices) && m.choices.length > 0;
		});
	}

	return false;
}

/**
 * Helper to check if context contains text that can be read aloud
 */
export function hasReadableText(context: ToolContext): boolean {
	const text = extractTextContent(context);
	// Must have at least 10 characters of text (arbitrary threshold)
	return text.trim().length >= 10;
}

/**
 * Helper to check if context contains science content
 * (Basic heuristic - can be overridden by tools)
 */
export function hasScienceContent(context: ToolContext): boolean {
	const text = extractTextContent(context);

	// Look for common science indicators
	const scienceIndicators = [
		/chemistry|chemical|element|atom|molecule|compound/i,
		/periodic\s+table/i,
		/H₂O|CO₂|NaCl|O₂|N₂/i, // Chemical formulas
		/\b[A-Z][a-z]?\d*\b/, // Element symbols (H, He, Li, etc.)
		/biology|organism|cell|DNA|RNA|protein/i,
		/physics|force|energy|velocity|acceleration/i,
	];

	return scienceIndicators.some((pattern) => pattern.test(text));
}
