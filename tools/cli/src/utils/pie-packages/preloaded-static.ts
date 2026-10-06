import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { assertElementPackagesAllowed } from "@pie-players/pie-players-shared/loaders";
import { parsePackageName } from "@pie-players/pie-players-shared/pie";
import { transform } from "esbuild";

import { buildElementModules, type ElementModulesBuild, MATHJAX_LOADER_FILE } from "./preloaded-elements-build.js";
import type { ElementSpec } from "./types.js";

export interface BuildStaticConfig {
	elements: string[]; // "@pie-element/foo@1.2.3"
	elementTags?: Record<string, string>; // Package name -> base tag to register
	iteration?: number;
	loaderVersion?: string;
	setName?: string; // Names a published version; local builds use the element hash
	outputDir?: string;
	publish?: boolean;
	monorepoDir: string;
}

/** A published element set: the config it comes from, and the dist-tag it publishes under. */
export interface ElementSet {
	name: string;
	distTag: string;
}

/** The name becomes both a semver prerelease identifier and an npm dist-tag. */
const SET_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

/**
 * Reads the element set a config file publishes. The set is named after the
 * file, and publishes under that name, or under `latest` when the config sets
 * `"latest": true`. A publish carries exactly one dist-tag, because npm's OIDC
 * trusted publishing authorizes `npm publish` and not `npm dist-tag`.
 */
export async function readElementSet(elementsFile: string): Promise<ElementSet> {
	const name = basename(elementsFile, ".json");
	if (!SET_NAME_PATTERN.test(name)) {
		throw new Error(
			`Config file name "${name}" is not a valid element-set name: use lowercase letters, digits and hyphens, starting with a letter`,
		);
	}
	const parsed = JSON.parse(await readFile(elementsFile, "utf-8"));
	return { name, distTag: parsed?.latest === true ? "latest" : name };
}

const STATIC_PACKAGE_NAME = "@pie-players/pie-preloaded-player";

export function generateHash(elements: string[]): string {
	const sorted = [...elements].sort();
	const elementString = sorted.join("+");
	return createHash("sha256")
		.update(elementString)
		.digest("hex")
		.substring(0, 7);
}

async function resolveDefaultLoaderVersion(
	monorepoDir: string,
): Promise<string> {
	try {
		const itemPlayerPkgJsonPath = join(
			monorepoDir,
			"packages",
			"item-player",
			"package.json",
		);
		const content = await readFile(itemPlayerPkgJsonPath, "utf-8");
		const pkg = JSON.parse(content);
		if (typeof pkg?.version === "string" && pkg.version.length > 0)
			return pkg.version;
	} catch {
		// ignore
	}
	return "1.0.0";
}

function generateVersionFromParts(
	loaderVersion: string,
	label: string,
	iteration: number,
): string {
	return `${loaderVersion}-${label}.${iteration}`;
}

async function fetchNextIterationFromNpm(
	loaderVersion: string,
	setName: string,
): Promise<number> {
	const prefix = `${loaderVersion}-${setName}.`;

	const url = `https://registry.npmjs.org/${encodeURIComponent(STATIC_PACKAGE_NAME)}`;
	const res = await fetch(url);

	// Package not published yet.
	if (res.status === 404) return 1;
	if (!res.ok) {
		throw new Error(
			`Failed to query npm for ${STATIC_PACKAGE_NAME}: HTTP ${res.status} ${res.statusText}`,
		);
	}

	const data = await res.json();
	const versions: string[] = Object.keys(data?.versions || {});

	let maxIteration = 0;
	for (const v of versions) {
		if (!v.startsWith(prefix)) continue;
		const iterStr = v.slice(prefix.length);
		const iter = Number.parseInt(iterStr, 10);
		if (!Number.isNaN(iter)) maxIteration = Math.max(maxIteration, iter);
	}

	return maxIteration + 1;
}

function parseElements(elements: string[]): Record<string, string> {
	return Object.fromEntries(
		elements.map((spec) => {
			const { name, version } = parsePackageName(spec);
			return [name, version || "latest"];
		}),
	);
}

