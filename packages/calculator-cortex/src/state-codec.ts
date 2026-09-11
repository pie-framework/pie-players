import type { ComputeEngine } from "@cortex-js/compute-engine";
import type {
	CalculationHistoryEntry,
	CalculatorState,
	CalculatorType,
} from "@pie-players/pie-calculator";
import { CortexCalculatorError } from "./errors.js";
import { inspectEditBuffer, validateExpression } from "./function-policy.js";
import {
	CORTEX_GRAPH_EXPRESSION_LIMIT,
	type ResolvedCortexSettings,
} from "./settings.js";
import type {
	CortexCalculatorStateV1,
	CortexGraphExpressionState,
	CortexGraphLineStyle,
	CortexGraphState,
	CortexGraphViewport,
	CortexOuterCalculatorState,
} from "./types.js";

function invalidState(message: string, cause?: unknown): never {
	throw new CortexCalculatorError("invalid-state", message, { cause });
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		invalidState(`${label} must be an object.`);
	}
	return value as Record<string, unknown>;
}

function finiteNumber(value: unknown, label: string): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		invalidState(`${label} must be a finite number.`);
	}
	return value;
}

function decodeViewport(value: unknown): CortexGraphViewport {
	const viewport = objectValue(value, "Graph viewport");
	const decoded = {
		xMin: finiteNumber(viewport.xMin, "Graph xMin"),
		xMax: finiteNumber(viewport.xMax, "Graph xMax"),
		yMin: finiteNumber(viewport.yMin, "Graph yMin"),
		yMax: finiteNumber(viewport.yMax, "Graph yMax"),
	};
	if (decoded.xMin >= decoded.xMax || decoded.yMin >= decoded.yMax) {
		invalidState("Graph viewport minimums must be less than maximums.");
	}
	return decoded;
}

function decodeGraphExpression(
	value: unknown,
	engine: ComputeEngine,
	settings: ResolvedCortexSettings,
): CortexGraphExpressionState {
	const expression = objectValue(value, "Graph expression");
	if (
		typeof expression.id !== "string" ||
		expression.id.length < 1 ||
		expression.id.length > 128
	) {
		invalidState("Graph expression ids must contain 1 to 128 characters.");
	}
	if (typeof expression.latex !== "string") {
		invalidState("Graph expression LaTeX must be a string.");
	}
	inspectEditBuffer(expression.latex);
	if (expression.latex.trim()) validateExpression(engine, expression.latex, settings);
	if (
		!Number.isInteger(expression.colorIndex) ||
		(expression.colorIndex as number) < 0 ||
		(expression.colorIndex as number) >= CORTEX_GRAPH_EXPRESSION_LIMIT
	) {
		invalidState("Graph colorIndex is outside the supported palette.");
	}
	const lineStyle = expression.lineStyle;
	if (lineStyle !== "solid" && lineStyle !== "dashed" && lineStyle !== "dotted") {
		invalidState("Graph lineStyle is invalid.");
	}
	if (typeof expression.hidden !== "boolean") {
		invalidState("Graph hidden must be a boolean.");
	}
	return {
		id: expression.id,
		latex: expression.latex,
		colorIndex: expression.colorIndex as number,
		lineStyle: lineStyle as CortexGraphLineStyle,
		hidden: expression.hidden,
	};
}

function decodeGraph(
	value: unknown,
	engine: ComputeEngine,
	settings: ResolvedCortexSettings,
): CortexGraphState {
	const graph = objectValue(value, "Graph state");
	if (!Array.isArray(graph.expressions)) {
		invalidState("Graph expressions must be an array.");
	}
	if (graph.expressions.length > CORTEX_GRAPH_EXPRESSION_LIMIT) {
		invalidState(`Graph state supports at most ${CORTEX_GRAPH_EXPRESSION_LIMIT} expressions.`);
	}
	const expressions = graph.expressions.map((expression) =>
		decodeGraphExpression(expression, engine, settings),
	);
	if (new Set(expressions.map((expression) => expression.id)).size !== expressions.length) {
		invalidState("Graph expression ids must be unique.");
	}
	return {
		viewport: decodeViewport(graph.viewport),
		expressions,
	};
}

