/**
 * Pseudo-localization: a transform over the English catalog that keeps every key,
 * plural category and `{placeholder}` intact while making each string accented,
 * bracketed and padded roughly 40% longer.
 *
 * What it is for: the gates check parity, not rendered geometry. A pseudo-locale
 * makes truncation, clipped labels, strings glued together in code and text that
 * was never catalog text visible in any demo or e2e run, before a translator or a
 * reviewer sees a real one. It is the industry's `qps-ploc` (Windows) and
 * `en-XA`/`ar-XB` (Android) practice; PIE uses the Android tags, registered
 * through `customMessages`, never shipped as catalogs.
 */
import type { MessageCatalog, MessageNode } from "./types.js";

/** Expanded Latin pseudo-locale: text grows ~40% and carries accents and brackets. */
export const PSEUDO_LOCALE_EXPANDED = "en-XA";

/**
 * Right-to-left pseudo-locale: the same transformed English under an `ar` primary
 * subtag, so `localeDirection` resolves RTL and chrome lays out mirrored without a
 * word of Arabic on screen.
 */
export const PSEUDO_LOCALE_RTL = "ar-XB";

export interface PseudoLocalizeOptions {
	/** Extra length as a fraction of the original, on top of what accents add. Default 0.4. */
	expansion?: number;
	/** Wrap every string in `[` and `]` so concatenated fragments stand out. Default true. */
	brackets?: boolean;
	/** Map Latin letters to accented look-alikes. Default true. */
	accents?: boolean;
}

const ACCENTS: Record<string, string> = {
	a: "á",
	A: "Á",
	b: "ƀ",
	B: "Ƀ",
	c: "ç",
	C: "Ç",
	d: "ð",
	D: "Ð",
	e: "é",
	E: "É",
	f: "ƒ",
	F: "Ƒ",
	g: "ğ",
	G: "Ğ",
	h: "ĥ",
	H: "Ĥ",
	i: "í",
	I: "Í",
	j: "ĵ",
	J: "Ĵ",
	k: "ķ",
	K: "Ķ",
	l: "ĺ",
	L: "Ĺ",
	m: "ḿ",
	M: "Ḿ",
	n: "ñ",
	N: "Ñ",
	o: "ó",
	O: "Ó",
	p: "þ",
	P: "Þ",
	q: "ǫ",
	Q: "Ǫ",
	r: "ŕ",
	R: "Ŕ",
	s: "š",
	S: "Š",
	t: "ŧ",
	T: "Ŧ",
	u: "ú",
	U: "Ú",
	v: "ṽ",
	V: "Ṽ",
	w: "ŵ",
	W: "Ŵ",
	x: "ẋ",
	X: "Ẋ",
	y: "ý",
	Y: "Ý",
	z: "ž",
	Z: "Ž",
};

const PLACEHOLDER = /(\{\w+\})/g;

function pseudoText(
	text: string,
	{ expansion, accents, brackets }: Required<PseudoLocalizeOptions>,
): string {
	const segments = text.split(PLACEHOLDER);
	const transformed = segments.map((segment, index) => {
		// A capturing split leaves each placeholder at an odd index, verbatim.
		if (index % 2 === 1 || segment === "") return segment;
		let out = segment;
		if (accents) {
			out = out.replace(/[a-zA-Z]/g, (letter) => ACCENTS[letter] ?? letter);
		}
		if (expansion <= 0) return out;
		const padding = Math.max(1, Math.ceil(segment.length * expansion));
		return `${out} ${"~".repeat(padding)}`;
	});
	const joined = transformed.join("");
	return brackets ? `[${joined}]` : joined;
}

/**
 * Produce the pseudo-localized twin of a catalog: same keys, same plural
 * categories, same placeholder sets, longer accented bracketed strings.
 */
export function pseudoLocalize(
	catalog: MessageCatalog,
	options?: PseudoLocalizeOptions,
): MessageCatalog {
	const settings: Required<PseudoLocalizeOptions> = {
		expansion: options?.expansion ?? 0.4,
		brackets: options?.brackets ?? true,
		accents: options?.accents ?? true,
	};
	const result: MessageCatalog = {};
	for (const [key, node] of Object.entries(catalog)) {
		result[key] = pseudoNode(node, settings);
	}
	return result;
}

function pseudoNode(
	node: MessageNode,
	settings: Required<PseudoLocalizeOptions>,
): MessageNode {
	if (typeof node === "string") return pseudoText(node, settings);
	const branch: Record<string, MessageNode> = {};
	for (const [key, child] of Object.entries(node)) {
		branch[key] = pseudoNode(child, settings);
	}
	return branch;
}
