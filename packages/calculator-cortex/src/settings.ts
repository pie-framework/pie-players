import type {
	CalculatorType,
} from "@pie-players/pie-calculator";
import { CortexCalculatorError } from "./errors.js";
import {
	cortexEnglishMessages,
	createCortexLocalization,
	type CortexCalculatorLocalization,
} from "./localization.js";
import type {
	CortexAngleMode,
	CortexCalculatorProviderConfig,
	CortexCalculatorMessageOverrides,
	CortexCalculatorSettings,
	CortexFunctionId,
	CortexGraphViewport,
} from "./types.js";

export const CORTEX_INPUT_LENGTH_LIMIT = 1_024;
export const CORTEX_AST_NODE_LIMIT = 256;
export const CORTEX_AST_DEPTH_LIMIT = 32;
export const CORTEX_GRAPH_EXPRESSION_LIMIT = 6;
export const CORTEX_GRAPH_SAMPLE_LIMIT = 1_200;

const DEFAULT_VIEWPORT: CortexGraphViewport = {
	xMin: -10,
	xMax: 10,
	yMin: -10,
	yMax: 10,
};

const BASIC_FUNCTIONS = ["square-root"] as const satisfies readonly CortexFunctionId[];
const SCIENTIFIC_FUNCTIONS = [
	"square-root",
	"power",
	"root",
	"exponential",
	"natural-log",
	"common-log",
	"log-base-n",
	"sine",
	"cosine",
	"tangent",
	"inverse-sine",
	"inverse-cosine",
	"inverse-tangent",
	"absolute-value",
	"factorial",
] as const satisfies readonly CortexFunctionId[];

export interface ResolvedCortexSettings {
	readonly type: CalculatorType;
	readonly angleMode: CortexAngleMode;
	readonly calculationPrecision: number;
	readonly displayPrecision: number;
	readonly historyLimit: number;
	readonly evaluationTimeLimitMs: number;
	readonly allowedFunctions: ReadonlySet<CortexFunctionId>;
	readonly allowClipboard: boolean;
	readonly restrictedMode: boolean;
	readonly locale: string;
	readonly theme: "light" | "dark" | "auto";
	readonly localization: CortexCalculatorLocalization;
	readonly graph: {
		readonly viewport: CortexGraphViewport;
		readonly showAxes: boolean;
		readonly showGrid: boolean;
	};
}

function fail(message: string): never {
	throw new CortexCalculatorError("invalid-state", message);
}

function integerInRange(
	value: unknown,
	fallback: number,
	minimum: number,
	maximum: number,
	label: string,
): number {
	if (value === undefined) return fallback;
	if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
		fail(`${label} must be an integer from ${minimum} to ${maximum}.`);
	}
	return value as number;
}

function resolveViewport(value: unknown): CortexGraphViewport {
	if (value === undefined) return { ...DEFAULT_VIEWPORT };
	if (!value || typeof value !== "object") fail("Graph viewport must be an object.");
	const candidate = value as Partial<CortexGraphViewport>;
	const numbers = [candidate.xMin, candidate.xMax, candidate.yMin, candidate.yMax];
	if (!numbers.every((entry) => typeof entry === "number" && Number.isFinite(entry))) {
		fail("Graph viewport bounds must be finite numbers.");
	}
	if ((candidate.xMin as number) >= (candidate.xMax as number) || (candidate.yMin as number) >= (candidate.yMax as number)) {
		fail("Graph viewport minimums must be less than maximums.");
	}
	return candidate as CortexGraphViewport;
}

function resolveFunctions(
	type: CalculatorType,
	value: unknown,
): ReadonlySet<CortexFunctionId> {
	const modeFunctions = type === "basic" ? BASIC_FUNCTIONS : SCIENTIFIC_FUNCTIONS;
	if (value === undefined) return new Set(modeFunctions);
	if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
		fail("allowedFunctions must be an array of function identifiers.");
	}
	const known = new Set<CortexFunctionId>(SCIENTIFIC_FUNCTIONS);
	for (const item of value) {
		if (!known.has(item as CortexFunctionId)) fail(`Unknown calculator function: ${item}.`);
	}
	const requested = new Set(value as CortexFunctionId[]);
	return new Set(modeFunctions.filter((item) => requested.has(item)));
}

function booleanOrDefault(value: unknown, fallback: boolean, label: string): boolean {
	if (value === undefined) return fallback;
	if (typeof value !== "boolean") fail(`${label} must be a boolean.`);
	return value;
}

function resolveMessageOverrides(value: unknown): CortexCalculatorMessageOverrides {
	if (value === undefined) return {};
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		fail("messages must be an object.");
	}
	const overrides: Record<string, string> = {};
	for (const [key, message] of Object.entries(value)) {
		if (!Object.hasOwn(cortexEnglishMessages, key)) continue;
		if (typeof message !== "string") {
			fail(`messages.${key} must be a string.`);
		}
		overrides[key] = message;
	}
	return overrides as CortexCalculatorMessageOverrides;
}

export function resolveCortexSettings(
	type: CalculatorType,
	config: CortexCalculatorProviderConfig = {},
): ResolvedCortexSettings {
	const settings = (config.settings ?? {}) as CortexCalculatorSettings;
	const angleMode = settings.angleMode ?? "degree";
	if (angleMode !== "degree" && angleMode !== "radian") {
		fail('angleMode must be "degree" or "radian".');
	}
	const graph = settings.graph;
	if (graph !== undefined && (!graph || typeof graph !== "object")) {
		fail("graph settings must be an object.");
	}
	const restrictedMode = config.restrictedMode === true;
	const locale = typeof config.locale === "string" && config.locale.trim()
		? config.locale.trim()
		: "en-US";
	const theme = config.theme ?? "auto";
	if (theme !== "light" && theme !== "dark" && theme !== "auto") {
		fail('theme must be "light", "dark", or "auto".');
	}
	const direction = settings.direction ?? "auto";
	if (direction !== "ltr" && direction !== "rtl" && direction !== "auto") {
		fail('direction must be "ltr", "rtl", or "auto".');
	}
	const localization = createCortexLocalization(
		locale,
		resolveMessageOverrides(settings.messages),
		direction,
	);

	return Object.freeze({
		type,
		angleMode,
		calculationPrecision: integerInRange(
			settings.calculationPrecision,
			15,
			1,
			21,
			"calculationPrecision",
		),
		displayPrecision: integerInRange(
			settings.displayPrecision,
			10,
			1,
			12,
			"displayPrecision",
		),
		historyLimit: integerInRange(settings.historyLimit, 20, 0, 50, "historyLimit"),
		evaluationTimeLimitMs: integerInRange(
			settings.evaluationTimeLimitMs,
			1_000,
			100,
			2_000,
			"evaluationTimeLimitMs",
		),
		allowedFunctions: resolveFunctions(type, settings.allowedFunctions),
		allowClipboard:
			!restrictedMode && booleanOrDefault(settings.allowClipboard, true, "allowClipboard"),
		restrictedMode,
		locale,
		theme,
		localization,
		graph: Object.freeze({
			viewport: resolveViewport(graph?.viewport),
			showAxes: booleanOrDefault(graph?.showAxes, true, "graph.showAxes"),
			showGrid: booleanOrDefault(graph?.showGrid, true, "graph.showGrid"),
		}),
	});
}

export function isCortexFunctionId(value: unknown): value is CortexFunctionId {
	return typeof value === "string" && SCIENTIFIC_FUNCTIONS.includes(value as CortexFunctionId);
}