/** The `registerPreloadedElements` entries a build registers, less their element classes. */
function preloadedEntries(
	elements: string[],
	elementTags: Record<string, string> = {},
): Array<{ tag: string; package: string; version: string }> {
	return elements.map((spec) => {
		const { name, version } = parsePackageName(spec);
		return {
			tag: elementTags[name] ?? `pie-${name.split("/").pop()}`,
			package: name,
			version,
		};
	});
}

/**
 * The generated entry registers each element at its build version, and a
 * page holds one version per package, so a build pins exact versions.
 */
export function assertBuildElements(
	elements: string[],
	elementTags: Record<string, string> = {},
): void {
	const entries = preloadedEntries(elements, elementTags);
	const names = entries.map((entry) => entry.package);
	const duplicate = names.find((name, index) => names.indexOf(name) !== index);
	if (duplicate) {
		throw new Error(`${duplicate} is listed twice; a build registers one version per package`);
	}
	assertElementPackagesAllowed(
		Object.fromEntries(entries.map((entry, index) => [entry.tag, elements[index]])),
		{ allowedPackages: names },
	);
}

function generateVersion(config: BuildStaticConfig): string {
	const loaderVersion = config.loaderVersion || "1.0.0";
	const label = config.setName ?? generateHash(config.elements);
	const iteration = config.iteration || 1;
	return generateVersionFromParts(loaderVersion, label, iteration);
}

function generatePackageJson(config: BuildStaticConfig, version: string): any {
	const hash = generateHash(config.elements);
	const elements = parseElements(config.elements);
	const elementNames = Object.keys(elements)
		.map((pkg) => pkg.replace("@pie-element/", ""))
		.join(", ");
	const description = `PIE item player with these elements preloaded: ${elementNames}. One ES module tree with every dependency included (hash: ${hash.substring(0, 7)}).`;
	const elementKeywords = Object.keys(elements)
		.map((pkg) => pkg.replace("@pie-element/", ""))
		.slice(0, 10);

	return {
		name: STATIC_PACKAGE_NAME,
		version,
		description,
		main: "dist/index.js",
		module: "dist/index.js",
		type: "module",
		types: "dist/index.d.ts",
		files: ["dist/", "README.md"],
		keywords: [
			"pie",
			"assessment",
			"player",
			"static",
			"bundled",
			"pie-framework",
			...elementKeywords,
		],
		license: "MIT",
		repository: {
			type: "git",
			url: "git+https://github.com/pie-framework/pie-players.git",
		},
		publishConfig: {
			access: "public",
		},
		unpkg: "dist/index.js",
		jsdelivr: "dist/index.js",
		pie: {
			...(config.setName ? { set: config.setName } : {}),
			bundleHash: hash,
			iteration: config.iteration || 1,
			loaderVersion: config.loaderVersion || "1.0.0",
			generatedAt: new Date().toISOString(),
			elements,
		},
	};
}

/**
 * The build's browser entry. It loads the bundled element modules, starts the
 * page's MathJax load from the copy beside it, registers the elements through
 * the item player's `registerPreloadedElements`, and loads the item player. The
 * top-level await makes `await import()` of the entry resolve once every
 * element is registered.
 */
