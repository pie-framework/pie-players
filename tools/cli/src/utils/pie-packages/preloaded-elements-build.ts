import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";

import { parsePackageName } from "@pie-players/pie-players-shared/pie";
import { build, type Rollup } from "vite";

/** The MathJax adapter pie-elements-ng bundles into every element that renders math. */
const MATH_ADAPTER = "@pie-element/shared-math-rendering-mathjax";

/**
 * The key under which every copy of the adapter on a page keeps the one MathJax
 * load, so the first copy to render starts it and the rest wait on it.
 */
const MATH_LOAD_REGISTRY = `${MATH_ADAPTER}/loading`;

/** The adapter's default MathJax script, which names the MathJax version it expects. */
const MATHJAX_CDN_URL = /https:\/\/cdn\.jsdelivr\.net\/npm\/mathjax@([0-9][0-9A-Za-z.+-]*)\/tex-mml-chtml\.js/g;

/** The default MathJax 4 font, which MathJax loads from its `[fonts]` path. */
const MATHJAX_FONT = "@mathjax/mathjax-newcm-font";

/**
 * The parts of the `mathjax` package a page can request: the combined component,
 * the extensions and data it loads by path, and both output renderers, which
 * MathJax's menu lets a student switch between. The font package ships its
 * license in its manifest.
 */
const MATHJAX_FILES = ["tex-mml-chtml.js", "a11y", "input", "output", "ui", "sre", "LICENSE"];
const MATHJAX_FONT_FILES = ["chtml.js", "chtml", "svg.js", "svg", "package.json"];

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
	/** The MathJax version shipped under `dist/mathjax/`, when an element renders math. */
	mathjaxVersion?: string;
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

/** The MathJax version each chunk's copy of the adapter loads, and whether it shares the load. */
export function mathjaxUse(chunks: Array<{ fileName: string; code: string }>): {
	versions: Set<string>;
	unshared: string[];
} {
	const versions = new Set<string>();
	const unshared: string[] = [];
	for (const { fileName, code } of chunks) {
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

/**
 * Bundles each element's ESM browser build into `<distDir>/elements/`, with one
 * React for all of them and every other dependency included, and ships the
 * MathJax those elements render with under `<distDir>/mathjax/`. The elements
 * are installed into a scratch project, because each config pins its own
 * versions of the same packages.
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
		const adapterVersions = installed
			.map(({ manifest }) => manifest?.dependencies?.[MATH_ADAPTER])
			.filter((version): version is string => typeof version === "string");
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
			dependencies.mathjax = mathjaxVersion;
			dependencies[MATHJAX_FONT] = mathjaxVersion;
		}
		await installDependencies(workDir, dependencies);

		const entry = join(workDir, "src", "elements.js");
		await mkdir(join(workDir, "src"), { recursive: true });
		await writeFile(entry, generateElementsModule(Object.keys(requested), withMath));

		const outDir = join(distDir, "elements");
		const output = await build({
			root: workDir,
			configFile: false,
			envDir: false,
			publicDir: false,
			logLevel: "warn",
			base: "./",
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

		if (mathjaxVersion) {
			const mathjaxDir = join(distDir, "mathjax");
			await copyEntries(join(workDir, "node_modules", "mathjax"), mathjaxDir, MATHJAX_FILES);
			await copyEntries(
				join(workDir, "node_modules", MATHJAX_FONT),
				join(mathjaxDir, "fonts", MATHJAX_FONT.split("/")[1]),
				MATHJAX_FONT_FILES,
			);
			await writeFile(join(mathjaxDir, MATHJAX_LOADER_FILE), MATHJAX_LOADER);
		}
		return { mathjaxVersion };
	} finally {
		await rm(workDir, { recursive: true, force: true });
	}
}

async function readChunks(dir: string): Promise<Array<{ fileName: string; code: string }>> {
	const files = (await readdir(dir, { recursive: true })).filter((file) => file.endsWith(".js"));
	return Promise.all(
		files.map(async (fileName) => ({ fileName, code: await readFile(join(dir, fileName), "utf-8") })),
	);
}
