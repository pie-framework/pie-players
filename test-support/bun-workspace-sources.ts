/**
 * Bun test preload: workspace siblings resolve to source, and the Svelte that
 * source reaches compiles as the package builds compile it.
 *
 * Every package that runs `bun test` preloads this file from its `bunfig.toml`,
 * and so does the root one. The rationale for resolving siblings to source is in
 * `workspace-sources.ts`.
 *
 * A built export keeps Bun's resolution, and its `dist` file loads as a
 * re-export of its source. An unbuilt export, which Bun cannot resolve, is a
 * virtual module re-exporting its source: runtime `onResolve` runs only on paths
 * Bun has already resolved. A built export gets no virtual module because one
 * shadows `mock.module`: a mock of a resolvable specifier is keyed by the file
 * it resolves to, and an import served by a virtual module never reaches that
 * file. Either way a test's mock of a sibling wins and the sibling runs from
 * source; `scripts/tests/workspace-sources.test.mjs` runs both cases against a
 * fixture workspace.
 *
 * `.svelte` files compile with the options every package build uses: client
 * output, custom elements on, CSS injected, and the custom-element define guard
 * from players-shared, so a test that loads a component twice keeps the first
 * registration as a page does. `.svelte.ts` and `.svelte.js` rune modules
 * compile through `compileModule`. The `svelte` subpaths with a browser build
 * resolve to it, as in every package build: under Bun's default conditions they
 * resolve to the server build, whose lifecycle functions do nothing.
 *
 * Nothing here registers a DOM. The assessment toolkit preloads
 * speech-rule-engine before any test file registers happy-dom, and that order
 * holds only while every preload leaves `window` undefined.
 */

import { type BunPlugin, plugin } from "bun";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { guardSvelteCustomElementDefines } from "../packages/players-shared/svelte-custom-element-guard.js";
import { REPO_ROOT, workspaceExports } from "./workspace-sources.js";

const SCRIPT_LOADER = { ".js": "js", ".ts": "ts" } as const;

/** Re-exports `source`, including a default export only where it has one. */
function reexport(source: string): string {
	const target = JSON.stringify(source);
	const extension = path.extname(source);
	if (extension === ".json") return `export { default } from ${target};`;
	const hasDefault =
		extension === ".svelte" ||
		new Bun.Transpiler({
			loader: SCRIPT_LOADER[extension as keyof typeof SCRIPT_LOADER] ?? "js",
		})
			.scan(readFileSync(source, "utf8"))
			.exports.includes("default");
	return hasDefault
		? `export * from ${target};\nexport { default } from ${target};`
		: `export * from ${target};`;
}

/** `svelte` subpath -> its browser build, for each subpath that has one. */
function svelteBrowserEntries(): Map<string, string> {
	const svelteDir = path.dirname(
		Bun.resolveSync("svelte/package.json", REPO_ROOT),
	);
	const manifest = JSON.parse(
		readFileSync(path.join(svelteDir, "package.json"), "utf8"),
	);
	const entries = new Map<string, string>();
	for (const [subpath, conditions] of Object.entries(manifest.exports)) {
		const browser = (conditions as Record<string, unknown>)?.browser;
		if (typeof browser !== "string") continue;
		const specifier = subpath === "." ? "svelte" : `svelte/${subpath.slice(2)}`;
		entries.set(specifier, path.join(svelteDir, browser));
	}
	return entries;
}

function exactPaths(paths: Iterable<string>): RegExp {
	const escaped = Array.from(paths, (p) =>
		p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
	);
	return new RegExp(`^(?:${escaped.join("|")})$`);
}

/** Resolves the `@pie-players/*` exports of the workspace at `root` to source. */
export function workspaceSourcesPlugin(root = REPO_ROOT): BunPlugin {
	return {
		name: "pie-workspace-sources",
		setup(build) {
			const builtTargets = new Map<string, string>();
			for (const { specifier, source, target } of workspaceExports(root)) {
				if (target && existsSync(target)) {
					builtTargets.set(realpathSync(target), source);
					continue;
				}
				build.module(specifier, () => ({
					contents: reexport(source),
					loader: "js",
				}));
			}
			if (builtTargets.size === 0) return;
			build.onLoad(
				{ filter: exactPaths(builtTargets.keys()) },
				({ path: filename }) => ({
					contents: reexport(builtTargets.get(filename) as string),
					loader: "js",
				}),
			);
		},
	};
}

const guard = guardSvelteCustomElementDefines();

plugin(workspaceSourcesPlugin());

plugin({
	name: "pie-svelte-sources",
	setup(build) {
		for (const [specifier, browser] of svelteBrowserEntries()) {
			build.module(specifier, () => ({
				contents: `export * from ${JSON.stringify(browser)};`,
				loader: "js",
			}));
		}

		build.onLoad({ filter: /\.svelte$/ }, async ({ path: filename }) => {
			const { compile } = await import("svelte/compiler");
			const { js } = compile(readFileSync(filename, "utf8"), {
				filename,
				rootDir: REPO_ROOT,
				generate: "client",
				customElement: true,
				css: "injected",
				dev: false,
			});
			return {
				contents: guard.transform(js.code, filename)?.code ?? js.code,
				loader: "js",
			};
		});

		build.onLoad(
			{ filter: /\.svelte\.(?:js|ts)$/ },
			async ({ path: filename }) => {
				const { compileModule } = await import("svelte/compiler");
				const source = readFileSync(filename, "utf8");
				const { js } = compileModule(
					filename.endsWith(".ts")
						? new Bun.Transpiler({ loader: "ts" }).transformSync(source)
						: source,
					{ filename, generate: "client", dev: false },
				);
				return { contents: js.code, loader: "js" };
			},
		);
	},
});
