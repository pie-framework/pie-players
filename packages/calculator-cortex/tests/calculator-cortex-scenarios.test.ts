import type { CalculatorType } from "@pie-players/pie-calculator";
import { describe, expect, test } from "bun:test";
import type { CortexCalculatorErrorCode } from "../src/errors.js";
import { evaluateLatex, sampleLatex } from "../src/evaluation-engine.js";
import { resolveCortexSettings } from "../src/settings.js";
import type { CortexGraphViewport } from "../src/types.js";
import type { WorkerEvaluationSettings } from "../src/worker-protocol.js";

/*
 * The feature matrix: what a learner enters, and what this calculator answers.
 *
 * No public conformance suite exists for a scientific calculator, so the cases are
 * authored — from the PRD's capability spec, from the conventional calculator test
 * axes (operator precedence, boundary values, domain errors, display formatting),
 * and from what the three modes are actually used for. The one public artifact
 * that does exist is the calculator forensics expression, and it is here.
 *
 * These are our layers, not the Compute Engine's. Every case is a claim about the
 * mode policy that admits or refuses the input, the angle mode and precision this
 * package configures, the formatter that turns a number into what a learner reads,
 * and the sampler that turns an expression into a curve. A wrong value here means
 * one of those is misconfigured — which is exactly how `cos(90°)` was found
 * answering `6.123233996e-17`, and `sin(30°)` answering `0.5000000000000008` at a
 * display precision that showed it.
 *
 * A case belongs in this file when a learner could type it. Lifecycle, budgets,
 * the worker seam and the keypad have their own files.
 */

type Mode = CalculatorType;

interface Answer {
	readonly latex: string;
	readonly expects: string;
	readonly settings?: Record<string, unknown>;
	/** Only where the expected answer is not self-evident. */
	readonly why?: string;
}

interface Refusal {
	readonly latex: string;
	readonly code: CortexCalculatorErrorCode;
	readonly why: string;
}

function workerSettings(
	mode: Mode,
	overrides: Record<string, unknown> = {},
): WorkerEvaluationSettings {
	const settings = resolveCortexSettings(mode, { settings: overrides });
	return {
		angleMode: settings.angleMode,
		calculationPrecision: settings.calculationPrecision,
		displayPrecision: settings.displayPrecision,
		evaluationTimeLimitMs: settings.evaluationTimeLimitMs,
		allowedFunctions: [...settings.allowedFunctions],
	};
}

function answer(mode: Mode, entry: Answer): string {
	return evaluateLatex(mode, entry.latex, workerSettings(mode, entry.settings))
		.formatted;
}

function runAnswers(mode: Mode, entries: readonly Answer[]): void {
	for (const entry of entries) {
		const label = entry.why
			? `${entry.latex} = ${entry.expects} (${entry.why})`
			: `${entry.latex} = ${entry.expects}`;
		test(label, () => {
			expect(answer(mode, entry)).toBe(entry.expects);
		});
	}
}

function runRefusals(mode: Mode, entries: readonly Refusal[]): void {
	for (const entry of entries) {
		test(`${entry.latex} is refused: ${entry.why}`, () => {
			try {
				evaluateLatex(mode, entry.latex, workerSettings(mode));
			} catch (error) {
				expect((error as { code?: string }).code).toBe(entry.code);
				return;
			}
			throw new Error(`${entry.latex} was accepted in ${mode} mode.`);
		});
	}
}

/* ------------------------------------------------------------------ basic ---- */

