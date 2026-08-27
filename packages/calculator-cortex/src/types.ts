import type {
	CalculatorProviderInit,
	CalculatorState,
	CalculatorType,
} from "@pie-players/pie-calculator";

export type CortexAngleMode = "degree" | "radian";

export type CortexFunctionId =
	| "square-root"
	| "power"
	| "root"
	| "exponential"
	| "natural-log"
	| "common-log"
	| "sine"
	| "cosine"
	| "tangent"
	| "inverse-sine"
	| "inverse-cosine"
	| "inverse-tangent"
	| "absolute-value"
	| "factorial";

export interface CortexGraphViewport {
	xMin: number;
	xMax: number;
	yMin: number;
	yMax: number;
}

export interface CortexGraphSettings {
	viewport?: CortexGraphViewport;
	showAxes?: boolean;
	showGrid?: boolean;
}

export interface CortexCalculatorSettings extends Record<string, unknown> {
	angleMode?: CortexAngleMode;
	calculationPrecision?: number;
	displayPrecision?: number;
	historyLimit?: number;
	evaluationTimeLimitMs?: number;
	allowedFunctions?: readonly CortexFunctionId[];
	allowClipboard?: boolean;
	graph?: CortexGraphSettings;
}

export type CortexCalculatorProviderConfig = Pick<
	CalculatorProviderInit,
	"onTelemetry"
>;

export type CortexGraphLineStyle = "solid" | "dashed" | "dotted";

export interface CortexGraphExpressionState {
	id: string;
	latex: string;
	colorIndex: number;
	lineStyle: CortexGraphLineStyle;
	hidden: boolean;
}

export interface CortexGraphState {
	viewport: CortexGraphViewport;
	expressions: CortexGraphExpressionState[];
}

export interface CortexCalculatorStateV1 {
	schema: "pie-calculator-cortex";
	version: 1;
	type: CalculatorType;
	angleMode: CortexAngleMode;
	calculationPrecision: number;
	displayPrecision: number;
	inputLatex: string;
	graph?: CortexGraphState;
}

export type CortexCalculatorState = CortexCalculatorStateV1;

export type CortexOuterCalculatorState = CalculatorState & {
	provider: "cortex";
	providerState: CortexCalculatorState;
};
