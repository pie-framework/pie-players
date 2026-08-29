import { ComputeEngine } from "@cortex-js/compute-engine";
import type {
	CalculationHistoryEntry,
	CalculatorState,
} from "@pie-players/pie-calculator";
import { EvaluationClient } from "./evaluation-client.js";
import {
	CortexCalculatorError,
	asCortexError,
	type CortexCalculatorErrorCode,
} from "./errors.js";
import { inspectEditBuffer, validateExpression } from "./function-policy.js";
import {
	CORTEX_GRAPH_EXPRESSION_LIMIT,
	type ResolvedCortexSettings,
} from "./settings.js";
import { decodeCortexState, encodeCortexState } from "./state-codec.js";
import type {
	CortexAngleMode,
	CortexGraphExpressionState,
	CortexGraphLineStyle,
	CortexGraphState,
	CortexGraphViewport,
	CortexOuterCalculatorState,
} from "./types.js";
import type { SampledSeries } from "./worker-protocol.js";

export interface CortexCalculatorSnapshot {
	readonly inputLatex: string;
	readonly result: string;
	readonly errorCode: CortexCalculatorErrorCode | null;
	readonly busy: boolean;
	readonly graphUpdating: boolean;
	readonly history: readonly CalculationHistoryEntry[];
	readonly angleMode: CortexAngleMode;
	readonly graph: CortexGraphState | null;
	readonly series: readonly SampledSeries[];
	readonly focusRequest: number;
	readonly resizeRequest: number;
}

type Subscriber = (snapshot: CortexCalculatorSnapshot) => void;
type TelemetryCallback = (
	eventName: string,
	payload?: Record<string, unknown>,
) => void | Promise<void>;

const LINE_STYLES: readonly CortexGraphLineStyle[] = [
	"solid",
	"dashed",
	"dotted",
	"solid",
	"dashed",
	"dotted",
];

let nextExpressionId = 0;

function createExpression(colorIndex: number): CortexGraphExpressionState {
	nextExpressionId += 1;
	return {
		id: `expression-${nextExpressionId}`,
		latex: "",
		colorIndex,
		lineStyle: LINE_STYLES[colorIndex] ?? "solid",
		hidden: false,
	};
}

function cloneGraph(graph: CortexGraphState | null): CortexGraphState | null {
	if (!graph) return null;
	return {
		viewport: { ...graph.viewport },
		expressions: graph.expressions.map((expression) => ({ ...expression })),
	};
}

export class CortexCalculatorController {
	private readonly subscribers = new Set<Subscriber>();
	private readonly mainEngine = new ComputeEngine();
	private evaluationClient: EvaluationClient;
	private destroyed = false;
	private operationGeneration = 0;
	private currentAngleMode: CortexAngleMode;
	private inputLatex = "";
	private result = "";
	private errorCode: CortexCalculatorErrorCode | null = null;
	private busy = false;
	private inFlightEvaluations = 0;
	private graphUpdating = false;
	private history: CalculationHistoryEntry[] = [];
	private graph: CortexGraphState | null;
	private series: SampledSeries[] = [];
	private focusRequest = 0;
	private resizeRequest = 0;

	constructor(
		readonly settings: ResolvedCortexSettings,
		private readonly onTelemetry?: TelemetryCallback,
	) {
		this.currentAngleMode = settings.angleMode;
		this.mainEngine.precision = settings.calculationPrecision;
		this.mainEngine.angularUnit =
			settings.angleMode === "degree" ? "deg" : "rad";
		this.mainEngine.iterationLimit = 10_000;
		this.mainEngine.recursionLimit = 64;
		this.mainEngine.maxCollectionSize = 1_200;
		this.evaluationClient = new EvaluationClient(this.effectiveSettings());
		this.graph =
			settings.type === "graphing"
				? {
						viewport: { ...settings.graph.viewport },
						expressions: [createExpression(0)],
					}
				: null;
	}

	private effectiveSettings(): ResolvedCortexSettings {
		return { ...this.settings, angleMode: this.currentAngleMode };
	}

	getSnapshot(): CortexCalculatorSnapshot {
		return {
			inputLatex: this.inputLatex,
			result: this.result,
			errorCode: this.errorCode,
			busy: this.busy,
			graphUpdating: this.graphUpdating,
			history: this.history.map((entry) => ({ ...entry })),
			angleMode: this.currentAngleMode,
			graph: cloneGraph(this.graph),
			series: this.series.map((entry) => ({
				id: entry.id,
				x: [...entry.x],
				y: [...entry.y],
			})),
			focusRequest: this.focusRequest,
			resizeRequest: this.resizeRequest,
		};
	}

