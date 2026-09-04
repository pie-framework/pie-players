import { ComputeEngine } from "@cortex-js/compute-engine";
import { describe, expect, test } from "bun:test";
import { evaluateLatex, sampleLatex } from "../src/evaluation-engine.js";
import {
	inspectEditBuffer,
	unwrapGraphExpression,
	validateExpression,
} from "../src/function-policy.js";
import {
	CORTEX_AST_DEPTH_LIMIT,
	CORTEX_AST_NODE_LIMIT,
	CORTEX_GRAPH_SAMPLE_LIMIT,
	CORTEX_INPUT_LENGTH_LIMIT,
	resolveCortexSettings,
} from "../src/settings.js";
import type { WorkerEvaluationSettings } from "../src/worker-protocol.js";
import { expectCortexCode } from "./support/cortex-errors.js";

/*
 * The bounds from the PRD's "Defaults and hard limits" table and its error
 * contract. Every one of them is the difference between a malformed or hostile
 * expression producing a message and producing an unbounded computation, so each
 * is asserted against the exported constant rather than against a copied literal.
 */

const SCIENTIFIC_FUNCTIONS = [
	"square-root",
	"power",
	"root",
	"exponential",
	"natural-log",
	"common-log",
	"sine",
	"cosine",
	"tangent",
	"inverse-sine",
	"inverse-cosine",
	"inverse-tangent",
	"absolute-value",
	"factorial",
] as const;

const workerSettings: WorkerEvaluationSettings = {
	angleMode: "degree",
	calculationPrecision: 15,
	displayPrecision: 10,
	evaluationTimeLimitMs: 1_000,
	allowedFunctions: [...SCIENTIFIC_FUNCTIONS],
};

const engine = () => new ComputeEngine();

describe("input and AST budgets", () => {
	test("accepts input at the length ceiling and refuses one unit past it", () => {
		const atLimit = "1".repeat(CORTEX_INPUT_LENGTH_LIMIT);
		expect(inspectEditBuffer(atLimit).latex).toHaveLength(
			CORTEX_INPUT_LENGTH_LIMIT,
		);
		expectCortexCode(
			() => inspectEditBuffer(`${atLimit}1`),
			"expression-too-complex",
		);
	});

	test("treats a non-string edit buffer as invalid rather than coercing it", () => {
		expectCortexCode(
			() => inspectEditBuffer(undefined as unknown as string),
			"invalid-expression",
		);
	});

	test("refuses LaTeX commands that reach outside mathematics", () => {
		// The edit buffer is checked before parsing, so a command the Compute Engine
		// would silently drop cannot ride into stored state either.
		for (const latex of [
			"\\html{<script>}",
			"\\href{https://example.invalid}{x}",
			"\\includegraphics{x}",
			"\\class{x}{1}",
			"\\style{color:red}{1}",
		]) {
			expectCortexCode(
				() => inspectEditBuffer(latex),
				"unsupported-expression",
			);
		}
	});

	test("counts nodes and refuses a sum past the node budget", () => {
		const settings = resolveCortexSettings("scientific");
		const sum = (terms: number) =>
			Array.from({ length: terms }, () => "1").join("+");

		const wide = validateExpression(engine(), sum(200), settings);
		expect(wide.nodeCount).toBeGreaterThan(200);
		expect(wide.nodeCount).toBeLessThanOrEqual(CORTEX_AST_NODE_LIMIT);

		expectCortexCode(
			() =>
				validateExpression(engine(), sum(CORTEX_AST_NODE_LIMIT + 50), settings),
			"expression-too-complex",
		);
	});

	test("refuses nesting past the depth budget", () => {
		const settings = resolveCortexSettings("scientific");
		const nested = (depth: number) =>
			`${"\\sqrt{".repeat(depth)}2${"}".repeat(depth)}`;

		const shallow = validateExpression(engine(), nested(4), settings);
		expect(shallow.depth).toBeLessThanOrEqual(CORTEX_AST_DEPTH_LIMIT);

		expectCortexCode(
			() =>
				validateExpression(
					engine(),
					nested(CORTEX_AST_DEPTH_LIMIT + 8),
					settings,
				),
			"expression-too-complex",
		);
	});
});

describe("results that are not finite real numbers", () => {
	test("refuses division by zero, a log pole, and an imaginary root", () => {
		for (const [type, latex] of [
			["basic", "1\\div0"],
			["scientific", "\\ln(0)"],
			["basic", "\\sqrt{-1}"],
		] as const) {
			expectCortexCode(
				() => evaluateLatex(type, latex, workerSettings),
				"invalid-expression",
			);
		}
	});

	test("refuses an empty edit buffer with a recoverable error", () => {
		const settings = resolveCortexSettings("basic");
		const error = expectCortexCode(
			() => validateExpression(engine(), "   ", settings),
			"invalid-expression",
		);
		expect(error.recoverable).toBe(true);
	});
});

