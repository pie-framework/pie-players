import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	test,
} from "bun:test";
import { observeMathControlNames } from "../src/services/tts/math-control-names";
import {
	resolveMathSpeechFromChunks,
	type SREMathSpeechOptions,
} from "../src/services/tts/math-speech";

beforeAll(() => {
	if (typeof (globalThis as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

const stops: Array<() => void> = [];

afterEach(() => {
	for (const stop of stops.splice(0)) stop();
	document.body.innerHTML = "";
});

/** MathJax's output for `mathml`: a container holding the hidden MathML. */
const typeset = (mathml: string): string =>
	`<mjx-container class="MathJax"><mjx-math aria-hidden="true"></mjx-math><mjx-assistive-mml><math>${mathml}</math></mjx-assistive-mml></mjx-container>`;

const FOUR_TWELFTHS = "<mfrac><mn>4</mn><mn>12</mn></mfrac>";

const observe = (root: Element, mathSpeech?: SREMathSpeechOptions): void => {
	stops.push(
		observeMathControlNames(root, { getMathSpeech: () => mathSpeech }),
	);
};

const labelOf = async (
	root: ParentNode,
	selector = "mjx-container",
	expected = /^(?!base:)/,
): Promise<string | null> => {
	const container = root.querySelector(selector);
	for (let attempt = 0; attempt < 200; attempt += 1) {
		const label = container?.getAttribute("aria-label");
		if (label && expected.test(label)) return label;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	return container?.getAttribute("aria-label") ?? null;
};

describe("math control names", () => {
	test("names the math in a control with ClearSpeak, fractions read over", async () => {
		document.body.innerHTML = `<div id="item"><label><input type="radio" />${typeset(FOUR_TWELFTHS)}</label></div>`;
		observe(document.getElementById("item")!);

		expect(await labelOf(document)).toBe("4 over 12");
	});

	test("reads every fraction by its parts when one has longer parts", async () => {
		document.body.innerHTML = `<div id="item"><button>${typeset(
			"<mfrac><mn>7</mn><mn>6</mn></mfrac><mo>+</mo><mfrac><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow><mrow><mi>x</mi><mo>-</mo><mn>1</mn></mrow></mfrac>",
		)}</button></div>`;
		observe(document.getElementById("item")!);

		expect(await labelOf(document)).toBe(
			"the fraction with numerator 7 and denominator 6 plus the fraction with numerator x plus 1 and denominator x minus 1",
		);
	});

	test("replaces the label the elements gave the math", async () => {
		document.body.innerHTML = `<div id="item"><div role="option">${typeset(FOUR_TWELFTHS)}</div></div>`;
		document
			.querySelector("mjx-container")!
			.setAttribute("aria-label", "base: four twelfths");
		observe(document.getElementById("item")!);

		expect(await labelOf(document)).toBe("4 over 12");
	});

	test("names math typeset after observing starts, and again when MathJax replaces it", async () => {
		document.body.innerHTML = `<div id="item"><button id="choice"></button></div>`;
		observe(document.getElementById("item")!);
		const choice = document.getElementById("choice")!;

		choice.innerHTML = typeset(FOUR_TWELFTHS);
		expect(await labelOf(choice)).toBe("4 over 12");

		choice.innerHTML = typeset("<msup><mi>x</mi><mn>2</mn></msup>");
		expect(await labelOf(choice)).toBe("x squared");
	});

	test("speaks the content's language with MathSpeak", async () => {
		document.body.innerHTML = `<div id="item" lang="es"><button>${typeset(FOUR_TWELFTHS)}</button></div>`;
		observe(document.getElementById("item")!);

		expect(await labelOf(document)).toBe(
			"empezar fracción 4 entre 12 finalizar fracción",
		);
	});

	test("names the math again in the language an element sets", async () => {
		document.body.innerHTML = `<div id="item"><div id="element" lang="en"><button>${typeset(FOUR_TWELFTHS)}</button></div></div>`;
		observe(document.getElementById("item")!);
		expect(await labelOf(document)).toBe("4 over 12");

		document.getElementById("element")!.setAttribute("lang", "es");

		expect(await labelOf(document, "mjx-container", /^empezar/)).toBe(
			"empezar fracción 4 entre 12 finalizar fracción",
		);
	});

	test("takes the host's ClearSpeak preferences, all but its fraction one", async () => {
		document.body.innerHTML = `<div id="item"><button>${typeset(
			`<msqrt><mi>x</mi></msqrt><mo>+</mo>${FOUR_TWELFTHS}`,
		)}</button></div>`;
		observe(document.getElementById("item")!, {
			domain: "clearspeak",
			style: "Roots_RootEnd:Fraction_Ordinal",
		});

		expect(await labelOf(document)).toBe(
			"the square root of x end root plus 4 over 12",
		);
	});

	test("keeps ClearSpeak in English when the host reads MathSpeak", async () => {
		document.body.innerHTML = `<div id="item"><button>${typeset(FOUR_TWELFTHS)}</button></div>`;
		observe(document.getElementById("item")!, { domain: "mathspeak" });

		expect(await labelOf(document)).toBe("4 over 12");
	});

	test("names the math a slot under the root shows", async () => {
		document.body.innerHTML = `<div id="base"></div>`;
		const base = document.getElementById("base")!;
		base.attachShadow({
			mode: "open",
		}).innerHTML = `<div id="toolkit"><slot></slot></div>`;
		const toolkit = base.shadowRoot!.getElementById("toolkit")!;
		base.innerHTML = `<button id="first">${typeset(FOUR_TWELFTHS)}</button>`;
		observe(toolkit);
		expect(await labelOf(base, "#first mjx-container")).toBe("4 over 12");

		base.insertAdjacentHTML("beforeend", `<div id="later"></div>`);
		await new Promise((resolve) => setTimeout(resolve, 0));
		document.getElementById("later")!.innerHTML =
			`<button>${typeset("<msup><mi>x</mi><mn>2</mn></msup>")}</button>`;
		expect(await labelOf(base, "#later mjx-container")).toBe("x squared");
	});

	test("leaves math outside controls, and math after it stops, unlabelled", async () => {
		document.body.innerHTML = `<div id="item"><p>${typeset(FOUR_TWELFTHS)}</p><button id="choice"></button></div>`;
		const stop = observeMathControlNames(document.getElementById("item")!);
		stop();
		document.getElementById("choice")!.innerHTML = typeset(FOUR_TWELFTHS);
		await new Promise((resolve) => setTimeout(resolve, 200));

		for (const container of document.querySelectorAll("mjx-container")) {
			expect(container.hasAttribute("aria-label")).toBe(false);
		}
	});

	test("leaves read-aloud on SRE's default style", async () => {
		document.body.innerHTML = `<div id="item"><button>${typeset(FOUR_TWELFTHS)}</button></div>`;
		observe(document.getElementById("item")!);
		expect(await labelOf(document)).toBe("4 over 12");

		const readAloud = await resolveMathSpeechFromChunks(
			[
				{
					type: "math",
					mathml: "<math><mfrac><mn>7</mn><mn>6</mn></mfrac></math>",
					fallbackText: "7/6",
				},
			],
			{ language: "en-US" },
		);

		expect(readAloud.speechText).toBe("seven sixths");
	});
});
