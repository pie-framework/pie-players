import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { join, posix, sep } from "node:path";

import { parsePackageName } from "@pie-players/pie-players-shared/pie";
import { build, type Plugin, type Rollup } from "vite";

/** The MathJax adapter pie-elements-ng bundles into every element that renders math. */
const MATH_ADAPTER = "@pie-element/shared-math-rendering-mathjax";

/**
 * The key under which every copy of the adapter on a page keeps the one MathJax
 * load, so the first copy to render starts it and the rest wait on it.
 */
const MATH_LOAD_REGISTRY = `${MATH_ADAPTER}/loading`;

/**
 * Names the copy of the adapter that bundles its own MathJax, which never reads
 * `window.MathJax` and needs no page MathJax.
 */
const BUNDLED_ENGINE = `${MATH_ADAPTER}/bundled`;

/** The adapter's default MathJax script, which names the MathJax version it expects. */
const MATHJAX_CDN_URL = /https:\/\/cdn\.jsdelivr\.net\/npm\/mathjax@([0-9][0-9A-Za-z.+-]*)\/tex-mml-chtml\.js/g;

/** Where a bundled MathJax loads its font files and speech worker from. */
const BUNDLED_ASSET_CDN = "https://cdn.jsdelivr.net/npm/@mathjax/";

/**
 * A string literal holding one of those URLs: the package, its version, and the
 * path in it. A template literal that interpolates is not matched.
 */
