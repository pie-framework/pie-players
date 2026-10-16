/**
 * Generated interface catalogs for PIE Players — the optional locale tier.
 *
 * Every catalog here is machine-generated against the terminology brief named
 * in `catalog-manifest.json` and is **not reviewed** by a native speaker. The
 * reviewed catalogs ship from `@pie-players/pie-players-shared/i18n`; this
 * package is pure data a host opts into by installing it and wiring it into
 * the provider alongside the bundled loaders:
 *
 * ```ts
 * import {
 * 	BUNDLED_LOCALES,
 * 	createPieI18n,
 * 	loadBundledCatalog,
 * } from "@pie-players/pie-players-shared/i18n";
 * import {
 * 	GENERATED_LOCALES,
 * 	loadGeneratedCatalog,
 * } from "@pie-players/pie-i18n-generated";
 *
 * const i18n = createPieI18n({
 * 	locale: "th-TH",
 * 	availableLocales: [...BUNDLED_LOCALES, ...GENERATED_LOCALES],
 * 	// Bundled first: a reviewed catalog silently wins over a generated one
 * 	// for the same tag, which is what makes promotion from generated to
 * 	// reviewed a no-op for a wired host.
 * 	loadCatalog: (locale) =>
 * 		loadBundledCatalog(locale).catch(() => loadGeneratedCatalog(locale)),
 * });
 * ```
 *
 * Nothing here loads unless a host asks for a generated locale: the loaders
 * are never invoked for the default `en-US` (statically resident in
 * `players-shared`), and each locale stays its own lazy chunk because `tsc`
 * emits these `import()` calls verbatim — the same property
 * `players-shared`'s `catalogs.ts` relies on.
 *
 * Provenance per locale — source hash, brief, model, generation date — lives
 * in `catalog-manifest.json`. `scripts/check-catalogs.ts` fails when a catalog
 * drifts from the English source or from its brief's structural rules.
 *
 * @module @pie-players/pie-i18n-generated
 */

import type { MessageCatalog } from "@pie-players/pie-players-shared/i18n/types";

type CatalogLoader = () => Promise<{ default: MessageCatalog }>;

/**
 * An explicit static map rather than a bundler macro, for the same reason
 * `catalogs.ts` gives: `tsc` emits the `import()` calls verbatim, so `dist`
 * evaluates under every ESM runtime, and every bundler keeps each locale its
 * own chunk. String-keyed: the generated set is open, and a host adding a
 * locale adds one line here alongside the file.
 */
const GENERATED_CATALOG_LOADERS: Record<string, CatalogLoader> = {
	"th-TH": () => import("./messages/th-TH.js"),
	"en-GB": () => import("./messages/en-GB.js"),
	"en-AU": () => import("./messages/en-AU.js"),
	// Bare tags on purpose: the provider's RFC 4647 lookup plus
	// primary-subtag widening lands `es-MX`, `es-419`, `fr-CA`, `pt-BR` and
	// `ar-SA` on these, and a host wanting a different national flavour
	// overrides per key through `customMessages`.
	es: () => import("./messages/es.js"),
	fr: () => import("./messages/fr.js"),
	ar: () => import("./messages/ar.js"),
};

/**
 * Every locale tag this package ships a generated catalog for.
 *
 * `en-GB` and `en-AU` are regional on purpose: bare `en` must keep resolving
 * to the statically bundled English, never to a regional variant.
 */
export const GENERATED_LOCALES: readonly string[] = [
	"th-TH",
	"en-GB",
	"en-AU",
	"es",
	"fr",
	"ar",
];

/**
 * Load one generated catalog.
 *
 * Throws for a locale with no generated catalog; the provider treats that as
 * "resolve through the fallback chain" rather than an error, mirroring
 * `loadBundledCatalog`.
 */
export async function loadGeneratedCatalog(
	locale: string,
): Promise<MessageCatalog> {
	const loader = GENERATED_CATALOG_LOADERS[locale];
	if (!loader) {
		throw new Error(`No generated i18n catalog for locale: ${locale}`);
	}
	const module = await loader();
	return module.default;
}
