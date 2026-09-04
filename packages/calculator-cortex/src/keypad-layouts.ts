import type { CalculatorType } from "@pie-players/pie-calculator";
import type { CortexCalculatorLocalization } from "./localization.js";
import { mathfieldDecimalSeparator } from "./mathlive-runtime.js";
import type { ResolvedCortexSettings } from "./settings.js";
import type { CortexCalculatorMessageKey, CortexFunctionId } from "./types.js";

/**
 * The keypad this package renders itself.
 *
 * It is not MathLive's virtual keyboard, and that is deliberate. MathLive's is a
 * viewport-fixed singleton whose keycaps are `div[tabindex="-1"]` with no `role`,
 * whose toggle carries `role="button"` with no `tabindex`, and which therefore
 * contains zero focusable elements — it cannot be opened or operated by keyboard
 * or switch access at all. Its `container` setter also throws inside an iframe
 * (`VirtualKeyboardProxy`), which is how assessments are commonly delivered. So
 * the layouts live here as data and render as real buttons.
 *
 * `visualLabel` is what a learner sees. Keys labelled with a word carry that word
 * inside their accessible name (WCAG 2.5.3 Label in Name, and what voice control
 * speaks); keys labelled with a glyph are named freely.
 *
 * `requires` gates a key on `settings.allowedFunctions`. A host may narrow that
 * set, and `validateExpression` throws `unsupported-expression` for anything
 * outside it — so an ungated keypad would offer keys that raise a `role="alert"`
 * error when pressed.
 */
export interface KeypadKey {
	/** Stable id, used for keyed iteration and the roving tab index. */
	readonly id: string;
	/** LaTeX handed to the mathfield, `#0` marking where the caret lands. */
	readonly latex: string;
	/** Rendered as the key's face. `math` is typeset by MathLive, `text` is not. */
	readonly visualLabel: string;
	readonly labelKind: "math" | "text" | "glyph";
	/** Message key for the accessible name. */
	readonly nameKey: CortexCalculatorMessageKey;
	readonly nameValues?: Readonly<Record<string, string | number>>;
	/** Key class, which drives grouping and emphasis rather than decoration. */
	readonly role: "digit" | "operator" | "function" | "commit" | "edit";
	/** Omit the key unless every listed capability is allowed. */
	readonly requires?: readonly CortexFunctionId[];
	/** Basic mode rejects constants outright (`validateSymbol`). */
	readonly scientificOnly?: boolean;
	/**
	 * Grid column to place the key in, 1-based over the five key columns, instead
	 * of the position its index implies. The commit key uses it to hold the same
	 * corner on a short row as it does on a full one.
	 */
	readonly column?: number;
}

export interface KeypadLayer {
	readonly id: string;
	readonly labelKey: CortexCalculatorMessageKey;
	readonly rows: readonly (readonly KeypadKey[])[];
}

/** Key columns per row; the grid has a bare gutter between the third and fourth. */
const KEY_COLUMNS = 5;

const digit = (value: string): KeypadKey => ({
	id: `digit-${value}`,
	latex: value,
	visualLabel: value,
	labelKind: "text",
	nameKey: "keyDigit",
	nameValues: { digit: value },
	role: "digit",
});

/*
 * Columns 1-3 are digits and column 4-5 operators in every row, so the two blocks
 * separate by position. Position, not hue: under the ten PNP colour schemes
 * `--pie-fixed-hue-collapse` is 100% and there are effectively two colours, so a
 * tint cannot carry the distinction. The wider gutter between column 3 and 4 does.
 */
