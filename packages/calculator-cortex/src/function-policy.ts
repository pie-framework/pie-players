import { ComputeEngine, type Expression } from "@cortex-js/compute-engine";
import type { CalculatorType } from "@pie-players/pie-calculator";
import { CortexCalculatorError } from "./errors.js";
import {
	CORTEX_AST_DEPTH_LIMIT,
	CORTEX_AST_NODE_LIMIT,
	CORTEX_INPUT_LENGTH_LIMIT,
	type ResolvedCortexSettings,
} from "./settings.js";
import type { CortexFunctionId } from "./types.js";

const BASE_OPERATORS = new Set([
	"Number",
	"Integer",
	"Rational",
	"Real",
	"Symbol",
	"Add",
	"Subtract",
	"Negate",
	"Multiply",
	"Divide",
	/*
	 * Implicit multiplication. The Compute Engine parses `2x`, `2\pi`, `3(4+5)` and
	 * `2\sin(x)` as `InvisibleOperator`, so omitting it here refused the ordinary
	 * way a polynomial coefficient is written — `y=3x^2+2x+1` was rejected while
	 * `y=3\times x^2` was accepted. It grants no capability `Multiply` does not:
	 * operands are still validated recursively, so `2\sin(x)` continues to require
	 * `sine` in the mode's allowlist.
	 */
	"InvisibleOperator",
]);

const FUNCTION_OPERATORS: Readonly<Record<string, CortexFunctionId>> = {
	Sqrt: "square-root",
	Root: "root",
	Exp: "exponential",
	Ln: "natural-log",
	Log: "common-log",
	Log10: "common-log",
	Sin: "sine",
	Cos: "cosine",
	Tan: "tangent",
	Arcsin: "inverse-sine",
	Arccos: "inverse-cosine",
	Arctan: "inverse-tangent",
	Abs: "absolute-value",
	Factorial: "factorial",
};

/*
 * `\sin^{-1}(x)` — what the keypad's inverse keys insert — parses to
 * `["Apply", ["InverseFunction", "Sin"], x]`, not to `Arcsin`, which is only the
 * canonical spelling. The three keys shipped refusing their own output.
 *
 * Only these three heads are recognised. Permitting `Apply` generally would let an
 * arbitrary head be applied to arguments, which is the one thing a capability
 * allowlist over canonical operators exists to prevent.
 */
const INVERSE_FUNCTION_OPERATORS: Readonly<Record<string, CortexFunctionId>> = {
	Sin: "inverse-sine",
	Cos: "inverse-cosine",
	Tan: "inverse-tangent",
};

const FORBIDDEN_LATEX =
	/\\(?:html|class|cssId|style|href|url|includegraphics|input|require|unicode|tooltip|error)\b/i;

export interface EditBufferInspection {
	readonly latex: string;
	readonly empty: boolean;
}

export interface ValidatedExpression {
	readonly latex: string;
	readonly expression: Expression;
	readonly nodeCount: number;
	readonly depth: number;
}

export function inspectEditBuffer(latex: string): EditBufferInspection {
	if (typeof latex !== "string") {
		throw new CortexCalculatorError(
			"invalid-expression",
			"Calculator input must be a LaTeX string.",
		);
	}
	if (latex.length > CORTEX_INPUT_LENGTH_LIMIT) {
		throw new CortexCalculatorError(
			"expression-too-complex",
			`Calculator input is limited to ${CORTEX_INPUT_LENGTH_LIMIT} characters.`,
		);
	}
	if (FORBIDDEN_LATEX.test(latex)) {
		throw new CortexCalculatorError(
			"unsupported-expression",
			"This expression contains an unsupported command.",
		);
	}
	return { latex, empty: latex.trim().length === 0 };
}

export function unwrapGraphExpression(latex: string): string {
	const trimmed = latex.trim();
	const yMatch = trimmed.match(/^y\s*=\s*(.+)$/i);
	if (yMatch?.[1]) return yMatch[1];
	const functionMatch = trimmed.match(/^f\s*\(\s*x\s*\)\s*=\s*(.+)$/i);
	return functionMatch?.[1] ?? trimmed;
}

