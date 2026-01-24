/**
 * Standalone i18n Composable
 *
 * Lightweight i18n for standalone components that don't use the service architecture.
 * Creates its own internal I18nService instance with hybrid loading.
 *
 * Use this when:
 * - Building standalone components (tools, players) without full toolkit integration
 * - You want simple i18n without dependency injection
 *
 * Use `useI18n()` when:
 * - Working within the full assessment toolkit architecture
 * - You need centralized locale management across the application
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useI18nStandalone } from '@pie-framework/pie-players-shared/i18n';
 *
 *   const i18n = useI18nStandalone({ locale: 'en' });
 * </script>
 *
 * <button>{i18n.t('common.save')}</button>
 * <span dir={i18n.direction}>{i18n.tn('assessment.questions', 10)}</span>
 * ```
 */

import { BUNDLED_TRANSLATIONS, loadTranslations } from "./loader";
import { SimpleI18n } from "./simple-i18n";
import type { I18nConfig } from "./types";

/**
 * Standalone i18n configuration
 */
export interface UseI18nStandaloneConfig {
	/** Initial locale (default: browser language) */
	locale?: string;
	/** Fallback locale (default: 'en') */
	fallbackLocale?: string;
	/** Debug mode */
	debug?: boolean;
}

/**
 * Create a standalone i18n instance
 *
 * @param config Configuration options
 * @returns Reactive i18n interface
 */
export function useI18nStandalone(config: UseI18nStandaloneConfig = {}) {
	let locale = $state<string>(config.locale || "en");
	let direction = $state<"ltr" | "rtl">("ltr");
	let isLoading = $state(false);

	// Create internal service instance
	const service = new SimpleI18n({
		locale: config.locale,
		fallbackLocale: config.fallbackLocale || "en",
		bundledTranslations: BUNDLED_TRANSLATIONS,
		loadTranslations,
		debug: config.debug,
	});

	// Initialize service
	$effect(() => {
		service
			.initialize({
				locale: config.locale,
				fallbackLocale: config.fallbackLocale || "en",
				bundledTranslations: BUNDLED_TRANSLATIONS,
				loadTranslations,
				debug: config.debug,
			})
			.then(() => {
				locale = service.getLocale();
				direction = service.getDirection();
			});
	});

	// Subscribe to service changes
	$effect(() => {
		const unsubscribe = service.subscribe(() => {
			locale = service.getLocale();
			direction = service.getDirection();
		});

		return unsubscribe;
	});

	/**
	 * Translate a key with optional interpolation
	 */
	function t(key: string, params?: Record<string, any>): string {
		return service.t(key, params);
	}

	/**
	 * Translate with pluralization
	 */
	function tn(
		key: string,
		count: number,
		params?: Record<string, any>,
	): string {
		return service.tn(key, count, params);
	}

	/**
	 * Change locale (async)
	 */
	async function setLocale(newLocale: string): Promise<void> {
		isLoading = true;
		try {
			await service.setLocale(newLocale);
		} finally {
			isLoading = false;
		}
	}

	return {
		/**
		 * Current locale (reactive)
		 */
		get locale() {
			return locale;
		},

		/**
		 * Current text direction (reactive)
		 */
		get direction() {
			return direction;
		},

		/**
		 * Loading state (reactive)
		 */
		get isLoading() {
			return isLoading;
		},

		/**
		 * Translate function
		 */
		t,

		/**
		 * Translate with pluralization
		 */
		tn,

		/**
		 * Change locale
		 */
		setLocale,

		/**
		 * Get available locales
		 */
		get availableLocales() {
			return service.getAvailableLocales();
		},

		/**
		 * Check if locale is loaded
		 */
		isLocaleLoaded(loc: string): boolean {
			return service.isLocaleLoaded(loc);
		},

		/**
		 * Check if translation key exists
		 */
		hasKey(key: string): boolean {
			return service.hasKey(key);
		},

		/**
		 * Access underlying service (for advanced use cases)
		 */
		get service() {
			return service;
		},
	};
}