const BASIC_ANSWERS: readonly Answer[] = [
	// Operator precedence, the first thing a calculator is judged on.
	{ latex: "2+3\\times4", expects: "14", why: "multiplication binds first" },
	{ latex: "(2+3)\\times4", expects: "20", why: "grouping overrides it" },
	{ latex: "2\\times3+4\\times5", expects: "26" },
	{ latex: "100\\div10\\div2", expects: "5", why: "division is left to right" },
	{ latex: "2-3-4", expects: "-5", why: "so is subtraction" },
	{ latex: "((2+3)\\times(4-1))", expects: "15", why: "nested grouping" },
	// Signs.
	{ latex: "-5+3", expects: "-2" },
	{ latex: "-(3+4)", expects: "-7", why: "negation of a group" },
	{ latex: "5-8", expects: "-3" },
	{ latex: "0-0", expects: "0", why: "never -0" },
	// Boundaries around zero.
	{ latex: "0\\div5", expects: "0" },
	{ latex: "5\\times0", expects: "0" },
	// Decimals and repeating quotients at the default 10-digit display.
	{ latex: "0.1+0.2", expects: "0.3", why: "not 0.30000000000000004" },
	{ latex: "1.5\\times2", expects: "3" },
	{ latex: "10\\div4", expects: "2.5" },
	{ latex: "1\\div3", expects: "0.3333333333" },
	{ latex: "2\\div3", expects: "0.6666666667", why: "rounded, not truncated" },
	// Percent is division by 100, and nothing else.
	{ latex: "50\\%", expects: "0.5" },
	{ latex: "200\\%", expects: "2" },
	{ latex: "50\\%\\times40", expects: "20", why: "50% of 40" },
	// Square root, the one function basic mode has.
	{ latex: "\\sqrt{9}", expects: "3" },
	{ latex: "\\sqrt{0}", expects: "0" },
	{ latex: "\\sqrt{2}", expects: "1.414213562" },
	// Display switches to exponential outside 1e-9 .. 1e12, with no padding.
	{ latex: "12345678901234", expects: "1.23456789e+13" },
	{ latex: "999999999999\\times10", expects: "1e+13" },
	{ latex: "0.000000001\\div10", expects: "1e-10" },
	/*
	 * Entry shapes MathLive emits that nothing above produces. Derived from the
	 * LaTeX corner-case corpora in mathquill's `test/unit/latex.test.js` and
	 * Doenet's `math-expressions` `spec/quick_latex-to-ast.spec.js` -- both of which
	 * test their own parsers, so only the shapes carry over, not the expectations.
	 */
	{ latex: ".5+.25", expects: "0.75", why: "a leading decimal point" },
	{ latex: "1.+2.", expects: "3", why: "a trailing decimal point" },
	{ latex: "2\\cdot3", expects: "6", why: "the other multiplication sign" },
	{
		latex: "\\left(4+5\\right)\\times2",
		expects: "18",
		why: "sized delimiters, which is what the keypad's parentheses produce",
	},
	{ latex: "2\\ +\\ 2", expects: "4", why: "explicit LaTeX spacing" },
];

const BASIC_REFUSALS: readonly Refusal[] = [
	{
		latex: "5\\div0",
		code: "invalid-expression",
		why: "division by zero has no finite real result",
	},
	{
		latex: "\\sqrt{-1}",
		code: "invalid-expression",
		why: "the root of a negative is not real",
	},
	{
		latex: "\\sin(30)",
		code: "unsupported-expression",
		why: "no trigonometry",
	},
	{ latex: "\\ln(2)", code: "unsupported-expression", why: "no logarithms" },
	{ latex: "2^{3}", code: "unsupported-expression", why: "no powers" },
	{ latex: "5!", code: "unsupported-expression", why: "no factorial" },
	{ latex: "\\sqrt[3]{8}", code: "unsupported-expression", why: "no nth root" },
	{ latex: "\\pi", code: "unsupported-expression", why: "no constants" },
	{ latex: "e", code: "unsupported-expression", why: "no constants" },
	{ latex: "2x", code: "unsupported-expression", why: "no variable" },
];

/* ------------------------------------------------------------- scientific ---- */

