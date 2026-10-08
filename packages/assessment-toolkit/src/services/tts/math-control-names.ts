import {
	flatQuerySelector,
	flatTreeClosest,
	isShadowRootNode,
	walkFlatTree,
} from "./flat-tree.js";
import {
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

/** The language a container's content is in, read across shadow roots. */
const contentLanguage = (element: Element): string | undefined => {
	for (let node: Element | null = element; node; ) {
		const lang = node.closest("[lang]")?.getAttribute("lang")?.trim();
		if (lang) return lang;
		const root = node.getRootNode();
		node = isShadowRootNode(root) ? root.host : null;
	}
	return undefined;
};

const isEnglish = (language: string | undefined): boolean =>
	!language || language.toLowerCase().split("-")[0] === "en";

export interface MathControlNamesOptions {
	/**
	 * The host's math speech options. Names take only `engineOptions`, where
	 * SRE's locale tables load from: their domain and style are fixed.
	 */
	getMathSpeech?: () => SREMathSpeechOptions | undefined;
	loadSre?: ResolveMathSpeechOptions["loadSre"];
}

/**
 * Labels each typeset expression inside a control under `root`, open shadow
 * roots included, with SRE's speech, as MathJax adds it and again whenever
 * MathJax replaces it. An `aria-label` on the role-less `mjx-container` puts
 * that speech in the name of the control around it, among the control's other
 * text. English reads ClearSpeak, other languages MathSpeak, in the language of
 * the content. The label replaces the elements' own; it stays when SRE cannot
 * speak the math. Returns the function that stops observing.
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
		math: Element,
		language: string | undefined,
	): Promise<string | null> => {
		const result = await resolveMathSpeechFromChunks(
			[{ type: "math", mathml, fallbackText: "" }],
			{
				language,
				loadSre: options.loadSre,
				mathSpeech: {
					...(isEnglish(language) ? { style: fractionStyle(math) } : {}),
					engineOptions: options.getMathSpeech?.()?.engineOptions,
				},
			},
		);
		return result.usedMathSpeech ? result.speechText : null;
	};

	const name = (container: Element): void => {
		if (!flatTreeClosest(container, CONTROLS)) return;
		const math = flatQuerySelector(container, "math");
		const mathml = math && canonicalizeMathML(math.outerHTML);
		if (!math || !mathml) return;
		const language = contentLanguage(container);
		const key = `${language ?? ""}\u0000${mathml}`;
		let pending = speech.get(key);
		if (!pending) {
			pending = speak(mathml, math, language);
			speech.set(key, pending);
		}
		void pending.then((label) => {
			if (stopped || !label || !container.isConnected) return;
			if (container.getAttribute("aria-label") !== label) {
				container.setAttribute("aria-label", label);
			}
		});
	};

	// A shadow root is a tree of its own, which an observer on `root` does not
	// see into, so each one found is observed as well. One attached after its
	// host was visited is not found until something is added around the host.
	const observed = new WeakSet<Node>();
	const observeTree = (tree: Node): void => {
		if (observed.has(tree)) return;
		observed.add(tree);
		observer.observe(tree, { childList: true, subtree: true });
	};

	const visit = (node: Node): void => {
		if (node.nodeType !== 1) return;
		const element = node as Element;
		const container = flatTreeClosest(element, "mjx-container");
		if (container) {
			name(container);
			return;
		}
		if (element.shadowRoot) observeTree(element.shadowRoot);
		walkFlatTree(element, (descendant) => {
			if (descendant.nodeType !== 1) return "skip";
			const found = descendant as Element;
			if (found.localName === "mjx-container") {
				name(found);
				return "skip";
			}
			if (found.shadowRoot) observeTree(found.shadowRoot);
			return undefined;
		});
	};

	const observer = new MutationObserver((records) => {
		for (const record of records) {
			for (const node of record.addedNodes) visit(node);
		}
	});
	observeTree(root);
	visit(root);

	return () => {
		stopped = true;
		observer.disconnect();
	};
}
