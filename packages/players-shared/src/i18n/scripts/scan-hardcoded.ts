#!/usr/bin/env bun
/**
 * Hardcoded string scanner.
 *
 * Finds quoted English in component source that no catalog key covers. Advisory,
 * never gating: the pattern cannot tell a rendered label from a DOM tag name or a
 * developer diagnostic, so its output is a lead list for the packages adoption
 * has not reached, not a defect list.
 *
 * Lines that already resolve through a provider are excluded, so the count falls
 * as adoption lands rather than staying flat.
 *
 * Two blind spots, both structural: the pattern only matches quoted strings, so
 * plain text between tags is invisible; and it requires an initial capital, so a
 * lowercase-initial label is missed. Widening either one buries the leads under
 * CSS values and identifiers.
 *
 * Usage:
 *   bun run packages/players-shared/src/i18n/scripts/scan-hardcoded.ts
 *
 * Options:
 *   --path <dir>  - Directory to scan (default: packages/)
 */

import { readFileSync } from "fs";
import { glob } from "glob";
import { dirname, relative, resolve } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface StringMatch {
	file: string;
	line: number;
	context: string;
	string: string;
	suggestedKey: string | null;
}

const PLURAL_CATEGORIES = new Set([
	"zero",
	"one",
	"two",
	"few",
	"many",
	"other",
]);

/** The English catalog, flattened to `key → English value`. */
async function loadEnglishTranslations(): Promise<Record<string, string>> {
	const module = await import(resolve(__dirname, "../messages/en-US.ts"));
	const translations: Record<string, string> = {};
	flattenObject(module.default, "", translations);
	return translations;
}

/**
 * Flatten a catalog to dot-notation leaves.
 *
 * A plural group contributes its `other` form under the group key — the form a
 * component's English literal is most likely to match, and the key `plural()` is
 * actually called with. A group is recognized by every one of its keys being a
 * CLDR category, which a namespace can never satisfy.
 */
function flattenObject(
	obj: any,
	prefix: string,
	result: Record<string, string>,
) {
	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;

		if (typeof value === "object" && value !== null) {
			const keys = Object.keys(value);
			const isPluralGroup =
				keys.length > 0 && keys.every((k) => PLURAL_CATEGORIES.has(k));
			if (isPluralGroup) {
				result[fullKey] = ((value as Record<string, string>).other ??
					(value as Record<string, string>).one) as string;
			} else {
				flattenObject(value, fullKey, result);
			}
		} else if (typeof value === "string") {
			result[fullKey] = value;
		}
	}
}

/**
 * Find translation key for a given string value
 */
function findTranslationKey(
	translations: Record<string, string>,
	searchValue: string,
): string | null {
	// Exact match first
	for (const [key, value] of Object.entries(translations)) {
		if (value === searchValue) {
			return key;
		}
	}

	// Fuzzy match (case-insensitive)
	const lowerSearch = searchValue.toLowerCase();
	for (const [key, value] of Object.entries(translations)) {
		if (value.toLowerCase() === lowerSearch) {
			return key;
		}
	}

	return null;
}

/**
 * Scan a file for hardcoded strings
 */
