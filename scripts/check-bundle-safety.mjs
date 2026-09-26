#!/usr/bin/env node

import { createHash } from "node:crypto";
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

/** Parent of every package whose published `dist` the suite-wide checks scan. */
const PACKAGES_DIR = "packages";

const SPEECH_RULE_ENGINE_SPECIFIER = /^speech-rule-engine(?:\/|$)/;
const SRE_LOCALE_TABLE_SPECIFIER = /^speech-rule-engine\/lib\/mathmaps\//;

/**
 * An error message only the toolkit's math speech carries (see
 * packages/assessment-toolkit/src/services/tts/math-speech.ts). Minifiers keep
 * string literals, so it marks every bundle that inlines math speech.
 */
const MATH_SPEECH_MARKER = "speech-rule-engine did not expose toSpeech";

/**
 * A rule-set key from one of SRE's locale tables, such as
 * `"en/messages/alphabets.min"`: each table keys its rule sets by its own
 * locale, so the key is present wherever the table is.
 */
const SRE_LOCALE_TABLE_KEY_PATTERN =
	/["']([a-z]+)\/(?:characters|functions|messages|rules|si|symbols|units)\/[\w-]+\.min["']/g;

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

/** The locales of the SRE locale tables a bundle carries inline. */
export function findInlinedSreLocaleTables(content) {
	return [
		...new Set(
			[...content.matchAll(SRE_LOCALE_TABLE_KEY_PATTERN)].map(
				(match) => match[1],
			),
		),
	].sort();
}

// `import x from "m"`, `import{a}from"m"`, `export { y } from "m"`, `export*from"m"`.
const STATIC_FROM_PATTERN =
	/(?:^|[\s;}])(?:import|export)\b[^;'"()]*?from\s*(["'])([^"'\n]+)\1/g;
// Side-effect only: `import "m"`. `import("m")` does not match, because a `(`
// follows `import` instead of the quote.
const STATIC_BARE_PATTERN = /(?:^|[\s;}])import\s*(["'])([^"'\n]+)\1/g;
const DYNAMIC_PATTERN = /\bimport\(\s*(["'])([^"'\n]+)\1/g;

/**
 * The module specifiers a bundle imports: `static` ones load with the bundle,
 * `dynamic` ones (`import("m")`) when the code calling them runs.
 */
export function findModuleSpecifiers(content) {
	const collect = (pattern) =>
		[...content.matchAll(pattern)].map((match) => match[2]);
	return {
		static: [...collect(STATIC_FROM_PATTERN), ...collect(STATIC_BARE_PATTERN)],
		dynamic: collect(DYNAMIC_PATTERN),
	};
}

/**
 * How a build output directory reaches speech-rule-engine.
 *
 * `files` are the directory's JavaScript files as `{ path, content }`, with
 * `path` relative to the directory in POSIX form. A file no other file imports
 * is an entry. A file is eager when a chain of static imports reaches it from
 * an entry, and lazy when such a chain starts at a dynamic import instead.
 *
 * SRE is external everywhere, but external is not enough: a static import of
 * it from an eager file puts it in every consumer's initial graph. So SRE may
 * be imported statically only from a lazy file (the toolkit's `sre-engine`
 * module, which has to configure SRE synchronously after it evaluates), and
 * its locale tables only dynamically, so SRE loads each when it asks for it.
 */
export function analyzeSpeechRuleEngineBoundary(files) {
	const paths = new Set(files.map((file) => file.path));
	const staticEdges = new Map();
	const dynamicTargets = new Set();
	const referenced = new Set();
	const staticImporters = new Set();
	const dynamicEngineImporters = new Set();
	const tableImporters = new Set();
	const issues = [];

	for (const file of files) {
		const specifiers = findModuleSpecifiers(file.content);
		const resolve = (specifier) => {
			if (!specifier.startsWith(".")) return undefined;
			const target = path.posix.join(
				path.posix.dirname(file.path),
				specifier.replace(/[?#].*$/, ""),
			);
			return paths.has(target) ? target : undefined;
		};

		const staticTargets = specifiers.static.map(resolve).filter(Boolean);
		staticEdges.set(file.path, staticTargets);
		for (const target of staticTargets) referenced.add(target);

		for (const specifier of specifiers.static) {
			if (SRE_LOCALE_TABLE_SPECIFIER.test(specifier)) {
				issues.push(
					`${file.path} imports a speech-rule-engine locale table statically (${specifier}); the tables must stay behind a dynamic import`,
				);
			} else if (SPEECH_RULE_ENGINE_SPECIFIER.test(specifier)) {
				staticImporters.add(file.path);
			}
		}

		for (const specifier of specifiers.dynamic) {
			const target = resolve(specifier);
			if (target) {
				dynamicTargets.add(target);
				referenced.add(target);
			}
			if (SRE_LOCALE_TABLE_SPECIFIER.test(specifier)) {
				tableImporters.add(file.path);
			} else if (SPEECH_RULE_ENGINE_SPECIFIER.test(specifier)) {
				dynamicEngineImporters.add(file.path);
			}
		}
	}

	// Maps every file a chain of static imports reaches from `roots` to the root
	// it was reached from.
	const reachFrom = (roots) => {
		const reached = new Map(roots.map((root) => [root, root]));
		const queue = [...roots];
		while (queue.length > 0) {
			const current = queue.pop();
			for (const target of staticEdges.get(current) ?? []) {
				if (reached.has(target)) continue;
				reached.set(target, reached.get(current));
				queue.push(target);
			}
		}
		return reached;
	};
	const eager = reachFrom([...paths].filter((file) => !referenced.has(file)));
	const lazy = reachFrom([...dynamicTargets]);

	const lazyEngineModules = [];
	for (const importer of staticImporters) {
		const entry = eager.get(importer);
		if (entry !== undefined) {
			issues.push(
				`${importer} imports speech-rule-engine statically and ${entry === importer ? "is an entry" : `loads eagerly with ${entry}`}; only a module reached through a dynamic import may import it statically`,
			);
		} else if (!lazy.has(importer)) {
			issues.push(
				`${importer} imports speech-rule-engine statically, but no dynamic import reaches it`,
			);
		} else {
			lazyEngineModules.push(importer);
		}
	}

	return {
		issues,
		lazyEngineModules,
		dynamicEngineImporters: [...dynamicEngineImporters],
		tableImporters: [...tableImporters],
	};
}

/** Sourcemaps found in published output. */
export function findPublishedSourcemaps(relativePaths) {
	return relativePaths.filter((filePath) => filePath.endsWith(".map"));
}

/**
 * True when a bundle carries Svelte's development runtime.
 *
 * Keys off `__svelte_cleanup`, the property Svelte's dev-only array warnings
 * set on `Array` after wrapping `indexOf`, `lastIndexOf` and `includes` on the
 * host page. Only the dev runtime contains that string, and a production build
 * removes it along with every other `DEV` branch.
 */
export function hasSvelteDevRuntime(content) {
	return content.includes("__svelte_cleanup");
}

const EMPTY_MODULE_PATTERN = /^\s*(?:export\s*\{\s*\}\s*;?\s*)?$/;

/**
 * Groups of a build's files with identical bytes, each group sorted. A bundler
 * that reaches one module through two import paths can emit it twice, and a
 * host that loads both copies fetches it twice. Empty modules, which type-only
 * entries compile to, carry nothing to fetch twice.
 */
export function findIdenticalFiles(files) {
	const byDigest = new Map();
	for (const file of files) {
		if (EMPTY_MODULE_PATTERN.test(file.content)) continue;
		const digest = createHash("sha256").update(file.content).digest("hex");
		byDigest.set(digest, [...(byDigest.get(digest) ?? []), file.path]);
	}
	return [...byDigest.values()]
		.filter((group) => group.length > 1)
		.map((group) => group.sort());
}

/**
 * Packages every tool imports from the host's node_modules, each with a string
 * only its own published code carries and minifiers keep: a `Symbol.for` key of
 * the toolkit's contexts, pie-context's request event name, and an error of
 * players-shared's i18n provider.
 */
export const HOST_SHARED_PACKAGES = [
	{
		name: "@pie-players/pie-assessment-toolkit",
		dist: "packages/assessment-toolkit/dist",
		marker: /pie\.assessmentToolkit\.runtimeContext/,
	},
	{
		name: "@pie-players/pie-context",
		dist: "packages/pie-context/dist",
		marker: /["'`]context-request["'`]/,
	},
	{
		name: "@pie-players/pie-players-shared",
		dist: "packages/players-shared/dist",
		marker: /Failed to load i18n catalog for locale/,
	},
];

/** The host-shared packages whose code a bundle carries inline. */
export function findInlinedHostSharedPackages(
	content,
	packages = HOST_SHARED_PACKAGES,
) {
	return packages
		.filter((entry) => entry.marker.test(content))
		.map((entry) => entry.name);
}

const FILE_EXTENSION_PATTERN = /\.(?:[cm]?js|json|css|wasm)$/;

/** The package name and subpath of a bare specifier; null for any other. */
export function splitBareSpecifier(specifier) {
	if (/^(?:\.|\/|[a-z][a-z\d+.-]*:)/i.test(specifier)) return null;
	const parts = specifier.split("/");
	const nameLength = specifier.startsWith("@") ? 2 : 1;
	if (parts.length < nameLength || parts.some((part) => part === "")) {
		return null;
	}
	return {
		name: parts.slice(0, nameLength).join("/"),
		subpath: parts.slice(nameLength).join("/"),
	};
}

/**
 * True when a bare specifier's subpath names no file inside a package without
 * an exports map. Only a resolver that completes directories and extensions
 * finds its target; webpack's fully specified ESM resolution warns instead.
 */
export function needsFullySpecifiedSubpath(specifier, manifest) {
	const parsed = splitBareSpecifier(specifier);
	if (!parsed?.subpath || !manifest || manifest.exports !== undefined) {
		return false;
	}
	return !FILE_EXTENSION_PATTERN.test(parsed.subpath);
}

const LITERAL_DEFINE_PATTERN = /customElements\.define\(\s*(["'`])([^"'`]+)\1/g;
// How far back a `customElements.get` for the same tag may sit and still count
// as guarding the define. Guards in shipped output sit directly before it
// (`customElements.get("x")||customElements.define("x",…)`).
const GUARD_LOOKBEHIND = 200;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Tags a bundle registers by literal name with no `customElements.get` guard.
 *
 * This is what Svelte compiles a component whose `svelte:options` names its tag
 * into: a module-scope `customElements.define("tag", …)` that throws
 * `NotSupportedError` once a second copy of the package, or the host, has
 * registered the tag, and so rejects the module that imported it. A Vite build
 * that compiles Svelte custom elements lists `guardSvelteCustomElementDefines()`
 * (`packages/players-shared/svelte-custom-element-guard.ts`), which routes the
 * call through a helper whose define takes a variable tag.
 */
export function findUnguardedCustomElementDefines(content) {
	const unguarded = [];
	for (const match of content.matchAll(LITERAL_DEFINE_PATTERN)) {
		const tag = match[2];
		const preceding = content.slice(
			Math.max(0, match.index - GUARD_LOOKBEHIND),
			match.index,
		);
		const guard = new RegExp(
			`customElements\\.get\\(\\s*(["'\`])${escapeRegExp(tag)}\\1\\s*\\)`,
		);
		if (!guard.test(preceding)) unguarded.push(tag);
	}
	return unguarded;
}

/**
 * Vite 7's asset-import-meta-url plugin tests every module a host build
 * transforms against `/new\s+URL.+import\.meta\.url/s`. Node 26 compiles that
 * pattern without V8's fixed-length-loop optimization once the build has
 * generated over 1 MB of regexp code and holds over 16 MB of executable memory.
 * The greedy `.+` then takes one entry of V8's 64 MiB backtrack stack per
 * character after the module's first `new URL`, and past about 4.19 million
 * characters the host build fails with "Maximum call stack size exceeded". The
 * limit is half that ceiling, because a host's earlier transforms grow a module
 * before the filter reads it.
 */
export const NEW_URL_TAIL_LIMIT = 2 * 1024 * 1024;

/** How many characters follow a module's first `new URL`; 0 without one. */
export function newUrlTailLength(content) {
	const match = /new\s+URL/.exec(content);
	return match ? content.length - (match.index + match[0].length) : 0;
}

function listPackageDistDirs() {
	const absPackages = path.join(ROOT, PACKAGES_DIR);
	if (!existsSync(absPackages)) return [];

	return readdirSync(absPackages, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join(absPackages, entry.name, "dist"))
		.filter((dir) => existsSync(dir));
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
	}

	return files.length;
}

/**
 * Fails any package whose published output bundles an SRE locale table, and
 * applies `analyzeSpeechRuleEngineBoundary` to every package whose output
 * carries math speech: the toolkit itself and each Vite bundle that inlines it.
 * Returns how many packages carry math speech.
 */
function checkSpeechRuleEngineBoundaries(failures) {
	const toolkitDist = path.posix.dirname(TOOLKIT_CE_DIR);
	const componentsPrefix = `${path.posix.basename(TOOLKIT_CE_DIR)}/`;
	let packagesChecked = 0;

	for (const entry of readdirSync(path.join(ROOT, PACKAGES_DIR), {
		withFileTypes: true,
	})) {
		const distDir = `${PACKAGES_DIR}/${entry.name}/dist`;
		const absDist = path.join(ROOT, distDir);
		if (!entry.isDirectory() || !existsSync(absDist)) continue;

		const files = collectJsFiles(absDist).map((filePath) => ({
			path: path.relative(absDist, filePath).split(path.sep).join("/"),
			content: readFileSync(filePath, "utf8"),
		}));
		// A bundled table ships in the package whether or not it is loaded, and a
		// host that inlines every `import()` carries it in its one file.
		for (const file of files) {
			const tables = findInlinedSreLocaleTables(file.content);
			if (tables.length > 0) {
				failures.push(
					`[bundle-safety] ${distDir}/${file.path} bundles the speech-rule-engine locale table(s) ${tables.join(", ")}; they may be reached only as dynamic imports of speech-rule-engine/lib/mathmaps, which the host resolves`,
				);
			}
		}
		const isToolkit = distDir === toolkitDist;
		if (
			!isToolkit &&
			!files.some((file) => file.content.includes(MATH_SPEECH_MARKER))
		) {
			continue;
		}
		packagesChecked += 1;

		const boundary = analyzeSpeechRuleEngineBoundary(files);
		for (const issue of boundary.issues) {
			failures.push(`[bundle-safety] ${distDir}/${issue}`);
		}

		// The toolkit's CE build must carry the boundary itself: its absence means
		// the math-speech path was dropped, or the bundler started inlining SRE
		// under a marker `hasInlinedSpeechRuleEngine` does not recognise.
		const inScope = (file) => !isToolkit || file.startsWith(componentsPrefix);
		const scope = isToolkit ? TOOLKIT_CE_DIR : distDir;
		if (
			![...boundary.lazyEngineModules, ...boundary.dynamicEngineImporters].some(
				inScope,
			)
		) {
			failures.push(
				`[bundle-safety] ${scope} ships math speech without importing speech-rule-engine by name from a lazily loaded module; keep /^speech-rule-engine(?:\\/|$)/ external so every PIE bundle a host loads shares one copy`,
			);
		}
		if (!boundary.tableImporters.some(inScope)) {
			failures.push(
				`[bundle-safety] ${scope} ships math speech without a dynamic import from speech-rule-engine/lib/mathmaps; SRE's locale tables must load lazily from the host's node_modules, like SRE itself`,
			);
		}
	}

	return packagesChecked;
}

function checkNoPublishedSourcemaps(failures) {
	const distDirs = listPackageDistDirs();

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

function checkNoSvelteDevRuntime(failures) {
	let filesChecked = 0;

	for (const dir of listPackageDistDirs()) {
		for (const filePath of collectJsFiles(dir)) {
			filesChecked += 1;
			if (hasSvelteDevRuntime(readFileSync(filePath, "utf8"))) {
				failures.push(
					`[bundle-safety] ${path.relative(ROOT, filePath)} ships Svelte's dev runtime, which patches Array.prototype on the host page; build it with production Svelte`,
				);
			}
		}
	}

	return filesChecked;
}

const readDistFiles = (dir) =>
	collectJsFiles(dir).map((filePath) => ({
		path: path.relative(dir, filePath).split(path.sep).join("/"),
		content: readFileSync(filePath, "utf8"),
	}));

const readManifest = (dir) =>
	JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));

function checkNoIdenticalFiles(failures) {
	for (const dir of listPackageDistDirs()) {
		for (const group of findIdenticalFiles(readDistFiles(dir))) {
			failures.push(
				`[bundle-safety] ${path.relative(ROOT, dir)} ships identical files ${group.join(", ")}; a host that loads both fetches the module twice, so give it one import path`,
			);
		}
	}
}

/**
 * A tool resolves the toolkit, players-shared and pie-context from the host,
 * so a section host carries one copy of each rather than one per tool.
 */
function checkToolsImportHostSharedPackages(failures) {
	for (const shared of HOST_SHARED_PACKAGES) {
		const absDist = path.join(ROOT, shared.dist);
		if (
			!existsSync(absDist) ||
			!readDistFiles(absDist).some((file) => shared.marker.test(file.content))
		) {
			failures.push(
				`[bundle-safety] ${shared.dist} no longer carries ${shared.marker}, which marks ${shared.name} inlined elsewhere; pick a string only its published code still carries`,
			);
		}
	}

	for (const dir of listPackageDistDirs()) {
		const packageDir = path.dirname(dir);
		if (!/^@pie-players\/pie-tool-/.test(readManifest(packageDir).name)) {
			continue;
		}
		for (const file of readDistFiles(dir)) {
			for (const name of findInlinedHostSharedPackages(file.content)) {
				failures.push(
					`[bundle-safety] ${path.relative(ROOT, dir)}/${file.path} inlines ${name}; list /^@pie-players\\/pie-(?:assessment-toolkit|players-shared|context)(?:\\/|$)/ in the tool's Vite externals so the host resolves one copy`,
				);
			}
		}
	}
}

/** The manifest of `name` as Node resolves it from `fromDir`, or null. */
function findInstalledManifest(fromDir, name) {
	for (let dir = fromDir; ; dir = path.dirname(dir)) {
		const candidate = path.join(dir, "node_modules", name, "package.json");
		if (existsSync(candidate)) {
			return JSON.parse(readFileSync(candidate, "utf8"));
		}
		if (dir === path.dirname(dir)) return null;
	}
}

function checkFullySpecifiedSubpaths(failures) {
	for (const dir of listPackageDistDirs()) {
		const packageDir = path.dirname(dir);
		if (readManifest(packageDir).private) continue;
		const manifests = new Map();
		for (const file of readDistFiles(dir)) {
			const specifiers = findModuleSpecifiers(file.content);
			for (const specifier of [...specifiers.static, ...specifiers.dynamic]) {
				const parsed = splitBareSpecifier(specifier);
				if (!parsed?.subpath) continue;
				if (!manifests.has(parsed.name)) {
					manifests.set(
						parsed.name,
						findInstalledManifest(packageDir, parsed.name),
					);
				}
				if (needsFullySpecifiedSubpath(specifier, manifests.get(parsed.name))) {
					failures.push(
						`[bundle-safety] ${path.relative(ROOT, dir)}/${file.path} imports ${specifier}, which names no file in a package without an exports map; import the file itself`,
					);
				}
			}
		}
	}
}

function checkNoUnguardedCustomElementDefines(failures) {
	for (const dir of listPackageDistDirs()) {
		for (const filePath of collectJsFiles(dir)) {
			const content = readFileSync(filePath, "utf8");
			for (const tag of findUnguardedCustomElementDefines(content)) {
				failures.push(
					`[bundle-safety] ${path.relative(ROOT, filePath)} registers <${tag}> with an unguarded customElements.define, which throws when a second copy of the package loads; list guardSvelteCustomElementDefines() in the package's Vite build`,
				);
			}
		}
	}
}

function checkNewUrlTails(failures) {
	for (const dir of listPackageDistDirs()) {
		for (const filePath of collectJsFiles(dir)) {
			const tail = newUrlTailLength(readFileSync(filePath, "utf8"));
			if (tail > NEW_URL_TAIL_LIMIT) {
				failures.push(
					`[bundle-safety] ${path.relative(ROOT, filePath)} has ${tail} characters after its first \`new URL\` (limit ${NEW_URL_TAIL_LIMIT}), enough to overflow V8's regexp stack in a Vite 7 host's asset filter on Node 26; split the module, as packages/calculator-cortex/vite.config.ts does`,
				);
			}
		}
	}
}

function main() {
	const failures = [];
	const filesChecked =
		checkEvalRequire(failures) + checkToolkitCustomElements(failures);
	const mathSpeechPackages = checkSpeechRuleEngineBoundaries(failures);
	checkNoPublishedSourcemaps(failures);
	checkNoSvelteDevRuntime(failures);
	checkNoIdenticalFiles(failures);
	checkToolsImportHostSharedPackages(failures);
	checkFullySpecifiedSubpaths(failures);
	checkNoUnguardedCustomElementDefines(failures);
	checkNewUrlTails(failures);

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
		`[check-bundle-safety] OK: validated ${filesChecked} JS bundle file(s) and the speech-rule-engine boundary in ${mathSpeechPackages} package(s)`,
	);
}

if (import.meta.main) main();
