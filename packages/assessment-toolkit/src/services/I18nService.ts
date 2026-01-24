/**
 * I18nService
 *
 * Internationalization service with hybrid loading strategy.
 * Manages translations, locale switching, and RTL/LTR direction.
 *
 * Features:
 * - Subscriber/listener pattern for reactive updates
 * - Hybrid loading: Bundle English, lazy-load other locales
 * - Interpolation: {variable} syntax
 * - Pluralization: ICU-style plural rules
 * - RTL detection: Automatic based on locale
 * - TypedEventBus integration: Emit locale change events
 * - Fallback to English for missing keys
 *
 * Part of PIE Assessment Toolkit.
 */

import type {
	I18nConfig,
	II18nService,
	PluralTranslation,
	TranslationBundle,
} from "@pie-framework/pie-players-shared/i18n";
import { createLogger } from "../utils/logger";

const log = createLogger("I18nService");

// Re-export types for convenience
export type { I18nConfig, II18nService, PluralTranslation, TranslationBundle };

/**
 * I18nService
 *
 * Manages internationalization with reactive state updates.
 */
export class I18nService implements II18nService {
	private locale: string = "en";
	private fallbackLocale: string = "en";
	private direction: "ltr" | "rtl" = "ltr";
	private translations = new Map<string, TranslationBundle>();
	private listeners = new Set<() => void>();
	private loadingPromises = new Map<string, Promise<void>>();
	private config: I18nConfig;

	constructor(config: I18nConfig = {}) {
		this.config = config;
		this.fallbackLocale = config.fallbackLocale || "en";

		log("I18nService initialized", { fallbackLocale: this.fallbackLocale });

		// Load bundled translations (English by default)
		if (config.bundledTranslations) {
			for (const [locale, bundle] of Object.entries(
				config.bundledTranslations,
			)) {
				this.translations.set(locale, bundle);
				log(`Loaded bundled translations for: ${locale}`);
			}
		}
	}

	/**
	 * Initialize i18n with locale and loading strategy
	 */
	async initialize(config: I18nConfig): Promise<void> {
		Object.assign(this.config, config);

		const locale = config.locale || this.detectBrowserLocale();
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
		const translation = this.getTranslation(key);
		return this.interpolate(translation as string, params);
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
		const translation = this.getTranslation(key);

		if (typeof translation === "object") {
			const pluralForm = this.selectPluralForm(count, this.locale);
			const text = translation[pluralForm] || translation.other;
			return this.interpolate(text, { ...params, count });
		}

		return this.interpolate(translation as string, { ...params, count });
	}

	/**
	 * Get current locale
	 */
	getLocale(): string {
		return this.locale;
	}

	/**
	 * Change locale (triggers async loading if needed)
	 *
	 * @param locale Locale code (e.g., 'en', 'es', 'zh', 'ar')
	 */
	async setLocale(locale: string): Promise<void> {
		log(`Setting locale to: ${locale}`);

		// Check if already loading
		if (this.loadingPromises.has(locale)) {
			log(`Locale ${locale} is already loading, waiting...`);
			await this.loadingPromises.get(locale);
			return;
		}

		// Check if already loaded
		if (this.translations.has(locale)) {
			log(`Locale ${locale} already loaded`);
			this.applyLocale(locale);
			return;
		}

		// Load translations
		const loadingPromise = this.loadTranslationsForLocale(locale);
		this.loadingPromises.set(locale, loadingPromise);

		try {
			await loadingPromise;
			this.applyLocale(locale);
		} finally {
			this.loadingPromises.delete(locale);
		}
	}

	/**
	 * Get current text direction
	 */
	getDirection(): "ltr" | "rtl" {
		return this.direction;
	}

	/**
	 * Get available locales
	 */
	getAvailableLocales(): string[] {
		return Array.from(this.translations.keys());
	}

	/**
	 * Check if locale is loaded
	 */
	isLocaleLoaded(locale: string): boolean {
		return this.translations.has(locale);
	}

