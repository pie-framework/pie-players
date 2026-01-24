#!/usr/bin/env bun
/**
 * Hardcoded String Scanner
 *
 * Scans component files for hardcoded English strings that should use i18n.
 * Adapted from pie-qti's hardcoded string scanner.
 *
 * Usage:
 *   bun run packages/players-shared/src/i18n/scripts/scan-hardcoded.ts
 *
 * Options:
 *   --path <dir>  - Directory to scan (default: packages/)
 *   --fix         - Attempt to auto-fix issues (not implemented yet)
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

/**
 * Load all English translations
 */
function loadEnglishTranslations(): Record<string, string> {
	const basePath = resolve(__dirname, "../translations/en");
	const translations: Record<string, string> = {};

	try {
		const common = JSON.parse(
			readFileSync(resolve(basePath, "common.json"), "utf-8"),
		);
		const toolkit = JSON.parse(
			readFileSync(resolve(basePath, "toolkit.json"), "utf-8"),
		);
		const tools = JSON.parse(
			readFileSync(resolve(basePath, "tools.json"), "utf-8"),
		);

		// Flatten all translations
		flattenObject(common, "", translations);
		flattenObject(toolkit, "", translations);
		flattenObject(tools, "", translations);
	} catch (error) {
		console.error("Error loading English translations:", error);
		throw error;
	}

	return translations;
}

/**
 * Flatten nested object to dot notation
 */
function flattenObject(
	obj: any,
	prefix: string,
	result: Record<string, string>,
) {
	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;

		if (typeof value === "object" && value !== null) {
			// Check for plural form
			if ("one" in value && "other" in value) {
				result[fullKey] = value.one as string;
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
		/i18n\./,
		/import\s+/,
		/from\s+['"]/,
		/class[:=]/,
		/className[:=]/,
		/aria-\w+[:=]/,
		/data-\w+[:=]/,
		/id[:=]/,
		/key[:=]/,
		/name[:=]/,
		/type[:=]/,
		/href[:=]/,
		/src[:=]/,
		/alt[:=]/,
		/title[:=]/,
		/placeholder[:=]/,
		/console\./,
		/\/\//, // Comments
		/\/\*/, // Block comments
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
				report += `           Use:   i18n?.t('${match.suggestedKey}') ?? '${match.suggestedKey}'\n`;
			} else {
				report += `           Note:  No matching translation key found. Consider adding to translations.\n`;
			}

			report += "\n";
		}

		report += "\n";
	}

	report += "════════════════════════════════════════════════════════\n";
	report += "📊 Summary:\n";
	report += "────────────────────────────────────────────────────────\n";
	report += `  Total files scanned: ${fileCount}\n`;
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
		const translations = loadEnglishTranslations();
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
				!file.includes("/scripts/")
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
		const report = formatResults(matchesByFile, projectRoot);
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