	private publish(): void {
		const snapshot = this.getSnapshot();
		for (const subscriber of this.subscribers) subscriber(snapshot);
	}

	private async telemetry(
		eventName: string,
		payload: Record<string, unknown>,
	): Promise<void> {
		try {
			await this.onTelemetry?.(eventName, {
				toolId: "calculator",
				backend: "cortex",
				calculatorType: this.settings.type,
				...payload,
			});
		} catch {
			// Instrumentation must never affect calculator behavior.
		}
	}

	subscribe(subscriber: Subscriber): () => void {
		this.subscribers.add(subscriber);
		subscriber(this.getSnapshot());
		return () => this.subscribers.delete(subscriber);
	}

	getValue(): string {
		return this.inputLatex;
	}

	setValue(latex: string): void {
		inspectEditBuffer(latex);
		this.inputLatex = latex;
		if (this.graph?.expressions[0]) this.graph.expressions[0].latex = latex;
		this.errorCode = null;
		/*
		 * The answer belonged to the expression that was there. The result line sits
		 * inside the active line, directly under the mathfield, so leaving it stands
		 * a stale number beside fresh input as though it answered it — the same
		 * hazard the error branch of `evaluate` already guards against.
		 *
		 * It also restores the result announcement for a repeated answer: the view
		 * announces on a *change* of result, so computing `2+2` twice announced only
		 * the first.
		 */
		this.result = "";
		this.operationGeneration += 1;
		this.publish();
	}

	setGraphExpression(id: string, latex: string): void {
		inspectEditBuffer(latex);
		const expression = this.graph?.expressions.find((entry) => entry.id === id);
		if (!expression) return;
		expression.latex = latex;
		if (this.graph?.expressions[0]?.id === id) this.inputLatex = latex;
		this.errorCode = null;
		// As in `setValue`: the answer was to the expression that was there.
		this.result = "";
		this.operationGeneration += 1;
		this.publish();
	}

	addGraphExpression(): void {
		if (
			!this.graph ||
			this.graph.expressions.length >= CORTEX_GRAPH_EXPRESSION_LIMIT
		)
			return;
		const used = new Set(
			this.graph.expressions.map((entry) => entry.colorIndex),
		);
		let colorIndex = 0;
		while (used.has(colorIndex) && colorIndex < CORTEX_GRAPH_EXPRESSION_LIMIT)
			colorIndex += 1;
		this.graph.expressions.push(createExpression(colorIndex));
		this.publish();
	}

	removeGraphExpression(id: string): void {
		if (!this.graph) return;
		const index = this.graph.expressions.findIndex((entry) => entry.id === id);
		if (index < 0) return;
		this.graph.expressions.splice(index, 1);
		if (this.graph.expressions.length === 0)
			this.graph.expressions.push(createExpression(0));
		this.inputLatex = this.graph.expressions[0]?.latex ?? "";
		this.series = this.series.filter((entry) => entry.id !== id);
		this.publish();
	}

	toggleGraphExpression(id: string): void {
		const expression = this.graph?.expressions.find((entry) => entry.id === id);
		if (!expression) return;
		expression.hidden = !expression.hidden;
		this.publish();
	}

	setAngleMode(mode: CortexAngleMode): void {
		if (mode === this.currentAngleMode) return;
		this.currentAngleMode = mode;
		this.mainEngine.angularUnit = mode === "degree" ? "deg" : "rad";
		this.evaluationClient.updateSettings(this.effectiveSettings());
		// The displayed answer was computed under the previous unit, so it is void.
		// `angleModeChanged` is what the view announces, since silently blanking the
		// result leaves a screen-reader user with no idea it went.
		this.result = "";
		this.errorCode = null;
		this.operationGeneration += 1;
		this.publish();
	}

