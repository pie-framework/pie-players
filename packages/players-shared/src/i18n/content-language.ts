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

import { localeDirection } from "./provider.js";
import { toLanguageTag } from "./language-tags.js";
import type { TextDirection } from "./types.js";

/** `lang` and `dir` for declared content, or `null` when nothing is declared. */
export interface ContentLanguageAttributes {
	lang: string;
	dir: TextDirection;
}

/**
 * The canonical form of a usable language tag, or `undefined` for anything a
 * language in use would not be: `es_MX` normalizes to `es-MX`, `Spanish` and
 * an empty string are not tags. The same rule the PIE elements apply to
 * `model.language`, so both channels stamp the same shape.
 */
export function canonicalContentLanguageTag(
	language: string | null | undefined,
): string | undefined {
	const tag = toLanguageTag(language).split(/[.@]/)[0];
	// `Intl` accepts any 5-8 letter primary subtag, `Spanish` included; a
	// language in use has an ISO 639 code of two or three letters.
	if (!/^[a-z]{2,3}(-|$)/i.test(tag)) return undefined;
	try {
		return Intl.getCanonicalLocales(tag)[0];
	} catch {
		return undefined;
	}
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
	const lang = canonicalContentLanguageTag(locale);
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
