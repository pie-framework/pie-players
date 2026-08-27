import { ComputeEngine } from "@cortex-js/compute-engine";
import type { CalculatorType } from "@pie-players/pie-calculator";
import { describe, expect, test } from "bun:test";
import { evaluateLatex, sampleLatex } from "../src/evaluation-engine.js";
import { validateExpression } from "../src/function-policy.js";
import { type KeypadKey, keypadLayers } from "../src/keypad-layouts.js";
import { createCortexLocalization } from "../src/localization.js";
import { resolveCortexSettings } from "../src/settings.js";
import type { CortexFunctionId } from "../src/types.js";
import type { WorkerEvaluationSettings } from "../src/worker-protocol.js";

/*
 * Every key the package renders, proved to produce an expression the policy
 * accepts and the engine can evaluate.
 *
 * The keypad and `validateExpression` are independent: the keypad decides what to
 * offer from `allowedFunctions`, the policy decides what to accept from the
 * canonical AST, and nothing structural connects the two. Both `(` and `)` shipped
 * as keys while every parenthesised expression was refused, because no test ever
 * pressed them — the suites reached `2+2`, `\sin(30)`, `5!`, `50\%` and `y=x^2`.
 *
 * `KEY_EXPRESSIONS` is therefore exhaustive by assertion: a key with no entry
 * fails, so adding one to a layout means proving it works.
 */

interface KeyCase {
	/** A complete expression containing this key's insertion. */
	readonly latex: string;
	/** Expected formatted result, where the expression is closed. */
	readonly expects?: string;
	/** Set for graphing keys, which are sampled over `x` instead of evaluated. */
	readonly sampled?: true;
}

const KEY_EXPRESSIONS: Readonly<Record<string, KeyCase>> = {
	"digit-0": { latex: "0", expects: "0" },
	"digit-1": { latex: "1", expects: "1" },
	"digit-2": { latex: "2", expects: "2" },
	"digit-3": { latex: "3", expects: "3" },
	"digit-4": { latex: "4", expects: "4" },
	"digit-5": { latex: "5", expects: "5" },
	"digit-6": { latex: "6", expects: "6" },
	"digit-7": { latex: "7", expects: "7" },
	"digit-8": { latex: "8", expects: "8" },
	"digit-9": { latex: "9", expects: "9" },
	"decimal-separator": { latex: "1.5", expects: "1.5" },
	add: { latex: "2+3", expects: "5" },
	subtract: { latex: "7-3", expects: "4" },
	multiply: { latex: "6\\times7", expects: "42" },
	divide: { latex: "9\\div4", expects: "2.25" },
	"open-parenthesis": { latex: "(2+3)\\times4", expects: "20" },
	"close-parenthesis": { latex: "(2+3)\\times4", expects: "20" },
	percent: { latex: "50\\%", expects: "0.5" },
	"square-root": { latex: "\\sqrt{9}", expects: "3" },
	sine: { latex: "\\sin(30)", expects: "0.5" },
	cosine: { latex: "\\cos(60)", expects: "0.5" },
	tangent: { latex: "\\tan(45)", expects: "1" },
	"natural-log": { latex: "\\ln(1)", expects: "0" },
	"common-log": { latex: "\\log(100)", expects: "2" },
	"inverse-sine": { latex: "\\sin^{-1}(1)", expects: "90" },
	"inverse-cosine": { latex: "\\cos^{-1}(1)", expects: "0" },
	"inverse-tangent": { latex: "\\tan^{-1}(1)", expects: "45" },
	exponential: { latex: "e^{0}", expects: "1" },
	power: { latex: "3^{4}", expects: "81" },
	"nth-root": { latex: "\\sqrt[3]{27}", expects: "3" },
	"absolute-value": { latex: "\\left|-3\\right|", expects: "3" },
	factorial: { latex: "5!", expects: "120" },
	pi: { latex: "\\pi", expects: "3.141592654" },
	euler: { latex: "e", expects: "2.718281828" },
	"variable-x": { latex: "y=2x", sampled: true },
	"x-squared": { latex: "y=x^2", sampled: true },
	"x-cubed": { latex: "y=x^3", sampled: true },
	"root-x": { latex: "y=\\sqrt{x}", sampled: true },
	"abs-x": { latex: "y=\\left|x\\right|", sampled: true },
	// The commit key inserts nothing; it evaluates the buffer.
	commit: { latex: "" },
};