const BUNDLED_ASSET_URL = /(["'`])https:\/\/cdn\.jsdelivr\.net\/npm\/(@mathjax\/[a-z0-9-]+)@([0-9][0-9A-Za-z.+-]*)\/([^"'`\s${}]*)\1/g;

/** Under `dist/mathjax/`: the asset packages bundled MathJax copies load from, by `package@version`. */
const BUNDLED_ASSETS_DIR = "npm";

/** The default MathJax 4 font, which MathJax loads from its `[fonts]` path. */
const MATHJAX_FONT = "@mathjax/mathjax-newcm-font";

/**
 * The font extensions MathJax loads from `[fonts]` when TeX autoloads a package
 * that needs one: mhchem for `\ce` and `\pu`. No content on the live installs
 * uses bbm, bboldx or dsfont (`\mathbbm`, `\mathbbb`, `\mathds`), so their
 * extensions are not shipped.
 */
const MATHJAX_FONT_EXTENSIONS = ["@mathjax/mathjax-mhchem-font-extension"];

/**
 * The parts of the `mathjax` package a page can request: the combined component,
 * the extensions and data it loads by path, and both output renderers, which
 * MathJax's menu lets a student switch between. The font packages ship their
 * licenses in their manifests; an extension's SVG glyphs are inside its `svg.js`.
 */
const MATHJAX_FILES = ["tex-mml-chtml.js", "a11y", "input", "output", "ui", "sre", "LICENSE"];
const MATHJAX_FONT_FILES = ["chtml.js", "chtml", "svg.js", "svg", "package.json"];
const MATHJAX_FONT_EXTENSION_FILES = ["chtml.js", "chtml", "svg.js", "package.json"];

/** Published under `dist/mathjax/`: the script the adapter loads in place of jsDelivr's. */
export const MATHJAX_LOADER_FILE = "load.js";

/**
 * MathJax reads its configuration from `window.MathJax` as its script runs, and
 * defaults its font path to jsDelivr whatever URL it loads from. The adapter
 * writes that configuration, sets no paths, and loads `srcUrl`, so this script
 * stands at `srcUrl`, points both paths at this directory, and loads the
 * MathJax beside it. Its failure reaches the adapter through the handler the
 * adapter set on this script.
 */
export const MATHJAX_LOADER = `(function () {
  var script = document.currentScript;
  var root = new URL(".", script.src).href.replace(/\\/$/, "");
  var config = window.MathJax || (window.MathJax = {});
  var loader = config.loader || (config.loader = {});
  var paths = loader.paths || (loader.paths = {});
  if (!paths.mathjax) paths.mathjax = root;
  if (!paths.fonts) paths.fonts = root + "/fonts";
  var mathjax = document.createElement("script");
  mathjax.src = root + "/tex-mml-chtml.js";
  mathjax.onerror = function (event) {
    if (typeof script.onerror === "function") script.onerror(event);
  };
  document.head.appendChild(mathjax);
})();
`;

interface InstalledElement {
	name: string;
	version: string;
	manifest: any;
}

export interface ElementModulesBuild {
	/**
	 * The MathJax version shipped under `dist/mathjax/`, when an element renders
	 * math on the page's MathJax.
	 */
	mathjaxVersion?: string;
	/**
	 * The `package@version` of each package shipped under `dist/mathjax/npm/` for
	 * the item player and the elements that bundle their MathJax: its fonts and
	 * speech worker.
	 */
	bundledMathjaxAssets: string[];
}

async function writeManifest(workDir: string, dependencies: Record<string, string>): Promise<void> {
	await writeFile(
		join(workDir, "package.json"),
		JSON.stringify({ name: "pie-preloaded-elements", private: true, type: "module", dependencies }, null, 2),
	);
}

async function installDependencies(workDir: string, dependencies: Record<string, string>): Promise<void> {
	await writeManifest(workDir, dependencies);
	execFileSync("bun", ["install", "--no-progress"], { cwd: workDir, stdio: "inherit" });
}

async function readManifest(workDir: string, name: string): Promise<any> {
	return JSON.parse(await readFile(join(workDir, "node_modules", name, "package.json"), "utf-8"));
}

/** Orders `x.y.z[-pre]` versions; a release follows its prereleases. */
export function compareVersions(a: string, b: string): number {
	const [mainA, preA] = a.split(/-(.*)/s);
	const [mainB, preB] = b.split(/-(.*)/s);
	const partsA = mainA.split(".").map(Number);
	const partsB = mainB.split(".").map(Number);
	for (let i = 0; i < 3; i++) {
		const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
		if (diff) return diff;
	}
	if (preA === preB) return 0;
	if (preA === undefined) return 1;
	if (preB === undefined) return -1;
	return preA.localeCompare(preB, "en", { numeric: true });
}

/**
 * The versions every element agrees on for the bare imports its browser build
 * leaves to the page, React today. The page holds one copy of each.
 */
export function sharedBrowserDependencies(elements: InstalledElement[]): Record<string, string> {
	const shared: Record<string, string> = {};
	const declaredBy: Record<string, string> = {};
	for (const { name, manifest } of elements) {
		for (const [dependency, version] of Object.entries<string>(
			manifest?.pie?.browserSharedDependencies ?? {},
		)) {
			if (shared[dependency] && shared[dependency] !== version) {
				throw new Error(
					`${declaredBy[dependency]} shares ${dependency}@${shared[dependency]} and ${name} shares ${dependency}@${version}; a build holds one copy`,
				);
			}
			shared[dependency] = version;
			declaredBy[dependency] = name;
		}
	}
	return shared;
}

/** Rejects a package without the ESM browser build a preloaded build bundles. */
export function assertEsmElement({ name, version, manifest }: InstalledElement): void {
	if (!manifest?.exports?.["./browser/delivery"]) {
		throw new Error(
			`${name}@${version} has no ESM browser build ("./browser/delivery"); preloaded builds bundle pie-elements-ng elements only`,
		);
	}
}

/**
 * The bundled module the entry imports: the element classes by package, and the
 * function that starts the page's MathJax load from the build's own copy.
 */
export function generateElementsModule(packages: string[], withMath: boolean): string {
	const imports = packages
		.map((name, index) => `import element${index} from ${JSON.stringify(`${name}/browser/delivery`)};`)
		.join("\n");
	const entries = packages
		.map((name, index) => `  ${JSON.stringify(name)}: element${index},`)
		.join("\n");
	const math = withMath
		? `import { createMathjaxRenderer } from ${JSON.stringify(MATH_ADAPTER)};

/**
 * Starts the page's MathJax load from \`srcUrl\`. Each element's copy of the
 * adapter finds the load in flight and waits on it, so none fetches MathJax
 * from jsDelivr. Elements hand math to a renderer the page installed, so then
 * nothing loads. The options match those each copy reads on its first render.
 */
export function startMathRendering(srcUrl) {
  const pageRenderer = window["@pie-lib/math-rendering"];
  if (typeof pageRenderer?.renderMath === "function") return;
  const useSingleDollar = Boolean(window["@pie-lib/math-rendering@2"]?.opts?.useSingleDollar);
  const render = createMathjaxRenderer({ srcUrl, useSingleDollar });
  Promise.resolve(render(document.createElement("div"))).catch((error) => {
    console.warn("[pie-preloaded-player] MathJax did not start", error);
  });
}
`
		: `export function startMathRendering() {}
`;
	return `${imports}
${math}
export const elements = {
${entries}
};
`;
}

/**
 * The MathJax version each chunk's copy of the adapter loads, and whether it
 * shares the load. A copy that bundles its MathJax loads none.
 */
export function mathjaxUse(chunks: Array<{ fileName: string; code: string }>): {
	versions: Set<string>;
	unshared: string[];
} {
	const versions = new Set<string>();
	const unshared: string[] = [];
	for (const { fileName, code } of chunks) {
		if (code.includes(BUNDLED_ENGINE)) continue;
		const found = [...code.matchAll(MATHJAX_CDN_URL)].map((match) => match[1]);
		if (!found.length) continue;
		for (const version of found) versions.add(version);
		if (!code.includes(MATH_LOAD_REGISTRY)) unshared.push(fileName);
	}
	return { versions, unshared };
}

async function copyEntries(fromDir: string, toDir: string, entries: string[]): Promise<void> {
	await mkdir(toDir, { recursive: true });
	for (const entry of entries) {
		const from = join(fromDir, entry);
		if (!existsSync(from)) throw new Error(`${from} is missing from the installed package`);
		await cp(from, join(toDir, entry), { recursive: true });
	}
}

/** The packages a build installs to ship MathJax `version`, each pinned to it. */
export function mathjaxDependencies(version: string): Record<string, string> {
	return Object.fromEntries(
		["mathjax", MATHJAX_FONT, ...MATHJAX_FONT_EXTENSIONS].map((name) => [name, version]),
	);
}

/**
 * Copies MathJax, its font and the font extensions from `modulesDir` into
 * `mathjaxDir`, each font under the `[fonts]` path the loader sets, and writes
 * the loader beside them.
 */
export async function copyMathjax(modulesDir: string, mathjaxDir: string): Promise<void> {
	const fontDir = (name: string) => join(mathjaxDir, "fonts", name.split("/")[1]);
	await copyEntries(join(modulesDir, "mathjax"), mathjaxDir, MATHJAX_FILES);
	await copyEntries(join(modulesDir, MATHJAX_FONT), fontDir(MATHJAX_FONT), MATHJAX_FONT_FILES);
	for (const extension of MATHJAX_FONT_EXTENSIONS) {
		await copyEntries(join(modulesDir, extension), fontDir(extension), MATHJAX_FONT_EXTENSION_FILES);
	}
	await writeFile(join(mathjaxDir, MATHJAX_LOADER_FILE), MATHJAX_LOADER);
}

/**
 * Points each bundled MathJax asset URL in `code`, the module at `fileName` in
 * `dist/`, at the build's copy under `dist/mathjax/npm/`, resolved from the
 * module's own URL, and adds the `package@version/path` to `assets`.
 */
export function rewriteBundledAssetUrls(code: string, fileName: string, assets: Set<string>): string {
	const from = posix.dirname(fileName);
	return code.replace(BUNDLED_ASSET_URL, (_literal, _quote, name: string, version: string, path: string) => {
		const asset = `${name}@${version}/${path}`;
		assets.add(asset);
		const target = posix.relative(from, posix.join("mathjax", BUNDLED_ASSETS_DIR, asset));
		return `new URL(${JSON.stringify(target)}, import.meta.url).href`;
	});
}

function bundledAssetUrls(assets: Set<string>): Plugin {
	return {
		name: "pie-preloaded-bundled-mathjax-assets",
		renderChunk(code, chunk) {
			const rewritten = rewriteBundledAssetUrls(code, posix.join("elements", chunk.fileName), assets);
			return rewritten === code ? null : { code: rewritten, map: null };
		},
	};
}

/** Whether the installed package at `dir` carries a copy of the adapter that bundles its MathJax. */
async function bundlesMathjax(dir: string): Promise<boolean> {
	const files = (await readdir(dir, { recursive: true })).filter(
		(file) => file.endsWith(".js") && !file.split(/[\\/]/).includes("node_modules"),
	);
	for (const file of files) {
		if ((await readFile(join(dir, file), "utf-8")).includes(BUNDLED_ENGINE)) return true;
	}
	return false;
}

/** Groups `package@version/path` assets by package version. */
export function assetPackages(assets: Iterable<string>): Map<string, { name: string; version: string; paths: string[] }> {
	const packages = new Map<string, { name: string; version: string; paths: string[] }>();
	for (const asset of assets) {
		const [, name, version, path] = /^(@[^/]+\/[^@]+)@([^/]+)\/(.*)$/.exec(asset) ?? [];
		if (!name) throw new Error(`${asset} names no package version`);
		const key = `${name}@${version}`;
		const entry = packages.get(key) ?? { name, version, paths: [] };
		if (!entry.paths.includes(path)) entry.paths.push(path);
		packages.set(key, entry);
	}
	return packages;
}

/**
 * Installs each package version `assets` name, under an alias so that two
 * versions of one package can sit side by side, and copies the paths named, with
 * its manifest and license, to `mathjaxDir/npm/<package>@<version>/`.
 */
async function copyBundledMathjaxAssets(
	workDir: string,
	dependencies: Record<string, string>,
	assets: Set<string>,
	mathjaxDir: string,
): Promise<string[]> {
	const packages = [...assetPackages(assets)];
	const aliases = packages.map((_, index) => `pie-mathjax-asset-${index}`);
	await installDependencies(workDir, {
		...dependencies,
		...Object.fromEntries(packages.map(([key], index) => [aliases[index], `npm:${key}`])),
	});
	for (const [index, [key, { paths }]] of packages.entries()) {
		const installed = join(workDir, "node_modules", aliases[index]);
		const license = existsSync(join(installed, "LICENSE")) ? ["LICENSE"] : [];
		const entries = paths.map((path) => path.replace(/\/$/, "")).filter(Boolean);
		if (entries.length < paths.length) throw new Error(`${key} is named without a path in it`);
		await copyEntries(installed, join(mathjaxDir, BUNDLED_ASSETS_DIR, key), [
			"package.json",
			...license,
			...entries,
		]);
	}
	return packages.map(([key]) => key);
}

/**
 * Bundles each element's ESM browser build into `<distDir>/elements/`, with one
 * React for all of them and every other dependency included, and ships what the
 * elements render math with under `<distDir>/mathjax/`: the page's MathJax for
 * elements whose adapter copy loads it, and the fonts and speech worker of each
 * MathJax an element bundles. The item player's modules, already in `distDir`,
 * bundle a MathJax for the item's own markup, and are pointed at the same copies.
 * The elements are installed into a scratch project, because each config pins
 * its own versions of the same packages.
 */
export async function buildElementModules(
	elements: string[],
	distDir: string,
): Promise<ElementModulesBuild> {
	const workDir = await mkdtemp(join(os.tmpdir(), "pie-preloaded-elements-"));
	try {
		const requested = Object.fromEntries(
			elements.map((spec) => {
				const { name, version } = parsePackageName(spec);
				return [name, version];
			}),
		);
		await installDependencies(workDir, requested);
		const installed: InstalledElement[] = [];
		for (const [name, version] of Object.entries(requested)) {
			const manifest = await readManifest(workDir, name);
			installed.push({ name, version, manifest });
			assertEsmElement({ name, version, manifest });
		}

		const shared = sharedBrowserDependencies(installed);
		const dependencies: Record<string, string> = { ...requested, ...shared };
		const adapterVersions: string[] = [];
		for (const { name, manifest } of installed) {
			const version = manifest?.dependencies?.[MATH_ADAPTER];
			if (typeof version !== "string") continue;
			if (await bundlesMathjax(join(workDir, "node_modules", name))) continue;
			adapterVersions.push(version);
		}
		const withMath = adapterVersions.length > 0;
		let mathjaxVersion: string | undefined;
		if (withMath) {
			dependencies[MATH_ADAPTER] = adapterVersions.sort(compareVersions).at(-1)!;
			await installDependencies(workDir, dependencies);
			const adapterChunks = await readChunks(join(workDir, "node_modules", MATH_ADAPTER, "dist"));
			const { versions } = mathjaxUse(adapterChunks);
			if (versions.size !== 1) {
				throw new Error(
					`${MATH_ADAPTER}@${dependencies[MATH_ADAPTER]} names ${versions.size ? [...versions].join(", ") : "no"} MathJax versions; expected one`,
				);
			}
			mathjaxVersion = [...versions][0];
			Object.assign(dependencies, mathjaxDependencies(mathjaxVersion));
		}
		await installDependencies(workDir, dependencies);

		const entry = join(workDir, "src", "elements.js");
		await mkdir(join(workDir, "src"), { recursive: true });
		await writeFile(entry, generateElementsModule(Object.keys(requested), withMath));

		const outDir = join(distDir, "elements");
		const assets = new Set<string>();
		const output = await build({
			root: workDir,
			configFile: false,
			envDir: false,
			publicDir: false,
			logLevel: "warn",
			base: "./",
			plugins: [bundledAssetUrls(assets)],
			resolve: { dedupe: Object.keys(shared) },
			// A browser has no `process` to read it from.
			define: { "process.env.NODE_ENV": JSON.stringify("production") },
			build: {
				outDir,
				emptyOutDir: true,
				target: "es2022",
				minify: "esbuild",
				sourcemap: false,
				assetsInlineLimit: 0,
				modulePreload: false,
				copyPublicDir: false,
				rollupOptions: {
					input: { index: entry },
					preserveEntrySignatures: "strict",
					external: [],
					// Element packages declare `"sideEffects": false`, and a chunk they
					// import only to install its styles would be dropped.
					treeshake: { moduleSideEffects: true },
					output: {
						format: "es",
						entryFileNames: "[name].js",
						chunkFileNames: "chunks/[name]-[hash].js",
						assetFileNames: "assets/[name]-[hash][extname]",
					},
				},
			},
		});
		const chunks = (Array.isArray(output) ? output : [output as Rollup.RollupOutput])
			.flatMap((result) => result.output)
			.filter((file): file is Rollup.OutputChunk => file.type === "chunk")
			.map(({ fileName, code }) => ({ fileName, code }));

		const { versions, unshared } = mathjaxUse(chunks);
		if (unshared.length) {
			throw new Error(
				`${unshared.join(", ")} would load MathJax from jsDelivr: the adapter copy in it predates the shared load`,
			);
		}
		const expected = mathjaxVersion ? [mathjaxVersion] : [];
		const unexpected = [...versions].filter((version) => !expected.includes(version));
		if (unexpected.length) {
			throw new Error(
				`Elements expect MathJax ${unexpected.join(", ")}, and the build ships ${mathjaxVersion ?? "none"}`,
			);
		}

		const playerModules = await rewritePlayerAssetUrls(distDir, assets);
		const unrewritten = [
			...chunks.map((chunk) => ({ ...chunk, fileName: posix.join("elements", chunk.fileName) })),
			...playerModules,
		]
			.filter(({ code }) => code.includes(BUNDLED_ASSET_CDN))
			.map(({ fileName }) => fileName);
		if (unrewritten.length) {
			throw new Error(
				`${unrewritten.join(", ")} would load MathJax fonts or speech from jsDelivr: a URL to it is not a plain string`,
			);
		}

		if (mathjaxVersion) {
			await copyMathjax(join(workDir, "node_modules"), join(distDir, "mathjax"));
		}
		const bundledMathjaxAssets = assets.size
			? await copyBundledMathjaxAssets(workDir, dependencies, assets, join(distDir, "mathjax"))
			: [];
		return { mathjaxVersion, bundledMathjaxAssets };
	} finally {
		await rm(workDir, { recursive: true, force: true });
	}
}

async function readChunks(dir: string): Promise<Array<{ fileName: string; code: string }>> {
	const files = (await readdir(dir, { recursive: true })).filter((file) => file.endsWith(".js"));
	return Promise.all(
		files.map(async (fileName) => ({
			fileName: fileName.split(sep).join(posix.sep),
			code: await readFile(join(dir, fileName), "utf-8"),
		})),
	);
}

/**
 * Points the bundled MathJax asset URLs in the item player's modules in
 * `distDir`, every module outside `elements/` and `mathjax/`, at the build's
 * copies, in place, and returns the modules as rewritten.
 */
async function rewritePlayerAssetUrls(
	distDir: string,
	assets: Set<string>,
): Promise<Array<{ fileName: string; code: string }>> {
	const modules = (await readChunks(distDir)).filter(
		({ fileName }) => !/^(?:elements|mathjax)\//.test(fileName),
	);
	return Promise.all(
		modules.map(async ({ fileName, code }) => {
			const rewritten = rewriteBundledAssetUrls(code, fileName, assets);
			if (rewritten !== code) await writeFile(join(distDir, fileName), rewritten);
			return { fileName, code: rewritten };
		}),
	);
}
