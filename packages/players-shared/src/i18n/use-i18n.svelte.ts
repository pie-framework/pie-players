/**
 * Svelte 5 Composable for i18n
 *
 * Provides reactive translation functions and locale state.
 * Uses Svelte 5 runes for reactivity.
 *
 * Usage in a Svelte 5 component:
 * ```svelte
 * <script lang="ts">
 *   import { useI18n } from '@pie-framework/pie-players-shared/i18n';
 *
 *   let { player } = $props();
 *   const i18n = useI18n(() => player.getI18nService());
 * </script>
 *
 * <button>{i18n.t('common.save')}</button>
 * <span dir={i18n.direction}>
 *   {i18n.tn('assessment.questions', totalQuestions)}
 * </span>
 * ```
 */

import type { II18nService } from "./types";

/**
 * Svelte 5 composable for internationalization
 *
 * @param getService - Function that returns the I18nService instance (reactive)
 * @returns Object with reactive locale, direction, and translation functions
 */
export function useI18n(getService: () => II18nService | undefined) {
	let locale = $state<string>("en");
	let direction = $state<"ltr" | "rtl">("ltr");
	let isLoading = $state(false);

	// Get service instance reactively
	const service = $derived(getService());

	// Subscribe to service changes
	$effect(() => {
		if (service) {
			// Initialize state from service
			locale = service.getLocale();
			direction = service.getDirection();

			// Subscribe to changes
			const unsubscribe = service.subscribe(() => {
				locale = service.getLocale();
				direction = service.getDirection();
			});

			// Cleanup subscription
			return unsubscribe;
		}
		// Return no-op cleanup if service is undefined
		return () => {};
	});

	/**
	 * Translate a key with optional interpolation
	 *
	 * @param key Translation key (e.g., 'common.save')
	 * @param params Optional parameters for interpolation
	 * @returns Translated string
	 */
	function t(key: string, params?: Record<string, any>): string {
		if (!service) return key;
		return service.t(key, params);
	}

	/**
	 * Translate with pluralization
	 *
	 * @param key Translation key
	 * @param count Count for pluralization
	 * @param params Optional parameters for interpolation
	 * @returns Translated string with plural form
	 */
	function tn(
		key: string,
		count: number,
		params?: Record<string, any>,
	): string {
		if (!service) return key;
		return service.tn(key, count, params);
	}

	/**
	 * Change locale (async)
	 *
	 * @param newLocale Locale code (e.g., 'en', 'es', 'zh', 'ar')
	 */
	async function setLocale(newLocale: string): Promise<void> {
		if (!service) return;

		isLoading = true;
		try {
			await service.setLocale(newLocale);
		} finally {
			isLoading = false;
		}
	}

	// Return reactive getters and functions
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
			return service?.getAvailableLocales() || [];
		},

		/**
		 * Check if locale is loaded
		 */
		isLocaleLoaded(loc: string): boolean {
			return service?.isLocaleLoaded(loc) || false;
		},

		/**
		 * Check if translation key exists
		 */
		hasKey(key: string): boolean {
			return service?.hasKey(key) || false;
		},
	};
}
