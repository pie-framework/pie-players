import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ElementSpec } from "./types.js";

export interface BuildStaticConfig {
	elements: string[]; // "@pie-element/foo@1.2.3"
	iteration?: number;
	loaderVersion?: string;
	pitsBaseUrl?: string;
	outputDir?: string;
	overwriteBundle?: boolean;
	monorepoDir: string;
}

const DEFAULT_PITS_BASE_URL = "https://proxy.pie-api.com";
const STATIC_PACKAGE_NAME = "@pie-players/pie-fixed-player-static";

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

async function checkMathRenderingRequired(
	elements: string[],
): Promise<boolean> {
	const parsed = parseElements(elements);
	for (const [packageName, version] of Object.entries(parsed)) {
		try {
			const versionToFetch = version === "latest" ? "latest" : version;
			const url = `https://registry.npmjs.org/${packageName}/${versionToFetch}`;
			const response = await fetch(url);
			if (!response.ok) return true;
			const packageJson = await response.json();
			const dependencies = packageJson.dependencies || {};
			if (
				dependencies["@pie-lib/math-rendering"] ||
				dependencies["@pie-lib/math-rendering-accessible"]
			) {
				return true;
			}
		} catch {
			return true;
		}
	}
	return false;
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
	includeMathRendering: boolean,
): string {
	const mathRenderingSetup = includeMathRendering
		? `
    const mathRenderingModule = await importWithRetry('./math-rendering.js', 4, 200);
    if (typeof window !== 'undefined') {
      window['@pie-lib/math-rendering'] = mathRenderingModule._dll_pie_lib__math_rendering;
      window['_dll_pie_lib__math_rendering'] = mathRenderingModule._dll_pie_lib__math_rendering;
    }`
		: `
    // Math rendering not required by any elements in this bundle`;

	return `// Auto-generated entry point for pie-fixed-player-static
(async function initializePieItemPlayerStatic() {
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
    try { console.error('[pie-fixed-player-static] Initialization failed'); } catch {}
  }
})();

export {};
`;
}

function generateTypes(): string {
	return `declare module '@pie-players/pie-fixed-player-static' {
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
      newrelic?: {
        addPageAction(name: string, attributes?: Record<string, any>): void;
        noticeError(error: Error, attributes?: Record<string, any>): void;
      };
    }
  }
}
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

export async function buildFixedPlayerStaticPackage(
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
		process.env.PIE_FIXED_PLAYER_STATIC_AUTO_ITERATION === "true"
	) {
		config.iteration = await fetchNextIterationFromNpm(
			config.loaderVersion,
			config.elements,
		);
	}

	const version = generateVersion(config);
	const hash = generateHash(config.elements);

	const defaultDirName = config.iteration
		? `pie-fixed-player-static-${version}`
		: "local";
	const outputDir =
		config.outputDir ||
		join(config.monorepoDir, "local-builds", defaultDirName);

	await rm(outputDir, { recursive: true, force: true });
	await mkdir(join(outputDir, "dist"), { recursive: true });

	const mathRenderingRequired = await checkMathRenderingRequired(
		config.elements,
	);

	let pitsBaseUrl =
		config.pitsBaseUrl || process.env.BUNDLE_BASE_URL || DEFAULT_PITS_BASE_URL;
	if (pitsBaseUrl.endsWith("/bundles")) pitsBaseUrl = pitsBaseUrl.slice(0, -8);

	const bundleJs = await fetchBundle(
		config.elements,
		pitsBaseUrl,
		!!config.overwriteBundle,
	);

	// Build pie-item-player custom element from this monorepo
	const itemPlayerPkgDir = join(
		config.monorepoDir,
		"packages",
		"item-player",
	);
	if (!existsSync(itemPlayerPkgDir)) {
		throw new Error(`pie-item-player package not found: ${itemPlayerPkgDir}`);
	}
	execSync("bun run build", { cwd: itemPlayerPkgDir, stdio: "inherit" });

	const customElementSrc = join(
		itemPlayerPkgDir,
		"dist",
		"pie-item-player.js",
	);
	const customElementDest = join(outputDir, "dist", "pie-item-player.js");
	await copyFile(customElementSrc, customElementDest);

	const bundleFilename = `pie-elements-bundle-${hash}.js`;
	await writeFile(join(outputDir, "dist", bundleFilename), bundleJs);

	if (mathRenderingRequired) {
		const rootNodeModules = join(config.monorepoDir, "node_modules");
		const mathModuleSrc = join(
			rootNodeModules,
			"@pie-lib",
			"math-rendering-module",
			"module",
			"index.js",
		);
		const mathModuleDest = join(outputDir, "dist", "math-rendering.js");
		await copyFile(mathModuleSrc, mathModuleDest);
	}

	const packageJson = generatePackageJson(config, version);
	await writeFile(
		join(outputDir, "package.json"),
		JSON.stringify(packageJson, null, 2),
	);
	await writeFile(
		join(outputDir, "dist", "index.js"),
		generateIndex(bundleFilename, mathRenderingRequired),
	);
	await writeFile(join(outputDir, "dist", "index.d.ts"), generateTypes());
	await writeFile(
		join(outputDir, "README.md"),
		`# @pie-players/pie-fixed-player-static\n\nVersion: ${version}\n\nHash: ${hash}\n\nUse with \`<pie-item-player strategy="preloaded">\`.\n`,
	);

	return { outputDir, version };
}
