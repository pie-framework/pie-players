import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import { join, posix, sep } from "node:path";

import { parsePackageName } from "@pie-players/pie-players-shared/pie";
import { build, type Rollup } from "vite";

/** The MathJax adapter pie-elements-ng bundles into every element that renders math. */
const MATH_ADAPTER = "@pie-element/shared-math-rendering-mathjax";

/** Names the adapter's browser build, which bundles its MathJax. */
const BUNDLED_ENGINE = `${MATH_ADAPTER}/bundled`;

/**
 * Names an adapter copy from `0.1.3`, which loads MathJax's files from the URLs
 * the page gives it and names no CDN host.
 */
const ASSET_ROOT_READER = `${MATH_ADAPTER}/no-assets`;

/** A jsDelivr URL of MathJax or its files, which adapter copies up to `0.1.2` load from. */
const MATHJAX_CDN = /https:\/\/cdn\.jsdelivr\.net\/npm\/(?:mathjax@|@mathjax\/)/;

/** Under `dist/mathjax/`: the MathJax files a build ships, at `<package>@<version>/<path>`. */
export const MATHJAX_NPM_DIR = "npm";

/** The speech locales a build ships when its config names none. */
export const DEFAULT_SPEECH_LOCALES = ["en"];

/**
 * The speech rules SRE loads with every locale, and those of the braille codes
 * the menu offers whatever the locale.
 */
const SPEECH_BASE_RULES = ["base", "nemeth", "euro"];

/** A speech locale id, as SRE names its rules file. */
const SPEECH_LOCALE = /^[a-z]{2,3}(?:-[A-Za-z0-9]+)*$/;

/** The default MathJax 4 font. */
const MATHJAX_FONT = "@mathjax/mathjax-newcm-font";

/**
 * The font extensions MathJax loads when TeX autoloads a package that needs
 * one: mhchem for `\ce` and `\pu`. No content on the live installs uses bbm,
 * bboldx or dsfont (`\mathbbm`, `\mathbbb`, `\mathds`), so their extensions are
 * not shipped.
 */
const MATHJAX_FONT_EXTENSIONS = ["@mathjax/mathjax-mhchem-font-extension"];

interface InstalledElement {
	name: string;
	version: string;
	manifest: any;
}

export interface ElementModulesBuild {
	/**
	 * The npm path, `<package>@<version>/<path>`, of each MathJax file shipped
	 * under `dist/mathjax/npm/`. The entry gives the adapter copies each file's
	 * URL.
	 */
	mathjaxFiles: string[];
	/** The speech locales shipped, when MathJax files are. */
	speechLocales?: string[];
}

