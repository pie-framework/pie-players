import { composedParentElement } from "../services/tts/flat-tree.js";
import { findShellScopeHost } from "./content-region.js";

/** The content language when neither the markup nor the host names one. */
export const DEFAULT_CONTENT_LANGUAGE = "en-US";

/**
 * The nearest `lang` attribute at or above `node`, climbing through shadow
 * hosts, and ending after `boundary` when one is given. An empty `lang` names
 * the language unknown and ends the climb with no language, as it ends the
 * browser's own inheritance: the players stamp it on content that declares
 * none, so the interface's `lang` above never reads as the content's.
 */
export const findLangAttribute = (
	node: Node | null | undefined,
	boundary?: Element | null,
): string | undefined => {
	let current: Element | null = !node
		? null
		: node.nodeType === 1
			? (node as Element)
			: composedParentElement(node);
	while (current) {
		const lang = current.getAttribute("lang");
		if (lang !== null) return lang.trim() || undefined;
		if (boundary && current === boundary) return undefined;
		current = composedParentElement(current);
	}
	return undefined;
};

/**
 * The language the content `root` holds is declared in: the `lang` its
 * outermost `lang`-carrying descendants share, or undefined when they disagree,
 * one is empty, or there are none. The players stamp `lang` on the content root
 * they render, below the shell a whole-item read targets, so this is how such
 * a read finds the language an item declared through `env.locale`.
 */
export const findHeldContentLanguage = (root: Element): string | undefined => {
	let language: string | undefined;
	for (const element of root.querySelectorAll("[lang]")) {
		const outer = element.parentElement?.closest("[lang]");
		if (outer && outer !== root && root.contains(outer)) continue;
		const lang = element.getAttribute("lang")?.trim();
		if (!lang) return undefined;
		if (language === undefined) language = lang;
		else if (language.toLowerCase() !== lang.toLowerCase()) return undefined;
	}
	return language;
};

export interface ContentLanguageOptions {
	/**
	 * Where the `lang` climb ends, inclusive. Defaults to the nearest shell scope
	 * host above the target; with neither, markup names no language.
	 */
	boundary?: Element | null;
	/** The host's `content-language` input. */
	contentLanguage?: string | null;
}

/**
 * The language the content at `target` is named as being in: the nearest `lang`
 * between it and its shell scope host, else the host's `content-language` input.
 * Undefined when neither names one.
 *
 * The climb stops at the shell because the page's own `lang` above it is the
 * interface language, which the toolkit's `locale` carries; content language is
 * the content's. Resolved at speak time, since a reading target's markup can
 * change between reads.
 */
export const findContentLanguage = (
	target: Node | null | undefined,
	options: ContentLanguageOptions = {},
): string | undefined => {
	const boundary =
		options.boundary !== undefined
			? options.boundary
			: findShellScopeHost(target);
	const fromMarkup = boundary ? findLangAttribute(target, boundary) : undefined;
	return fromMarkup || options.contentLanguage?.trim() || undefined;
};

/**
 * {@link findContentLanguage}, else `en-US`: the language text processing and
 * catalog lookup read.
 */
export const resolveContentLanguage = (
	target: Node | null | undefined,
	options: ContentLanguageOptions = {},
): string => findContentLanguage(target, options) ?? DEFAULT_CONTENT_LANGUAGE;