const SCIENTIFIC_ANSWERS: readonly Answer[] = [
	// Powers and roots.
	{ latex: "2^{10}", expects: "1024" },
	{ latex: "2^{0}", expects: "1" },
	{ latex: "2^{-3}", expects: "0.125" },
	{ latex: "(-2)^{2}", expects: "4" },
	{ latex: "9^{0.5}", expects: "3", why: "fractional exponent" },
	{ latex: "\\sqrt[3]{27}", expects: "3" },
	{
		latex: "\\sqrt[3]{-8}",
		expects: "-2",
		why: "odd roots of negatives are real",
	},
	{ latex: "\\sqrt[4]{16}", expects: "2" },
	{ latex: "\\sqrt{\\sqrt{16}}", expects: "2", why: "nested" },
	// Exponential and logarithms.
	{ latex: "e^{0}", expects: "1" },
	{ latex: "e^{1}", expects: "2.718281828" },
	{ latex: "\\ln(1)", expects: "0" },
	{ latex: "\\ln(e)", expects: "1" },
	{ latex: "\\ln(e^{2})", expects: "2" },
	{ latex: "\\log(100)", expects: "2" },
	{ latex: "\\log(1000)", expects: "3" },
	// Trigonometry in degrees, the default.
	{ latex: "\\sin(0)", expects: "0" },
	{ latex: "\\sin(30)", expects: "0.5" },
	{ latex: "\\sin(90)", expects: "1" },
	{ latex: "\\sin(-30)", expects: "-0.5" },
	{ latex: "\\sin(180)", expects: "0", why: "exact, not 1.2e-16" },
	{ latex: "\\cos(0)", expects: "1" },
	{ latex: "\\cos(60)", expects: "0.5" },
	{ latex: "\\cos(90)", expects: "0", why: "exact, not 6.1e-17" },
	{ latex: "\\tan(0)", expects: "0" },
	{ latex: "\\tan(45)", expects: "1" },
	{ latex: "\\sin(30)+\\cos(60)", expects: "1" },
	// The same functions in radians, which is a setting rather than a mode.
	{ latex: "\\sin(\\pi)", expects: "0", settings: { angleMode: "radian" } },
	{ latex: "\\cos(\\pi)", expects: "-1", settings: { angleMode: "radian" } },
	{
		latex: "\\tan(\\frac{\\pi}{4})",
		expects: "1",
		settings: { angleMode: "radian" },
	},
	{
		latex: "\\sin(30)",
		expects: "-0.9880316241",
		settings: { angleMode: "radian" },
		why: "30 radians, not 30 degrees",
	},
	// Inverse trigonometry answers in the configured unit.
	{ latex: "\\sin^{-1}(0)", expects: "0" },
	{ latex: "\\sin^{-1}(0.5)", expects: "30" },
	{ latex: "\\sin^{-1}(1)", expects: "90" },
	{ latex: "\\sin^{-1}(-1)", expects: "-90" },
	{ latex: "\\cos^{-1}(0)", expects: "90" },
	{ latex: "\\cos^{-1}(1)", expects: "0" },
	{ latex: "\\tan^{-1}(1)", expects: "45" },
	{
		latex: "\\sin^{-1}(1)",
		expects: "1.570796327",
		settings: { angleMode: "radian" },
		why: "pi/2",
	},
	// Absolute value and factorial.
	{ latex: "\\left|-7\\right|", expects: "7" },
	{ latex: "\\left|0\\right|", expects: "0" },
	{ latex: "0!", expects: "1", why: "by definition" },
	{ latex: "1!", expects: "1" },
	{ latex: "5!", expects: "120" },
	{ latex: "20!", expects: "2.432902008e+18", why: "past a double's integers" },
	{
		latex: "2.5!",
		expects: "3.32335097",
		/*
		 * The Gamma continuation, not a domain error. A handheld refuses a
		 * non-integer factorial; Desmos answers 3.32335097, the Compute Engine
		 * answers the same, and Desmos is the reference this calculator follows.
		 */
		why: "the factorial is Gamma(x+1) off the integers",
	},
	// Constants, and the implicit multiplication a learner writes beside them.
	{ latex: "\\pi", expects: "3.141592654" },
	{ latex: "e", expects: "2.718281828" },
	{ latex: "2\\pi", expects: "6.283185307" },
	{ latex: "\\frac{1}{2}", expects: "0.5", why: "a typeset fraction" },
	// Scientific notation, entered the way the keypad produces it.
	{ latex: "3\\times10^{8}", expects: "300000000" },
	{ latex: "1.5\\times10^{-9}", expects: "1.5e-9" },
	// Display precision is a host setting, and it is the only thing it changes.
	{ latex: "1\\div3", expects: "0.333", settings: { displayPrecision: 3 } },
	{ latex: "1\\div3", expects: "0.3", settings: { displayPrecision: 1 } },
	{
		latex: "\\pi",
		expects: "3.14159265359",
		settings: { displayPrecision: 12 },
	},
	{
		latex: "\\sin(30)",
		expects: "0.5",
		settings: { displayPrecision: 12 },
		why: "still exact at the maximum display precision",
	},
	// The calculator forensics expression: the one public accuracy check for a
	// scientific calculator. An accurate machine in degree mode returns 9.
	{
		latex: "\\sin^{-1}(\\cos^{-1}(\\tan^{-1}(\\tan(\\cos(\\sin(9))))))",
		expects: "9",
		why: "calculator forensics",
	},
	/*
	 * Logarithms of a base other than 10 or e. The Compute Engine parses
	 * `\\log_{3}(9)` as `["Log", 9, 3]` -- admitted by `Log` from the start -- but
	 * special-cases base 2 into its own `Lb` operator, which was refused until it
	 * joined the map. Every base is now the one capability, `common-log`.
	 */
	{ latex: "\\log_{2}(8)", expects: "3" },
	{ latex: "\\log_{2}(1024)", expects: "10" },
	{ latex: "\\log_{3}(9)", expects: "2" },
	/*
	 * What the `log-base-n` key actually produces: `\\log_{#0}` with the argument
	 * typed after the subscript, parentheses optional.
	 */
	{ latex: "\\log_{2}8", expects: "3" },
	{ latex: "\\log_{3}9", expects: "2" },
	/* And what the `fraction` key produces, which `#@` fills from what precedes it. */
	{ latex: "\\frac{12}{4}", expects: "3" },
	{ latex: "\\frac34", expects: "0.75" },
	/*
	 * Grouping and precedence shapes from the corpora named in `BASIC_ANSWERS`.
	 */
	{
		latex: "-2^{2}",
		expects: "-4",
		why: "the exponent binds tighter than the negation",
	},
	{ latex: "{2^{3}}^{2}", expects: "64", why: "a braced power, not 2^(3^2)" },
	{
		latex: "\\frac{1}{2}\\pi",
		expects: "1.570796327",
		why: "implicit multiplication after a typeset fraction",
	},
	{ latex: "\\pi\\pi", expects: "9.869604401", why: "two constants, no sign" },
	{
		latex: "|\\sin(|{-1}|)|",
		expects: "0.01745240644",
		why: "nested absolute-value bars",
	},
	/*
	 * An exponent whose placeholder is still empty answers the base, because the
	 * Compute Engine parses `2^{}` as `2`. An empty radical does not: `\\sqrt{}`
	 * parses as `["Sqrt", ["Error", "missing"]]` and is refused below. Both states
	 * are reachable mid-entry, and the asymmetry is the parser's, not this
	 * package's policy -- pinned so a change in either direction is deliberate.
	 */
	{ latex: "2^{}", expects: "2", why: "an exponent not yet filled in" },
];

