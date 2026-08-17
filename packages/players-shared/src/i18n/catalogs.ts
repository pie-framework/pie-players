/**
 * Lazy catalog loaders for every locale this repository ships.
 *
 * Imported by players, never by tools. A tool resolves its provider from the
 * toolkit runtime context and needs only the interface plus the English
 * fallback; reaching this module from a tool entry would emit a locale chunk
 * into a bundle that never calls `setLocale`, because every tool
 * `vite.config.ts` sets `external: []`.
 *
 * An explicit static map rather than a bundler macro: `tsc` emits these
 * `import()` calls verbatim, so `players-shared/dist` evaluates anywhere ESM
 * does — webpack, esbuild, Rollup, Node, or a browser loading the files
 * directly. `pie-qti` used `import.meta.glob` and shipped a `dist` that throws
 * under every one of those. Each bundler still sees the specifiers statically,
 * so each locale stays its own chunk. Adding a locale means adding one line here
 * alongside the file.
 *
 * `en-US` is absent: it is the fallback for every missing key in every other
 * locale, so the provider imports it statically and it is always resident.
 *
 * @module @pie-players/pie-players-shared/i18n/catalogs
 */

import type { BundledLocaleCode, MessageCatalog } from "./types.js";

type CatalogLoader = () => Promise<{ default: MessageCatalog }>;

const CATALOG_LOADERS: Record<
	Exclude<BundledLocaleCode, "en-US">,
	CatalogLoader
> = {
	"nl-NL": () => import("./messages/nl-NL.js"),
};

/**
 * Every locale tag this repository ships a catalog for, English included.
 *
 * The provider resolves a request against this list through RFC 4647 lookup and
 * primary-subtag widening, so `nl`, `nl_NL` and `nl-BE` all reach `nl-NL`.
 */
export const BUNDLED_LOCALES: readonly BundledLocaleCode[] = ["en-US", "nl-NL"];

/**
 * Load one shipped catalog.
 *
 * Throws for a locale with no shipped catalog; the provider treats that as
 * "resolve through the fallback chain" rather than an error, so a host locale we
 * do not ship still renders.
 */
export async function loadBundledCatalog(
	locale: string,
): Promise<MessageCatalog> {
	const loader = CATALOG_LOADERS[locale as Exclude<BundledLocaleCode, "en-US">];
	if (!loader) {
		throw new Error(`No bundled i18n catalog for locale: ${locale}`);
	}
	const module = await loader();
	return module.default;
}
