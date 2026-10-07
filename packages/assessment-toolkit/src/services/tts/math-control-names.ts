import { observeFlattenedTree } from "@pie-players/pie-players-shared/ui/flattened-tree";
import {
	mathSpeechDomain,
	type ResolveMathSpeechOptions,
	resolveMathSpeechFromChunks,
	type SREMathSpeechOptions,
} from "./math-speech.js";
import { canonicalizeMathML } from "./mathml-sanitization.js";

/**
 * Elements that take their accessible name from their content. Browsers leave
 * MathML out of that name, so a choice labelled with math is named from its
 * bare symbols ("4 12" for 4 over 12). The elements' renderer labels the math
 * in the same set of controls with its own English speech.
 */
const CONTROLS = [
	"a[href]",
	"button",
	"label",
	"summary",
	...[
		"button",
		"checkbox",
		"combobox",
		"link",
		"menuitem",
		"menuitemcheckbox",
		"menuitemradio",
		"option",
		"radio",
		"switch",
		"tab",
		"treeitem",
	].map((role) => `[role="${role}"]`),
].join(", ");

const TOKENS = new Set(["mi", "mn", "mtext"]);

const isToken = (element: Element): boolean =>
	TOKENS.has(element.localName) ||
	(element.localName === "mrow" &&
		element.children.length === 1 &&
		TOKENS.has(element.children[0].localName));

/**
 * ClearSpeak's fraction preference for a name. "4 over 12" keeps the numerals
 * as written, where the default says "four fourths" for 4 over 4 (WCAG 2.5.3:
 * a name does not put words in place of the formula). "Over" between longer
 * parts is ambiguous, so an expression holding such a fraction reads every
 * fraction by numerator and denominator.
 */
const fractionStyle = (math: Element): string =>
	Array.from(math.getElementsByTagName("mfrac")).every((fraction) =>
		Array.from(fraction.children).every(isToken),
	)
		? "Fraction_Over"
		: "Fraction_General";

/** The host's ClearSpeak preferences, with the name's fraction preference. */
const clearSpeakStyle = (
	hostStyle: string | undefined,
	math: Element,
): string =>
	[
		...(hostStyle ?? "")
			.split(":")
			.map((preference) => preference.trim())
			.filter(
				(preference) =>
					preference &&
					preference !== "default" &&
					!preference.startsWith("Fraction_"),
			),
		fractionStyle(math),
	].join(":");

/** The language a container's content is in, read across shadow roots. */
const contentLanguage = (element: Element): string | undefined => {
	for (let node: Element | null = element; node; ) {
		const lang = node.closest("[lang]")?.getAttribute("lang")?.trim();
		if (lang) return lang;
		const root = node.getRootNode();
		node = root instanceof ShadowRoot ? root.host : null;
	}
	return undefined;
};

export interface MathControlNamesOptions {
	/**
	 * The host's math speech options, read-aloud's. Names keep the locale's
	 * domain, since MathSpeak reads 4 over 12 "four twelfths" in English, and
	 * take the host's style for that domain, all but its fraction preference.
	 */
	getMathSpeech?: () => SREMathSpeechOptions | undefined;
	loadSre?: ResolveMathSpeechOptions["loadSre"];
}

/**
 * Labels each typeset expression inside a control in `root`'s flattened tree
 * with SRE's speech, as MathJax adds it and again whenever MathJax replaces it.
 * An `aria-label` on the role-less `mjx-container` puts that speech in the name
 * of the control around it, among the control's other text. The speech is in
 * the language of the content, as read-aloud would speak it there. The label
 * replaces the elements' own; it stays when SRE cannot speak the math.
 * Returns the function that stops observing.
 */
export function observeMathControlNames(
	root: Element,
	options: MathControlNamesOptions = {},
): () => void {
	if (typeof MutationObserver === "undefined") return () => {};
	const speech = new Map<string, Promise<string | null>>();
	let stopped = false;

	const speak = async (
		mathml: string,
		mathSpeech: SREMathSpeechOptions,
		language: string | undefined,
	): Promise<string | null> => {
		const result = await resolveMathSpeechFromChunks(
			[{ type: "math", mathml, fallbackText: "" }],
			{ language, loadSre: options.loadSre, mathSpeech },
		);
		return result.usedMathSpeech ? result.speechText : null;
	};

	const name = (container: Element): void => {
		if (!container.closest(CONTROLS)) return;
		const math = container.querySelector("math");
		const mathml = math && canonicalizeMathML(math.outerHTML);
		if (!math || !mathml) return;
		const language = contentLanguage(container);
		const host = options.getMathSpeech?.();
		const domain = mathSpeechDomain(language);
		const hostStyle =
			!host?.domain || host.domain === domain ? host?.style : undefined;
		const mathSpeech: SREMathSpeechOptions = {
			domain,
			style:
				domain === "clearspeak" ? clearSpeakStyle(hostStyle, math) : hostStyle,
			engineOptions: host?.engineOptions,
		};
		const key = [language, mathSpeech.domain, mathSpeech.style, mathml].join(
			"\u0000",
		);
		let pending = speech.get(key);
		if (!pending) {
			pending = speak(mathml, mathSpeech, language);
			speech.set(key, pending);
		}
		void pending.then((label) => {
			if (stopped || !label || !container.isConnected) return;
			if (container.getAttribute("aria-label") !== label) {
				container.setAttribute("aria-label", label);
			}
		});
	};

	const visit = (node: Element | ShadowRoot): void => {
		const container =
			node.nodeType === Node.ELEMENT_NODE
				? (node as Element).closest("mjx-container")
				: null;
		if (container) {
			name(container);
			return;
		}
		for (const found of node.querySelectorAll("mjx-container")) {
			name(found);
		}
	};

	// A `lang` change, as an element makes when its model's language changes,
	// names the math under it again in the new language.
	const stop = observeFlattenedTree(root, visit, { attributeFilter: ["lang"] });

	return () => {
		stopped = true;
		stop();
	};
}
