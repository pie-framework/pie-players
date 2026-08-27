import type { CortexCalculatorErrorCode } from "./errors.js";
import type {
	CortexCalculatorMessageKey,
	CortexCalculatorMessageOverrides,
	CortexCalculatorMessages,
	CortexGraphLineStyle,
	CortexTextDirection,
} from "./types.js";

const EN_US_MESSAGES = {
	basicCalculator: "Basic calculator",
	scientificCalculator: "Scientific calculator",
	graphingCalculator: "Graphing calculator",
	expressionLabel: "{calculator} expression",
	angleMode: "Angle mode",
	degrees: "Degrees",
	radians: "Radians",
	calculate: "Calculate",
	calculating: "Calculating",
	backspace: "Backspace",
	clear: "Clear",
	result: "Result: {result}",
	calculationHistory: "Calculation history",
	clearHistory: "Clear history",
	virtualKeyboardBasic: "Basic",
	virtualKeyboardScientific: "Scientific",
	virtualKeyboardGraphing: "Graphing",
	graphExpressions: "Graph expressions",
	graphExpressionLabel: "Graph expression {index}, {lineStyle} line",
	seriesDescription: "Series {index}: {lineStyle} line",
	showExpression: "Show expression {index}",
	hideExpression: "Hide expression {index}",
	show: "Show",
	hide: "Hide",
	removeExpression: "Remove expression {index}",
	remove: "Remove",
	addExpression: "Add expression",
	graph: "Graph",
	resetView: "Reset view",
	updatingGraph: "Updating graph",
	graphSummary: "Graph summary",
	viewportSummary:
		"Viewport x from {xMin} to {xMax}, y from {yMin} to {yMax}.",
	seriesSummary: "Series {index}, {lineStyle}: {expression}",
	keyboardGraphTrace: "Keyboard graph trace",
	keyboardTrace: "Keyboard trace",
	series: "Series",
	seriesOption: "Series {index}",
	previousPoint: "Previous point",
	nextPoint: "Next point",
	tracePoint: "x {x}, y {y}",
	noSampledPoint: "No sampled graph point is available.",
	lineStyleSolid: "solid",
	lineStyleDashed: "dashed",
	lineStyleDotted: "dotted",
	errorInvalidExpression: "Check the expression and try again.",
	errorUnsupportedExpression:
		"This expression is not available in this calculator.",
	errorExpressionTooComplex: "Simplify the expression and try again.",
	errorEvaluationTimeout: "The calculation took too long and was stopped.",
	errorInvalidState: "The saved calculator state could not be restored.",
	errorWorkerUnavailable: "The calculator is temporarily unavailable.",
} as const satisfies CortexCalculatorMessages;

const NL_NL_MESSAGES = {
	basicCalculator: "Eenvoudige rekenmachine",
	scientificCalculator: "Wetenschappelijke rekenmachine",
	graphingCalculator: "Grafische rekenmachine",
	expressionLabel: "Uitdrukking voor {calculator}",
	angleMode: "Hoekeenheid",
	degrees: "Graden",
	radians: "Radialen",
	calculate: "Bereken",
	calculating: "Bezig met berekenen",
	backspace: "Wis teken",
	clear: "Wissen",
	result: "Resultaat: {result}",
	calculationHistory: "Berekeningsgeschiedenis",
	clearHistory: "Geschiedenis wissen",
	virtualKeyboardBasic: "Eenvoudig",
	virtualKeyboardScientific: "Wetenschappelijk",
	virtualKeyboardGraphing: "Grafisch",
	graphExpressions: "Grafiekuitdrukkingen",
	graphExpressionLabel: "Grafiekuitdrukking {index}, {lineStyle} lijn",
	seriesDescription: "Reeks {index}: {lineStyle} lijn",
	showExpression: "Uitdrukking {index} tonen",
	hideExpression: "Uitdrukking {index} verbergen",
	show: "Tonen",
	hide: "Verbergen",
	removeExpression: "Uitdrukking {index} verwijderen",
	remove: "Verwijderen",
	addExpression: "Uitdrukking toevoegen",
	graph: "Grafiek",
	resetView: "Weergave herstellen",
	updatingGraph: "Grafiek wordt bijgewerkt",
	graphSummary: "Samenvatting van de grafiek",
	viewportSummary:
		"Weergave x van {xMin} tot {xMax}, y van {yMin} tot {yMax}.",
	seriesSummary: "Reeks {index}, {lineStyle}: {expression}",
	keyboardGraphTrace: "Grafiek volgen met het toetsenbord",
	keyboardTrace: "Volgen met het toetsenbord",
	series: "Reeks",
	seriesOption: "Reeks {index}",
	previousPoint: "Vorig punt",
	nextPoint: "Volgend punt",
	tracePoint: "x {x}, y {y}",
	noSampledPoint: "Er is geen bemonsterd grafiekpunt beschikbaar.",
	lineStyleSolid: "ononderbroken",
	lineStyleDashed: "gestreepte",
	lineStyleDotted: "gestippelde",
	errorInvalidExpression: "Controleer de uitdrukking en probeer het opnieuw.",
	errorUnsupportedExpression:
		"Deze uitdrukking is niet beschikbaar in deze rekenmachine.",
	errorExpressionTooComplex:
		"Vereenvoudig de uitdrukking en probeer het opnieuw.",
	errorEvaluationTimeout: "De berekening duurde te lang en is gestopt.",
	errorInvalidState: "De opgeslagen rekenmachinestatus kon niet worden hersteld.",
	errorWorkerUnavailable: "De rekenmachine is tijdelijk niet beschikbaar.",
} as const satisfies CortexCalculatorMessages;

