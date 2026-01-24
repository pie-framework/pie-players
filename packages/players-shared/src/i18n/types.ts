/**
 * I18n Type Definitions
 *
 * Shared types for internationalization system.
 * Defined in players-shared to avoid circular dependencies.
 */

/**
 * Plural translation forms
 * Follows ICU MessageFormat plural rules
 */
export interface PluralTranslation {
	zero?: string;
	one: string;
	few?: string;
	many?: string;
	other: string;
}

/**
 * Translation bundle structure
 */
export interface TranslationBundle {
	locale: string;
	translations: Record<string, string | PluralTranslation>;
	direction: "ltr" | "rtl";
}

/**
 * I18n configuration
 */
export interface I18nConfig {
	/** Initial locale (default: browser language) */
	locale?: string;

	/** Fallback locale (default: 'en') */
	fallbackLocale?: string;

	/** Translation loader function */
	loadTranslations?: (locale: string) => Promise<TranslationBundle>;

	/** Bundled translations (for hybrid loading) */
	bundledTranslations?: Record<string, TranslationBundle>;

	/** Missing key handler */
	onMissingKey?: (key: string, locale: string) => void;

	/** Debug mode */
	debug?: boolean;
}

/**
 * I18nService interface
 */
export interface II18nService {
	initialize(config: I18nConfig): Promise<void>;
	t(key: string, params?: Record<string, any>): string;
	tn(key: string, count: number, params?: Record<string, any>): string;
	getLocale(): string;
	setLocale(locale: string): Promise<void>;
	getDirection(): "ltr" | "rtl";
	getAvailableLocales(): string[];
	isLocaleLoaded(locale: string): boolean;
	subscribe(listener: () => void): () => void;
	hasKey(key: string): boolean;
}
