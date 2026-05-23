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
	I18nServiceApi,
	PluralTranslation,
	TranslationBundle,
} from "./types.js";
