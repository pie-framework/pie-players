#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const EVAL_REQUIRE_PATTERN = /eval\((["'])require\1\)/;

const TARGET_DIRS = [
	"packages/item-player/dist",
	"packages/section-player/dist",
];

/**
 * The toolkit's custom elements are produced by a bespoke bundler script rather
 * than Vite (see packages/assessment-toolkit/scripts/build-ce-components.mjs).
 * That script had already drifted away from the repo's build conventions once,
 * shipping unminified artifacts that each inlined their own copy of the shared
 * services layer and of speech-rule-engine. The assertions below pin the shape
 * that fixed it so the drift cannot recur silently.
 */
const TOOLKIT_CE_DIR = "packages/assessment-toolkit/dist/components";

/** Directories whose published output must not contain sourcemaps. */
const PACKAGES_DIR = "packages";

function collectFiles(dir, predicate) {
	const entries = readdirSync(dir);
	const files = [];

	for (const entry of entries) {
		const absPath = path.join(dir, entry);
		const stats = statSync(absPath);
		if (stats.isDirectory()) {
			files.push(...collectFiles(absPath, predicate));
			continue;
		}
		if (predicate(entry)) {
			files.push(absPath);
		}
	}

	return files;
}

const collectJsFiles = (dir) =>
	collectFiles(dir, (name) => name.endsWith(".js"));

/**
 * True when a bundle looks like it skipped minification.
 *
 * Uses average bytes-per-line rather than any minifier-specific marker, because
 * that gap is enormous and stable: the unminified toolkit artifact averaged
 * about 40 bytes per line (30,106 lines for 1.19 MB), while minified output runs
 * to thousands. The 200-byte threshold therefore sits nowhere near either case.
 * Small files are skipped because a short artifact can legitimately be one or
 * two lines regardless of minification.
 */
export function looksUnminified(
	content,
	{ minBytes = 20_000, minBytesPerLine = 200 } = {},
) {
	const bytes = Buffer.byteLength(content, "utf8");
	if (bytes < minBytes) return false;
	// Count lines the way `wc -l` would, then add one for a trailing partial line
	// so a single-line file is 1 rather than 0.
	const lines = content.split("\n").length;
	return bytes / lines < minBytesPerLine;
}

/**
 * True when speech-rule-engine's own source has been inlined into a bundle.
 *
 * Keys off the mathmaps CDN template that SRE builds its locale URL from. That
 * string exists only inside SRE itself, which makes it a far safer marker than a
 * domain name like "clearspeak" — the toolkit's own sources mention those as
 * configuration values.
 */
export function hasInlinedSpeechRuleEngine(content) {
	return content.includes("cdn.jsdelivr.net/npm/speech-rule-engine");
}

/**
 * Static (eager) references to speech-rule-engine.
 *
 * The dependency is external by design, but external is not enough: a static
 * `from "speech-rule-engine"` would put it back in the eager graph for every
 * consumer, undoing the lazy boundary that services/tts/math-speech.ts asks for
 * with a dynamic import. Only the dynamic form is acceptable here.
 */
export function findStaticSpeechRuleEngineImports(content) {
	const specifier = `["']speech-rule-engine(?:\\/[^"']*)?["']`;
	const patterns = [
		// `import x from "sre"` / `export { y } from "sre/js/..."`
		new RegExp(
			`(?:^|[\\s;}])(?:import|export)\\b[^;'"()]*?from\\s*${specifier}`,
			"g",
		),
		// Side-effect only: `import "sre"`. The negative case this must not catch
		// is `import("sre")`, where a `(` follows instead of the quote.
		new RegExp(`(?:^|[\\s;}])import\\s*${specifier}`, "g"),
	];
	const matches = [];
	for (const pattern of patterns) {
		matches.push(...(content.match(pattern) ?? []));
	}
	return matches;
}

/** Sourcemaps found in published output. */
export function findPublishedSourcemaps(relativePaths) {
	return relativePaths.filter((filePath) => filePath.endsWith(".map"));
}

