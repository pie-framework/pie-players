import {
	CancellationError,
	ComputeEngine,
	type Expression,
} from "@cortex-js/compute-engine";
import { CortexCalculatorError, asCortexError } from "./errors.js";
import { validateExpression } from "./function-policy.js";
import {
	CORTEX_GRAPH_SAMPLE_LIMIT,
	type ResolvedCortexSettings,
} from "./settings.js";
import type {
	CortexFunctionId,
	CortexGraphViewport,
} from "./types.js";
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
		graph: {
			viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
			showAxes: true,
			showGrid: true,
		},
	};
}

function realNumber(expression: Expression): number {
	if (expression.im !== 0) {
		throw new CortexCalculatorError(
			"invalid-expression",
			"The result is not a finite real number.",
		);
	}
	const result = expression.re;
	if (!Number.isFinite(result)) {
		throw new CortexCalculatorError(
			"invalid-expression",
			"The result is not a finite real number.",
		);
	}
	return result;
}

function formatNumber(value: number, precision: number): string {
	if (Object.is(value, -0)) return "0";
	const absolute = Math.abs(value);
	if (absolute !== 0 && (absolute >= 1e12 || absolute < 1e-9)) {
		return value.toExponential(Math.max(0, precision - 1)).replace(/\.0+e/, "e");
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
		const numeric = validated.expression.N();
		const numericValue = realNumber(numeric);
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
		const xValue = viewport.xMin + (index / Math.max(1, pointCount - 1)) * xRange;
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
				return { id, ...sampleExpression(validated.expression, viewport, pointCount) };
			}),
		);
	} catch (error) {
		throw asCortexError(error, "invalid-expression", "The graph could not be sampled.");
	}
}
