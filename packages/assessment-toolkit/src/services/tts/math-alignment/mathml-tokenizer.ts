import type {
	HighlightTarget,
	MathAlignmentToken,
	MathAlignmentTokenKind,
	MathMLTokenizationResult,
} from "./types.js";

const OPERATOR_ALIASES = new Map<string, string[]>([
	["+", ["plus"]],
	["-", ["minus", "negative"]],
	["−", ["minus", "negative"]],
	["×", ["times", "multiplied by"]],
	["÷", ["divided by"]],
	["=", ["equals", "equal to"]],
	["≠", ["is not equal to", "not equal to"]],
	["≈", ["approximately equals"]],
	["≤", ["less than or equal to"]],
	["≥", ["greater than or equal to"]],
	["<", ["less than"]],
	[">", ["greater than"]],
	["∠", ["angle"]],
	["△", ["triangle"]],
	["□", ["box"]],
	["○", ["circle"]],
	["°", ["degrees", "degree"]],
	["%", ["percent"]],
	["'", ["prime"]],
	["′", ["prime"]],
	["•", ["times"]],
	["·", ["times"]],
	["\u2062", ["times", "multiplied by"]],
]);

// Invisible operators (no glyph). A TTS engine usually does not voice them, so
// they are tokenized as OPTIONAL — they only consume a spoken token when one
// happens to match (e.g. an invisible-times read aloud as "times"). Marking
// them required would force a coarse fallback for any function call (sin, f(x))
// or implicit product.
const INVISIBLE_OPERATOR_ROLES = new Map<string, string>([
	["\u2061", "function-application"],
	["\u2062", "implicit-multiply"],
	["\u2063", "invisible-separator"],
	["\u2064", "invisible-plus"],
]);

// Exponents a TTS engine reliably reads as a single power word. Other exponents
// (variables, 4 and up, nested) are voiced in ways we cannot anchor, so they
// recurse and let the all-or-nothing cover check fall back to the expression.
const SUPERSCRIPT_ALIASES = new Map<string, string[]>([
	["2", ["squared"]],
	["3", ["cubed"]],
]);

// 2D / scripted containers we do not attempt to track per token. Each becomes a
// single opaque, unmatchable structure token so any expression containing one
// degrades to a coarse whole-expression highlight rather than risking a
// misaligned per-glyph highlight from flattened inner tokens.
const OPAQUE_STRUCTURE_ROLES = new Map<string, string>([
	["msqrt", "radical"],
	["mroot", "radical"],
	["msub", "subscript"],
	["msubsup", "subsupscript"],
	["munder", "underscript"],
	["mover", "overscript"],
	["munderover", "underoverscript"],
	["mmultiscripts", "multiscript"],
	["menclose", "enclosure"],
]);

const normalizeWhitespace = (value: string): string =>
	value.replace(/\s+/g, " ").trim();

const localNameOf = (element: Element): string =>
	(element.localName || element.tagName || "").toLowerCase();

const isElement = (node: Node): node is Element =>
	node.nodeType === Node.ELEMENT_NODE;

const elementChildren = (element: Element): Element[] =>
	Array.from(element.childNodes).filter(isElement);

const textContentOf = (element: Element): string =>
	normalizeWhitespace(element.textContent || "");

const elementTarget = (
	element: Element,
	quality: "element-range" | "region-fallback",
): HighlightTarget => ({
	type: "element-range",
	quality,
	element,
});

const tokenKindFor = (tagName: string): MathAlignmentTokenKind => {
	switch (tagName) {
		case "mi":
			return "identifier";
		case "mn":
			return "number";
		case "mo":
			return "operator";
		case "mtext":
		case "ms":
			return "text";
		case "mspace":
			return "space";
		default:
			return "unknown";
	}
};

const normalizeToken = (text: string, kind: MathAlignmentTokenKind): string => {
	if (kind === "operator") {
		if (text === "−") return "-";
		return text;
	}
	return text.toLowerCase();
};