function checkEvalRequire(failures) {
	let filesChecked = 0;

	for (const targetDir of TARGET_DIRS) {
		const absTargetDir = path.join(ROOT, targetDir);
		if (!existsSync(absTargetDir)) {
			failures.push(
				`[bundle-safety] missing build output directory: ${targetDir}`,
			);
			continue;
		}

		for (const filePath of collectJsFiles(absTargetDir)) {
			filesChecked += 1;
			const content = readFileSync(filePath, "utf8");
			if (EVAL_REQUIRE_PATTERN.test(content)) {
				const relPath = path.relative(ROOT, filePath);
				failures.push(
					`[bundle-safety] unsafe eval(require) pattern found in ${relPath}`,
				);
			}
		}
	}

	return filesChecked;
}

function checkToolkitCustomElements(failures) {
	const absDir = path.join(ROOT, TOOLKIT_CE_DIR);
	if (!existsSync(absDir)) {
		failures.push(
			`[bundle-safety] missing build output directory: ${TOOLKIT_CE_DIR}`,
		);
		return 0;
	}

	const files = collectJsFiles(absDir);
	let sawDynamicSpeechRuleEngineImport = false;

	for (const filePath of files) {
		const relPath = path.relative(ROOT, filePath);
		const content = readFileSync(filePath, "utf8");

		if (looksUnminified(content)) {
			failures.push(
				`[bundle-safety] ${relPath} looks unminified; the toolkit CE build must pass --minify`,
			);
		}

		if (hasInlinedSpeechRuleEngine(content)) {
			failures.push(
				`[bundle-safety] ${relPath} inlines speech-rule-engine; keep every runtime dependency external so consumers can deduplicate it`,
			);
		}

		for (const match of findStaticSpeechRuleEngineImports(content)) {
			failures.push(
				`[bundle-safety] ${relPath} imports speech-rule-engine statically (${match.trim()}); it must stay a dynamic import so it is not in the eager graph`,
			);
		}

		if (content.includes('import("speech-rule-engine")')) {
			sawDynamicSpeechRuleEngineImport = true;
		}
	}

	// Guards against the lazy boundary disappearing entirely — for example if a
	// refactor dropped the math-speech path, or the bundler started inlining it
	// again under a marker this check does not recognise.
	if (!sawDynamicSpeechRuleEngineImport) {
		failures.push(
			`[bundle-safety] no dynamic import("speech-rule-engine") found under ${TOOLKIT_CE_DIR}; the lazy math-speech boundary is missing`,
		);
	}

	return files.length;
}

function checkNoPublishedSourcemaps(failures) {
	const absPackages = path.join(ROOT, PACKAGES_DIR);
	if (!existsSync(absPackages)) return 0;

	const distDirs = readdirSync(absPackages, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join(absPackages, entry.name, "dist"))
		.filter((dir) => existsSync(dir));

	const mapFiles = [];
	for (const dir of distDirs) {
		mapFiles.push(
			...collectFiles(dir, (name) => name.endsWith(".map")).map((filePath) =>
				path.relative(ROOT, filePath),
			),
		);
	}

	for (const relPath of findPublishedSourcemaps(mapFiles)) {
		failures.push(
			`[bundle-safety] ${relPath} is a published sourcemap; sourceMap is off because usable maps require inlineSources, which embeds every .ts source in the tarball`,
		);
	}

	return distDirs.length;
}

function main() {
	const failures = [];
	const filesChecked =
		checkEvalRequire(failures) + checkToolkitCustomElements(failures);
	checkNoPublishedSourcemaps(failures);

	if (failures.length > 0) {
		console.error(
			`[check-bundle-safety] Found ${failures.length} bundle safety issue(s)`,
		);
		for (const failure of failures) {
			console.error(`- ${failure}`);
		}
		process.exit(1);
	}

	console.log(
		`[check-bundle-safety] OK: validated ${filesChecked} JS bundle file(s)`,
	);
}

if (import.meta.main) main();