export function generateIndex(
	elements: string[],
	elementTags: Record<string, string> = {},
	{ mathjax = false }: { mathjax?: boolean } = {},
): string {
	const entries = JSON.stringify(preloadedEntries(elements, elementTags), null, 2).replace(
		/\n/g,
		"\n  ",
	);
	const startMath = mathjax
		? `
    // Before any element renders: the first adapter copy to render starts the
    // page's one MathJax load, and this one loads it from the build.
    startMathRendering(new URL('./mathjax/${MATHJAX_LOADER_FILE}', import.meta.url).href);`
		: "";

	return `// Auto-generated entry point for pie-preloaded-player
await (async function initializePieItemPlayerStatic() {
  const elements = ${entries};

  const withRetry = async (load, attempts = 4, baseDelayMs = 200) => {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await load();
      } catch (err) {
        lastError = err;
        if (attempt < attempts) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          await new Promise((res) => setTimeout(res, delay));
        }
      }
    }
    throw lastError;
  };
  const importWithRetry = (specifier) => withRetry(() => import(specifier));

  // Parity with @pie-framework/pie-fixed-player-static, whose load signal Star
  // and Quiz Engine listen for: the same event name on \`document\`, the same
  // detail strings, the same performance mark, and the same global flag for a
  // host that initializes after the player and misses the dispatch.
  const announceLoadState = (state) => {
    try {
      if (typeof window === 'undefined' || typeof document === 'undefined') return;
      if (state === 'PIE-Fixed-Player-Load-Complete') {
        try { window.performance && window.performance.mark(state); } catch {}
        window.pieFixedPlayerLoaded = true;
      }
      document.dispatchEvent(new CustomEvent('PiePlayerLoadEvent', {
        detail: state,
        bubbles: true,
        cancelable: true,
      }));
    } catch {}
  };

  try {
    const { registerPreloadedElements } = await importWithRetry('./preloaded.js');
    const { elements: elementClasses, startMathRendering } =
      await importWithRetry('./elements/index.js');${startMath}
    // Registered without controllers, for hosted players.
    registerPreloadedElements(elements.map((entry) => {
      const element = elementClasses[entry.package];
      if (!element) {
        throw new Error('[pie-preloaded-player] No element class found in build for ' + entry.package);
      }
      return { ...entry, element };
    }));
    // A page that already registered \`pie-item-player\` — anything importing
    // @pie-players/pie-section-player — renders these elements through that
    // copy. This one would only find the tag taken, so it is not fetched.
    if (!customElements.get('pie-item-player')) {
      await importWithRetry('./pie-item-player.js');
    }
    announceLoadState('PIE-Fixed-Player-Load-Complete');
  } catch (error) {
    try { console.error('[pie-preloaded-player] Initialization failed'); } catch {}
    announceLoadState('PIE-Fixed-Player-Load-Failed');
    throw error;
  }
})();

export {};
`;
}

function generateTypes(): string {
	return `declare module '@pie-players/pie-preloaded-player' {
  export {};
  global {
    interface HTMLElementTagNameMap {
      'pie-item-player': HTMLElement;
    }
    interface Window {
      PIE_DEBUG?: boolean;
      PIE_PRELOADED_ELEMENTS?: Record<string, string>;
      newrelic?: {
        addPageAction(name: string, attributes?: Record<string, any>): void;
        noticeError(error: Error, attributes?: Record<string, any>): void;
      };
    }
  }
}
`;
}

/** What `dist/mathjax/` holds, for the README. */
function describeMath(mathjaxVersion: string | undefined, bundledMathjaxAssets: string[]): string {
	const page = mathjaxVersion && `MathJax ${mathjaxVersion} with its fonts and speech data under \`dist/mathjax/\``;
	if (!bundledMathjaxAssets.length) return page || "no MathJax, since nothing in it renders math";
	const bundled = `the font and speech files for the MathJax bundled into the item player and ${page ? "the other elements" : "each element that renders math"}, under \`dist/mathjax/npm/\` (${bundledMathjaxAssets.map((asset) => `\`${asset}\``).join(", ")})`;
	return page ? `${page} for elements that render on the page's MathJax, and ${bundled}` : bundled;
}