const aliasesFor = (
	text: string,
	kind: MathAlignmentTokenKind,
	role: string,
): string[] => {
	if (role === "fraction") return ["over", "divided by"];
	if (role === "superscript") return SUPERSCRIPT_ALIASES.get(text) ?? [];
	if (text === "|") return ["absolute value"];
	if (kind === "operator") return OPERATOR_ALIASES.get(text) || [];
	return [];
};

interface TokenizerState {
	tokens: MathAlignmentToken[];
	layoutTargets: MathAlignmentToken[];
	nextId: number;
}

const createToken = (args: {
	state: TokenizerState;
	kind: MathAlignmentTokenKind;
	role: string;
	text: string;
	normalized?: string;
	sourceElement: Element;
	path: string;
	target?: HighlightTarget;
	optional?: boolean;
}): MathAlignmentToken => {
	const normalized =
		args.normalized ?? normalizeToken(args.text, args.kind || "unknown");
	return {
		id: `math-token-${args.state.nextId++}`,
		kind: args.kind,
		role: args.role,
		text: args.text,
		normalized,
		spokenAliases: aliasesFor(args.text, args.kind, args.role),
		sourceElement: args.sourceElement,
		path: args.path,
		target: args.target || elementTarget(args.sourceElement, "element-range"),
		optional: args.optional,
	};
};

const pushToken = (
	state: TokenizerState,
	token: MathAlignmentToken,
	collection: "tokens" | "layoutTargets" = "tokens",
): void => {
	state[collection].push(token);
};

const visitChildren = (
	element: Element,
	state: TokenizerState,
	path: string,
): void => {
	elementChildren(element).forEach((child, index) =>
		visitElement(child, state, `${path}/${localNameOf(child)}[${index}]`),
	);
};

const visitFraction = (
	element: Element,
	state: TokenizerState,
	path: string,
): void => {
	const children = elementChildren(element);
	if (children[0]) visitElement(children[0], state, `${path}/numerator`);
	pushToken(
		state,
		createToken({
			state,
			kind: "structure",
			role: "fraction",
			text: "/",
			sourceElement: element,
			path,
			target: elementTarget(element, "element-range"),
		}),
	);
	if (children[1]) visitElement(children[1], state, `${path}/denominator`);
};

const visitFenced = (
	element: Element,
	state: TokenizerState,
	path: string,
): void => {
	const open = element.getAttribute("open") || "(";
	const close = element.getAttribute("close") || ")";
	pushToken(
		state,
		createToken({
			state,
			kind: "operator",
			role: open === "|" ? "absolute-value-fence" : "open-fence",
			text: open,
			sourceElement: element,
			path: `${path}/open`,
			target: elementTarget(element, "element-range"),
		}),
	);
	visitChildren(element, state, path);
	pushToken(
		state,
		createToken({
			state,
			kind: "operator",
			role: close === "|" ? "absolute-value-fence" : "close-fence",
			text: close,
			sourceElement: element,
			path: `${path}/close`,
			target: elementTarget(element, "element-range"),
		}),
	);
};

const visitSuperscript = (
	element: Element,
	state: TokenizerState,
	path: string,
): void => {
	const children = elementChildren(element);
	if (children[0]) visitElement(children[0], state, `${path}/base`);
	const exponent = children[1];
	if (!exponent) return;
	const exponentText = textContentOf(exponent);
	if (SUPERSCRIPT_ALIASES.has(exponentText)) {
		// One token aliased to the power word ("squared" / "cubed"), targeting the
		// whole superscript so the spoken power word highlights the base-and-
		// exponent unit.
		pushToken(
			state,
			createToken({
				state,
				kind: "structure",
				role: "superscript",
				text: exponentText,
				normalized: exponentText,
				sourceElement: exponent,
				path: `${path}/exponent`,
				target: elementTarget(element, "element-range"),
			}),
		);
		return;
	}
	visitElement(exponent, state, `${path}/exponent`);
};

