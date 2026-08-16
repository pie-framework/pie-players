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
import enCommon from "./translations/en/common.json" with { type: "json" };
import enToolkit from "./translations/en/toolkit.json" with { type: "json" };
import enTools from "./translations/en/tools.json" with { type: "json" };
import type { TranslationBundle } from "./types.js";

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

// Every dynamic import here carries `with { type: "json" }`, matching the static
// English imports above. Bundlers infer the type from the extension, but Node's
// ESM loader refuses a JSON module without the attribute
// (`ERR_IMPORT_ATTRIBUTE_MISSING`), and `players-shared` is on the publish
// policy's `nodeSafe` list. Omitting it made English work and every other locale
// throw, which the catch below then reported as missing files.
const LOCALE_IMPORTS: Record<string, () => Promise<[any, any, any]>> = {
	es: () =>
		Promise.all([
			import("./translations/es/common.json", { with: { type: "json" } }),
			import("./translations/es/toolkit.json", { with: { type: "json" } }),
			import("./translations/es/tools.json", { with: { type: "json" } }),
		]),
	zh: () =>
		Promise.all([
			import("./translations/zh/common.json", { with: { type: "json" } }),
			import("./translations/zh/toolkit.json", { with: { type: "json" } }),
			import("./translations/zh/tools.json", { with: { type: "json" } }),
		]),
	ar: () =>
		Promise.all([
			import("./translations/ar/common.json", { with: { type: "json" } }),
			import("./translations/ar/toolkit.json", { with: { type: "json" } }),
			import("./translations/ar/tools.json", { with: { type: "json" } }),
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
		// Preserve the cause. `locale` is a known key of LOCALE_IMPORTS by this
		// point, so the files exist and the old "not found" message sent readers
		// looking for the wrong thing — it masked a loader-level import failure as
		// a missing-asset problem.
		throw new Error(`Failed to load translations for locale: ${locale}`, {
			cause: error,
		});
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
