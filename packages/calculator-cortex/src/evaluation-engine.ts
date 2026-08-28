import {
	CancellationError,
	ComputeEngine,
	type Expression,
} from "@cortex-js/compute-engine";
import { CortexCalculatorError, asCortexError } from "./errors.js";
import { validateExpression } from "./function-policy.js";
import { createCortexLocalization } from "./localization.js";
import {
	CORTEX_GRAPH_SAMPLE_LIMIT,
	type ResolvedCortexSettings,
} from "./settings.js";
import type { CortexFunctionId, CortexGraphViewport } from "./types.js";
import type {
	EvaluationResult,
	SampledSeries,
	WorkerEvaluationSettings,
} from "./worker-protocol.js";

function createEngine(settings: WorkerEvaluationSettings): ComputeEngine {
	const engine = new ComputeEngine();
	engine.precision = settings.calculationPrecision;
	engine.angularUnit = settings.angleMode === "degree" ? "deg" : "rad";
	engine.iterationLimit = 10_000;
	engine.recursionLimit = 64;
	engine.maxCollectionSize = 1_200;
	return engine;
}

export function workerSettingsToResolved(
	type: "basic" | "scientific" | "graphing",
	settings: WorkerEvaluationSettings,
): ResolvedCortexSettings {
	return {
		type,
		angleMode: settings.angleMode,
		calculationPrecision: settings.calculationPrecision,
		displayPrecision: settings.displayPrecision,
		historyLimit: 0,
		evaluationTimeLimitMs: settings.evaluationTimeLimitMs,
		allowedFunctions: new Set<CortexFunctionId>(settings.allowedFunctions),
		allowClipboard: false,
		restrictedMode: true,
		locale: "en-US",
		theme: "auto",
		localization: createCortexLocalization("en-US"),
		graph: {
			viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
			showAxes: true,
			showGrid: true,
		},
	};
}

/** The finite real this expression holds, or `null` if it holds no such value. */
function finiteReal(expression: Expression): number | null {
	// `im` is NaN for an unevaluated symbolic form, which this comparison rejects
	// along with a genuinely imaginary result.
	if (expression.im !== 0) return null;
	const result = expression.re;
	return Number.isFinite(result) ? result : null;
}

function realNumber(expression: Expression): number {
	const result = finiteReal(expression);
	if (result === null) {
		throw new CortexCalculatorError(
			"invalid-expression",
			"The result is not a finite real number.",
		);
	}
	return result;
}

/**
 * The exact value where the Compute Engine has one, the numeric approximation
 * otherwise.
 *
 * `.N()` alone converts degrees to radians and returns what floating point can
 * represent of the result, so `cos(90°)` came out as `6.123233996e-17` and
 * `sin(30°)` as `0.5000000000000008` — the second only looked right because the
 * default display precision is 10 digits, and showed as `0.500000000001` at the
 * supported maximum of 12. `.evaluate()` returns `0` and `1/2` for those, which is
 * what a learner comparing against any handheld expects.
 *
 * It has no exact form for most expressions — `sqrt(2)`, and `sin(Pi)` in degree
 * mode, come back unevaluated — so the numeric path stays as the fallback rather
 * than as a second attempt at the same thing.
 */
function exactOrNumeric(expression: Expression): number {
	const exact = finiteReal(expression.evaluate());
	return exact ?? realNumber(expression.N());
}

/** `1.234567890e+13` -> `1.23456789e+13`, `1.000e+13` -> `1e+13`. */
function trimExponential(exponential: string): string {
	const [mantissa = "", exponent = ""] = exponential.split("e");
	if (!mantissa.includes(".")) return exponential;
	const trimmed = mantissa.replace(/0+$/, "").replace(/\.$/, "");
	return `${trimmed}e${exponent}`;
}

function formatNumber(value: number, precision: number): string {
	if (Object.is(value, -0)) return "0";
	const absolute = Math.abs(value);
	if (absolute !== 0 && (absolute >= 1e12 || absolute < 1e-9)) {
		// Trailing zeros are digits the result does not have. Only an all-zero
		// mantissa was trimmed before, so `1e+13` and `1.234567890e+13` were both
		// reachable from the same formatter.
		return trimExponential(value.toExponential(Math.max(0, precision - 1)));
	}
	return Number(value.toPrecision(precision)).toString();
}

function withEvaluationLimit<T>(
	engine: ComputeEngine,
	timeLimitMs: number,
	operation: () => T,
): T {
	try {
		const runWithLimit = engine.withTimeLimit.bind(engine) as <Result>(
			limit: number | { ms: number; label?: string },
			callback: () => Result,
		) => Result;
		return runWithLimit(
			{ ms: timeLimitMs, label: "pie-calculator-cortex" },
			operation,
		);
	} catch (error) {
		if (error instanceof CancellationError) {
			throw new CortexCalculatorError(
				"evaluation-timeout",
				"The calculation took too long and was stopped.",
				{ cause: error },
			);
		}
		throw error;
	}
}

export function evaluateLatex(
	type: "basic" | "scientific" | "graphing",
	latex: string,
	settings: WorkerEvaluationSettings,
): EvaluationResult {
	const engine = createEngine(settings);
	const resolved = workerSettingsToResolved(type, settings);
	return withEvaluationLimit(engine, settings.evaluationTimeLimitMs, () => {
		const validated = validateExpression(engine, latex, resolved);
		const numericValue = exactOrNumeric(validated.expression);
		return {
			formatted: formatNumber(numericValue, settings.displayPrecision),
			numericValue,
		};
	});
}

function sampleExpression(
	expression: Expression,
	viewport: CortexGraphViewport,
	pointCount: number,
): { x: number[]; y: number[] } {
	const x: number[] = [];
	const y: number[] = [];
	const xRange = viewport.xMax - viewport.xMin;
	const yRange = viewport.yMax - viewport.yMin;
	let previous: number | undefined;
	for (let index = 0; index < pointCount; index += 1) {
		const xValue =
			viewport.xMin + (index / Math.max(1, pointCount - 1)) * xRange;
		let yValue = Number.NaN;
		try {
			yValue = realNumber(expression.subs({ x: xValue }).N());
			if (Math.abs(yValue) > Math.max(1, yRange) * 1_000) yValue = Number.NaN;
			if (
				previous !== undefined &&
				Number.isFinite(previous) &&
				Number.isFinite(yValue) &&
				Math.abs(yValue - previous) > Math.max(1, yRange) * 4
			) {
				yValue = Number.NaN;
			}
		} catch {
			yValue = Number.NaN;
		}
		x.push(xValue);
		y.push(yValue);
		previous = yValue;
	}
	return { x, y };
}

export function sampleLatex(
	expressions: Array<{ id: string; latex: string }>,
	viewport: CortexGraphViewport,
	pixelWidth: number,
	settings: WorkerEvaluationSettings,
): SampledSeries[] {
	const engine = createEngine(settings);
	const resolved = workerSettingsToResolved("graphing", settings);
	const pointCount = Math.min(
		CORTEX_GRAPH_SAMPLE_LIMIT,
		Math.max(200, Math.round(pixelWidth)),
	);
	try {
		return withEvaluationLimit(engine, settings.evaluationTimeLimitMs, () =>
			expressions.map(({ id, latex }) => {
				const validated = validateExpression(engine, latex, resolved);
				return {
					id,
					...sampleExpression(validated.expression, viewport, pointCount),
				};
			}),
		);
	} catch (error) {
		throw asCortexError(
			error,
			"invalid-expression",
			"The graph could not be sampled.",
		);
	}
}