const visitOpaqueStructure = (
	element: Element,
	state: TokenizerState,
	path: string,
	role: string,
): void => {
	// A single required, unmatchable token. The NUL-prefixed normalized value can
	// never equal a spoken token, so the cover check always falls back to the
	// whole-expression target when this structure is present — no per-glyph
	// guessing inside fractions-under-radicals, subscripts, accents, etc.
	pushToken(
		state,
		createToken({
			state,
			kind: "structure",
			role,
			text: textContentOf(element) || role,
			normalized: `\u0000${role}`,
			sourceElement: element,
			path,
			target: elementTarget(element, "element-range"),
		}),
	);
};

const visitTable = (
	element: Element,
	state: TokenizerState,
	path: string,
): void => {
	let rowNumber = 0;
	for (const child of elementChildren(element)) {
		if (localNameOf(child) === "mtr" || localNameOf(child) === "mlabeledtr") {
			rowNumber++;
			pushToken(
				state,
				createToken({
					state,
					kind: "layout",
					role: "table-row",
					text: `row-${rowNumber}`,
					normalized: `row-${rowNumber}`,
					sourceElement: child,
					path: `${path}/row[${rowNumber}]`,
					target: elementTarget(child, "region-fallback"),
				}),
				"layoutTargets",
			);
		}
		visitElement(child, state, `${path}/${localNameOf(child)}[${rowNumber}]`);
	}
};

const visitTokenElement = (
	element: Element,
	state: TokenizerState,
	path: string,
): void => {
	const text = textContentOf(element);
	if (!text) return;
	const kind = tokenKindFor(localNameOf(element));
	const invisibleRole =
		kind === "operator" ? INVISIBLE_OPERATOR_ROLES.get(text) : undefined;
	const role =
		invisibleRole ??
		(kind === "operator" && (text === "(" || text === ")")
			? "grouping-fence"
			: kind);
	pushToken(
		state,
		createToken({
			state,
			kind,
			role,
			text,
			sourceElement: element,
			path,
			target:
				invisibleRole && element.parentElement
					? elementTarget(element.parentElement, "region-fallback")
					: undefined,
			optional: Boolean(invisibleRole) || role === "grouping-fence",
		}),
	);
};

const visitElement = (
	element: Element,
	state: TokenizerState,
	path: string,
): void => {
	const tagName = localNameOf(element);
	switch (tagName) {
		case "annotation":
		case "annotation-xml":
			return;
		case "semantics": {
			const presentation = elementChildren(element).find((child) => {
				const childName = localNameOf(child);
				return childName !== "annotation" && childName !== "annotation-xml";
			});
			if (presentation)
				visitElement(presentation, state, `${path}/presentation`);
			return;
		}
		case "mi":
		case "mn":
		case "mo":
		case "mtext":
		case "ms":
		case "mspace":
			visitTokenElement(element, state, path);
			return;
		case "mfrac":
			visitFraction(element, state, path);
			return;
		case "msup":
			visitSuperscript(element, state, path);
			return;
		case "mfenced":
			visitFenced(element, state, path);
			return;
		case "mtable":
			visitTable(element, state, path);
			return;
		case "mphantom":
			// Invisible spacing content — must not become spoken tokens.
			return;
		case "maction": {
			// Only the shown alternative (first child) is rendered/spoken.
			const shown = elementChildren(element)[0];
			if (shown) visitElement(shown, state, `${path}/action`);
			return;
		}
		default: {
			const opaqueRole = OPAQUE_STRUCTURE_ROLES.get(tagName);
			if (opaqueRole) {
				visitOpaqueStructure(element, state, path, opaqueRole);
				return;
			}
			visitChildren(element, state, path);
		}
	}
};

export const tokenizeMathML = (
	mathElement: Element,
): MathMLTokenizationResult => {
	const state: TokenizerState = {
		tokens: [],
		layoutTargets: [],
		nextId: 0,
	};
	visitElement(mathElement, state, "/math");

	return {
		tokens: state.tokens,
		layoutTargets: state.layoutTargets,
		expressionTarget: elementTarget(mathElement, "region-fallback"),
	};
};
