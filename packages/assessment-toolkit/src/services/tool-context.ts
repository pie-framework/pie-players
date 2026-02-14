/**
 * Tool Context Types
 *
 * Defines the context types passed to tools for making visibility and behavior decisions.
 * Each context level provides increasingly specific information about where the tool is being used.
 */

import type {
	AssessmentEntity,
	AssessmentItemRef,
	ItemEntity,
	PassageEntity,
	QtiAssessmentSection,
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
	section?: QtiAssessmentSection;

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
	section: QtiAssessmentSection;
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
	section: QtiAssessmentSection;

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
export function isItemContext(context: ToolContext): context is ItemToolContext {
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
		// Extract text from specific element in the config
		const config = context.item.config;
		if (!config) return "";

		// Try to find element markup
		const elementMarkup = config.elements?.[context.elementId];
		if (elementMarkup) {
			// Strip HTML tags for text analysis
			return elementMarkup.replace(/<[^>]*>/g, " ").trim();
		}
		return "";
	}

	if (isItemContext(context)) {
		const item = context.item;
		if (!item?.config) return "";

		// Extract all markup from config
		const markup = item.config.markup || "";
		// Strip HTML tags
		return markup.replace(/<[^>]*>/g, " ").trim();
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
	if (isElementContext(context)) {
		const config = context.item.config;
		if (!config?.models) return false;

		// Find model for this element
		const model = config.models.find((m) => m.id === context.elementId);
		if (!model) return false;

		const type = model.element || "";
		return [
			"pie-multiple-choice",
			"pie-inline-choice",
			"pie-select-text",
		].includes(type);
	}

	if (isItemContext(context)) {
		const models = context.item.config?.models || [];
		return models.some((m) =>
			[
				"pie-multiple-choice",
				"pie-inline-choice",
				"pie-select-text",
			].includes(m.element || ""),
		);
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
