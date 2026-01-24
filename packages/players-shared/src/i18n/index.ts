/**
 * I18n Module
 *
 * Internationalization system for PIE Players.
 *
 * @module @pie-framework/pie-players-shared/i18n
 */

export {
	BUNDLED_TRANSLATIONS,
	getAvailableLocales,
	isRTLLocale,
	loadTranslations,
} from "./loader";
export { SimpleI18n } from "./simple-i18n";
export type {
	I18nConfig,
	II18nService,
	PluralTranslation,
	TranslationBundle,
} from "./types";
export { useI18n } from "./use-i18n.svelte";
export {
	type UseI18nStandaloneConfig,
	useI18nStandalone,
} from "./use-i18n-standalone.svelte";