export interface ElementModulesOptions {
	/**
	 * The `pie.assetPackages` of the adapter the item player's modules in
	 * `distDir` bundle.
	 */
	playerAssetPackages?: Record<string, string>;
	/** The speech locales to ship, by SRE locale id; `DEFAULT_SPEECH_LOCALES` when unset. */
	speechLocales?: string[];
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

/**
 * The `pie.assetPackages` of the adapter the package at `dir` resolves: the
 * packages, each at its version, the adapter loads files of. `undefined` for an
 * adapter up to `0.1.2`, which exports no manifest, and for a package without
 * the adapter.
 */
export function adapterAssetPackages(dir: string): Record<string, string> | undefined {
	let manifest: string;
	try {
		manifest = createRequire(join(realpathSync(dir), "package.json")).resolve(
			`${MATH_ADAPTER}/package.json`,
		);
	} catch {
		return undefined;
	}
	const assetPackages = JSON.parse(readFileSync(manifest, "utf-8"))?.pie?.assetPackages;
	return assetPackages && typeof assetPackages === "object" ? assetPackages : undefined;
}

/** Rejects speech locales a build cannot ship. */
export function assertSpeechLocales(locales: string[]): void {
	if (!locales.length) throw new Error("A build ships at least one speech locale");
	const invalid = locales.filter((locale) => !SPEECH_LOCALE.test(locale) || SPEECH_BASE_RULES.includes(locale));
	if (invalid.length) {
		throw new Error(`${invalid.map((locale) => JSON.stringify(locale)).join(", ")}: not a speech locale id`);
	}
}

/**
 * The `package@version/path` entries the adapter's browser build loads files of
 * from `assetPackages`: the fonts' woff2 directories, the speech worker, and the
 * speech rules of `speechLocales` alone.
 */
export function mathjaxAssets(assetPackages: Record<string, string>, speechLocales: string[]): string[] {
	assertSpeechLocales(speechLocales);
	const files: Record<string, string[]> = {
		mathjax: [
			"sre/speech-worker.js",
			...[...SPEECH_BASE_RULES, ...speechLocales].map((rules) => `sre/mathmaps/${rules}.json`),
		],
		...Object.fromEntries([MATHJAX_FONT, ...MATHJAX_FONT_EXTENSIONS].map((name) => [name, ["chtml/woff2"]])),
	};
	return Object.entries(assetPackages).flatMap(([name, version]) => {
		if (!files[name]) {
			throw new Error(`${MATH_ADAPTER} loads files of ${name}, which a preloaded build does not ship`);
		}
		return files[name].map((path) => `${name}@${version}/${path}`);
	});
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
 * Rejects an element whose browser build bundles an adapter copy up to `0.1.2`,
 * which loads MathJax or its files from jsDelivr, given the code of its files.
 */
export function assertCurrentAdapter({ name, version }: InstalledElement, code: string[]): void {
	const bundled = code.some((file) => file.includes(BUNDLED_ENGINE));
	const current = code.some((file) => file.includes(ASSET_ROOT_READER));
	if (bundled && current && !code.some((file) => MATHJAX_CDN.test(file))) return;
	throw new Error(
		`${name}@${version} bundles ${MATH_ADAPTER} before 0.1.3, which loads MathJax from jsDelivr; a preloaded build takes elements on 0.1.3 or later`,
	);
}

/** The bundled module the entry imports: the element classes by package. */
export function generateElementsModule(packages: string[]): string {
	const imports = packages
		.map((name, index) => `import element${index} from ${JSON.stringify(`${name}/browser/delivery`)};`)
		.join("\n");
	const entries = packages
		.map((name, index) => `  ${JSON.stringify(name)}: element${index},`)
		.join("\n");
	return `${imports}

export const elements = {
${entries}
};
`;
}

async function copyEntries(fromDir: string, toDir: string, entries: string[]): Promise<void> {
	await mkdir(toDir, { recursive: true });
	for (const entry of entries) {
		const from = join(fromDir, entry);
		if (!existsSync(from)) throw new Error(`${from} is missing from the installed package`);
		await cp(from, join(toDir, entry), { recursive: true });
	}
}

/** The code of every module of the installed package at `dir`, its own dependencies left out. */
async function packageCode(dir: string): Promise<string[]> {
	const files = (await readdir(dir, { recursive: true })).filter(
		(file) => file.endsWith(".js") && !file.split(/[\\/]/).includes("node_modules"),
	);
	return Promise.all(files.map((file) => readFile(join(dir, file), "utf-8")));
}

/** Groups `package@version/path` assets by package version. */
export function assetPackages(assets: Iterable<string>): Map<string, { name: string; version: string; paths: string[] }> {
	const packages = new Map<string, { name: string; version: string; paths: string[] }>();
	for (const asset of assets) {
		const [, name, version, path] = /^((?:@[^/]+\/)?[^@/]+)@([^/]+)\/(.*)$/.exec(asset) ?? [];
		if (!name) throw new Error(`${asset} names no package version`);
		const key = `${name}@${version}`;
		const entry = packages.get(key) ?? { name, version, paths: [] };
		if (!entry.paths.includes(path)) entry.paths.push(path);
		packages.set(key, entry);
	}
	return packages;
}

/** The files under `path` in `dir`, by their path from `dir`; `path` itself when it is a file. */
async function filesUnder(dir: string, path: string): Promise<string[]> {
	const full = join(dir, path);
	if (!(await stat(full)).isDirectory()) return [path];
	const files: string[] = [];
	for (const entry of await readdir(full, { recursive: true })) {
		if ((await stat(join(full, entry))).isFile()) files.push(posix.join(path, entry.split(sep).join(posix.sep)));
	}
	return files;
}

/**
 * Installs each package version `assets` name, under an alias so that two
 * versions of one package can sit side by side, and copies the paths named,
 * with its manifest and license, to `npmDir/<package>@<version>/`. Returns the
 * npm path of every file copied but the manifests and licenses. A speech locale
 * has to be one SRE ships.
 */
async function copyMathjaxAssets(
	workDir: string,
	dependencies: Record<string, string>,
	assets: Set<string>,
	npmDir: string,
): Promise<string[]> {
	const packages = [...assetPackages(assets)];
	const aliases = packages.map((_, index) => `pie-mathjax-asset-${index}`);
	await installDependencies(workDir, {
		...dependencies,
		...Object.fromEntries(packages.map(([key], index) => [aliases[index], `npm:${key}`])),
	});
	const files: string[] = [];
	for (const [index, [key, { paths }]] of packages.entries()) {
		const installed = join(workDir, "node_modules", aliases[index]);
		const license = existsSync(join(installed, "LICENSE")) ? ["LICENSE"] : [];
		const missing = paths.filter((path) => !existsSync(join(installed, path)));
		if (missing.length) throw new Error(`${key} has no ${missing.join(", ")}`);
		const packageDir = join(npmDir, key);
		await copyEntries(installed, packageDir, ["package.json", ...license, ...paths]);
		for (const path of paths) {
			for (const file of await filesUnder(packageDir, path)) files.push(`${key}/${file}`);
		}
	}
	return files.sort();
}

/**
 * Bundles each element's ESM browser build into `<distDir>/elements/`, with one
 * React for all of them and every other dependency included, and ships the
 * files their MathJax and the item player's load under `<distDir>/mathjax/npm/`,
 * with speech for `options.speechLocales`. Elements and an item player whose
 * adapter predates `0.1.3` load MathJax from jsDelivr, so they are refused. The
 * elements are installed into a scratch project, because each config pins its
 * own versions of the same packages.
 */
export async function buildElementModules(
	elements: string[],
	distDir: string,
	options: ElementModulesOptions = {},
): Promise<ElementModulesBuild> {
	const speechLocales = options.speechLocales ?? DEFAULT_SPEECH_LOCALES;
	assertSpeechLocales(speechLocales);
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
		const assets = new Set<string>();
		for (const element of installed) {
			if (typeof element.manifest?.dependencies?.[MATH_ADAPTER] !== "string") continue;
			const dir = join(workDir, "node_modules", element.name);
			assertCurrentAdapter(element, await packageCode(dir));
			const packages = adapterAssetPackages(dir);
			if (!packages) {
				throw new Error(
					`${element.name}@${element.version} bundles a ${MATH_ADAPTER} that lists no pie.assetPackages`,
				);
			}
			for (const asset of mathjaxAssets(packages, speechLocales)) assets.add(asset);
		}
		await installDependencies(workDir, dependencies);

		const entry = join(workDir, "src", "elements.js");
		await mkdir(join(workDir, "src"), { recursive: true });
		await writeFile(entry, generateElementsModule(Object.keys(requested)));

		// Read before the elements are written beside them.
		const playerModules = (await readChunks(distDir)).filter(
			({ fileName }) => !/^(?:elements|mathjax)\//.test(fileName),
		);
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
				outDir: join(distDir, "elements"),
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
			.map(({ fileName, code }) => ({ fileName: posix.join("elements", fileName), code }));

		if (playerModules.some(({ code }) => code.includes(ASSET_ROOT_READER))) {
			if (!options.playerAssetPackages) {
				throw new Error(`No pie.assetPackages are given for the ${MATH_ADAPTER} the item player bundles`);
			}
			for (const asset of mathjaxAssets(options.playerAssetPackages, speechLocales)) assets.add(asset);
		}
		// Copies the checks above miss, such as one a dependency of an element bundles.
		const fromCdn = [...chunks, ...playerModules]
			.filter(({ code }) => MATHJAX_CDN.test(code))
			.map(({ fileName }) => fileName);
		if (fromCdn.length) {
			throw new Error(
				`${fromCdn.join(", ")} would load MathJax from jsDelivr: it bundles ${MATH_ADAPTER} before 0.1.3`,
			);
		}

		const mathjaxFiles = assets.size
			? await copyMathjaxAssets(workDir, dependencies, assets, join(distDir, "mathjax", MATHJAX_NPM_DIR))
			: [];
		return { mathjaxFiles, speechLocales: mathjaxFiles.length ? speechLocales : undefined };
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
