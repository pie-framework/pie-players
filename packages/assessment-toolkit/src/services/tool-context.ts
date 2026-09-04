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

const stripHtml = (value: string): string =>
	value.replace(/<[^>]*>/g, " ").trim();

/**
 * A config's `models` as a list, whether it was authored as an array or as a
 * record keyed by element id. Both forms are in the wild.
 */
function normalizeModels(modelsRaw: unknown): unknown[] {
	if (Array.isArray(modelsRaw)) return modelsRaw;
	if (modelsRaw && typeof modelsRaw === "object") {
		return Object.values(modelsRaw as Record<string, unknown>);
	}
	return [];
}

/**
 * Push every string a model carries, one level into its arrays of objects.
 *
 * The depth is deliberate rather than a full walk: math and prose live in a
 * model's own fields (`prompt`, `label`) and in its choice/row arrays, which is
 * one level down. Recursing further would pull in ids, keys and config flags.
 */
function collectModelText(model: unknown, push: (text: string) => void): void {
	if (!model || typeof model !== "object") return;
	for (const value of Object.values(model as Record<string, unknown>)) {
		if (typeof value === "string") push(value);
		if (Array.isArray(value)) {
			for (const entry of value) {
				if (entry && typeof entry === "object") {
					for (const nested of Object.values(
						entry as Record<string, unknown>,
					)) {
						if (typeof nested === "string") push(nested);
					}
				}
			}
		}
	}
}

/** Push the markup of every element snippet in a config's `elements` map. */
function collectElementsText(
	elements: unknown,
	push: (text: string) => void,
): void {
	if (!elements || typeof elements !== "object") return;
	for (const elementMarkup of Object.values(
		elements as Record<string, unknown>,
	)) {
		if (typeof elementMarkup === "string") push(elementMarkup);
	}
}

/**
 * The authored content a context carries, for the content heuristics below.
 *
 * Each level differs only in which fields it reads: an element reads its own
 * markup snippet and the one model bearing its id, an item and a passage read
 * their whole config and every model. The traversal itself is shared, so a new
 * place content can hide is added once.
 *
 * `transform` decides what the caller gets. {@link extractTextContent} strips
 * tags, which is right for prose keyword matching and wrong for structural
 * matching: a MathML item's only math signal *is* the `<math>` tag, and stripping
 * first left `hasMathContent`'s MathML pattern unreachable.
 */
function extractContent(
	context: ToolContext,
	transform: (value: string) => string,
): string {
	const textChunks: string[] = [];
	const push = (text: string) => {
		textChunks.push(transform(text));
	};
	const joined = () => textChunks.filter(Boolean).join(" ").trim();

	if (isElementContext(context)) {
		const config = context.item.config;
		if (!config) return "";

		const elementMarkup = config.elements?.[context.elementId];
		if (typeof elementMarkup === "string") push(elementMarkup);

		// Model data keyed by this element id: in many items the math is in
		// `model.prompt`/labels rather than in `elements[elementId]`.
		const model = normalizeModels(config.models).find(
			(candidate) =>
				!!candidate &&
				typeof candidate === "object" &&
				(candidate as Record<string, unknown>).id === context.elementId,
		);
		collectModelText(model, push);

		return joined();
	}

	if (isItemContext(context)) {
		const config = context.item?.config as Record<string, unknown> | undefined;
		if (!config) return "";

		if (typeof config.markup === "string") push(config.markup);
		collectElementsText(config.elements, push);
		for (const model of normalizeModels(config.models)) {
			collectModelText(model, push);
		}

		return joined();
	}

	if (isPassageContext(context)) {
		const config = context.passage?.config as
			| Record<string, unknown>
			| undefined;
		if (!config) return "";

		for (const field of ["markup", "content", "prompt"] as const) {
			const value = config[field];
			if (typeof value === "string") push(value);
		}
		collectElementsText(config.elements, push);
		for (const model of normalizeModels(config.models)) {
			collectModelText(model, push);
		}

		return joined();
	}

	if (isRubricContext(context)) {
		// No model walk: a rubric block is authored prose, so its text is one
		// string — the embedded passage's markup when it has one, else its content.
		const rubric = context.rubricBlock;
		if (rubric.passage?.config) {
			return transform(rubric.passage.config.markup || "");
		}
		return transform(rubric.content || "");
	}

	return "";
}

/** The plain text a context carries, tags removed. */
export function extractTextContent(context: ToolContext): string {
	return extractContent(context, stripHtml);
}

/**
 * The authored markup a context carries, tags intact.
 *
 * For indicators that live in the markup rather than in the prose — `<math>`
 * above all, whose whole signal is the element name.
 */
export function extractMarkupContent(context: ToolContext): string {
	return extractContent(context, (value) => value);
}

/**
 * Helper to check if context contains mathematical content
 * (Basic heuristic - can be overridden by tools)
 */
/**
 * Chemical element symbols.
 *
 * A real set rather than `[A-Z][a-z]?`: that shape matches "It", "In", "He" and
 * "A", which is why the science gate used to answer `true` for any prose that
 * began a sentence.
 */