describe("mode policy at the expression seam", () => {
	test("accepts both documented graph entry forms", () => {
		expect(unwrapGraphExpression("y=x^2")).toBe("x^2");
		expect(unwrapGraphExpression("f(x) = x^2")).toBe("x^2");
		expect(unwrapGraphExpression("x^2")).toBe("x^2");
	});

	test("permits x only in graphing mode and no other free symbol anywhere", () => {
		validateExpression(engine(), "y=2x", resolveCortexSettings("graphing"));
		expectCortexCode(
			() =>
				validateExpression(engine(), "2x", resolveCortexSettings("scientific")),
			"unsupported-expression",
		);
		expectCortexCode(
			() =>
				validateExpression(engine(), "y=2t", resolveCortexSettings("graphing")),
			"unsupported-expression",
		);
	});

	test("accepts implicit multiplication wherever multiplication is allowed", () => {
		/*
		 * `2x` and `2\pi` parse to `InvisibleOperator`, not `Multiply`. Refusing that
		 * operator refused the ordinary way a coefficient is written, and the keypad
		 * produces it: a digit followed by the pi or sin key.
		 */
		validateExpression(
			engine(),
			"y=3x^2+2x+1",
			resolveCortexSettings("graphing"),
		);
		const scientific = resolveCortexSettings("scientific");
		for (const latex of ["2\\pi", "2\\sin(30)", "3(4+5)"]) {
			validateExpression(engine(), latex, scientific);
		}
		expect(
			evaluateLatex("scientific", "3(4+5)", workerSettings).formatted,
		).toBe("27");
		// And it still grants no function the mode withholds.
		expectCortexCode(
			() =>
				validateExpression(
					engine(),
					"2\\sin(30)",
					resolveCortexSettings("basic"),
				),
			"unsupported-expression",
		);
	});

	test("keeps basic mode clear of the scientific capability set", () => {
		const basic = resolveCortexSettings("basic");
		for (const latex of ["\\sin(30)", "5!", "\\ln(2)", "\\pi", "2^3"]) {
			expectCortexCode(
				() => validateExpression(engine(), latex, basic),
				"unsupported-expression",
			);
		}
	});
});

describe("graph sampling", () => {
	test("clamps the point count to the documented floor and ceiling", () => {
		const series = (pixelWidth: number) =>
			sampleLatex(
				[{ id: "line", latex: "y=x" }],
				{ xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
				pixelWidth,
				workerSettings,
			)[0];

		expect(series(10)?.x).toHaveLength(200);
		expect(series(100_000)?.x).toHaveLength(CORTEX_GRAPH_SAMPLE_LIMIT);
	});

	test("breaks a series at a pole instead of joining across it", () => {
		/*
		 * A hyperbola sampled straight through x=0 joins -inf to +inf as one segment,
		 * which draws a vertical line that is not part of the function. The sampler
		 * emits NaN at the break; JSXGraph renders NaN as a gap.
		 */
		const [series] = sampleLatex(
			[{ id: "hyperbola", latex: "y=1\\div x" }],
			{ xMin: -5, xMax: 5, yMin: -10, yMax: 10 },
			401,
			workerSettings,
		);
		const y = series?.y ?? [];
		expect(y.some((value) => Number.isNaN(value))).toBe(true);
		expect(y[0]).toBeLessThan(0);
		expect(y.at(-1)).toBeGreaterThan(0);
		// Both branches survive: the gap is a break, not a truncation.
		expect(
			y.filter((value) => Number.isFinite(value) && value < 0).length,
		).toBeGreaterThan(50);
		expect(
			y.filter((value) => Number.isFinite(value) && value > 0).length,
		).toBeGreaterThan(50);
	});

	test("reports one series per expression, keyed by the caller's id", () => {
		const series = sampleLatex(
			[
				{ id: "row-a", latex: "y=x" },
				{ id: "row-b", latex: "y=x^2" },
			],
			{ xMin: -2, xMax: 2, yMin: -4, yMax: 4 },
			200,
			workerSettings,
		);
		expect(series.map((entry) => entry.id)).toEqual(["row-a", "row-b"]);
	});

	test("refuses to sample an expression the mode policy rejects", () => {
		expectCortexCode(
			() =>
				sampleLatex(
					[{ id: "row", latex: "y=2t" }],
					{ xMin: -1, xMax: 1, yMin: -1, yMax: 1 },
					200,
					workerSettings,
				),
			"unsupported-expression",
		);
	});
});
