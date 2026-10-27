/**
 * Tool Context Types
 *
 * Defines the context types passed to tools for making visibility and behavior decisions.
 * Each context level provides increasingly specific information about where the tool is being used.
 */

import { runtimeElementTags } from "@pie-players/pie-players-shared/pie";
import { parseVersionedTagName } from "@pie-players/pie-players-shared/pie/tag-names";
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
 * Type guard to check if context is at item level
 */
function isItemContext(
	context: ToolContext,
): context is ItemToolContext {
	return context.level === "item";
}

/**
 * Type guard to check if context is at passage level
 */
function isPassageContext(
	context: ToolContext,
): context is PassageToolContext {
	return context.level === "passage";
}

/**
 * Type guard to check if context is at rubric level
 */
function isRubricContext(
	context: ToolContext,
): context is RubricToolContext {
	return context.level === "rubric";
}

/**
 * Type guard to check if context is at element level
 */
function isElementContext(
	context: ToolContext,
): context is ElementToolContext {
	return context.level === "element";
}

const stripHtml = (value: string): string =>
	value.replace(/<[^>]*>/g, " ").trim();

// The digit fold mirrors pie-elements-ng's response normalizer
// (`controller-utils/src/response-normalizer.ts`), so tool visibility and
// scoring read one number the same way. The separators fold to the
// point-decimal marks the patterns below are written in.
const DECIMAL_DIGIT = /\p{Nd}/u;
const NON_ASCII_DIGITS = /(?![0-9])\p{Nd}/gu;
// ALM, LRM, RLM, the embeddings and overrides, the isolates, and tatweel.
const BIDI_CONTROLS_AND_TATWEEL =
	/[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\u0640]/g;

const digitValues = new Map<number, number>();

/**
 * A decimal digit's value: its offset into its run of ten. Unicode assigns
 * decimal digits only in ascending runs from zero, and runs can abut, hence the
 * modulo.
 */
function digitValue(codePoint: number): number {
	const cached = digitValues.get(codePoint);
	if (cached !== undefined) return cached;
	let offset = 0;
	while (DECIMAL_DIGIT.test(String.fromCodePoint(codePoint - offset - 1))) {
		offset += 1;
	}
	const value = offset % 10;
	digitValues.set(codePoint, value);
	return value;
}

/**
 * Text with every decimal digit in ASCII, the Arabic decimal, thousands and
 * percent signs as `.`, `,` and `%`, and bidi controls and tatweel removed, so
 * the patterns below match `٣٫٥ × ٢ = ٧` as they match `3.5 × 2 = 7`.
 */
function foldNumerals(text: string): string {
	return text
		.replace(BIDI_CONTROLS_AND_TATWEEL, "")
		.replace(NON_ASCII_DIGITS, (digit) =>
			String(digitValue(digit.codePointAt(0) as number)),
		)
		.replace(/\u066B/g, ".")
		.replace(/\u066C/g, ",")
		.replace(/\u066A/g, "%");
}

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

