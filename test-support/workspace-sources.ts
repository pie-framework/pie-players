/**
 * The source file each `@pie-players/*` workspace export is built from, for the
 * unit-test runners.
 *
 * Unit tests resolve a workspace sibling to its source. Through the published
 * `exports` they ran against whatever the sibling's last build left in `dist`, so
 * a stale `dist` failed unrelated suites and a missing one failed every suite
 * that imported the sibling. Bun reads this map through
 * `bun-workspace-sources.ts`, which every package's `bunfig.toml` preloads, and
 * Vitest through `workspaceSourcesVitePlugin`. Published `exports` keep their
 * `dist` targets: the map exists only inside the test runners.
 *
 * An export's source is found from its build output. `dist/<path>.js` is built
 * from `<path>` under `src/` or at the package root, as `.ts`, `.svelte` or
 * `.js`: tsc maps `rootDir` onto `outDir` one to one, and most Vite builds name
 * their output after their entry. `RENAMED_OUTPUTS` lists the builds that do
 * not. An export whose source cannot be found throws, so no export falls back
 * to `dist` unnoticed. `scripts/tests/workspace-sources.test.mjs` checks that
 * each `RENAMED_OUTPUTS` entry is still needed and named by its package's Vite
 * config, and that every package running unit tests is wired to this map.
 *
 * The subpaths a sibling's Vite build aliases to source, outside `exports`,
 * resolve the same way here; their tables stay where they are declared.
 */

import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { CALCULATOR_SHARED_SVELTE_SOURCE_RELATIVE } from "../packages/tool-calculator-shared/svelte-source-aliases.js";
import { PLAYERS_SHARED_SVELTE_SOURCE_RELATIVE } from "../packages/players-shared/svelte-source-aliases.js";

/** The workspace root, as a real path, because module ids are real paths. */
export const REPO_ROOT = realpathSync(path.resolve(import.meta.dirname, ".."));

/**
 * Package -> build output -> the entry it is built from, for the outputs not
 * named after their entry. Each source is relative to the package directory and
 * named by the package's Vite config.
 */
export const RENAMED_OUTPUTS: Record<string, Record<string, string>> = {
	"@pie-players/pie-print-player": { "./dist/print-player.js": "src/index.ts" },
	"@pie-players/pie-section-player": {
		"./dist/browser/pie-section-player.js": "src/browser.ts",
	},
	"@pie-players/pie-section-player-tools-event-debugger": {
		"./dist/section-player-tools-event-debugger.js": "EventPanel.svelte",
	},
	"@pie-players/pie-section-player-tools-instrumentation-debugger": {
		"./dist/section-player-tools-instrumentation-debugger.js":
			"InstrumentationPanel.svelte",
	},
	"@pie-players/pie-section-player-tools-pnp-debugger": {
		"./dist/section-player-tools-pnp-debugger.js": "PnpPanel.svelte",
	},
	"@pie-players/pie-section-player-tools-session-debugger": {
		"./dist/section-player-tools-session-debugger.js":
			"SectionSessionPanel.svelte",
	},
	"@pie-players/pie-section-player-tools-tts-settings": {
		"./dist/section-player-tools-tts-settings.js": "TtsSettingsPanel.svelte",
	},
	"@pie-players/pie-tool-calculator-cortex": {
		"./dist/pie-tool-calculator-cortex.js": "tool-calculator-cortex.svelte",
	},
	"@pie-players/pie-tool-calculator-desmos": {
		"./dist/pie-tool-calculator.js": "index.ts",
	},
	"@pie-players/pie-tool-calculator-geogebra": {
		"./dist/pie-tool-calculator-geogebra.js": "tool-calculator-geogebra.svelte",
	},
	"@pie-players/pie-tool-sign-language": {
		"./dist/tool-sign-language.js": "index.ts",
	},
};

/** Package directory -> its source-aliased subpaths, as declared beside it. */
const ALIASED_SOURCES: Record<string, Record<string, string>> = {
	"packages/players-shared": PLAYERS_SHARED_SVELTE_SOURCE_RELATIVE,
	"packages/tool-calculator-shared": CALCULATOR_SHARED_SVELTE_SOURCE_RELATIVE,
};

const SOURCE_EXTENSIONS = [".ts", ".svelte", ".js"];

export interface WorkspacePackage {
	name: string;
	dir: string;
	manifest: {
		name?: string;
		exports?: unknown;
	};
}