const NUMERIC_ROWS: readonly (readonly KeypadKey[])[] = [
	[
		digit("7"),
		digit("8"),
		digit("9"),
		{
			id: "add",
			latex: "+",
			visualLabel: "+",
			labelKind: "glyph",
			nameKey: "keyAdd",
			role: "operator",
		},
		{
			id: "subtract",
			latex: "-",
			visualLabel: "−",
			labelKind: "glyph",
			nameKey: "keySubtract",
			role: "operator",
		},
	],
	[
		digit("4"),
		digit("5"),
		digit("6"),
		{
			id: "multiply",
			latex: "\\times",
			visualLabel: "×",
			labelKind: "glyph",
			nameKey: "keyMultiply",
			role: "operator",
		},
		{
			id: "divide",
			latex: "\\div",
			visualLabel: "÷",
			labelKind: "glyph",
			nameKey: "keyDivide",
			role: "operator",
		},
	],
	[
		digit("1"),
		digit("2"),
		digit("3"),
		{
			id: "open-parenthesis",
			latex: "(",
			visualLabel: "(",
			labelKind: "glyph",
			nameKey: "keyOpenParenthesis",
			role: "operator",
		},
		{
			id: "close-parenthesis",
			latex: ")",
			visualLabel: ")",
			labelKind: "glyph",
			nameKey: "keyCloseParenthesis",
			role: "operator",
		},
	],
];

function numericBottomRow(decimalSeparator: string): readonly KeypadKey[] {
	return [
		digit("0"),
		{
			id: "decimal-separator",
			latex: decimalSeparator,
			visualLabel: decimalSeparator,
			labelKind: "text",
			nameKey: "keyDecimalSeparator",
			role: "digit",
		},
		{
			id: "square-root",
			latex: "\\sqrt{#0}",
			visualLabel: "\\sqrt{\\square}",
			labelKind: "math",
			nameKey: "keySquareRoot",
			role: "function",
			requires: ["square-root"],
		},
		{
			id: "percent",
			latex: "\\%",
			visualLabel: "%",
			labelKind: "glyph",
			nameKey: "keyPercent",
			role: "operator",
		},
		commitKey(),
	];
}

/**
 * The key that evaluates the buffer.
 *
 * Every layer carries one. It was on the numeric layer alone, and a learner who
 * built an expression from the scientific keys had to switch layers back to reach
 * a key they could see -- Enter works, but a pointer or switch-access user has no
 * Enter. `column` pins it to the fifth key column so it does not move when the
 * layer does.
 */
function commitKey(column?: number): KeypadKey {
	return {
		id: "commit",
		latex: "",
		visualLabel: "=",
		labelKind: "glyph",
		// The commit key keeps the `calculate` name the e2e suite resolves it by,
		// in both catalogs, so nothing depends on a new string for a known button.
		nameKey: "calculate",
		role: "commit",
		column,
	};
}

