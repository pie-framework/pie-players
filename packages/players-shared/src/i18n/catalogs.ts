/**
 * The bundled catalog loader: `en-US`, the one statically shipped catalog.
 *
 * Imported by players, never by tools. A tool resolves its provider from the
 * toolkit runtime context and needs only the interface plus the English
 * fallback; reaching this module from a tool entry would emit a locale chunk
 * into a bundle that never calls `setLocale`, because every tool
 * `vite.config.ts` sets `external: []`.
 *
 * `en-US` is the source of truth — the fallback for every missing key in every
 * other locale — so the provider imports it statically and it is always
 * resident. It is the only catalog this package ships: every other locale this
 * repository ships lives in the optional generated tier
 * (`@pie-players/pie-i18n-generated`), whose loaders a host composes after
 * this one. The composed shape is that package's README's wiring example:
 *
 * ```ts
 * loadCatalog: (locale) =>
 *   loadBundledCatalog(locale).catch(() => loadGeneratedCatalog(locale));
 * ```
 *
 * A request this function cannot serve rejects, and the provider treats that
 * as "resolve through the fallback chain" rather than an error, so a host
 * locale nothing ships still renders English.
 *
 * @module @pie-players/pie-players-shared/i18n/catalogs
 */

import enUS from "./messages/en-US.js";
import type { BundledLocaleCode, MessageCatalog } from "./types.js";

/**
 * Every locale tag this repository bundles a catalog for. `en-US` alone: the
 * statically resident source of truth.
 *
 * The provider resolves a request against this list through RFC 4647 lookup and
 * primary-subtag widening, so `en`, `en_US` and `en-GB`-without-a-catalog all
 * land on `en-US` unless a composed loader serves the region.
 */
export const BUNDLED_LOCALES: readonly BundledLocaleCode[] = ["en-US"];

/**
 * Load one shipped catalog.
 *
 * `en-US` comes back without a load: it is statically resident, and a host
 * composing this loader into a provider — the generated tier's README pattern,
 * or a pseudo-localization of the English catalog — asks for it by name like
 * any other locale.
 *
 * Rejects for a locale with no bundled catalog; the provider treats that as
 * "resolve through the fallback chain" rather than an error, so a host locale we
 * do not ship still renders.
 */
export async function loadBundledCatalog(
	locale: string,
): Promise<MessageCatalog> {
	if (locale === "en-US") {
		return enUS;
	}
	throw new Error(`No bundled i18n catalog for locale: ${locale}`);
}
