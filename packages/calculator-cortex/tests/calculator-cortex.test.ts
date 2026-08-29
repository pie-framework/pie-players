import { describe, expect, test } from "bun:test";
import { ComputeEngine } from "@cortex-js/compute-engine";
import type { CalculatorState } from "@pie-players/pie-calculator";
import { CortexCalculatorProvider } from "../src/index.js";
import { evaluateLatex, sampleLatex } from "../src/evaluation-engine.js";
import { validateExpression } from "../src/function-policy.js";
import { localeDirection } from "../src/localization.js";
import { mathfieldDecimalSeparator } from "../src/mathlive-runtime.js";
import { resolveCortexSettings } from "../src/settings.js";
import { decodeCortexState, encodeCortexState } from "../src/state-codec.js";
import type { CortexOuterCalculatorState } from "../src/types.js";
import type { WorkerEvaluationSettings } from "../src/worker-protocol.js";
import { expectCortexCode } from "./support/cortex-errors.js";

const workerSettings: WorkerEvaluationSettings = {
	angleMode: "degree",
	calculationPrecision: 15,
	displayPrecision: 10,
	evaluationTimeLimitMs: 1_000,
	allowedFunctions: [
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
	],
};

describe("Cortex calculator settings and policy", () => {
	test("applies bounded defaults and makes restricted mode monotonic", () => {
		const settings = resolveCortexSettings("scientific", {
			restrictedMode: true,
			settings: { allowClipboard: true, allowedFunctions: ["sine"] },
		});

		expect(settings.angleMode).toBe("degree");
		expect(settings.calculationPrecision).toBe(15);
		expect(settings.displayPrecision).toBe(10);
		expect(settings.allowClipboard).toBe(false);
		expect([...settings.allowedFunctions]).toEqual(["sine"]);
	});

	test("rejects invalid known settings instead of clamping them", () => {
		expectCortexCode(
			() =>
				resolveCortexSettings("basic", {
					settings: { evaluationTimeLimitMs: 99 },
				}),
			"invalid-state",
		);
	});

	test("resolves built-in locale messages, typed overrides, and writing direction", () => {
		const dutch = resolveCortexSettings("basic", { locale: "nl-BE" });
		expect(dutch.localization.t("calculate")).toBe("Bereken");
		expect(dutch.localization.formatNumber(1.5)).toBe("1,5");
		expect(dutch.localization.direction).toBe("ltr");

		const customRtl = resolveCortexSettings("basic", {
			locale: "ar-EG",
			settings: {
				messages: { calculate: "احسب" },
			},
		});
		expect(customRtl.localization.t("calculate")).toBe("احسب");
		expect(customRtl.localization.t("clear")).toBe("Clear");
		expect(customRtl.localization.direction).toBe("rtl");
		expect(localeDirection("fa_IR")).toBe("rtl");
	});

	test("punctuates a displayed result for the locale without reformatting it", () => {
		const dutch = resolveCortexSettings("basic", { locale: "nl-BE" }).localization;
		const english = resolveCortexSettings("basic").localization;

		expect(dutch.formatResult("1.5")).toBe("1,5");
		expect(english.formatResult("1.5")).toBe("1.5");
		// The keypad's separator key and the mathfield both take the same resolver,
		// so what a learner taps, types and reads back agree.
		expect(dutch.formatResult("1.5")).toContain(
			mathfieldDecimalSeparator("nl-BE"),
		);
		// A separator swap, not a reformat: the exponent and every significant digit
		// survive, where Intl.NumberFormat would re-round and expand both.
		expect(dutch.formatResult("2.432902008e+18")).toBe("2,432902008e+18");
		expect(dutch.formatResult("1.5e-9")).toBe("1,5e-9");
		expect(dutch.formatResult("-0.125")).toBe("-0,125");
		expect(dutch.formatResult("120")).toBe("120");
	});

	test("validates localization and theme settings at the package seam", () => {
		expectCortexCode(
			() =>
				resolveCortexSettings("basic", {
					settings: { messages: { clear: 42 } as never },
				}),
			"invalid-state",
		);
		expectCortexCode(
			() =>
				resolveCortexSettings("basic", {
					settings: { direction: "sideways" as never },
				}),
			"invalid-state",
		);
		expectCortexCode(
			() => resolveCortexSettings("basic", { theme: "sepia" as never }),
			"invalid-state",
		);
	});

	test("enforces mode policy on canonical structural expressions", () => {
		const engine = new ComputeEngine();
		expectCortexCode(
			() => validateExpression(engine, "2^3", resolveCortexSettings("basic")),
			"unsupported-expression",
		);
		expect(
			validateExpression(engine, "2^3", resolveCortexSettings("scientific"))
				.nodeCount,
		).toBeGreaterThan(1);
	});
});

