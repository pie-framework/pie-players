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
 */

import { canonicalLanguageTag } from "./language-tags.js";
import { localeDirection } from "./provider.js";
import type { TextDirection } from "./types.js";

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
 * Stamps `contentLanguageAttributes(env)` onto `target`, removing both
 * attributes when the env declares no language — a model set can drop the
 * language a previous one declared. No-op without a target.
 */
export function stampContentLanguage(
	target: Element | null | undefined,
	env: unknown,
): void {
	if (!target) return;
	const attributes = contentLanguageAttributes(env);
	if (attributes) {
		target.setAttribute("lang", attributes.lang);
		target.setAttribute("dir", attributes.dir);
	} else {
		target.removeAttribute("lang");
		target.removeAttribute("dir");
	}
}