const ELEMENT_SYMBOLS = new Set([
	"H", "He", "Li", "Be", "B", "C", "N", "O", "F", "Ne", "Na", "Mg", "Al", "Si",
	"P", "S", "Cl", "Ar", "K", "Ca", "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co",
	"Ni", "Cu", "Zn", "Ga", "Ge", "As", "Se", "Br", "Kr", "Rb", "Sr", "Y", "Zr",
	"Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd", "In", "Sn", "Sb", "Te", "I",
	"Xe", "Cs", "Ba", "La", "Ce", "Pr", "Nd", "Pm", "Sm", "Eu", "Gd", "Tb", "Dy",
	"Ho", "Er", "Tm", "Yb", "Lu", "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au",
	"Hg", "Tl", "Pb", "Bi", "Po", "At", "Rn", "Fr", "Ra", "Ac", "Th", "Pa", "U",
	"Np", "Pu", "Am", "Cm", "Bk", "Cf", "Es", "Fm", "Md", "No", "Lr",
]);

/** A word that could be a formula: capitalised groups with optional counts. */
const FORMULA_CANDIDATE = /\b[A-Z][A-Za-z]*\d*(?:[A-Z][A-Za-z]*\d*)*\b/g;
const FORMULA_GROUP = /([A-Z][a-z]?)(\d*)/g;

/**
 * Whether the text contains something only a chemical formula looks like.
 *
 * A token qualifies when every one of its groups is a real element symbol *and*
 * it either names two or more of them or carries a count — `NaCl`, `CO2`, `H2O`,
 * `C6H12O6`. A lone symbol never qualifies: "In", "He", "As" and "At" are
 * ordinary English words, and a single-letter "I" or "A" more so.
 */
function hasChemicalFormula(text: string): boolean {
	for (const candidate of text.match(FORMULA_CANDIDATE) ?? []) {
		FORMULA_GROUP.lastIndex = 0;
		let groups = 0;
		let hasCount = false;
		let consumed = 0;
		let valid = true;
		let match: RegExpExecArray | null = FORMULA_GROUP.exec(candidate);
		while (match !== null) {
			if (match[0] === "") break;
			if (!ELEMENT_SYMBOLS.has(match[1])) {
				valid = false;
				break;
			}
			groups += 1;
			if (match[2]) hasCount = true;
			consumed += match[0].length;
			match = FORMULA_GROUP.exec(candidate);
		}
		// Every character has to belong to a group, or the token was only
		// formula-shaped at its start ("Hello" -> "He" + "llo").
		if (valid && consumed === candidate.length && (groups > 1 || hasCount)) {
			return true;
		}
	}
	return false;
}

export function hasMathContent(context: ToolContext): boolean {
	// Structural signals live in the markup: stripping tags first is what left the
	// MathML pattern unable to match anything at all.
	const markup = extractMarkupContent(context);
	const structuralIndicators = [
		/<math[>\s]/i, // MathML
		/\\\[([^\]]+)\\\]/, // LaTeX display math
		/\$\$[^$]+\$\$/, // LaTeX display math ($$...$$)
		/\\\(/, // LaTeX inline math
	];
	if (structuralIndicators.some((pattern) => pattern.test(markup))) return true;

	const text = extractTextContent(context);
	// No bare-operator pattern. `/[+\-*/=<>≤≥∑∫√π]/` matched any hyphen or slash,
	// so "well-known" and "and/or" made every item mathematical and this predicate
	// answered `true` for essentially all content — a gate that does not gate. An
	// operator counts only with operands around it, or when the character has no
	// prose reading at all.
	const textIndicators = [
		/[≤≥≠±×÷∑∫√∞π]/, // Symbols with no prose reading
		/\d+\s*[+\-*/×÷=]\s*\d+/, // Simple arithmetic
		/\d\s*[<>]\s*\d/, // Numeric comparison
		/\b\d+\s*\/\s*\d+\b/, // Fractions
		/\b\d+(?:\.\d+)?\s*%/, // Percentages
		/\^\s*\d/, // Exponents
	];
	return textIndicators.some((pattern) => pattern.test(text));
}

/**
 * Helper to check if context contains choice-based interactions
 */
export function hasChoiceInteraction(context: ToolContext): boolean {
	const interactionTypes = [
		"pie-multiple-choice",
		"pie-inline-choice",
		"pie-select-text",
		"pie-ebsr",
		"multiple-choice",
		"inline-choice",
		"select-text",
		"ebsr",
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
			// A model that names its element has answered the question, whichever way
			// the answer falls. `choices` is carried by interactions that are not
			// choice interactions at all — `placement-ordering`, `categorize` and
			// `drag-in-the-blank` each hold their draggables there — so reading it on
			// a named model showed the answer eliminator on items where the tool does
			// nothing. The heuristic remains for configs that name no element.
			if (type) return interactionTypes.includes(type);
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

	// The element-symbol pattern used to be `/\b[A-Z][a-z]?\d*\b/`, which matches
	// any one- or two-letter capitalised word: "It", "In", "A", "No". Every item
	// beginning a sentence with one read as science.
	if (hasChemicalFormula(text)) return true;
	if (/[A-Z][a-z]?[\u2080-\u2089]/.test(text)) return true; // Subscripted: H₂O, CO₂

	const scienceIndicators = [
		/chemistry|chemical|molecule|compound|periodic\s+table/i,
		/\bchemical\s+element\b|\belement\s+symbol\b/i,
		/biology|organism|\bDNA\b|\bRNA\b|protein|photosynthesis|ecosystem/i,
		/physics|\bforce\b|\benergy\b|velocity|acceleration|momentum/i,
	];
	return scienceIndicators.some((pattern) => pattern.test(text));
}
