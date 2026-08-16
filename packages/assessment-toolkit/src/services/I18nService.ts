/**
 * I18nService
 *
 * Internationalization service with hybrid loading strategy: English bundled,
 * other locales lazy-loaded. Manages translations, locale switching and RTL/LTR
 * direction, and notifies subscribers on change.
 *
 * This is a thin wrapper over `SimpleI18n` from `players-shared`, adding
 * toolkit-scoped logging and the `initialize()` convenience. It was previously a
 * near-verbatim second copy of that class — same fields, same lookup, same
 * `selectPluralForm` — and duplicate implementations of one contract drift
 * silently, because nothing fails when only one of them is fixed. Both are
 * published and neither had a consumer, so the copy was pure exposure.
 *
 * Part of PIE Assessment Toolkit.
 */

import type {
	I18nConfig,
	I18nServiceApi,
	PluralTranslation,
	TranslationBundle,
} from "@pie-players/pie-players-shared/i18n";
import {
	detectBrowserLocale,
	SimpleI18n,
} from "@pie-players/pie-players-shared/i18n";
import { createLogger } from "../utils/logger.js";

const log = createLogger("I18nService");

// Re-export types for convenience
export type {
	I18nConfig,
	I18nServiceApi,
	PluralTranslation,
	TranslationBundle,
};

/**
 * I18nService
 *
 * Manages internationalization with reactive state updates.
 */
export class I18nService implements I18nServiceApi {
	private readonly i18n: SimpleI18n;
	private readonly config: I18nConfig;

	constructor(config: I18nConfig = {}) {
		this.config = { ...config };
		this.i18n = new SimpleI18n(config);

		log("I18nService initialized", {
			fallbackLocale: config.fallbackLocale || "en",
		});
	}

	/**
	 * Initialize i18n with locale and loading strategy.
	 *
	 * Falls back to the browser's locale when the config names none.
	 */
	async initialize(config: I18nConfig): Promise<void> {
		Object.assign(this.config, config);

		const locale = config.locale || detectBrowserLocale();
		log(`Initializing with locale: ${locale}`);

		await this.setLocale(locale);
	}

	/**
	 * Translate a key with optional interpolation
	 *
	 * @param key Translation key (e.g., 'common.save')
	 * @param params Optional parameters for interpolation
	 * @returns Translated string
	 */
	t(key: string, params?: Record<string, any>): string {
		return this.i18n.t(key, params);
	}

	/**
	 * Translate with pluralization
	 *
	 * @param key Translation key
	 * @param count Count for pluralization
	 * @param params Optional parameters for interpolation
	 * @returns Translated string with plural form
	 */
	tn(key: string, count: number, params?: Record<string, any>): string {
		return this.i18n.tn(key, count, params);
	}

	/**
	 * Get current locale
	 */
	getLocale(): string {
		return this.i18n.getLocale();
	}

	/**
	 * Change locale (triggers async loading if needed)
	 *
	 * @param locale Locale code (e.g., 'en', 'es', 'zh', 'ar')
	 */
	async setLocale(locale: string): Promise<void> {
		log(`Setting locale to: ${locale}`);
		await this.i18n.setLocale(locale);
	}

	/**
	 * Get current text direction
	 */
	getDirection(): "ltr" | "rtl" {
		return this.i18n.getDirection();
	}

	/**
	 * Get available locales
	 */
	getAvailableLocales(): string[] {
		return this.i18n.getAvailableLocales();
	}

	/**
	 * Check if locale is loaded
	 */
	isLocaleLoaded(locale: string): boolean {
		return this.i18n.isLocaleLoaded(locale);
	}

	/**
	 * Subscribe to locale/translation changes
	 * Returns unsubscribe function
	 */
	subscribe(listener: () => void): () => void {
		return this.i18n.subscribe(listener);
	}

	/**
	 * Check if a translation key exists
	 */
	hasKey(key: string): boolean {
		return this.i18n.hasKey(key);
	}
}