function requiredPowerCapability(
	latex: string,
	expression: readonly unknown[],
): CortexFunctionId {
	if (/\\sqrt\s*\[/.test(latex)) return "root";
	if (/\\sqrt/.test(latex)) return "square-root";
	const baseSymbol = expression[1];
	if (
		baseSymbol === "ExponentialE" ||
		baseSymbol === "E" ||
		baseSymbol === "e"
	) {
		return "exponential";
	}
	return "power";
}

function validateSymbol(
	symbol: string | undefined,
	type: CalculatorType,
): void {
	// `e` is what a structural parse yields; `ExponentialE` is the canonical form.
	// Accepting only the latter refused both the euler key and the `e^x` key.
	if (
		symbol === "Pi" ||
		symbol === "ExponentialE" ||
		symbol === "E" ||
		symbol === "e"
	) {
		if (type === "basic") {
			throw new CortexCalculatorError(
				"unsupported-expression",
				"Constants are not available in the basic calculator.",
			);
		}
		return;
	}
	if (symbol === "x" && type === "graphing") return;
	throw new CortexCalculatorError(
		"unsupported-expression",
		`The symbol ${symbol ?? "in this expression"} is not available in this calculator.`,
	);
}

function requireFunction(
	functionId: CortexFunctionId,
	settings: ResolvedCortexSettings,
): void {
	if (!settings.allowedFunctions.has(functionId)) {
		throw new CortexCalculatorError(
			"unsupported-expression",
			`The ${functionId} function is not available in this calculator.`,
		);
	}
}

export function validateExpression(
	engine: ComputeEngine,
	latex: string,
	settings: ResolvedCortexSettings,
): ValidatedExpression {
	const inspection = inspectEditBuffer(latex);
	if (inspection.empty) {
		throw new CortexCalculatorError(
			"invalid-expression",
			"Enter an expression to calculate.",
		);
	}

	const normalizedLatex =
		settings.type === "graphing" ? unwrapGraphExpression(latex) : latex;
	let expression: Expression;
	try {
		expression = engine.parse(normalizedLatex, {
			form: "structural",
			strict: true,
		});
	} catch (error) {
		throw new CortexCalculatorError(
			"invalid-expression",
			"The expression could not be parsed.",
			{ cause: error },
		);
	}
	if (!expression.isValid) {
		throw new CortexCalculatorError(
			"invalid-expression",
			"Check the expression for missing or unsupported input.",
		);
	}

	let nodeCount = 0;
	let maximumDepth = 0;
	const pending: Array<{ expression: unknown; depth: number }> = [
		{ expression: expression.json, depth: 1 },
	];
	while (pending.length > 0) {
		const current = pending.pop();
		if (!current) break;
		nodeCount += 1;
		maximumDepth = Math.max(maximumDepth, current.depth);
		if (
			nodeCount > CORTEX_AST_NODE_LIMIT ||
			current.depth > CORTEX_AST_DEPTH_LIMIT
		) {
			throw new CortexCalculatorError(
				"expression-too-complex",
				"The expression is too complex for this calculator.",
			);
		}

		const value = current.expression;
		if (typeof value === "number") continue;
		if (typeof value === "string") {
			validateSymbol(value, settings.type);
			continue;
		}
		if (!Array.isArray(value)) {
			if (
				value &&
				typeof value === "object" &&
				"num" in value &&
				typeof (value as { num?: unknown }).num === "string"
			) {
				continue;
			}
			throw new CortexCalculatorError(
				"unsupported-expression",
				"This expression contains an unsupported value.",
			);
		}
		const operator = typeof value[0] === "string" ? value[0] : "Unknown";
		if (operator === "Error") {
			throw new CortexCalculatorError(
				"invalid-expression",
				"The expression contains invalid input.",
			);
		}
		if (operator === "Apply") {
			const head = value[1];
			const inverse =
				Array.isArray(head) && head[0] === "InverseFunction"
					? INVERSE_FUNCTION_OPERATORS[
							typeof head[1] === "string" ? head[1] : ""
						]
					: undefined;
			if (!inverse) {
				throw new CortexCalculatorError(
					"unsupported-expression",
					"This expression applies a function this calculator does not provide.",
				);
			}
			requireFunction(inverse, settings);
			// The head is consumed here; only the arguments are queued.
			for (const operand of value.slice(2)) {
				pending.push({ expression: operand, depth: current.depth + 1 });
			}
			continue;
		}
		if (operator === "Delimiter") {
			/*
			 * Grouping, not a function. The Compute Engine parses `(4+5)` as
			 * `["Delimiter", ["Add", 4, 5]]`, so refusing this operator refused every
			 * parenthesised expression in every mode — including `(2+3)\times4` from the
			 * shipped keypad's own `(` and `)` keys, while the PRD's first capability
			 * line grants parentheses everywhere.
			 *
			 * Only the grouped expression is queued. A later operand is the delimiter
			 * string itself (`"(,)"`), which the traversal would otherwise read as a
			 * free symbol; and a separator-bearing delimiter still fails, because the
			 * `Sequence` it wraps is not a permitted operator.
			 */
			if (value[1] !== undefined) {
				pending.push({ expression: value[1], depth: current.depth + 1 });
			}
			continue;
		}
		if (operator === "Power") {
			requireFunction(
				requiredPowerCapability(normalizedLatex, value),
				settings,
			);
		} else if (!BASE_OPERATORS.has(operator)) {
			const functionId = FUNCTION_OPERATORS[operator];
			if (!functionId) {
				throw new CortexCalculatorError(
					"unsupported-expression",
					`The ${operator} operation is not available in this calculator.`,
				);
			}
			requireFunction(functionId, settings);
		}

		for (const operand of value.slice(1)) {
			pending.push({ expression: operand, depth: current.depth + 1 });
		}
	}

	const canonicalExpression = expression.canonical;
	if (!canonicalExpression.isPure) {
		throw new CortexCalculatorError(
			"unsupported-expression",
			"Only deterministic calculations are supported.",
		);
	}

	return {
		latex: normalizedLatex,
		expression: canonicalExpression,
		nodeCount,
		depth: maximumDepth,
	};
}
