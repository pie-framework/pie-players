/**
 * Translation Loader
 *
 * Implements hybrid loading strategy:
 * - English bundled with application
 * - Other languages loaded on demand
 *
 * Part of PIE Players i18n system.
 */

// Import English translations (bundled)
import enCommon from "./translations/en/common.json";
import enToolkit from "./translations/en/toolkit.json";
import enTools from "./translations/en/tools.json";
import type { TranslationBundle } from "./types";

// RTL locales
const RTL_LOCALES = ["ar", "he", "fa", "ur"];

/**
 * Bundled English translations
 * Available immediately without network request
 */
export const BUNDLED_TRANSLATIONS: Record<string, TranslationBundle> = {
	en: {
		locale: "en",
		direction: "ltr",
		translations: {
			...flattenTranslations(enCommon),
			...flattenTranslations(enToolkit),
			...flattenTranslations(enTools),
		},
	},
};

const LOCALE_IMPORTS: Record<string, () => Promise<[any, any, any]>> = {
	es: () =>
		Promise.all([
			import("./translations/es/common.json"),
			import("./translations/es/toolkit.json"),
			import("./translations/es/tools.json"),
		]),
	zh: () =>
		Promise.all([
			import("./translations/zh/common.json"),
			import("./translations/zh/toolkit.json"),
			import("./translations/zh/tools.json"),
		]),
	ar: () =>
		Promise.all([
			import("./translations/ar/common.json"),
			import("./translations/ar/toolkit.json"),
			import("./translations/ar/tools.json"),
		]),
};

/**
 * Load translations for a locale
 *
 * @param locale Locale code (e.g., 'en', 'es', 'zh', 'ar')
 * @returns Translation bundle with flattened keys
 */
export async function loadTranslations(
	locale: string,
): Promise<TranslationBundle> {
	// Return bundled English immediately
	if (locale === "en") {
		return BUNDLED_TRANSLATIONS.en;
	}

	const importer = LOCALE_IMPORTS[locale];
	if (!importer) {
		throw new Error(
			`Translation files not found for locale: ${locale}. Ensure translation files exist in packages/players-shared/src/i18n/translations/${locale}/`,
		);
	}

	// Lazy load other locales
	try {
		const [common, toolkit, tools] = await importer();

		return {
			locale,
			direction: RTL_LOCALES.includes(locale) ? "rtl" : "ltr",
			translations: {
				...flattenTranslations(common.default || common),
				...flattenTranslations(toolkit.default || toolkit),
				...flattenTranslations(tools.default || tools),
			},
		};
	} catch (error) {
		console.error(`Failed to load translations for locale: ${locale}`, error);
		throw new Error(
			`Translation files not found for locale: ${locale}. Ensure translation files exist in packages/players-shared/src/i18n/translations/${locale}/`,
		);
	}
}

/**
 * Flatten nested JSON to dot notation
 *
 * Converts:
 * { "common": { "save": "Save" } }
 *
 * To:
 * { "common.save": "Save" }
 *
 * @param obj Nested translation object
 * @param prefix Current key prefix
 * @param result Accumulated result
 * @returns Flattened translation object
 */
function flattenTranslations(
	obj: any,
	prefix = "",
	result: Record<string, any> = {},
): Record<string, any> {
	for (const [key, value] of Object.entries(obj)) {
		const newKey = prefix ? `${prefix}.${key}` : key;

		if (value && typeof value === "object" && !Array.isArray(value)) {
			// Check if it's a plural form (has 'one' or 'other' keys)
			if ("one" in value || "other" in value) {
				// This is a plural translation, keep it as an object
				result[newKey] = value;
			} else {
				// This is a nested object, flatten recursively
				flattenTranslations(value, newKey, result);
			}
		} else {
			// This is a leaf value
			result[newKey] = value;
		}
	}

	return result;
}

/**
 * Get available locales
 *
 * @returns Array of locale codes
 */
export function getAvailableLocales(): string[] {
	return ["en", "es", "zh", "ar"];
}

/**
 * Check if locale is RTL
 *
 * @param locale Locale code
 * @returns True if locale is right-to-left
 */
export function isRTLLocale(locale: string): boolean {
	return RTL_LOCALES.includes(locale);
}
