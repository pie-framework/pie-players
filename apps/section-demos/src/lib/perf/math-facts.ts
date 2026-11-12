import { ESM_DEMO_ELEMENT_VERSIONS } from "@pie-players/demo-ui/element-versions";
import type { PieContent } from "@pie-players/pie-players-shared/types";

/**
 * Math-fact items in the shape a fact-drill host serves: one `math-inline`
 * model per item, `responseType: "Simple"`, one of three named keypads, a
 * prompt holding the fact, and one symbolically validated answer. The
 * delivery-cost harness (`packages/section-player/perf/`) measures players
 * rendering them.
 */

export const FACT_KEYPADS = [
	"non-negative-integers",
	"integers",
	"fractions",
] as const;

export type FactKeypad = (typeof FACT_KEYPADS)[number];

export type Fact = {
	prompt: string;
	answer: string;
	/** What a learner types into the response field. */
	keys: string;
	equationEditor: FactKeypad;
};

/** The installed math elements, which `preloaded` registers and `esm` loads. */
export const MATH_INLINE_PACKAGE = "@pie-element/math-inline";
export const MATH_TEMPLATED_PACKAGE = "@pie-element/math-templated";

export function installedVersion(packageName: string): string {
	const version = ESM_DEMO_ELEMENT_VERSIONS[packageName];
	if (!version) throw new Error(`${packageName} is not installed`);
	return version;
}

/** Fact `n`, cycling through the three keypads. */
export function fact(n: number): Fact {
	const equationEditor = FACT_KEYPADS[n % FACT_KEYPADS.length];
	const a = 2 + (n % 8);
	const b = 3 + ((n * 5) % 7);
	if (equationEditor === "integers") {
		return {
			prompt: `${a} - ${a + b}`,
			answer: String(-b),
			keys: String(-b),
			equationEditor,
		};
	}
	if (equationEditor === "fractions") {
		return {
			prompt: `${a}/${a + b} + ${b}/${a + b}`,
			answer: "1",
			keys: "1",
			equationEditor,
		};
	}
	return {
		prompt: `${a} + ${b}`,
		answer: String(a + b),
		keys: String(a + b),
		equationEditor,
	};
}

export function factResponseId(n: number): string {
	return `fact-${n}-response`;
}

/** One fact as its own `math-inline` item. */
export function factItem(n: number, version: string): PieContent {
	const { prompt, answer, equationEditor } = fact(n);
	const responseId = factResponseId(n);
	return {
		id: `fact-${n}`,
		markup: `<math-inline id="${responseId}"></math-inline>`,
		elements: { "math-inline": `${MATH_INLINE_PACKAGE}@${version}` },
		models: [
			{
				id: responseId,
				element: "math-inline",
				responseType: "Simple",
				equationEditor,
				prompt: `<p>${prompt}</p>`,
				expression: "{{response}}",
				responses: [{ id: "1", answer, validation: "symbolic" }],
			},
		],
	} as PieContent;
}

/**
 * `count` facts as one `math-templated` item, one response area per fact. The
 * item takes a single keypad, so every area gets the first fact's.
 */
export function factGridItem(count: number, version: string): PieContent {
	const cells = Array.from({ length: count }, (_, n) => {
		const { prompt } = fact(n);
		return `<span>${prompt} = {{${n}}}</span>`;
	});
	const responses = Object.fromEntries(
		Array.from({ length: count }, (_, n) => [
			String(n),
			{ id: String(n), answer: fact(n).answer, validation: "symbolic" },
		]),
	);
	return {
		id: "fact-grid",
		markup: '<math-templated id="fact-grid-response"></math-templated>',
		elements: { "math-templated": `${MATH_TEMPLATED_PACKAGE}@${version}` },
		models: [
			{
				id: "fact-grid-response",
				element: "math-templated",
				equationEditor: fact(0).equationEditor,
				markup: `<p>${cells.join(" ")}</p>`,
				responses,
				validationDefault: "symbolic",
				partialScoring: true,
				promptEnabled: false,
			},
		],
	} as PieContent;
}
