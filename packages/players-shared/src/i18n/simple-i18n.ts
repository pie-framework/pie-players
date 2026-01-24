/**
 * Simple I18n Implementation
 *
 * Lightweight i18n without external dependencies.
 * Used for standalone components that don't need the full service architecture.
 */

import type { I18nConfig, PluralTranslation, TranslationBundle } from "./types";

/**
 * Simple I18n class for standalone use
 */
export class SimpleI18n {
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

		// Load bundled translations
		if (config.bundledTranslations) {
			for (const [locale, bundle] of Object.entries(
				config.bundledTranslations,
			)) {
				this.translations.set(locale, bundle);
			}
		}
	}

	/**
	 * Initialize with locale
	 */
	async initialize(config: I18nConfig): Promise<void> {
		Object.assign(this.config, config);

		const locale = config.locale || this.detectBrowserLocale();
		await this.setLocale(locale);
	}

	/**
	 * Translate a key
	 */
	t(key: string, params?: Record<string, any>): string {
		const translation = this.getTranslation(key);
		return this.interpolate(translation as string, params);
	}

	/**
	 * Translate with pluralization
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
	 * Change locale
	 */
	async setLocale(locale: string): Promise<void> {
		// Check if already loading
		if (this.loadingPromises.has(locale)) {
			await this.loadingPromises.get(locale);
			return;
		}

		// Check if already loaded
		if (this.translations.has(locale)) {
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
	 * Get current direction
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
	 * Subscribe to changes
	 */
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Check if key exists
	 */
	hasKey(key: string): boolean {
		const bundle = this.translations.get(this.locale);
		return !!bundle?.translations[key];
	}

	private notifyListeners(): void {
		for (const listener of this.listeners) {
			listener();
		}
	}

	private applyLocale(locale: string): void {
		const bundle = this.translations.get(locale);
		if (!bundle) return;

		this.locale = locale;
		this.direction = bundle.direction;

		this.applyDOMDirection();
		this.notifyListeners();
	}

	private applyDOMDirection(): void {
		if (typeof document === "undefined") return;

		document.documentElement.setAttribute("dir", this.direction);
		document.documentElement.setAttribute("lang", this.locale);
	}

	private async loadTranslationsForLocale(locale: string): Promise<void> {
		if (!this.config.loadTranslations) {
			throw new Error(`No translation loader configured for locale: ${locale}`);
		}

		const bundle = await this.config.loadTranslations(locale);
		this.translations.set(locale, bundle);
	}

	private getTranslation(key: string): string | PluralTranslation {
		// Try current locale
		const currentBundle = this.translations.get(this.locale);
		if (currentBundle?.translations[key]) {
			return currentBundle.translations[key];
		}

		// Try fallback locale
		const fallbackBundle = this.translations.get(this.fallbackLocale);
		if (fallbackBundle?.translations[key]) {
			return fallbackBundle.translations[key];
		}

		// Missing key
		if (this.config.onMissingKey) {
			this.config.onMissingKey(key, this.locale);
		}

		return key;
	}

	private interpolate(text: string, params?: Record<string, any>): string {
		if (!params) return text;

		return text.replace(/\{(\w+)\}/g, (match, key) => {
			return params[key]?.toString() || match;
		});
	}

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
			} catch {
				// Fall through to simple rules
			}
		}

		// Fallback to simple rules
		if (count === 0) return "zero";
		if (count === 1) return "one";
		return "other";
	}

	private detectBrowserLocale(): string {
		if (typeof navigator === "undefined") return "en";

		const browserLang =
			navigator.language ||
			(navigator.languages && navigator.languages[0]) ||
			"en";

		return browserLang.split("-")[0];
	}
}