function decodeHistory(
	value: unknown,
	engine: ComputeEngine,
	settings: ResolvedCortexSettings,
): CalculationHistoryEntry[] | undefined {
	if (value === undefined) return undefined;
	if (!Array.isArray(value) || value.length > settings.historyLimit) {
		invalidState(`Calculator history supports at most ${settings.historyLimit} entries.`);
	}
	return value.map((entry) => {
		const historyEntry = objectValue(entry, "History entry");
		if (typeof historyEntry.expression !== "string" || typeof historyEntry.result !== "string") {
			invalidState("History expressions and results must be strings.");
		}
		validateExpression(engine, historyEntry.expression, settings);
		return {
			expression: historyEntry.expression,
			result: historyEntry.result,
			timestamp: finiteNumber(historyEntry.timestamp, "History timestamp"),
		};
	});
}

export interface DecodedCortexState {
	readonly state: CortexCalculatorStateV1;
	readonly history: CalculationHistoryEntry[];
}

export function decodeCortexState(
	value: CalculatorState,
	type: CalculatorType,
	engine: ComputeEngine,
	settings: ResolvedCortexSettings,
): DecodedCortexState {
	try {
		const outer = objectValue(value, "Calculator state");
		if (outer.provider !== "cortex" || outer.type !== type) {
			invalidState("Calculator state provider or type does not match this calculator.");
		}
		if (typeof outer.value !== "string") invalidState("Calculator state value must be a string.");
		const providerState = objectValue(outer.providerState, "Cortex provider state");
		if (providerState.schema !== "pie-calculator-cortex" || providerState.version !== 1) {
			invalidState("Unsupported Cortex calculator state version.");
		}
		if (providerState.type !== type || typeof providerState.inputLatex !== "string") {
			invalidState("Cortex provider state type or input is invalid.");
		}
		if (outer.value !== providerState.inputLatex) {
			invalidState("Calculator state value does not match Cortex input state.");
		}
		inspectEditBuffer(providerState.inputLatex);
		const angleMode = providerState.angleMode;
		if (angleMode !== "degree" && angleMode !== "radian") {
			invalidState("Cortex angle mode is invalid.");
		}
		const calculationPrecision = finiteNumber(
			providerState.calculationPrecision,
			"Cortex calculation precision",
		);
		const displayPrecision = finiteNumber(
			providerState.displayPrecision,
			"Cortex display precision",
		);
		if (!Number.isInteger(calculationPrecision) || calculationPrecision < 1 || calculationPrecision > 21) {
			invalidState("Cortex calculation precision is outside the supported range.");
		}
		if (!Number.isInteger(displayPrecision) || displayPrecision < 1 || displayPrecision > 12) {
			invalidState("Cortex display precision is outside the supported range.");
		}
		const graph = providerState.graph === undefined
			? undefined
			: decodeGraph(providerState.graph, engine, settings);
		if (type === "graphing" && !graph) invalidState("Graphing calculator state requires graph data.");
		if (type !== "graphing" && graph) invalidState("Only graphing calculators accept graph data.");

		return {
			state: {
				schema: "pie-calculator-cortex",
				version: 1,
				type,
				angleMode,
				calculationPrecision,
				displayPrecision,
				inputLatex: providerState.inputLatex,
				...(graph ? { graph } : {}),
			},
			history: decodeHistory(outer.history, engine, settings) ?? [],
		};
	} catch (error) {
		if (error instanceof CortexCalculatorError) throw error;
		invalidState("Calculator state could not be decoded.", error);
	}
}

export function encodeCortexState(
	type: CalculatorType,
	inputLatex: string,
	history: readonly CalculationHistoryEntry[],
	settings: ResolvedCortexSettings,
	angleMode: "degree" | "radian",
	graph?: CortexGraphState,
): CortexOuterCalculatorState {
	const providerState: CortexCalculatorStateV1 = {
		schema: "pie-calculator-cortex",
		version: 1,
		type,
		angleMode,
		calculationPrecision: settings.calculationPrecision,
		displayPrecision: settings.displayPrecision,
		inputLatex,
		...(graph ? { graph } : {}),
	};
	return {
		type,
		provider: "cortex",
		value: inputLatex,
		history: history.slice(0, settings.historyLimit).map((entry) => ({ ...entry })),
		providerState,
	};
}