const MODES: readonly CalculatorType[] = ["basic", "scientific", "graphing"];
const localization = createCortexLocalization("en-US");

function keysFor(type: CalculatorType): KeypadKey[] {
	return keypadLayers(resolveCortexSettings(type), localization).flatMap(
		(layer) => layer.rows.flatMap((row) => [...row]),
	);
}

function workerSettings(type: CalculatorType): WorkerEvaluationSettings {
	const settings = resolveCortexSettings(type);
	return {
		angleMode: settings.angleMode,
		calculationPrecision: settings.calculationPrecision,
		displayPrecision: settings.displayPrecision,
		evaluationTimeLimitMs: settings.evaluationTimeLimitMs,
		allowedFunctions: [...settings.allowedFunctions],
	};
}

/** The key's own template, with `#0`/`#@` placeholders removed. */
function templateFragments(latex: string): string[] {
	return latex
		.split(/#0|#@/)
		.map((fragment) => fragment.trim())
		.filter((fragment) => fragment.length > 0);
}

describe("every shipped keypad key produces a usable expression", () => {
	test("no mode offers a key without a proven expression", () => {
		const missing = MODES.flatMap((type) =>
			keysFor(type)
				.filter((key) => !(key.id in KEY_EXPRESSIONS))
				.map((key) => `${type}:${key.id}`),
		);
		expect(missing).toEqual([]);
	});

	test("no proven expression names a key that no longer ships", () => {
		const shipped = new Set(
			MODES.flatMap((type) => keysFor(type).map((key) => key.id)),
		);
		expect(
			Object.keys(KEY_EXPRESSIONS).filter((id) => !shipped.has(id)),
		).toEqual([]);
	});

	for (const type of MODES) {
		describe(type, () => {
			for (const key of keysFor(type)) {
				const testCase = KEY_EXPRESSIONS[key.id];
				if (!testCase?.latex) continue;

				test(`${key.id} is accepted and evaluated`, () => {
					// The proven expression really does contain this key's insertion, in
					// order, so the case cannot drift into testing something else.
					let cursor = 0;
					for (const fragment of templateFragments(key.latex)) {
						const index = testCase.latex.indexOf(fragment, cursor);
						expect(index, `${key.id}: "${fragment}" missing`).toBeGreaterThan(
							-1,
						);
						cursor = index + fragment.length;
					}

					const settings = resolveCortexSettings(type);
					validateExpression(new ComputeEngine(), testCase.latex, settings);

					if (testCase.sampled) {
						const [series] = sampleLatex(
							[{ id: key.id, latex: testCase.latex }],
							{ xMin: 1, xMax: 5, yMin: -10, yMax: 30 },
							200,
							workerSettings(type),
						);
						expect(
							series?.y.filter((value) => Number.isFinite(value)).length,
						).toBeGreaterThan(100);
						return;
					}
					if (testCase.expects !== undefined) {
						expect(
							evaluateLatex(type, testCase.latex, workerSettings(type))
								.formatted,
						).toBe(testCase.expects);
					}
				});
			}
		});
	}
});

describe("keypad pruning tracks the policy that would refuse the key", () => {
	test("removing a capability removes every key that requires it", () => {
		const gated = new Map<CortexFunctionId, string[]>();
		for (const key of keysFor("graphing")) {
			for (const capability of key.requires ?? []) {
				gated.set(capability, [...(gated.get(capability) ?? []), key.id]);
			}
		}
		expect(gated.size).toBeGreaterThan(0);

		for (const [capability, keyIds] of gated) {
			const remaining = [
				...resolveCortexSettings("graphing").allowedFunctions,
			].filter((entry) => entry !== capability);
			const narrowed = keysFor("graphing");
			const offered = new Set(
				keypadLayers(
					resolveCortexSettings("graphing", {
						settings: { allowedFunctions: remaining },
					}),
					localization,
				)
					.flatMap((layer) => layer.rows.flatMap((row) => [...row]))
					.map((key) => key.id),
			);
			expect(narrowed.length).toBeGreaterThan(offered.size);
			for (const keyId of keyIds) {
				expect(
					offered.has(keyId),
					`${keyId} survived losing ${capability}`,
				).toBe(false);
			}
		}
	});

	test("basic mode withholds the constants its policy rejects", () => {
		const basic = new Set(keysFor("basic").map((key) => key.id));
		expect(basic.has("pi")).toBe(false);
		expect(basic.has("euler")).toBe(false);
	});
});