const SCIENTIFIC_REFUSALS: readonly Refusal[] = [
	{
		latex: "\\tan(90)",
		code: "invalid-expression",
		why: "the tangent is undefined there",
	},
	{
		latex: "\\sin^{-1}(2)",
		code: "invalid-expression",
		why: "outside the inverse sine's domain",
	},
	{
		latex: "\\ln(0)",
		code: "invalid-expression",
		why: "the logarithm has a pole at zero",
	},
	{
		latex: "\\log(-5)",
		code: "invalid-expression",
		why: "no real logarithm of a negative",
	},
	{
		latex: "\\sqrt{-4}",
		code: "invalid-expression",
		why: "the root of a negative is not real",
	},
	{
		latex: "1\\div0",
		code: "invalid-expression",
		why: "division by zero",
	},
	{
		latex: "(-2)!",
		code: "invalid-expression",
		why: "the factorial has poles at the negative integers",
	},
	{
		latex: "x",
		code: "unsupported-expression",
		why: "the variable belongs to graphing mode",
	},
	{
		latex: "2\\sin",
		code: "unsupported-expression",
		why: "a function with no argument",
	},
	{
		latex: "\\foo(2)",
		code: "invalid-expression",
		why: "not a function this calculator has",
	},
	{
		latex: "\\href{https://example.invalid}{2}",
		code: "unsupported-expression",
		why: "a LaTeX command that reaches outside mathematics",
	},
	{ latex: "   ", code: "invalid-expression", why: "an empty edit buffer" },
	{
		latex: "\\sqrt{}",
		code: "invalid-expression",
		why: "an empty radical, unlike the empty exponent that answers its base",
	},
	{
		latex: "3!!",
		code: "unsupported-expression",
		why: "the double factorial is its own operator, not the factorial twice",
	},
	{
		latex: "2_3",
		code: "unsupported-expression",
		why: "a subscripted numeral is a radix, not a product",
	},
	{
		latex: "e^{i\\pi}",
		code: "unsupported-expression",
		why: "this calculator answers real numbers",
	},
	/*
	 * What typing `log_2` into the mathfield actually produces. MathLive nests the
	 * subscript rather than filling it, so a base-2 logarithm is unreachable from
	 * the keyboard even though `\\log_{2}(8)` now answers 3 -- and unreachable from
	 * the keypad, which ships no base-n log key. The capability is therefore
	 * currently exercised only by host-seeded or imported state.
	 */
	{
		latex: "\\log_{_2}(8)",
		code: "unsupported-expression",
		why: "a subscript MathLive nested instead of filling",
	},
];