const SCIENTIFIC_ROWS: readonly (readonly KeypadKey[])[] = [
	[
		{
			id: "sine",
			latex: "\\sin(#0)",
			visualLabel: "sin",
			labelKind: "text",
			nameKey: "keySine",
			role: "function",
			requires: ["sine"],
		},
		{
			id: "cosine",
			latex: "\\cos(#0)",
			visualLabel: "cos",
			labelKind: "text",
			nameKey: "keyCosine",
			role: "function",
			requires: ["cosine"],
		},
		{
			id: "tangent",
			latex: "\\tan(#0)",
			visualLabel: "tan",
			labelKind: "text",
			nameKey: "keyTangent",
			role: "function",
			requires: ["tangent"],
		},
		{
			id: "natural-log",
			latex: "\\ln(#0)",
			visualLabel: "ln",
			labelKind: "text",
			nameKey: "keyNaturalLog",
			role: "function",
			requires: ["natural-log"],
		},
		{
			id: "common-log",
			latex: "\\log(#0)",
			visualLabel: "log",
			labelKind: "text",
			nameKey: "keyCommonLog",
			role: "function",
			requires: ["common-log"],
		},
	],
	[
		{
			id: "inverse-sine",
			latex: "\\sin^{-1}(#0)",
			visualLabel: "\\sin^{-1}",
			labelKind: "math",
			nameKey: "keyInverseSine",
			role: "function",
			requires: ["inverse-sine"],
		},
		{
			id: "inverse-cosine",
			latex: "\\cos^{-1}(#0)",
			visualLabel: "\\cos^{-1}",
			labelKind: "math",
			nameKey: "keyInverseCosine",
			role: "function",
			requires: ["inverse-cosine"],
		},
		{
			id: "inverse-tangent",
			latex: "\\tan^{-1}(#0)",
			visualLabel: "\\tan^{-1}",
			labelKind: "math",
			nameKey: "keyInverseTangent",
			role: "function",
			requires: ["inverse-tangent"],
		},
		{
			id: "exponential",
			latex: "e^{#0}",
			visualLabel: "e^{\\square}",
			labelKind: "math",
			nameKey: "keyExponential",
			role: "function",
			requires: ["exponential"],
		},
		{
			id: "power",
			latex: "#@^{#0}",
			visualLabel: "\\square^{\\square}",
			labelKind: "math",
			nameKey: "keyPower",
			role: "function",
			requires: ["power"],
		},
	],
	[
		{
			id: "nth-root",
			latex: "\\sqrt[#0]{#@}",
			visualLabel: "\\sqrt[\\square]{\\square}",
			labelKind: "math",
			nameKey: "keyNthRoot",
			role: "function",
			requires: ["root"],
		},
		{
			id: "absolute-value",
			latex: "\\left|#0\\right|",
			visualLabel: "|\\square|",
			labelKind: "math",
			nameKey: "keyAbsoluteValue",
			role: "function",
			requires: ["absolute-value"],
		},
		{
			id: "factorial",
			latex: "!",
			visualLabel: "!",
			labelKind: "glyph",
			nameKey: "keyFactorial",
			role: "function",
			requires: ["factorial"],
		},
		{
			id: "pi",
			latex: "\\pi",
			visualLabel: "\\pi",
			labelKind: "math",
			nameKey: "keyPi",
			role: "function",
			scientificOnly: true,
		},
		{
			id: "euler",
			latex: "e",
			visualLabel: "e",
			labelKind: "text",
			nameKey: "keyEuler",
			role: "function",
			scientificOnly: true,
		},
	],
	/*
	 * A fourth row, which is the budget the sizing note on `keypadLayers` sets, and
	 * a fifth on the graphing layer -- measured against the shipped panel there.
	 */
	[
		{
			id: "log-base-n",
			/*
			 * One placeholder, like every other function key. A two-slot template is
			 * unusable here: `ArrowRight` leaves the subscript rather than crossing to
			 * the next placeholder, and MathLive's `moveToNextPlaceholder` is bound to
			 * Tab, which this keypad deliberately spends on being a single tab stop.
			 * The base fills, `ArrowRight` exits, and the argument follows --
			 * `\\log_{2}8` is `["Lb", 8]` and answers 3, parentheses optional.
			 */
			latex: "\\log_{#0}",
			visualLabel: "\\log_{\\square}",
			labelKind: "math",
			nameKey: "keyLogBaseN",
			role: "function",
			requires: ["log-base-n"],
		},
		{
			/*
			 * A stacked fraction, which is how a fraction is written everywhere outside
			 * a calculator. `\\div` is still on the numeric layer and both parse to
			 * `Divide`, so this needs no capability of its own -- but `100\\div10\\div2`
			 * is ambiguous to read back and this is not.
			 *
			 * `#@` takes the expression already typed as the numerator, the same idiom
			 * `nth-root` uses for its radicand, so pressing this after `12` gives
			 * `\\frac{12}{...}` with the cursor in the denominator and no placeholder
			 * navigation needed.
			 */
			id: "fraction",
			latex: "\\frac{#@}{#0}",
			visualLabel: "\\frac{\\square}{\\square}",
			labelKind: "math",
			nameKey: "keyFraction",
			role: "function",
		},
	],
];

const GRAPH_ROW: readonly KeypadKey[] = [
	{
		id: "variable-x",
		latex: "x",
		visualLabel: "x",
		labelKind: "text",
		nameKey: "keyVariableX",
		role: "digit",
	},
	{
		id: "x-squared",
		latex: "x^2",
		visualLabel: "x^2",
		labelKind: "math",
		nameKey: "keySquared",
		role: "function",
		requires: ["power"],
	},
	{
		id: "x-cubed",
		latex: "x^3",
		visualLabel: "x^3",
		labelKind: "math",
		nameKey: "keyCubed",
		role: "function",
		requires: ["power"],
	},
	{
		id: "root-x",
		latex: "\\sqrt{x}",
		visualLabel: "\\sqrt{x}",
		labelKind: "math",
		nameKey: "keySquareRoot",
		role: "function",
		requires: ["square-root"],
	},
	{
		id: "abs-x",
		latex: "\\left|x\\right|",
		visualLabel: "|x|",
		labelKind: "math",
		nameKey: "keyAbsoluteValue",
		role: "function",
		requires: ["absolute-value"],
	},
];

