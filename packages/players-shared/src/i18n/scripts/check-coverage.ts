#!/usr/bin/env bun
/**
 * Translation Coverage Checker
 *
 * Validates that all locales have complete translations compared to the reference locale (English).
 * Adapted from pie-qti's translation coverage checker for JSON-based translations.
 *
 * Usage:
 *   bun run packages/players-shared/src/i18n/scripts/check-coverage.ts
 *
 * Exit codes:
 *   0 - All translations complete
 *   1 - Missing translations found
 */

import { readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CoverageResult {
	locale: string;
	coverage: number; // Percentage
	totalKeys: number;
	translatedKeys: number;
	missing: string[];
	extra: string[];
	untranslated: string[];
}

/**
 * Extract all keys from a translation object recursively
 */
function extractKeys(obj: any, prefix = ""): Set<string> {
	const keys = new Set<string>();

	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;

		if (typeof value === "object" && value !== null) {
			// Check if it's a plural form (has 'one' and 'other' keys)
			if ("one" in value && "other" in value) {
				keys.add(fullKey);
			} else {
				// Recurse for nested objects
				const nested = extractKeys(value, fullKey);
				nested.forEach((k) => keys.add(k));
			}
		} else {
			keys.add(fullKey);
		}
	}

	return keys;
}

/**
 * Load all translations for a locale
 */
function loadLocaleTranslations(locale: string): Record<string, any> {
	const basePath = resolve(__dirname, "../translations", locale);

	try {
		const common = JSON.parse(
			readFileSync(join(basePath, "common.json"), "utf-8"),
		);
		const toolkit = JSON.parse(
			readFileSync(join(basePath, "toolkit.json"), "utf-8"),
		);
		const tools = JSON.parse(
			readFileSync(join(basePath, "tools.json"), "utf-8"),
		);

		return { ...common, ...toolkit, ...tools };
	} catch (error) {
		console.error(`Error loading translations for locale ${locale}:`, error);
		throw error;
	}
}

/**
 * Get value at a dot-notation path
 */
function getValueAtPath(obj: any, path: string): any {
	const keys = path.split(".");
	let current = obj;

	for (const key of keys) {
		if (current && typeof current === "object" && key in current) {
			current = current[key];
		} else {
			return undefined;
		}
	}

	return current;
}

/**
 * Check if a value looks like English (starts with uppercase letter)
 */
function looksLikeEnglish(value: any): boolean {
	if (typeof value !== "string") return false;
	return /^[A-Z]/.test(value) && value.length > 1;
}

/**
 * Check translation coverage for a locale
 */
function checkLocale(
	referenceKeys: Set<string>,
	referenceTranslations: Record<string, any>,
	targetLocale: string,
): CoverageResult {
	const targetTranslations = loadLocaleTranslations(targetLocale);
	const targetKeys = extractKeys(targetTranslations);

	// Missing keys (in reference but not in target)
	const missing = Array.from(referenceKeys).filter(
		(key) => !targetKeys.has(key),
	);

	// Extra keys (in target but not in reference)
	const extra = Array.from(targetKeys).filter((key) => !referenceKeys.has(key));

	// Potentially untranslated (same value as reference and looks like English)
	const untranslated = Array.from(targetKeys).filter((key) => {
		const refValue = getValueAtPath(referenceTranslations, key);
		const targetValue = getValueAtPath(targetTranslations, key);

		// For plural forms, check both 'one' and 'other'
		if (typeof refValue === "object" && "one" in refValue) {
			return (
				refValue.one === targetValue.one &&
				refValue.other === targetValue.other &&
				looksLikeEnglish(targetValue.one)
			);
		}

		if (typeof refValue === "string" && typeof targetValue === "string") {
			return refValue === targetValue && looksLikeEnglish(targetValue);
		}

		return false;
	});

	const translatedKeys = referenceKeys.size - missing.length;
	const coverage =
		referenceKeys.size > 0 ? (translatedKeys / referenceKeys.size) * 100 : 0;

	return {
		locale: targetLocale,
		coverage,
		totalKeys: referenceKeys.size,
		translatedKeys,
		missing,
		extra,
		untranslated,
	};
}

/**
 * Format coverage report
 */