/* --------------------------------------------------------------- graphing ---- */

interface Plot {
	readonly latex: string;
	readonly viewport: CortexGraphViewport;
	readonly settings?: Record<string, unknown>;
	readonly why: string;
	readonly check: (series: { x: number[]; y: number[] }) => void;
}

const DEFAULT_VIEWPORT: CortexGraphViewport = {
	xMin: -10,
	xMax: 10,
	yMin: -10,
	yMax: 10,
};
const POINTS = 201;

function finiteY(series: { x: number[]; y: number[] }): number[] {
	return series.y.filter((value) => Number.isFinite(value));
}

function yAt(series: { x: number[]; y: number[] }, x: number): number {
	let closest = 0;
	for (let index = 1; index < series.x.length; index += 1) {
		const candidate = series.x[index] ?? Number.NaN;
		if (
			Math.abs(candidate - x) < Math.abs((series.x[closest] ?? Number.NaN) - x)
		) {
			closest = index;
		}
	}
	return series.y[closest] ?? Number.NaN;
}

const PLOTS: readonly Plot[] = [
	{
		latex: "y=x",
		viewport: DEFAULT_VIEWPORT,
		why: "a line is finite everywhere and strictly increasing",
		check: (series) => {
			expect(finiteY(series)).toHaveLength(POINTS);
			for (let index = 1; index < series.y.length; index += 1) {
				expect(series.y[index]).toBeGreaterThan(series.y[index - 1] ?? 0);
			}
			expect(yAt(series, 5)).toBeCloseTo(5, 6);
		},
	},
	{
		latex: "y=2x+1",
		viewport: DEFAULT_VIEWPORT,
		why: "a coefficient and an intercept, written without a times sign",
		check: (series) => {
			expect(yAt(series, 0)).toBeCloseTo(1, 6);
			expect(yAt(series, 2)).toBeCloseTo(5, 6);
		},
	},
	{
		latex: "y=x^2",
		viewport: DEFAULT_VIEWPORT,
		why: "a parabola is symmetric about the y axis and bottoms out at zero",
		check: (series) => {
			expect(finiteY(series)).toHaveLength(POINTS);
			expect(Math.min(...finiteY(series))).toBeCloseTo(0, 6);
			expect(yAt(series, -3)).toBeCloseTo(yAt(series, 3), 6);
		},
	},
	{
		latex: "f(x)=x^2",
		viewport: DEFAULT_VIEWPORT,
		why: "the second documented entry form plots the same curve",
		check: (series) => expect(yAt(series, 3)).toBeCloseTo(9, 6),
	},
	{
		latex: "x^2",
		viewport: DEFAULT_VIEWPORT,
		why: "and so does a bare expression",
		check: (series) => expect(yAt(series, 3)).toBeCloseTo(9, 6),
	},
	{
		latex: "y=x^3",
		viewport: DEFAULT_VIEWPORT,
		why: "an odd power is antisymmetric",
		check: (series) => expect(yAt(series, -2)).toBeCloseTo(-yAt(series, 2), 6),
	},
	{
		latex: "y=\\left|x\\right|",
		viewport: { xMin: -4, xMax: 4, yMin: -1, yMax: 5 },
		why: "absolute value is a V with its vertex on the axis",
		check: (series) => {
			expect(finiteY(series)).toHaveLength(POINTS);
			expect(Math.min(...finiteY(series))).toBeCloseTo(0, 6);
			expect(yAt(series, -2)).toBeCloseTo(2, 6);
		},
	},
	{
		latex: "y=\\sqrt{x}",
		viewport: { xMin: -5, xMax: 5, yMin: -2, yMax: 3 },
		why: "a domain edge: nothing is plotted left of zero",
		check: (series) => {
			const negatives = series.x
				.map((x, index) => ({ x, y: series.y[index] }))
				.filter((point) => point.x < -0.01);
			expect(negatives.length).toBeGreaterThan(50);
			for (const point of negatives) expect(Number.isNaN(point.y)).toBe(true);
			expect(yAt(series, 4)).toBeCloseTo(2, 6);
		},
	},
	{
		latex: "y=\\ln(x)",
		viewport: { xMin: -5, xMax: 5, yMin: -3, yMax: 3 },
		why: "the logarithm's domain edge sits at zero, not at a negative bound",
		check: (series) => {
			expect(Number.isNaN(yAt(series, -1))).toBe(true);
			expect(yAt(series, 1)).toBeCloseTo(0, 6);
		},
	},
	{
		latex: "y=1\\div x",
		viewport: { xMin: -5, xMax: 5, yMin: -10, yMax: 10 },
		why: "a pole is a break in the series, not a vertical line across it",
		check: (series) => {
			expect(series.y.some((value) => Number.isNaN(value))).toBe(true);
			expect(
				finiteY(series).filter((value) => value < 0).length,
			).toBeGreaterThan(50);
			expect(
				finiteY(series).filter((value) => value > 0).length,
			).toBeGreaterThan(50);
			expect(yAt(series, 2)).toBeCloseTo(0.5, 6);
		},
	},
	{
		latex: "y=\\tan(x)",
		viewport: { xMin: -6, xMax: 6, yMin: -5, yMax: 5 },
		settings: { angleMode: "radian" },
		why: "repeated poles each break the series",
		check: (series) => {
			expect(
				series.y.filter((value) => Number.isNaN(value)).length,
			).toBeGreaterThan(1);
		},
	},
	{
		latex: "y=\\sin(x)",
		viewport: { xMin: -6.3, xMax: 6.3, yMin: -2, yMax: 2 },
		settings: { angleMode: "radian" },
		why: "a bounded periodic curve over one full turn either way",
		check: (series) => {
			expect(finiteY(series)).toHaveLength(POINTS);
			expect(Math.max(...finiteY(series))).toBeCloseTo(1, 3);
			expect(Math.min(...finiteY(series))).toBeCloseTo(-1, 3);
		},
	},
	{
		latex: "y=e^{x}",
		viewport: { xMin: -2, xMax: 2, yMin: -1, yMax: 8 },
		why: "exponential growth through (0, 1)",
		check: (series) => {
			expect(yAt(series, 0)).toBeCloseTo(1, 6);
			expect(yAt(series, 1)).toBeCloseTo(Math.E, 6);
		},
	},
	{
		latex: "y=3x^2+2x+1",
		viewport: DEFAULT_VIEWPORT,
		why: "a quadratic in the ordinary written form, coefficients and all",
		check: (series) => {
			expect(yAt(series, 0)).toBeCloseTo(1, 6);
			expect(yAt(series, 2)).toBeCloseTo(17, 6);
		},
	},
];