function scanFile(
	filePath: string,
	translations: Record<string, string>,
): StringMatch[] {
	const content = readFileSync(filePath, "utf-8");
	const lines = content.split("\n");
	const matches: StringMatch[] = [];

	// Patterns to match quoted English strings
	// Matches: "Text", 'Text', but ignores: i18n.t(...), class="...", etc.
	const stringPattern = /["']([A-Z][A-Za-z\s,.:;!?'\-()]+)["']/g;

	// Patterns to exclude (already using i18n, CSS classes, imports, etc.)
	const excludePatterns = [
		// Any provider call, whatever the local is named: `i18n.t`,
		// `interfaceI18n.t`, `chromeI18n.plural`. Without this the scan reports
		// adopted call sites, so the count never falls as adoption lands.
		/[A-Za-z_$][\w$]*[iI]18[nN]\s*[.?]/,
		/i18n\./,
		/import\s+/,
		/from\s+['"]/,
		/class[:=]/,
		/className[:=]/,
		/data-\w+[:=]/,
		/id[:=]/,
		/key[:=]/,
		/name[:=]/,
		/type[:=]/,
		/href[:=]/,
		/src[:=]/,
		// `aria-*`, `title`, `alt` and `placeholder` are deliberately NOT excluded.
		// They carry accessible names and image alternatives — the strings a screen
		// reader speaks — so they are the scan's whole point. Adopted lines are
		// already filtered by the provider-call pattern above.
		/console\./,
		/\/\//, // Comments
		/\/\*/, // Block comments
		/^\s*\*/, // Block comment continuation
	];

	lines.forEach((line, index) => {
		// Skip lines that match exclude patterns
		if (excludePatterns.some((pattern) => pattern.test(line))) {
			return;
		}

		// Find all string matches in the line
		let match;
		while ((match = stringPattern.exec(line)) !== null) {
			const string = match[1];

			// Skip very short strings (likely not user-facing)
			if (string.length < 3) continue;

			// Skip strings that are mostly numbers or special characters
			if (!/[a-zA-Z]{3,}/.test(string)) continue;

			// Find corresponding translation key
			const suggestedKey = findTranslationKey(translations, string);

			matches.push({
				file: filePath,
				line: index + 1,
				context: line.trim(),
				string,
				suggestedKey,
			});
		}
	});

	return matches;
}

/**
 * Format scan results
 */
function formatResults(
	matchesByFile: Map<string, StringMatch[]>,
	rootDir: string,
	filesScanned: number,
): string {
	let report = "\n";
	report += "┌─────────────────────────────────────────────────────┐\n";
	report += "│      Hardcoded String Scanner                       │\n";
	report += "└─────────────────────────────────────────────────────┘\n\n";

	const fileCount = matchesByFile.size;
	const totalMatches = Array.from(matchesByFile.values()).reduce(
		(sum, m) => sum + m.length,
		0,
	);

	if (fileCount === 0) {
		report += "✅ No hardcoded strings found!\n\n";
		return report;
	}

	// Sort files by number of matches (descending)
	const sortedFiles = Array.from(matchesByFile.entries()).sort(
		(a, b) => b[1].length - a[1].length,
	);

	for (const [file, matches] of sortedFiles) {
		const relPath = relative(rootDir, file);
		report += `📄 ${relPath} (${matches.length} match${matches.length === 1 ? "" : "es"})\n`;
		report += "────────────────────────────────────────────────────────\n";

		for (const match of matches) {
			report += `  Line ${match.line}: ${match.context}\n`;
			report += `           Found: "${match.string}"\n`;

			if (match.suggestedKey) {
				report += `           Use:   interfaceI18n.t('${match.suggestedKey}')\n`;
			} else {
				report += `           Note:  No catalog key carries this string. Add one to messages/en-US.ts if it reaches a user.\n`;
			}

			report += "\n";
		}

		report += "\n";
	}

	report += "════════════════════════════════════════════════════════\n";
	report += "📊 Summary:\n";
	report += "────────────────────────────────────────────────────────\n";
	report += `  Total files scanned: ${filesScanned}\n`;
	report += `  Files with matches: ${fileCount}\n`;
	report += `  Total hardcoded strings: ${totalMatches}\n\n`;
	report += "⚠️  Recommendation: Replace hardcoded strings with i18n keys\n";
	report += "    for proper internationalization support.\n";
	report += "════════════════════════════════════════════════════════\n";

	return report;
}

/**
 * Find project root by looking for package.json with workspaces
 */
function findProjectRoot(): string {
	let currentDir = process.cwd();
	while (currentDir !== "/") {
		try {
			const pkgPath = resolve(currentDir, "package.json");
			const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
			if (pkg.workspaces) {
				return currentDir;
			}
		} catch {
			// Continue searching
		}
		currentDir = dirname(currentDir);
	}
	// Fallback to script location's root
	return resolve(__dirname, "../../../..");
}

/**
 * Main entry point
 */
async function main() {
	const args = process.argv.slice(2);
	const pathArg = args.indexOf("--path");

	// Find project root and default to scanning packages/
	const projectRoot = findProjectRoot();
	const defaultPath = resolve(projectRoot, "packages/");
	const scanPath =
		pathArg !== -1 ? resolve(projectRoot, args[pathArg + 1]) : defaultPath;

	console.log("🔍 Scanning for hardcoded strings...\n");
	console.log(`📂 Scan path: ${scanPath}\n`);

	try {
		// Load English translations for matching
		const translations = await loadEnglishTranslations();
		console.log(
			`📖 Loaded ${Object.keys(translations).length} translation keys\n`,
		);

		// Find all component files
		const allFiles = await glob(`${scanPath}/**/*.{svelte,ts,tsx}`, {
			absolute: true,
		});

		// Filter out unwanted directories manually
		const files = allFiles.filter((file) => {
			return (
				!file.includes("/node_modules/") &&
				!file.includes("/dist/") &&
				!file.includes("/.svelte-kit/") &&
				!file.includes("/build/") &&
				!file.endsWith(".spec.ts") &&
				!file.endsWith(".test.ts") &&
				!file.includes("/scripts/") &&
				// The catalogs are where English is supposed to live. Scanning them
				// reports every key as a hardcoded string and swamps the real leads.
				!file.includes("/i18n/messages/")
			);
		});

		console.log(`📁 Found ${files.length} files to scan\n`);

		// Scan all files
		const matchesByFile = new Map<string, StringMatch[]>();

		for (const file of files) {
			const matches = scanFile(file, translations);
			if (matches.length > 0) {
				matchesByFile.set(file, matches);
			}
		}

		// Print results
		const report = formatResults(matchesByFile, projectRoot, files.length);
		console.log(report);

		// Exit with warning if matches found
		if (matchesByFile.size > 0) {
			console.warn(
				"\n⚠️  Found hardcoded strings. Consider using i18n for these strings.\n",
			);
			// Don't exit with error - this is informational only
			process.exit(0);
		}

		console.log("✅ No hardcoded strings found!\n");
		process.exit(0);
	} catch (error) {
		console.error("\n❌ Fatal error during scan:", error);
		process.exit(1);
	}
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