function generateReadme(
	config: BuildStaticConfig,
	version: string,
	hash: string,
	{ mathjaxVersion, bundledMathjaxAssets }: ElementModulesBuild,
): string {
	const parsedElements = parseElements(config.elements);
	const sortedElements = Object.entries(parsedElements).sort(([a], [b]) =>
		a.localeCompare(b),
	);
	const rows = sortedElements
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([pkg, pkgVersion]) => `| \`${pkg}\` | \`${pkgVersion}\` |`)
		.join("\n");
	const loaderVersion = config.loaderVersion || "1.0.0";
	const iteration = config.iteration || 1;
	const [examplePkgName, examplePkgVersion] = sortedElements[0] || [
		"@pie-element/multiple-choice",
		"11.4.3",
	];
	const examplePkgSpec = `${examplePkgName}@${examplePkgVersion}`;
	const exampleBaseName = examplePkgName.split("/").pop() || "multiple-choice";
	const exampleTag = config.elementTags?.[examplePkgName] ?? `pie-${exampleBaseName}`;

	return `# @pie-players/pie-preloaded-player

Version: \`${version}\`

Pre-bundled PIE item-player package with static element versions for production use.

**Note:** This package registers a predefined set of PIE elements for the preloaded strategy. Required tags must be registered before mounting the player. Missing registrations produce a readiness error.

\`dist/\` is one ES module tree with every dependency included: the item player, the elements' ESM browser builds with one shared React, and ${describeMath(mathjaxVersion, bundledMathjaxAssets)}. A page loads nothing from outside \`dist/\`, and every import in it is relative, so the tree can be served from any path.

## Included PIE elements

| Package | Version |
| --- | --- |
${rows}

## Package metadata

- Version: \`${version}\`
${config.setName ? `- Element set: \`${config.setName}\`\n` : ""}- Bundle hash: \`${hash}\`
- Loader version: \`${loaderVersion}\`
- Iteration: \`${iteration}\`

## Installation

\`\`\`bash
npm install @pie-players/pie-preloaded-player@${version}
\`\`\`

## Usage

\`\`\`html
<script type="module">
  import "@pie-players/pie-preloaded-player";
</script>

<pie-item-player
  strategy="preloaded"
  hosted
  config='{"elements":{"${exampleTag}":"${examplePkgSpec}"},"models":[{"id":"1","element":"${exampleTag}"}],"markup":"<${exampleTag} id=\\"1\\"></${exampleTag}>"}'
  env='{"mode":"gather","role":"student"}'
  session='{"id":"session-1","data":[]}'
></pie-item-player>
\`\`\`

The preloaded bundle is included by this package import. With \`strategy="preloaded"\`, the player verifies registration without fetching additional bundles. It normalizes \`config.elements\` to the bundled versions on a runtime copy. Each element registers under the base tag its build config's \`tag\` field selects, \`pie-<package basename>\` by default, with the canonical version suffix. Content can author another base tag for a bundled package; the player defines that versioned tag from the registered element.

A page that already registered \`pie-item-player\` — anything importing \`@pie-players/pie-section-player\` — renders these elements through that copy, and this package skips loading its own.

The entry uses top-level await, so \`await import()\` of it resolves once every element is registered. A bundler that processes it needs an es2022 or later target: Vite 6 and earlier default to an older one, which fails the build (\`build.target: "es2022"\`).

## Attributes

- \`config\` - Item config containing \`elements\`, \`models\`, and \`markup\`
- \`session\` - Session container with attempt data
- \`env\` - Runtime environment (mode and role)
- \`strategy\` - Must be \`"preloaded"\` for this package
- \`hosted\` - Required: the bundle registers elements without controllers, so the player renders server-processed models and scoring happens on the server. A player that is not hosted renders each model as authored and warns once per tag
- \`add-correct-response\` - Show correct response values on models
- \`external-style-urls\` - Comma-separated CSS URLs scoped to player content
- \`loader-config\` - Loader/retry/instrumentation config (JSON string)
- \`debug\` - Enables debug logging (also reads \`window.PIE_DEBUG\`)
- \`custom-class-name\` / \`container-class\` - Styling hooks for host apps

## Loader configuration

Control resource loading behavior and instrumentation via the \`loader-config\` attribute:

\`\`\`html
<pie-item-player
  strategy="preloaded"
  loader-config='{"trackPageActions": true, "maxResourceRetries": 3, "resourceRetryDelay": 500}'>
</pie-item-player>
\`\`\`

Options:

- \`trackPageActions\` (boolean, default: \`false\`) - Enable instrumentation for resource/module loading
- \`maxResourceRetries\` (number, default: \`3\`) - Maximum retry attempts for failed resources
- \`resourceRetryDelay\` (number, default: \`500\`) - Initial retry delay in milliseconds

## Resilient loading

This package includes retry behavior for:

- Module imports (registration, element modules, player module): up to 4 attempts with exponential backoff
- Runtime resources (images/audio/video): configurable retries via \`loader-config\`

## Events

- \`load-complete\` - Fired when the player has completed loading
- \`session-changed\` - Fired when session data updates from interaction
- \`player-error\` - Fired when the player encounters runtime errors
- \`model-updated\` - Fired when a PIE model is updated

## License

MIT
`;
}