function formatReport(results: CoverageResult[]): string {
	let report = "\n";
	report += "┌─────────────────────────────────────────────────────┐\n";
	report += "│      PIE Players Translation Coverage Report        │\n";
	report += `│      Reference Locale: en (${results[0]?.totalKeys || 0} keys)                │\n`;
	report += "└─────────────────────────────────────────────────────┘\n\n";

	for (const result of results) {
		report += `📋 Locale: ${result.locale}\n`;
		report += "─────────────────────────────────────────────────────\n";

		const coverageEmoji =
			result.coverage === 100 ? "✅" : result.coverage >= 95 ? "⚠️ " : "❌";

		report += `${coverageEmoji} Coverage: ${result.coverage.toFixed(1)}% `;
		report += `(${result.translatedKeys}/${result.totalKeys} keys)\n\n`;

		if (
			result.coverage === 100 &&
			result.extra.length === 0 &&
			result.untranslated.length === 0
		) {
			report += "✅ All keys present and translated!\n\n";
		} else {
			if (result.missing.length > 0) {
				report += `❌ Missing Keys (${result.missing.length}):\n`;
				const displayCount = Math.min(result.missing.length, 15);
				result.missing.slice(0, displayCount).forEach((key) => {
					report += `  • ${key}\n`;
				});
				if (result.missing.length > displayCount) {
					report += `  ... and ${result.missing.length - displayCount} more\n`;
				}
				report += "\n";
			}

			if (result.extra.length > 0) {
				report += `⚠️  Extra Keys (${result.extra.length}) - Not in reference locale:\n`;
				const displayCount = Math.min(result.extra.length, 10);
				result.extra.slice(0, displayCount).forEach((key) => {
					report += `  • ${key}\n`;
				});
				if (result.extra.length > displayCount) {
					report += `  ... and ${result.extra.length - displayCount} more\n`;
				}
				report += "\n";
			}

			if (result.untranslated.length > 0) {
				report += `⚠️  Potentially Untranslated (${result.untranslated.length}):\n`;
				const displayCount = Math.min(result.untranslated.length, 10);
				result.untranslated.slice(0, displayCount).forEach((key) => {
					const value = getValueAtPath(
						loadLocaleTranslations(result.locale),
						key,
					);
					const displayValue =
						typeof value === "string" ? value : JSON.stringify(value);
					report += `  • ${key} = "${displayValue}"\n`;
				});
				if (result.untranslated.length > displayCount) {
					report += `  ... and ${result.untranslated.length - displayCount} more\n`;
				}
				report += "\n";
			}
		}
	}

	// Summary
	report += "════════════════════════════════════════════════════════\n";
	report += "📊 Summary:\n";
	report += "────────────────────────────────────────────────────────\n";

	for (const result of results) {
		const emoji =
			result.coverage === 100 ? "✅" : result.coverage >= 95 ? "⚠️ " : "❌";
		const status =
			result.coverage === 100
				? result.extra.length > 0 || result.untranslated.length > 0
					? `Complete (${result.extra.length} extra, ${result.untranslated.length} untranslated)`
					: "Complete"
				: `Missing: ${result.missing.length}`;

		report += `  ${result.locale}: ${result.coverage.toFixed(1)}% `;
		report += `(${result.translatedKeys}/${result.totalKeys})  `;
		report += `${emoji} ${status}\n`;
	}

	const avgCoverage =
		results.reduce((sum, r) => sum + r.coverage, 0) / results.length;
	report += `\nOverall: ${avgCoverage.toFixed(1)}% average coverage\n`;

	const allComplete = results.every((r) => r.coverage === 100);
	const hasIssues = results.some(
		(r) => r.extra.length > 0 || r.untranslated.length > 0,
	);

	if (allComplete && !hasIssues) {
		report += "✅ All translations complete!\n";
	} else if (allComplete) {
		report +=
			"⚠️  All keys present, but some issues found (extra keys or untranslated)\n";
	} else {
		report += "❌ Some translations incomplete\n";
	}

	report += "════════════════════════════════════════════════════════\n";

	return report;
}

/**
 * Main entry point
 */
async function main() {
	console.log("🔍 Checking translation coverage...\n");

	try {
		// Load reference locale (English)
		const referenceTranslations = loadLocaleTranslations("en");
		const referenceKeys = extractKeys(referenceTranslations);

		console.log(`📖 Reference locale loaded: ${referenceKeys.size} keys\n`);

		// Check all other locales
		const targetLocales = ["es", "zh", "ar"];
		const results: CoverageResult[] = [];

		for (const locale of targetLocales) {
			try {
				const result = checkLocale(
					referenceKeys,
					referenceTranslations,
					locale,
				);
				results.push(result);
			} catch (error) {
				console.error(`❌ Error checking locale ${locale}:`, error);
				process.exit(1);
			}
		}

		// Print report
		const report = formatReport(results);
		console.log(report);

		// Exit with error if any locale is incomplete
		const allComplete = results.every((r) => r.coverage === 100);
		if (!allComplete) {
			console.error(
				"\n❌ Exiting with error code 1 (translations incomplete)\n",
			);
			process.exit(1);
		}

		// Warn if there are extra keys or untranslated strings
		const hasIssues = results.some(
			(r) => r.extra.length > 0 || r.untranslated.length > 0,
		);
		if (hasIssues) {
			console.warn(
				"\n⚠️  Warning: Some locales have extra keys or potentially untranslated strings.\n" +
					"    Consider reviewing and cleaning up these issues.\n",
			);
			// Don't exit with error for warnings, just inform
		}

		console.log("✅ Translation coverage check passed!\n");
		process.exit(0);
	} catch (error) {
		console.error("\n❌ Fatal error during coverage check:", error);
		process.exit(1);
	}
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