	async evaluate(latex = this.inputLatex): Promise<string> {
		if (this.destroyed) {
			throw new CortexCalculatorError(
				"worker-unavailable",
				"This calculator has been destroyed.",
				{ recoverable: false },
			);
		}
		this.inputLatex = latex;
		const generation = ++this.operationGeneration;
		this.inFlightEvaluations += 1;
		this.busy = true;
		this.errorCode = null;
		this.publish();
		const startedAt = Date.now();
		void this.telemetry("pie-tool-operation-start", { operation: "evaluate" });
		try {
			validateExpression(this.mainEngine, latex, this.effectiveSettings());
			const evaluation = await this.evaluationClient.evaluate(latex);
			if (generation !== this.operationGeneration || this.destroyed) {
				throw new CortexCalculatorError(
					"invalid-expression",
					"The calculation was superseded by newer input.",
				);
			}
			this.result = evaluation.formatted;
			if (this.settings.historyLimit > 0) {
				this.history.unshift({
					expression: latex,
					result: evaluation.formatted,
					timestamp: Date.now(),
				});
				this.history = this.history.slice(0, this.settings.historyLimit);
			}
			void this.telemetry("pie-tool-operation-success", {
				operation: "evaluate",
				duration: Date.now() - startedAt,
			});
			return evaluation.formatted;
		} catch (error) {
			const cortexError = asCortexError(
				error,
				"invalid-expression",
				"The calculation could not be completed.",
			);
			if (generation === this.operationGeneration) {
				this.errorCode = cortexError.code;
				// Without this the previous answer stays on screen next to a
				// `role="alert"` contradicting it, and the unchanged `role="status"`
				// never re-announces — so AT keeps reporting the stale result as current.
				this.result = "";
			}
			void this.telemetry("pie-tool-operation-error", {
				operation: "evaluate",
				duration: Date.now() - startedAt,
				errorType: cortexError.code,
			});
			throw cortexError;
		} finally {
			this.inFlightEvaluations -= 1;
			/*
			 * `busy` belongs to the set of in-flight calculations, not to the newest
			 * one. Clearing it only on a generation match left it set forever once a
			 * keystroke superseded a calculation, and the view announces `calculating`
			 * on the transition into busy — so every later calculation stopped
			 * announcing that it had started.
			 */
			if (this.inFlightEvaluations === 0) this.busy = false;
			if (
				generation === this.operationGeneration ||
				this.inFlightEvaluations === 0
			) {
				this.publish();
			}
		}
	}

	async sampleGraph(
		viewport: CortexGraphViewport,
		pixelWidth: number,
	): Promise<void> {
		if (!this.graph || this.destroyed) return;
		const expressions = this.graph.expressions
			.filter((entry) => !entry.hidden && entry.latex.trim())
			.map(({ id, latex }) => ({ id, latex }));
		this.graph.viewport = { ...viewport };
		if (expressions.length === 0) {
			this.series = [];
			this.publish();
			return;
		}
		const generation = ++this.operationGeneration;
		this.graphUpdating = true;
		this.errorCode = null;
		this.publish();
		try {
			for (const expression of expressions) {
				validateExpression(
					this.mainEngine,
					expression.latex,
					this.effectiveSettings(),
				);
			}
			const series = await this.evaluationClient.sample(
				expressions,
				viewport,
				pixelWidth,
			);
			if (generation !== this.operationGeneration || this.destroyed) return;
			this.series = series;
		} catch (error) {
			const cortexError = asCortexError(
				error,
				"invalid-expression",
				"The graph could not be updated.",
			);
			if (generation === this.operationGeneration)
				this.errorCode = cortexError.code;
		} finally {
			if (generation === this.operationGeneration) {
				this.graphUpdating = false;
				this.publish();
			}
		}
	}

	clear(): void {
		this.operationGeneration += 1;
		this.inputLatex = "";
		this.result = "";
		this.errorCode = null;
		this.series = [];
		if (this.graph) {
			this.graph = {
				viewport: { ...this.settings.graph.viewport },
				expressions: [createExpression(0)],
			};
		}
		this.focusRequest += 1;
		this.publish();
	}

	getHistory(): CalculationHistoryEntry[] {
		return this.history.map((entry) => ({ ...entry }));
	}

	clearHistory(): void {
		this.history = [];
		this.publish();
	}

	exportState(): CortexOuterCalculatorState {
		return encodeCortexState(
			this.settings.type,
			this.inputLatex,
			this.history,
			this.settings,
			this.currentAngleMode,
			this.graph ?? undefined,
		);
	}

	importState(state: CalculatorState): void {
		const decoded = decodeCortexState(
			state,
			this.settings.type,
			this.mainEngine,
			this.effectiveSettings(),
		);
		this.operationGeneration += 1;
		this.inputLatex = decoded.state.inputLatex;
		this.history = decoded.history;
		this.currentAngleMode = decoded.state.angleMode;
		this.mainEngine.angularUnit =
			this.currentAngleMode === "degree" ? "deg" : "rad";
		this.evaluationClient.updateSettings(this.effectiveSettings());
		this.graph = decoded.state.graph ? cloneGraph(decoded.state.graph) : null;
		this.series = [];
		this.result = "";
		this.errorCode = null;
		this.publish();
	}

	requestFocus(): void {
		this.focusRequest += 1;
		this.publish();
	}

	requestResize(): void {
		this.resizeRequest += 1;
		this.publish();
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.operationGeneration += 1;
		this.evaluationClient.destroy();
		this.subscribers.clear();
	}
}