export async function parseElementsInput(
	elementsFile?: string,
	elementsString?: string,
): Promise<ElementSpec[]> {
	if (elementsFile) {
		const content = await readFile(elementsFile, "utf-8");
		const parsed = JSON.parse(content);
		if (Array.isArray(parsed)) return parsed;
		if (parsed.elements && Array.isArray(parsed.elements))
			return parsed.elements;
		throw new Error(
			'Elements file must contain an array or an object with an "elements" array property',
		);
	}
	if (elementsString) {
		try {
			const parsed = JSON.parse(elementsString);
			if (Array.isArray(parsed)) return parsed;
			if (parsed.elements && Array.isArray(parsed.elements))
				return parsed.elements;
		} catch {
			return elementsString.split(",").map((item) => {
				const { name, version } = parsePackageName(item.trim());
				return { package: name, version };
			});
		}
	}
	throw new Error("Either elementsFile or elementsString must be provided");
}

/**
 * Strip the whitespace from every module under `dir`. Vite's library build
 * leaves whitespace in the item player's ES output, because removing it drops
 * the pure annotations bundlers read; a page loads this package's `dist/`
 * unbundled. Each file keeps its name and imports. A deliberate trade:
 * a host that bundles this package loses those annotations and the
 * `webpackIgnore` hints on the `esm` strategy's runtime imports, which the
 * `preloaded` strategy never runs.
 */
export async function minifyPlayerModules(dir: string): Promise<void> {
	const files = (await readdir(dir, { recursive: true })).filter((file) =>
		file.endsWith(".js"),
	);
	for (const file of files) {
		const path = join(dir, file);
		const { code } = await transform(await readFile(path, "utf-8"), {
			loader: "js",
			minifyWhitespace: true,
			charset: "utf8",
		});
		await writeFile(path, code);
	}
}

export async function buildPreloadedPlayerStaticPackage(
	config: BuildStaticConfig,
): Promise<{ outputDir: string; version: string }> {
	if (!config.loaderVersion) {
		config.loaderVersion = await resolveDefaultLoaderVersion(
			config.monorepoDir,
		);
	}

	// If iteration isn't provided, choose a safe default for publishing flows by finding the next available iteration on npm.
	// For local-only builds (no iteration passed from the CLI), we keep the historical behavior (iteration=1, outputDir=local).
	if (
		!config.iteration &&
		process.env.PIE_PRELOADED_PLAYER_AUTO_ITERATION === "true"
	) {
		if (!config.setName) {
			throw new Error("Choosing the next iteration needs an element-set name");
		}
		config.iteration = await fetchNextIterationFromNpm(
			config.loaderVersion,
			config.setName,
		);
	}

	assertBuildElements(config.elements, config.elementTags);
	const version = generateVersion(config);
	const hash = generateHash(config.elements);

	const defaultDirName = config.iteration
		? `pie-preloaded-player-${version}`
		: "local";
	const outputDir =
		config.outputDir ||
		join(config.monorepoDir, "local-builds", defaultDirName);

	await rm(outputDir, { recursive: true, force: true });
	await mkdir(join(outputDir, "dist"), { recursive: true });

	// Build required workspace outputs from this monorepo.
	// For publish flows we do a full package rebuild, matching regular publish expectations.
	// For local package generation we keep a narrower build for speed.
	const itemPlayerPkgDir = join(config.monorepoDir, "packages", "item-player");
	if (!existsSync(itemPlayerPkgDir)) {
		throw new Error(`pie-item-player package not found: ${itemPlayerPkgDir}`);
	}
	const buildCommand = config.publish
		? "bun run build"
		: "bun run build:e2e:item-player";
	execSync(buildCommand, {
		cwd: config.monorepoDir,
		stdio: "inherit",
	});

	// The entry imports sibling chunks and assets from the item-player build.
	const itemPlayerDistSrc = join(itemPlayerPkgDir, "dist");
	const outputDistDir = join(outputDir, "dist");
	await cp(itemPlayerDistSrc, outputDistDir, { recursive: true });
	await minifyPlayerModules(outputDistDir);

	const math = await buildElementModules(config.elements, outputDistDir);

	const packageJson = generatePackageJson(config, version);
	await writeFile(
		join(outputDir, "package.json"),
		JSON.stringify(packageJson, null, 2),
	);
	await writeFile(
		join(outputDir, "dist", "index.js"),
		generateIndex(config.elements, config.elementTags, { mathjax: !!math.mathjaxVersion }),
	);
	await writeFile(join(outputDir, "dist", "index.d.ts"), generateTypes());
	await writeFile(
		join(outputDir, "README.md"),
		generateReadme(config, version, hash, math),
	);

	return { outputDir, version };
}