const GRAPHING_REFUSALS: readonly Refusal[] = [
	{
		latex: "y=2t",
		code: "unsupported-expression",
		why: "x is the only variable the first release plots",
	},
	{
		latex: "y=x+z",
		code: "unsupported-expression",
		why: "a second free symbol",
	},
	{
		latex: "x^2+y^2=1",
		code: "unsupported-expression",
		why: "an implicit relation, explicitly out of scope",
	},
	{
		latex: "y>x",
		code: "unsupported-expression",
		why: "an inequality, explicitly out of scope",
	},
];

/* ------------------------------------------------------------------ suite ---- */

describe("basic mode", () => {
	runAnswers("basic", BASIC_ANSWERS);
	runRefusals("basic", BASIC_REFUSALS);
});

describe("scientific mode", () => {
	runAnswers("scientific", SCIENTIFIC_ANSWERS);
	runRefusals("scientific", SCIENTIFIC_REFUSALS);
});

describe("graphing mode", () => {
	test("has the whole scientific capability set", () => {
		// Anything scientific mode accepts, graphing mode accepts. Only the free
		// symbol is added, and a policy that drifted apart would be invisible until
		// a learner switched modes mid-item.
		const closed = SCIENTIFIC_ANSWERS.filter(
			(entry) => !entry.latex.includes("x"),
		);
		expect(closed.length).toBeGreaterThan(30);
		for (const entry of closed) {
			expect(answer("graphing", entry), entry.latex).toBe(entry.expects);
		}
	});

	for (const plot of PLOTS) {
		test(`${plot.latex}: ${plot.why}`, () => {
			const [series] = sampleLatex(
				[{ id: "row", latex: plot.latex }],
				plot.viewport,
				POINTS,
				workerSettings("graphing", plot.settings),
			);
			if (!series) throw new Error(`${plot.latex} produced no series.`);
			expect(series.x).toHaveLength(POINTS);
			plot.check(series);
		});
	}

	runRefusals("graphing", GRAPHING_REFUSALS);

	test("samples the window it is given, not a fixed one", () => {
		const sample = (viewport: CortexGraphViewport) =>
			sampleLatex(
				[{ id: "row", latex: "y=x" }],
				viewport,
				POINTS,
				workerSettings("graphing"),
			)[0];

		const wide = sample({ xMin: -100, xMax: 100, yMin: -100, yMax: 100 });
		const narrow = sample({ xMin: -1, xMax: 1, yMin: -1, yMax: 1 });
		expect(wide?.x[0]).toBeCloseTo(-100, 6);
		expect(narrow?.x[0]).toBeCloseTo(-1, 6);
		expect(wide?.x.at(-1)).toBeCloseTo(100, 6);
		expect(narrow?.x.at(-1)).toBeCloseTo(1, 6);
	});

	test("plots every row of a full expression list at once", () => {
		const rows = ["y=x", "y=x^2", "y=x^3", "y=\\sqrt{x}", "y=2x", "y=x-1"].map(
			(latex, index) => ({ id: `row-${index}`, latex }),
		);
		const series = sampleLatex(
			rows,
			DEFAULT_VIEWPORT,
			POINTS,
			workerSettings("graphing"),
		);
		expect(series.map((entry) => entry.id)).toEqual(rows.map((row) => row.id));
		for (const entry of series) expect(entry.x).toHaveLength(POINTS);
	});
});

