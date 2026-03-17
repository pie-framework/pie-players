import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

import type { ElementSpec } from "./types.js";

export interface BuildStaticConfig {
	elements: string[]; // "@pie-element/foo@1.2.3"
	iteration?: number;
	loaderVersion?: string;
	pitsBaseUrl?: string;
	outputDir?: string;
	overwriteBundle?: boolean;
	publish?: boolean;
	monorepoDir: string;
}

const DEFAULT_PITS_BASE_URL = "https://proxy.pie-api.com";
const STATIC_PACKAGE_NAME = "@pie-players/pie-preloaded-player";
const EVAL_REQUIRE_PATTERN = /return\s+eval\((["'])require\1\);/g;

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
	hash: string,
	iteration: number,
): string {
	return `${loaderVersion}-${hash}.${iteration}`;
}

async function fetchNextIterationFromNpm(
	loaderVersion: string,
	elements: string[],
): Promise<number> {
	const hash = generateHash(elements);
	const prefix = `${loaderVersion}-${hash}.`;

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
	const parsed: Record<string, string> = {};
	for (const el of elements) {
		const lastAtIndex = el.lastIndexOf("@");
		if (lastAtIndex > 0) {
			const name = el.substring(0, lastAtIndex);
			const version = el.substring(lastAtIndex + 1);
			parsed[name] = version;
		} else {
			parsed[el] = "latest";
		}
	}
	return parsed;
}

function generateVersion(config: BuildStaticConfig): string {
	const loaderVersion = config.loaderVersion || "1.0.0";
	const hash = generateHash(config.elements);
	const iteration = config.iteration || 1;
	return generateVersionFromParts(loaderVersion, hash, iteration);
}

async function sleep(ms: number) {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBundle(
	elements: string[],
	pitsBaseUrl: string,
	overwriteBundle: boolean,
): Promise<string> {
	const elementString = elements.join("+");
	const overwriteParam = overwriteBundle ? "?overwrite=true" : "";
	const bundleUrl = `${pitsBaseUrl}/bundles/${elementString}/player.js${overwriteParam}`;

	let attempt = 0;
	const maxRetries = 10;
	const retryDelay = 10_000;

	while (attempt < maxRetries) {
		attempt++;
		const res = await fetch(bundleUrl);
		if (res.ok) return await res.text();
		if (res.status === 503) {
			await sleep(retryDelay);
			continue;
		}
		throw new Error(
			`Failed to fetch bundle: HTTP ${res.status} ${res.statusText}`,
		);
	}
	throw new Error(`Failed to fetch bundle after ${maxRetries} attempts`);
}

function resolveMathRenderingModulePath(monorepoDir: string): string {
	const playersSharedPkgJsonPath = join(
		monorepoDir,
		"packages",
		"players-shared",
		"package.json",
	);
	const requireFromPlayersShared = createRequire(playersSharedPkgJsonPath);
	return requireFromPlayersShared.resolve(
		"@pie-lib/math-rendering-module/module/index.js",
	);
}

function patchMathRenderingModuleEval(code: string): string {
	return code.replace(EVAL_REQUIRE_PATTERN, "return commonjsRequire;");
}

function generatePackageJson(config: BuildStaticConfig, version: string): any {
	const hash = generateHash(config.elements);
	const elements = parseElements(config.elements);
	const elementNames = Object.keys(elements)
		.map((pkg) => pkg.replace("@pie-element/", ""))
		.join(", ");
	const description = `PIE preloaded item-player static bundle containing: ${elementNames}. Production-ready package with pre-bundled elements (hash: ${hash.substring(0, 7)}).`;
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
			bundleHash: hash,
			iteration: config.iteration || 1,
			loaderVersion: config.loaderVersion || "1.0.0",
			generatedAt: new Date().toISOString(),
			elements,
		},
	};
}

function generateIndex(
	bundleFilename: string,
	preloadedElements: Record<string, string>,
): string {
	const preloadedElementsJson = JSON.stringify(preloadedElements, null, 2);
	const mathRenderingSetup = `
    const mathRenderingModule = await importWithRetry('./math-rendering.js', 4, 200);
    if (typeof window !== 'undefined') {
      window['@pie-lib/math-rendering'] = mathRenderingModule._dll_pie_lib__math_rendering;
      window['_dll_pie_lib__math_rendering'] = mathRenderingModule._dll_pie_lib__math_rendering;
    }`;

	return `// Auto-generated entry point for pie-preloaded-player
(async function initializePieItemPlayerStatic() {
  const preloadedElements = ${preloadedElementsJson};
  if (typeof window !== 'undefined') {
    const existing = window.PIE_PRELOADED_ELEMENTS || {};
    window.PIE_PRELOADED_ELEMENTS = { ...existing, ...preloadedElements };
  }

  const importWithRetry = async (specifier, attempts = 3, baseDelayMs = 200) => {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await import(specifier);
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

  try {
${mathRenderingSetup}
    await importWithRetry('./${bundleFilename}', 4, 200);
    await importWithRetry('./pie-item-player.js', 4, 200);
  } catch (error) {
    try { console.error('[pie-preloaded-player] Initialization failed'); } catch {}
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
      PIE_LOADER_CONFIG?: {
        trackPageActions?: boolean;
        maxResourceRetries?: number;
        resourceRetryDelay?: number;
      };
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

function generateReadme(config: BuildStaticConfig, version: string, hash: string): string {
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
	const exampleTag = `pie-${exampleBaseName}`;

	return `# @pie-players/pie-preloaded-player

Version: \`${version}\`

Pre-bundled PIE item-player package with static element versions for production use.

**Note:** This package is intended for production with a predefined set of PIE elements. It assumes preloaded strategy at runtime and does not fetch PIE element bundles dynamically.

## Included PIE elements

| Package | Version |
| --- | --- |
${rows}

## Package metadata

- Version: \`${version}\`
- Bundle hash: \`${hash}\`
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
  config='{"elements":{"${exampleTag}":"${examplePkgSpec}"},"models":[{"id":"1","element":"${exampleTag}"}],"markup":"<${exampleTag} id=\\"1\\"></${exampleTag}>"}'
  env='{"mode":"gather","role":"student"}'
  session='{"id":"session-1","data":[]}'
></pie-item-player>
\`\`\`

The preloaded bundle is already included by this package import. With \`strategy="preloaded"\`, the player automatically skips runtime element bundle loading. The player also normalizes \`config.elements\` to the bundled versions exposed by this package.

## Attributes

- \`config\` - Item config containing \`elements\`, \`models\`, and \`markup\`
- \`session\` - Session container with attempt data
- \`env\` - Runtime environment (mode and role)
- \`strategy\` - Must be \`"preloaded"\` for this package
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

Global alternative:

\`\`\`html
<script>
  window.PIE_LOADER_CONFIG = {
    trackPageActions: true,
    maxResourceRetries: 3,
    resourceRetryDelay: 500
  };
</script>
<script type="module">
  import "@pie-players/pie-preloaded-player";
</script>
\`\`\`

## Resilient loading

This package includes retry behavior for:

- Module imports (math-rendering, preloaded bundle, player module): up to 4 attempts with exponential backoff
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
				const [pkg, version] = item.trim().split("@").filter(Boolean);
				return { package: `@${pkg}`, version };
			});
		}
	}
	throw new Error("Either elementsFile or elementsString must be provided");
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
		config.iteration = await fetchNextIterationFromNpm(
			config.loaderVersion,
			config.elements,
		);
	}

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

	let pitsBaseUrl =
		config.pitsBaseUrl || process.env.BUNDLE_BASE_URL || DEFAULT_PITS_BASE_URL;
	if (pitsBaseUrl.endsWith("/bundles")) pitsBaseUrl = pitsBaseUrl.slice(0, -8);

	const bundleJs = await fetchBundle(
		config.elements,
		pitsBaseUrl,
		!!config.overwriteBundle,
	);

	// Build required workspace outputs from this monorepo.
	// For publish flows we do a full package rebuild, matching regular publish expectations.
	// For local package generation we keep a narrower build for speed.
	const itemPlayerPkgDir = join(
		config.monorepoDir,
		"packages",
		"item-player",
	);
	if (!existsSync(itemPlayerPkgDir)) {
		throw new Error(`pie-item-player package not found: ${itemPlayerPkgDir}`);
	}
	const buildCommand = config.publish ? "bun run build" : "bun run build:e2e:item-player";
	execSync(buildCommand, {
		cwd: config.monorepoDir,
		stdio: "inherit",
	});

	const customElementSrc = join(
		itemPlayerPkgDir,
		"dist",
		"pie-item-player.js",
	);
	const customElementDest = join(outputDir, "dist", "pie-item-player.js");
	await copyFile(customElementSrc, customElementDest);

	const bundleFilename = `pie-elements-bundle-${hash}.js`;
	await writeFile(join(outputDir, "dist", bundleFilename), bundleJs);

	const mathModuleSrc = resolveMathRenderingModulePath(config.monorepoDir);
	const mathModuleDest = join(outputDir, "dist", "math-rendering.js");
	const mathModuleCode = await readFile(mathModuleSrc, "utf-8");
	const patchedMathModuleCode = patchMathRenderingModuleEval(mathModuleCode);
	if (/eval\((["'])require\1\)/.test(patchedMathModuleCode)) {
		throw new Error(
			"math-rendering-module still contains eval(require) after patching",
		);
	}
	await writeFile(mathModuleDest, patchedMathModuleCode);

	const packageJson = generatePackageJson(config, version);
	await writeFile(
		join(outputDir, "package.json"),
		JSON.stringify(packageJson, null, 2),
	);
	await writeFile(
		join(outputDir, "dist", "index.js"),
		generateIndex(bundleFilename, parseElements(config.elements)),
	);
	await writeFile(join(outputDir, "dist", "index.d.ts"), generateTypes());
	await writeFile(
		join(outputDir, "README.md"),
		generateReadme(config, version, hash),
	);

	return { outputDir, version };
}
