/**
 * I18n Module
 *
 * Chrome internationalization for PIE Players: the strings our own packages
 * render. Content language and in-item alternates are separate concerns on
 * separate channels — see `docs/architecture/internationalization.md`.
 *
 * Two entry points, and which one you import decides what ships:
 *
 * - **Players** import this module. `createPieI18n()` wires the provider to the
 *   lazy catalog loaders, so every shipped locale is reachable and each lands in
 *   its own chunk.
 * - **Tools** import `./types.js` as `import type` (fully erased) plus
 *   `getDefaultI18n` from `./provider.js` for the no-publisher default. That
 *   path never reaches `./catalogs.js`, so no locale chunk is emitted into a
 *   tool bundle — which matters because every tool `vite.config.ts` sets
 *   `external: []`.
 *
 * @module @pie-players/pie-players-shared/i18n
 */

import { BUNDLED_LOCALES, loadBundledCatalog } from "./catalogs.js";
import { SimpleI18n } from "./provider.js";
import type { I18nConfig, I18nServiceApi } from "./types.js";

/**
 * A provider serving every locale this repository ships.
 *
 * Defaults to `en-US` with no locale detection: under fixed lockstep patch-only
 * versioning a rendered-string change reaches a host's live delivery on their
 * next install with no build signal on their side, so a player must render
 * exactly what it rendered before until a host supplies a locale.
 */
export function createPieI18n(config: I18nConfig = {}): I18nServiceApi {
	return new SimpleI18n({
		loadCatalog: loadBundledCatalog,
		availableLocales: BUNDLED_LOCALES,
		...config,
	});
}

export { BUNDLED_LOCALES, loadBundledCatalog } from "./catalogs.js";
export {
	findBestLanguageMatch,
	languageTagLookupSequence,
	languageTagsEqual,
	normalizeLanguageTag,
} from "./language-tags.js";
export {
	DEFAULT_LOCALE,
	detectBrowserLocale,
	dynamicMessageKey,
	getDefaultI18n,
	localeDirection,
	resolveInterfaceI18n,
	SimpleI18n,
} from "./provider.js";
export type {
	BundledLocaleCode,
	DynamicMessageKey,
	I18nConfig,
	I18nProvider,
	I18nServiceApi,
	InterpolationValues,
	LocaleCode,
	MessageCatalog,
	MessageKey,
	MessageKeyInput,
	MessageNode,
	PluralOptions,
	PluralTranslation,
	TextDirection,
	TranslationBundle,
} from "./types.js";