describe("what a host can narrow", () => {
	test("removing a capability refuses the expressions that need it", () => {
		const withoutTrig = {
			allowedFunctions: [
				...resolveCortexSettings("scientific").allowedFunctions,
			].filter((entry) => entry !== "sine"),
		};
		expect(answer("scientific", { latex: "2+2", expects: "4" })).toBe("4");
		expect(() =>
			evaluateLatex(
				"scientific",
				"\\sin(30)",
				workerSettings("scientific", withoutTrig),
			),
		).toThrow();
		// Cosine was not removed, so it still answers.
		expect(
			evaluateLatex(
				"scientific",
				"\\cos(60)",
				workerSettings("scientific", withoutTrig),
			).formatted,
		).toBe("0.5");
	});

	test("a host can grant log base 10 without granting every base", () => {
		/*
		 * The reason `log-base-n` exists. The Compute Engine parses `\\log_{3}(9)` as
		 * `["Log", 9, 3]`, so before the split an arbitrary base rode in on the same
		 * `Log` that carries base 10 and a host granting `common-log` had no way to
		 * decline it. Base 2 is spelled differently again -- `["Lb", 8]` -- and was
		 * refused outright while every other base answered.
		 */
		const scientific = [
			...resolveCortexSettings("scientific").allowedFunctions,
		];
		const withoutBaseN = {
			allowedFunctions: scientific.filter((entry) => entry !== "log-base-n"),
		};
		const withoutCommon = {
			allowedFunctions: scientific.filter((entry) => entry !== "common-log"),
		};

		// Revoking base-n leaves base 10 and base e untouched.
		expect(
			evaluateLatex(
				"scientific",
				"\\log(100)",
				workerSettings("scientific", withoutBaseN),
			).formatted,
		).toBe("2");
		expect(
			evaluateLatex(
				"scientific",
				"\\ln(e)",
				workerSettings("scientific", withoutBaseN),
			).formatted,
		).toBe("1");
		for (const latex of ["\\log_{2}8", "\\log_{3}9"]) {
			expect(() =>
				evaluateLatex(
					"scientific",
					latex,
					workerSettings("scientific", withoutBaseN),
				),
			).toThrow();
		}

		// And revoking base 10 does not take base-n with it.
		expect(
			evaluateLatex(
				"scientific",
				"\\log_{3}9",
				workerSettings("scientific", withoutCommon),
			).formatted,
		).toBe("2");
		expect(() =>
			evaluateLatex(
				"scientific",
				"\\log(100)",
				workerSettings("scientific", withoutCommon),
			),
		).toThrow();
	});

	test("basic mode has no logarithms at all", () => {
		for (const latex of ["\\log(100)", "\\ln(e)", "\\log_{2}8"]) {
			expect(() =>
				evaluateLatex("basic", latex, workerSettings("basic")),
			).toThrow();
		}
	});

	test("an angle mode a host sets is the one every answer uses", () => {
		for (const [angleMode, expected] of [
			["degree", "1"],
			["radian", "1.619775191"],
		] as const) {
			expect(
				evaluateLatex(
					"scientific",
					"\\tan(45)",
					workerSettings("scientific", { angleMode }),
				).formatted,
			).toBe(expected);
		}
	});
});