describe("Cortex evaluation", () => {
	test("evaluates arithmetic, degree trigonometry, factorial, and percent", () => {
		expect(evaluateLatex("basic", "2+2", workerSettings).formatted).toBe("4");
		expect(
			evaluateLatex("scientific", "\\sin(30)", workerSettings).formatted,
		).toBe("0.5");
		expect(evaluateLatex("scientific", "5!", workerSettings).formatted).toBe(
			"120",
		);
		expect(evaluateLatex("basic", "50\\%", workerSettings).formatted).toBe(
			"0.5",
		);
	});

	test("samples numeric point arrays without compiling learner functions", () => {
		const [series] = sampleLatex(
			[{ id: "quadratic", latex: "y=x^2" }],
			{ xMin: -2, xMax: 2, yMin: -1, yMax: 5 },
			320,
			workerSettings,
		);
		expect(series?.id).toBe("quadratic");
		expect(series?.x).toHaveLength(320);
		expect(series?.y).toHaveLength(320);
		expect(series?.y.every((value) => Number.isFinite(value))).toBe(true);
	});
});

describe("Cortex state", () => {
	test("round trips the versioned provider state", () => {
		const settings = resolveCortexSettings("scientific");
		const state = encodeCortexState(
			"scientific",
			"2+2",
			[{ expression: "2+2", result: "4", timestamp: 1 }],
			settings,
			"degree",
		);
		const decoded = decodeCortexState(
			state,
			"scientific",
			new ComputeEngine(),
			settings,
		);
		expect(decoded.state.inputLatex).toBe("2+2");
		expect(decoded.history).toHaveLength(1);
	});

	test("rejects mismatched outer and provider values atomically", () => {
		const settings = resolveCortexSettings("basic");
		const state = encodeCortexState(
			"basic",
			"2+2",
			[],
			settings,
			"degree",
		) as CalculatorState & { value: string };
		state.value = "3+3";
		expectCortexCode(
			() => decodeCortexState(state, "basic", new ComputeEngine(), settings),
			"invalid-state",
		);
	});

	test("round trips the maximum graph state and drops unknown fields", () => {
		const settings = resolveCortexSettings("graphing");
		const graph = {
			viewport: { xMin: -12, xMax: 12, yMin: -8, yMax: 8 },
			expressions: Array.from({ length: 6 }, (_, index) => ({
				id: `series-${index + 1}`,
				latex: `y=x^${index + 1}`,
				colorIndex: index,
				lineStyle:
					(["solid", "dashed", "dotted"] as const)[index % 3] ?? "solid",
				hidden: index === 5,
			})),
		};
		const state = encodeCortexState(
			"graphing",
			"y=x^1",
			[],
			settings,
			"radian",
			graph,
		) as CortexOuterCalculatorState & { ignored?: string };
		state.ignored = "not retained";

		const decoded = decodeCortexState(
			state,
			"graphing",
			new ComputeEngine(),
			settings,
		);
		expect(decoded.state.graph?.expressions).toHaveLength(6);
		expect(decoded.state.graph?.expressions[1]?.lineStyle).toBe("dashed");
		expect("ignored" in decoded.state).toBe(false);
	});

	test("rejects unknown versions, excessive graph rows, and hostile input", () => {
		const settings = resolveCortexSettings("graphing");
		const createState = () =>
			encodeCortexState("graphing", "y=x", [], settings, "degree", {
				viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
				expressions: [
					{
						id: "series-1",
						latex: "y=x",
						colorIndex: 0,
						lineStyle: "solid",
						hidden: false,
					},
				],
			}) as CortexOuterCalculatorState;

		const unknownVersion = createState();
		(unknownVersion.providerState as { version: number }).version = 2;
		expectCortexCode(
			() =>
				decodeCortexState(
					unknownVersion,
					"graphing",
					new ComputeEngine(),
					settings,
				),
			"invalid-state",
		);

		const tooManyRows = createState();
		const graphState = tooManyRows.providerState.graph;
		if (!graphState) throw new Error("Expected graph state");
		graphState.expressions = Array.from({ length: 7 }, (_, index) => ({
			id: `series-${index}`,
			latex: "y=x",
			colorIndex: index % 6,
			lineStyle: "solid" as const,
			hidden: false,
		}));
		expectCortexCode(
			() =>
				decodeCortexState(
					tooManyRows,
					"graphing",
					new ComputeEngine(),
					settings,
				),
			"invalid-state",
		);

		const hostile = createState();
		hostile.value = "\\href{https://example.invalid}{x}";
		hostile.providerState.inputLatex = hostile.value;
		expectCortexCode(
			() =>
				decodeCortexState(hostile, "graphing", new ComputeEngine(), settings),
			"unsupported-expression",
		);
	});
});

test("the public provider import is server-safe and reports its browser boundary", async () => {
	const provider = new CortexCalculatorProvider();
	await expect(provider.initialize()).rejects.toMatchObject({
		name: "CortexCalculatorError",
		code: "worker-unavailable",
		recoverable: false,
	});
	expect(provider.getCapabilities()).toMatchObject({
		supportsGraphing: true,
		supportsHistory: true,
		maxPrecision: 21,
	});
});