/** The model in a config's `models` whose `id` is `elementId`, if any. */
function findElementModel(modelsRaw: unknown, elementId: string): unknown {
	return normalizeModels(modelsRaw).find(
		(candidate) =>
			!!candidate &&
			typeof candidate === "object" &&
			(candidate as Record<string, unknown>).id === elementId,
	);
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
 * matching: a MathML item's only math signal *is* the `<math>` tag.
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
		collectModelText(findElementModel(config.models, context.elementId), push);

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
function extractTextContent(context: ToolContext): string {
	return extractContent(context, stripHtml);
}

/** The plain text a context carries, with its numerals folded for matching. */
function extractMatchableText(context: ToolContext): string {
	return foldNumerals(extractTextContent(context));
}

/**
 * The authored markup a context carries, tags intact.
 *
 * For indicators that live in the markup rather than in the prose — `<math>`
 * above all, whose whole signal is the element name.
 */
function extractMarkupContent(context: ToolContext): string {
	return extractContent(context, (value) => value);
}

/**
 * Chemical element symbols.
 *
 * A real set rather than `[A-Z][a-z]?`: that shape matches "It", "In", "He" and
 * "A", so any prose beginning a sentence would read as science.
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

/** Numbers joined by slashes: `3/4`, `12 / 4`, `10/10/2026`. */
const SLASH_RUN = /\d+(?:\s*\/\s*\d+)+/g;

/** Numbers joined by hyphens spaced on both sides: `15 - 7`, `1809 - 1865`. */
const SPACED_HYPHEN_RUN = /\d+(?:[.,]\d+)*(?:\s+-\s+\d+(?:[.,]\d+)*)+/g;

/**
 * Whether the text holds a fraction or a division: exactly one slash between
 * two numbers. A second slash makes the run a date — `10/10/2026`, `2026/10/10`.
 */
function hasFraction(text: string): boolean {
	return (text.match(SLASH_RUN) ?? []).some(
		(run) => run.split("/").length === 2,
	);
}

/**
 * Whether the text holds a subtraction written with a hyphen.
 *
 * Between numbers a hyphen is mostly a range, a date or an identifier:
 * `1990-2000`, `2025-26`, `2026-10-10`, `555-1234`. On its own it counts as
 * minus only when spaced on both sides, and then only where the numbers fail to
 * ascend, since a range runs low to high: `15 - 7` counts, `1809 - 1865` does
 * not. The trade is that `3 - 5` on its own reads as a range; with an equals
 * sign next to it, it is caught as an equation.
 */
function hasSpacedSubtraction(text: string): boolean {
	return (text.match(SPACED_HYPHEN_RUN) ?? []).some((run) => {
		const values = run
			.split(/\s+-\s+/)
			.map((value) => Number(value.replace(/,/g, "")));
		return values.some((value, index) => index > 0 && value <= values[index - 1]);
	});
}

const PERCENTAGE = /\d\s*%/;

/**
 * A percentage taken of a number: `20% of 50`, `15% of $80`, `el 20% de 50`,
 * `٢٠٪ من ٥٠`.
 */
const PERCENTAGE_OF_NUMBER = /\d\s*%\s+(?:of|de|van|من)\s+\p{Sc}?\s?\d/iu;

/** A money amount: `$40`, `€ 12`, `12,50 €`, `٥٠ ؋`. */
const MONEY = /\p{Sc}\s?\d|\d\s?\p{Sc}/u;

/**
 * Currencies written as a word after the amount, by content language.
 *
 * Arabic writes most currencies as a word or an abbreviation where English
 * writes a sign: `٥٠ ريالًا`, `١٢ د.إ`. English has no set, because its
 * spelled-out "40 dollars" never counted. Script-disjoint, so every set is
 * tried. The Arabic set is pending the native review (PIE-1364).
 */
const CURRENCY_WORDS: Readonly<Record<string, RegExp>> = {
	ar: /\d\s*(?:ريال|دينار|درهم|جنيه|دولار|يورو|ليرة|ر\.س|د\.إ|د\.ك|ج\.م)/u,
};

/**
 * Whether the text applies a percentage to a quantity.
 *
 * A percentage on its own is a statistic in prose — "40% of voters", "70% of
 * Earth's surface" — so it counts when taken of a number or when the text
 * carries a money amount, as discount, tax and interest problems do. Beside an
 * operator (`25% = 0.25`) it is caught with the operator.
 */
function hasAppliedPercentage(text: string): boolean {
	if (PERCENTAGE_OF_NUMBER.test(text)) return true;
	if (!PERCENTAGE.test(text)) return false;
	return (
		MONEY.test(text) ||
		Object.values(CURRENCY_WORDS).some((pattern) => pattern.test(text))
	);
}

/**
 * Helper to check if context contains mathematical content
 * (Basic heuristic - can be overridden by tools)
 */
export function hasMathContent(context: ToolContext): boolean {
	// Structural signals live in the markup, so they match before tags are
	// stripped.
	const markup = extractMarkupContent(context);
	const structuralIndicators = [
		/<math[>\s]/i, // MathML
		/\\\[([^\]]+)\\\]/, // LaTeX display math
		/\$\$[^$]+\$\$/, // LaTeX display math ($$...$$)
		/\\\(/, // LaTeX inline math
	];
	if (structuralIndicators.some((pattern) => pattern.test(markup))) return true;

	const text = extractMatchableText(context);
	// No bare-operator pattern: a lone hyphen or slash matches "well-known" and
	// "and/or", which would make nearly every item mathematical. An operator
	// counts only with operands around it, or when the character has no prose
	// reading at all. Hyphens and slashes between numbers also write dates and
	// ranges, and a percentage alone is a statistic, so those have their own
	// predicates below. An operand may carry a percent sign (`25% = 0.25`).
	const textIndicators = [
		/[≤≥≠±×÷∑∫√∞π]/, // Symbols with no prose reading
		/\d\s*%?\s*[+*×÷=−]\s*\d/, // Operators with no date or range reading
		/\d\s*[-/]\s*\d[\d.,]*\s*=|=\s*\d[\d.,]*\s*[-/]\s*\d/, // Hyphen or slash in an equation
		/\d\s*%?\s*[<>]\s*\d/, // Numeric comparison
		/\^\s*\d/, // Exponents
	];
	return (
		textIndicators.some((pattern) => pattern.test(text)) ||
		hasFraction(text) ||
		hasSpacedSubtraction(text) ||
		hasAppliedPercentage(text)
	);
}

/**
 * What one element of a context declares about the PNP supports it implements.
 *
 * An element declares them on its class, as `static pieSupports`: a list of AfA
 * PNP 3.0 support terms, such as `answer-masking`. The toolkit reads the class
 * `customElements` holds under the element's runtime tag, so the declaration is
 * known before the element renders. What a support needs from the rendered
 * element is between the element and the tool that provides it, and that tool
 * documents it.
 */
export interface ElementSupports {
	/** The element's model id. */
	elementId: string | undefined;
	/** The tag the item binds the element to, as authored. */
	tag: string;
	/** The element's package spec in the item's `elements` map, when it has one. */
	packageSpec: string | undefined;
	/**
	 * The terms the element's class declares: `undefined` while the class is
	 * undefined, and for a class that declares nothing. An empty list is a
	 * declaration that the element implements none.
	 */
	supports: readonly string[] | undefined;
	/**
	 * The runtime tags the class can still be defined under, empty once it is
	 * defined. A definition landing under one of them can change `supports`.
	 */
	pendingTags: readonly string[];
}

function packageSpecFor(tag: string, elements: unknown): string | undefined {
	if (!elements || typeof elements !== "object") return undefined;
	const map = elements as Record<string, unknown>;
	const spec = map[tag] ?? map[parseVersionedTagName(tag).baseName];
	return typeof spec === "string" && spec ? spec : undefined;
}

function declaredSupports(
	elementClass: CustomElementConstructor,
): readonly string[] | undefined {
	let declared: unknown;
	try {
		declared = (elementClass as { pieSupports?: unknown }).pieSupports;
	} catch {
		return undefined;
	}
	if (!Array.isArray(declared)) return undefined;
	return declared.filter((term): term is string => typeof term === "string");
}

function readElementSupports(
	model: unknown,
	elements: unknown,
): ElementSupports | null {
	if (!model || typeof model !== "object") return null;
	const { id, element } = model as { id?: unknown; element?: unknown };
	if (typeof element !== "string" || !element) return null;
	const packageSpec = packageSpecFor(element, elements);
	const candidates = runtimeElementTags(element, packageSpec);
	const registry =
		typeof customElements === "undefined" ? undefined : customElements;
	for (const tag of candidates) {
		const elementClass = registry?.get(tag);
		if (elementClass) {
			return {
				elementId: typeof id === "string" ? id : undefined,
				tag: element,
				packageSpec,
				supports: declaredSupports(elementClass),
				pendingTags: [],
			};
		}
	}
	return {
		elementId: typeof id === "string" ? id : undefined,
		tag: element,
		packageSpec,
		supports: undefined,
		pendingTags: registry ? candidates : [],
	};
}

/**
 * The supports each element of a context declares: the element's own at element
 * level, every element of the item or passage config at those levels, and none
 * elsewhere. A model that names no element renders nothing and is skipped.
 */
export function elementSupports(context: ToolContext): ElementSupports[] {
	let config: { models?: unknown; elements?: unknown } | undefined;
	let models: unknown[];
	if (isElementContext(context)) {
		config = context.item.config;
		models = [findElementModel(config?.models, context.elementId)];
	} else if (isItemContext(context)) {
		config = context.item?.config;
		models = normalizeModels(config?.models);
	} else if (isPassageContext(context)) {
		config = context.passage?.config;
		models = normalizeModels(config?.models);
	} else {
		return [];
	}
	return models.flatMap((model) => {
		const supports = readElementSupports(model, config?.elements);
		return supports ? [supports] : [];
	});
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
 * Whether read-aloud has something to read: readable text, or markup carrying
 * a catalog idref, whose spoken card reads for content with no text.
 */
export function hasSpokenContent(context: ToolContext): boolean {
	return (
		hasReadableText(context) ||
		/\bdata-catalog-idref\s*=/.test(extractMarkupContent(context))
	);
}

/**
 * Helper to check if context contains science content
 * (Basic heuristic - can be overridden by tools)
 */
export function hasScienceContent(context: ToolContext): boolean {
	const text = extractMatchableText(context);

	if (hasChemicalFormula(text)) return true;
	if (/[A-Z][a-z]?[\u2080-\u2089]/.test(text)) return true; // Subscripted: H₂O, CO₂

	return Object.values(SCIENCE_KEYWORDS).some((patterns) =>
		patterns.some((pattern) => pattern.test(text)),
	);
}

/**
 * Science vocabulary by content language, one pattern per field: chemistry,
 * element naming, biology, physics.
 *
 * Every set is tried, because the sets are script-disjoint and content often
 * declares no language: an Arabic pattern cannot match English text. A language
 * is added as a set of its own.
 *
 * Arabic attaches the conjunction, prepositions and article to the word, so its
 * patterns match stems unanchored. The exceptions are قوة (force) and طاقة
 * (energy), bounded the way `\bforce\b` is: unbounded, بطاقة (card) and بقوة
 * (strongly) would match. "compound" has no Arabic entry, since مركب is also a
 * vehicle; كيميائي covers a chemical compound. The Arabic set is pending the
 * native review (PIE-1364).
 */
const SCIENCE_KEYWORDS: Readonly<Record<string, readonly RegExp[]>> = {
	en: [
		/chemistry|chemical|molecule|compound|periodic\s+table/i,
		/\bchemical\s+element\b|\belement\s+symbol\b/i,
		/biology|organism|\bDNA\b|\bRNA\b|protein|photosynthesis|ecosystem/i,
		/physics|\bforce\b|\benergy\b|velocity|acceleration|momentum/i,
	],
	ar: [
		/كيمياء|كيميائي|جزيء|جزيئ|جدول\s+(?:ال)?دوري/u,
		/رمز\s+(?:ال)?عنصر/u,
		/علم\s+الأحياء|كائن(?:ات)?\s+(?:ال)?حي|حمض\s+(?:ال)?نووي|بروتين|(?:بناء|تمثيل)\s+(?:ال)?ضوئي|(?:نظام|نظم|أنظمة)\s+(?:ال)?بيئي/u,
		/فيزياء|فيزيائي|(?<!\p{L})(?:و|ال|وال)?(?:قوة|قوى|طاقة)(?!\p{L})|سرعة\s+(?:ال)?متجهة|تسارع|كمية\s+(?:ال)?حركة/u,
	],
};
