import type {
	CalculatorProviderConfig,
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

export type CortexTextDirection = "ltr" | "rtl";

export interface CortexCalculatorMessages {
	basicCalculator: string;
	scientificCalculator: string;
	graphingCalculator: string;
	expressionLabel: string;
	angleMode: string;
	degrees: string;
	radians: string;
	calculate: string;
	calculating: string;
	backspace: string;
	clear: string;
	result: string;
	calculationHistory: string;
	clearHistory: string;
	virtualKeyboardBasic: string;
	virtualKeyboardScientific: string;
	virtualKeyboardGraphing: string;
	keypad: string;
	keypadLayer: string;
	angleModeDegreesShort: string;
	angleModeRadiansShort: string;
	angleModeChanged: string;
	inserted: string;
	/*
	 * Keys whose visible label is a word carry that word inside their accessible
	 * name — WCAG 2.5.3 Label in Name, and the thing voice control speaks. Keys
	 * whose label is a glyph are named freely, since a glyph is not a text label.
	 */
	keySine: string;
	keyCosine: string;
	keyTangent: string;
	keyInverseSine: string;
	keyInverseCosine: string;
	keyInverseTangent: string;
	keyNaturalLog: string;
	keyCommonLog: string;
	keySquareRoot: string;
	keyNthRoot: string;
	keyPower: string;
	keySquared: string;
	keyCubed: string;
	keyExponential: string;
	keyAbsoluteValue: string;
	keyFactorial: string;
	keyPi: string;
	keyEuler: string;
	keyPercent: string;
	keyOpenParenthesis: string;
	keyCloseParenthesis: string;
	keyDecimalSeparator: string;
	keyDigit: string;
	keyAdd: string;
	keySubtract: string;
	keyMultiply: string;
	keyDivide: string;
	keyVariableX: string;
	graphExpressions: string;
	graphExpressionLabel: string;
	seriesDescription: string;
	showExpression: string;
	hideExpression: string;
	show: string;
	hide: string;
	removeExpression: string;
	remove: string;
	addExpression: string;
	graph: string;
	resetView: string;
	updatingGraph: string;
	graphSummary: string;
	viewportSummary: string;
	seriesSummary: string;
	keyboardGraphTrace: string;
	keyboardTrace: string;
	series: string;
	seriesOption: string;
	previousPoint: string;
	nextPoint: string;
	tracePoint: string;
	noSampledPoint: string;
	lineStyleSolid: string;
	lineStyleDashed: string;
	lineStyleDotted: string;
	errorInvalidExpression: string;
	errorUnsupportedExpression: string;
	errorExpressionTooComplex: string;
	errorEvaluationTimeout: string;
	errorInvalidState: string;
	errorWorkerUnavailable: string;
}

export type CortexCalculatorMessageKey = keyof CortexCalculatorMessages;
export type CortexCalculatorMessageOverrides =
	Partial<CortexCalculatorMessages>;

export interface CortexCalculatorSettings extends Record<string, unknown> {
	angleMode?: CortexAngleMode;
	calculationPrecision?: number;
	displayPrecision?: number;
	historyLimit?: number;
	evaluationTimeLimitMs?: number;
	allowedFunctions?: readonly CortexFunctionId[];
	allowClipboard?: boolean;
	/** Override any package-owned visible or assistive label for this instance. */
	messages?: CortexCalculatorMessageOverrides;
	/** Derive direction from `locale` by default; override only for host policy. */
	direction?: CortexTextDirection | "auto";
	graph?: CortexGraphSettings;
}

export type CortexCalculatorProviderInit = Pick<
	CalculatorProviderInit,
	"onTelemetry"
>;

export interface CortexCalculatorProviderConfig
	extends Omit<CalculatorProviderConfig, "settings"> {
	settings?: CortexCalculatorSettings;
}

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
