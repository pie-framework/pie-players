/**
 * Content language on the delivery channel.
 *
 * Content language names the language the item's content is written in — a
 * fact about the content, on a separate channel from the interface locale a
 * player publishes to the elements inside it. It reaches the player in
 * `env.locale`, the same channel `env.mode` travels: a delivery fact the
 * container knows and content cannot. Authoring hosts emit it; a host that
 * emits nothing leaves the content unstamped, and nothing is invented — there
 * is no default language for content that names none.
 *
 * The player reflects the resolved language onto its content subtree's root as
 * `lang` and `dir`, so a screen reader takes the content's voice rules and RTL
 * content lays out right to left, independent of the chrome's locale.
 *
 * Content that declares nothing falls back to a default the container names:
 * a section's `runtime.contentLanguage`, or {@link UNDECLARED_CONTENT_LANGUAGE}
 * once the host sets an interface locale, which stamps `lang=""` and
 * `dir="auto"` so the content takes neither the interface's language nor its
 * direction. With neither, undeclared content inherits its context, which keeps
 * hosts that set no interface locale rendering as they always have.
 */

import { canonicalLanguageTag } from "./language-tags.js";
import { localeDirection } from "./provider.js";
import type { TextDirection } from "./types.js";

/**
 * The content-language default for content that declares no language under a
 * host-set interface locale: `lang=""` names the language unknown and
 * `dir="auto"` takes direction from the content's first strong character.
 */
export const UNDECLARED_CONTENT_LANGUAGE = "auto";

/**
 * The default a player stamps on content whose `env` declares no language: the
 * host's content language, else {@link UNDECLARED_CONTENT_LANGUAGE} when the
 * host set an interface locale, else `undefined`, which leaves undeclared
 * content inheriting its context. Inputs are read defensively, since both
 * arrive from attributes.
 */
export function defaultContentLanguage(options: {
	contentLanguage?: unknown;
	interfaceLocale?: unknown;
}): string | undefined {
	const named =
		typeof options.contentLanguage === "string"
			? options.contentLanguage.trim()
			: "";
	if (named) return named;
	const requested =
		typeof options.interfaceLocale === "string"
			? options.interfaceLocale.trim()
			: "";
	return requested ? UNDECLARED_CONTENT_LANGUAGE : undefined;
}

/** `lang` and `dir` for declared content, or `null` when nothing is declared. */
export interface ContentLanguageAttributes {
	lang: string;
	dir: TextDirection;
}

/**
 * `lang` and `dir` for the content an `env` describes, or `null` when it
 * declares no usable language. Reads `env.locale` defensively — `env` is
 * pass-through and load-bearing, so anything may arrive — and never invents a
 * default: undeclared content stays unstamped and inherits whatever its
 * context genuinely provides.
 */
export function contentLanguageAttributes(
	env: unknown,
): ContentLanguageAttributes | null {
	const locale = (env as { locale?: unknown } | null | undefined)?.locale;
	if (typeof locale !== "string") return null;
	const lang = canonicalLanguageTag(locale);
	if (!lang) return null;
	return { lang, dir: localeDirection(lang) };
}

/**
 * Stamps the content language onto `target`: `contentLanguageAttributes(env)`,
 * else `fallback` — a tag, or {@link UNDECLARED_CONTENT_LANGUAGE} for
 * `lang=""` and `dir="auto"` — else neither attribute, so a model set can drop
 * the language a previous one declared. A fallback that is not a usable tag
 * counts as absent. No-op without a target.
 */
export function stampContentLanguage(
	target: Element | null | undefined,
	env: unknown,
	fallback?: string | null,
): void {
	if (!target) return;
	const attributes =
		contentLanguageAttributes(env) ??
		(fallback === UNDECLARED_CONTENT_LANGUAGE
			? { lang: "", dir: "auto" }
			: contentLanguageAttributes({ locale: fallback }));
	if (attributes) {
		target.setAttribute("lang", attributes.lang);
		target.setAttribute("dir", attributes.dir);
	} else {
		target.removeAttribute("lang");
		target.removeAttribute("dir");
	}
}

/** Scripts written right to left, for {@link firstStrongDirection}. */
const RTL_LETTER =
	/[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}\p{Script=Adlam}\p{Script=Hanifi_Rohingya}\p{Script=Mandaic}\p{Script=Samaritan}]/u;
const LETTER = /\p{L}/u;

/**
 * The direction of the first letter in `root`'s text, skipping `script`,
 * `style` and `template`, or `null` when it has none. Letters only, which is
 * where the bidi algorithm's strong characters overwhelmingly sit.
 */
export function firstStrongDirection(root: Node): TextDirection | null {
	const doc = root.ownerDocument ?? (root as Document);
	const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */, {
		acceptNode: (node) =>
			node.parentElement?.closest("script, style, template")
				? 2 /* NodeFilter.FILTER_REJECT */
				: 1 /* NodeFilter.FILTER_ACCEPT */,
	});
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		for (const char of node.nodeValue ?? "") {
			if (RTL_LETTER.test(char)) return "rtl";
			if (LETTER.test(char)) return "ltr";
		}
	}
	return null;
}

/**
 * The mismatch between undeclared content's script and the direction a
 * fallback stamped on `root`, or `null` when there is none to report: the env
 * declares a language, `root` carries no stamped direction or `dir="auto"`, or
 * the content has no letters.
 */
export function undeclaredDirectionMismatch(
	root: Element,
	env: unknown,
): { stamped: TextDirection; script: TextDirection } | null {
	if (contentLanguageAttributes(env)) return null;
	const stamped = root.getAttribute("dir");
	if (stamped !== "ltr" && stamped !== "rtl") return null;
	const script = firstStrongDirection(root);
	if (!script) return null;
	return script === stamped ? null : { stamped, script };
}