const ERROR_MESSAGE_KEYS = {
	"invalid-expression": "errorInvalidExpression",
	"unsupported-expression": "errorUnsupportedExpression",
	"expression-too-complex": "errorExpressionTooComplex",
	"evaluation-timeout": "errorEvaluationTimeout",
	"invalid-state": "errorInvalidState",
	"worker-unavailable": "errorWorkerUnavailable",
} as const satisfies Record<CortexCalculatorErrorCode, CortexCalculatorMessageKey>;

const LINE_STYLE_KEYS = {
	solid: "lineStyleSolid",
	dashed: "lineStyleDashed",
	dotted: "lineStyleDotted",
} as const satisfies Record<CortexGraphLineStyle, CortexCalculatorMessageKey>;

const RTL_LANGUAGES = new Set([
	"ar",
	"ckb",
	"dv",
	"fa",
	"he",
	"iw",
	"ks",
	"ku",
	"nqo",
	"ps",
	"sd",
	"syr",
	"ug",
	"ur",
	"yi",
]);

function primaryLanguage(locale: string): string {
	try {
		return new Intl.Locale(locale.replaceAll("_", "-")).language.toLowerCase();
	} catch {
		return locale.replaceAll("_", "-").split("-")[0]?.toLowerCase() ?? "en";
	}
}

export function localeDirection(locale: string): CortexTextDirection {
	try {
		const textInfo = (
			new Intl.Locale(locale.replaceAll("_", "-")) as {
				textInfo?: { direction?: string };
			}
		).textInfo;
		if (textInfo?.direction === "rtl" || textInfo?.direction === "ltr") {
			return textInfo.direction;
		}
	} catch {
		// The primary-subtag fallback still handles malformed but recognizable tags.
	}
	return RTL_LANGUAGES.has(primaryLanguage(locale)) ? "rtl" : "ltr";
}

function baseMessages(locale: string): CortexCalculatorMessages {
	return primaryLanguage(locale) === "nl" ? NL_NL_MESSAGES : EN_US_MESSAGES;
}

function interpolate(
	message: string,
	values: Readonly<Record<string, string | number>>,
): string {
	return message.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (placeholder, key) =>
		Object.hasOwn(values, key) ? String(values[key]) : placeholder,
	);
}

export interface CortexCalculatorLocalization {
	readonly locale: string;
	readonly direction: CortexTextDirection;
	readonly messages: CortexCalculatorMessages;
	t(
		key: CortexCalculatorMessageKey,
		values?: Readonly<Record<string, string | number>>,
	): string;
	formatNumber(value: number, maximumSignificantDigits?: number): string;
	errorMessage(code: CortexCalculatorErrorCode): string;
	lineStyle(style: CortexGraphLineStyle): string;
}

export function createCortexLocalization(
	locale: string,
	overrides: CortexCalculatorMessageOverrides = {},
	direction: CortexTextDirection | "auto" = "auto",
): CortexCalculatorLocalization {
	const messages = Object.freeze({ ...baseMessages(locale), ...overrides });
	const resolvedDirection = direction === "auto" ? localeDirection(locale) : direction;
	let numberFormatter: Intl.NumberFormat | null = null;
	let formatterDigits = 0;

	const t = (
		key: CortexCalculatorMessageKey,
		values: Readonly<Record<string, string | number>> = {},
	): string => interpolate(messages[key], values);

	return Object.freeze({
		locale,
		direction: resolvedDirection,
		messages,
		t,
		formatNumber(value: number, maximumSignificantDigits = 6): string {
			try {
				if (!numberFormatter || formatterDigits !== maximumSignificantDigits) {
					formatterDigits = maximumSignificantDigits;
					numberFormatter = new Intl.NumberFormat(locale, {
						maximumSignificantDigits,
						useGrouping: false,
					});
				}
				return numberFormatter.format(value);
			} catch {
				return value.toPrecision(maximumSignificantDigits);
			}
		},
		errorMessage(code: CortexCalculatorErrorCode): string {
			return t(ERROR_MESSAGE_KEYS[code]);
		},
		lineStyle(style: CortexGraphLineStyle): string {
			return t(LINE_STYLE_KEYS[style]);
		},
	});
}

export const cortexEnglishMessages: Readonly<CortexCalculatorMessages> =
	EN_US_MESSAGES;

export const cortexDutchMessages: Readonly<CortexCalculatorMessages> =
	NL_NL_MESSAGES;