/** Every workspace package the root manifest's `workspaces` globs name. */
export function workspacePackages(root = REPO_ROOT): WorkspacePackage[] {
	const rootManifest = JSON.parse(
		readFileSync(path.join(root, "package.json"), "utf8"),
	);
	const packages: WorkspacePackage[] = [];
	for (const pattern of rootManifest.workspaces ?? []) {
		const dirs = pattern.endsWith("/*")
			? readdirSync(path.join(root, pattern.slice(0, -2)), {
					withFileTypes: true,
				})
					.filter((entry) => entry.isDirectory())
					.map((entry) => path.join(root, pattern.slice(0, -2), entry.name))
			: [path.join(root, pattern)];
		for (const dir of dirs) {
			const manifestPath = path.join(dir, "package.json");
			if (!existsSync(manifestPath)) continue;
			const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
			if (manifest.name?.startsWith("@pie-players/")) {
				packages.push({ name: manifest.name, dir, manifest });
			}
		}
	}
	return packages;
}

/** The target a runtime import of one `exports` entry resolves to. */
function runtimeTarget(entry: unknown): string | undefined {
	if (typeof entry === "string") return entry;
	if (!entry || typeof entry !== "object") return undefined;
	const conditions = entry as Record<string, unknown>;
	for (const condition of ["import", "default"]) {
		if (condition in conditions) return runtimeTarget(conditions[condition]);
	}
	return undefined;
}

/** The source a `./dist/...` output is built from, or `undefined`. */
export function conventionalSource(
	dir: string,
	target: string,
): string | undefined {
	const output = target.slice("./dist/".length);
	const extension = path.extname(output);
	const stem = output.slice(0, -extension.length);
	const candidates =
		extension === ".js"
			? ["src", "."].flatMap((base) =>
					SOURCE_EXTENSIONS.map((ext) => path.join(base, stem + ext)),
				)
			: [path.join("src", output), output];
	return candidates.find((candidate) => existsSync(path.join(dir, candidate)));
}

export interface WorkspaceExport {
	specifier: string;
	/** Absolute path of the source file the export is built from. */
	source: string;
	/** Absolute path of the published `dist` target; none for an aliased subpath. */
	target?: string;
}

/**
 * Every workspace export with a `dist` target that a module import can load
 * (JavaScript and JSON; a stylesheet export resolves as published), and every
 * aliased subpath.
 */
export function workspaceExports(root = REPO_ROOT): WorkspaceExport[] {
	const found: WorkspaceExport[] = [];
	const missing: string[] = [];
	for (const { name, dir, manifest } of workspacePackages(root)) {
		const exportsMap =
			typeof manifest.exports === "string"
				? { ".": manifest.exports }
				: ((manifest.exports ?? {}) as Record<string, unknown>);
		for (const [subpath, entry] of Object.entries(exportsMap)) {
			const target = runtimeTarget(entry);
			if (!target?.startsWith("./dist/") || target.endsWith(".css")) continue;
			const source =
				RENAMED_OUTPUTS[name]?.[target] ?? conventionalSource(dir, target);
			const specifier = subpath === "." ? name : `${name}/${subpath.slice(2)}`;
			if (source && existsSync(path.join(dir, source))) {
				found.push({
					specifier,
					source: path.join(dir, source),
					target: path.join(dir, target),
				});
			} else {
				missing.push(`${specifier} (${target})`);
			}
		}
		const aliased =
			ALIASED_SOURCES[path.relative(root, dir).split(path.sep).join("/")];
		for (const [specifier, source] of Object.entries(aliased ?? {})) {
			found.push({ specifier, source: path.join(dir, source) });
		}
	}
	if (missing.length > 0) {
		throw new Error(
			`[workspace-sources] no source found for ${missing.join(", ")}. Add the build entry to RENAMED_OUTPUTS in test-support/workspace-sources.ts.`,
		);
	}
	return found;
}

/** Specifier -> absolute source path, for every entry of `workspaceExports`. */
export function workspaceSources(root = REPO_ROOT): Map<string, string> {
	return new Map(
		workspaceExports(root).map(({ specifier, source }) => [specifier, source]),
	);
}

/**
 * The Vitest (Vite) adapter: resolves each workspace export to its source
 * before Vite's own resolver reads the `dist` target.
 */
export function workspaceSourcesVitePlugin() {
	const sources = workspaceSources();
	return {
		name: "pie-workspace-sources",
		enforce: "pre" as const,
		resolveId(id: string) {
			return sources.get(id) ?? null;
		},
	};
}