	/**
	 * Subscribe to locale/translation changes
	 * Returns unsubscribe function
	 */
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Check if a translation key exists
	 */
	hasKey(key: string): boolean {
		const bundle = this.translations.get(this.locale);
		return !!bundle?.translations[key];
	}

	/**
	 * Notify all listeners of state change
	 */
	private notifyListeners(): void {
		this.listeners.forEach((listener) => listener());
	}

	/**
	 * Apply locale and notify listeners
	 */
	private applyLocale(locale: string): void {
		const bundle = this.translations.get(locale);
		if (!bundle) {
			log(`No bundle found for locale: ${locale}`, "warn");
			return;
		}

		const previousLocale = this.locale;
		this.locale = locale;
		this.direction = bundle.direction;

		log(`Applied locale: ${locale} (direction: ${this.direction})`);

		this.applyDOMDirection();
		this.notifyListeners();
	}

	/**
	 * Apply direction to DOM
	 */
	private applyDOMDirection(): void {
		if (typeof document === "undefined") return;

		document.documentElement.setAttribute("dir", this.direction);
		document.documentElement.setAttribute("lang", this.locale);

		log(
			`Applied DOM attributes: dir="${this.direction}" lang="${this.locale}"`,
		);
	}

	/**
	 * Load translations for a locale
	 */
	private async loadTranslationsForLocale(locale: string): Promise<void> {
		if (!this.config.loadTranslations) {
			throw new Error(`No translation loader configured for locale: ${locale}`);
		}

		log(`Loading translations for: ${locale}`);

		try {
			const bundle = await this.config.loadTranslations(locale);
			this.translations.set(locale, bundle);
			log(
				`Loaded translations for: ${locale} (${Object.keys(bundle.translations).length} keys)`,
			);
		} catch (error) {
			log(`Failed to load translations for: ${locale}`, "error");
			throw error;
		}
	}

	/**
	 * Get translation for a key
	 */
	private getTranslation(key: string): string | PluralTranslation {
		// Try current locale
		const currentBundle = this.translations.get(this.locale);
		if (currentBundle?.translations[key]) {
			return currentBundle.translations[key];
		}

		// Try fallback locale
		const fallbackBundle = this.translations.get(this.fallbackLocale);
		if (fallbackBundle?.translations[key]) {
			if (this.config.debug) {
				log(`Using fallback translation for key: ${key}`);
			}
			return fallbackBundle.translations[key];
		}

		// Missing key handling
		if (this.config.onMissingKey) {
			this.config.onMissingKey(key, this.locale);
		}

		if (this.config.debug) {
			log(`Missing translation key: ${key} (locale: ${this.locale})`, "warn");
		}

		return key;
	}

	/**
	 * Interpolate variables in translation string
	 * Replaces {variable} with params.variable
	 */
	private interpolate(text: string, params?: Record<string, any>): string {
		if (!params) return text;

		return text.replace(/\{(\w+)\}/g, (match, key) => {
			return params[key]?.toString() || match;
		});
	}

	/**
	 * Select plural form based on count and locale
	 * Simplified implementation - real implementation would use Intl.PluralRules
	 */
	private selectPluralForm(
		count: number,
		locale: string,
	): keyof PluralTranslation {
		// Use Intl.PluralRules if available
		if (typeof Intl !== "undefined" && Intl.PluralRules) {
			try {
				const rules = new Intl.PluralRules(locale);
				const category = rules.select(count);
				return category as keyof PluralTranslation;
			} catch (error) {
				log(`Failed to use Intl.PluralRules for locale: ${locale}`, "warn");
			}
		}

		// Fallback to simple rules
		if (count === 0) return "zero";
		if (count === 1) return "one";
		return "other";
	}

	/**
	 * Detect browser locale
	 */
	private detectBrowserLocale(): string {
		if (typeof navigator === "undefined") return "en";

		const browserLang =
			navigator.language ||
			(navigator.languages && navigator.languages[0]) ||
			"en";

		// Extract language code (e.g., 'en-US' -> 'en')
		return browserLang.split("-")[0];
	}
}
