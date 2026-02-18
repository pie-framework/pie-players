/**
 * I18n Module
 *
 * Internationalization system for PIE Players.
 *
 * @module @pie-players/pie-players-shared/i18n
 */

export {
	BUNDLED_TRANSLATIONS,
	getAvailableLocales,
	isRTLLocale,
	loadTranslations,
} from "./loader.js";
export { SimpleI18n } from "./simple-i18n.js";
export type {
	I18nConfig,
	II18nService,
	PluralTranslation,
	TranslationBundle,
} from "./types.js";
export { useI18n } from "./use-i18n.svelte.js";
export {
	type UseI18nStandaloneConfig,
	useI18nStandalone,
} from "./use-i18n-standalone.svelte.js";