function permitted(
	key: KeypadKey,
	type: CalculatorType,
	allowed: ReadonlySet<CortexFunctionId>,
): boolean {
	if (key.scientificOnly && type === "basic") return false;
	return (key.requires ?? []).every((capability) => allowed.has(capability));
}

function prune(
	rows: readonly (readonly KeypadKey[])[],
	type: CalculatorType,
	allowed: ReadonlySet<CortexFunctionId>,
): readonly (readonly KeypadKey[])[] {
	return rows
		.map((row) => row.filter((key) => permitted(key, type, allowed)))
		.filter((row) => row.length > 0);
}

/**
 * Put a commit key in the layer's last free slot.
 *
 * Applied after pruning, never before: the commit key requires no capability, so a
 * layer that carried it as data would survive a host revoking every function on
 * it and render as a lone `=`.
 */
function withCommit(
	rows: readonly (readonly KeypadKey[])[],
): readonly (readonly KeypadKey[])[] {
	const copied = rows.map((row) => [...row]);
	const last = copied[copied.length - 1];
	if (last && last.length < KEY_COLUMNS) last.push(commitKey(KEY_COLUMNS));
	else copied.push([commitKey(KEY_COLUMNS)]);
	return copied;
}

/**
 * The layers for one calculator, already filtered to what the host permits.
 *
 * Scientific stacks its functions in a *second layer* rather than extra rows. The
 * shipped panels are 380x500 basic, 380x560 scientific and 720x660 graphing, with a
 * 480px floor for the first two (see `registrations/calculator.ts`). Row count is a
 * layout budget rather than a target-size one: keys hold 44px from a token whose
 * value the density tiers in `CalculatorView.svelte` step down only in a panel too
 * short for it, so an extra row costs panel height at every size that ships. Eight
 * rows in one layer would put the keypad 250px past the floor, which is a scroll to
 * reach `sin`.
 *
 * Four rows is the budget; the graphing layer spends five because it carries the
 * five graph keys as well. Both fit the shipped panels with no scroll in either
 * axis, and the e2e suite measures every layer at both the size the panel opens at
 * and its resizable minimum.
 */
export function keypadLayers(
	settings: ResolvedCortexSettings,
	localization: CortexCalculatorLocalization,
): readonly KeypadLayer[] {
	const { type, allowedFunctions } = settings;
	// The same resolver the mathfield class is configured with, so a tapped key and
	// a typed character produce the same separator rather than two.
	const separator = mathfieldDecimalSeparator(localization.locale);
	const numericRows = prune(
		[...NUMERIC_ROWS, numericBottomRow(separator)],
		type,
		allowedFunctions,
	);
	const numeric: KeypadLayer = {
		id: "numeric",
		labelKey: "virtualKeyboardBasic",
		rows: numericRows,
	};
	if (type === "basic") return [numeric];

	if (type === "graphing") {
		const graphRows = prune(
			[GRAPH_ROW, ...SCIENTIFIC_ROWS],
			type,
			allowedFunctions,
		);
		if (graphRows.length === 0) return [numeric];
		return [
			numeric,
			{
				id: "graph",
				labelKey: "virtualKeyboardGraphing",
				rows: withCommit(graphRows),
			},
		];
	}

	const scientificRows = prune(SCIENTIFIC_ROWS, type, allowedFunctions);
	if (scientificRows.length === 0) return [numeric];
	return [
		numeric,
		{
			id: "scientific",
			labelKey: "virtualKeyboardScientific",
			rows: withCommit(scientificRows),
		},
	];
}
