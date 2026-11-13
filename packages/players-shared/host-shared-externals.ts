/**
 * The packages a player's npm build leaves to the host, and the test a Vite
 * `external` runs against an import specifier.
 *
 * A host page that mounts a player, the toolkit and tools resolves each of these
 * packages once, from its own `node_modules`, instead of carrying a copy per
 * bundle. The set is read from the packages' `exports` maps, so it cannot drift
 * from them: a specifier is external when it names an entry point the package
 * publishes, and bundled when it does not.
 *
 * That last half matters for players-shared, whose `components`,
 * `ui/interface-i18n` and `ui/use-promise` resolve from source through
 * `svelte-source-aliases.ts` and have no `exports` entry. A pattern such as
 * `/^@pie-players\/pie-players-shared(?:\/|$)/` matches them too and leaves an
 * import the host cannot resolve.
 *
 * Applies to the npm build only. A self-contained browser build lists no
 * externals, and neither does a package whose one `dist` doubles as a CDN entry
 * (the item player and the print player).
 *
 * Lives at the package root beside `svelte-source-aliases.ts`, outside `src/`,
 * so it never lands in `dist`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Package name -> its directory under `packages/`. */
export const HOST_SHARED_PACKAGE_DIRS: Readonly<Record<string, string>> = {
	"@pie-players/pie-assessment-toolkit": "assessment-toolkit",
	"@pie-players/pie-players-shared": "players-shared",
	"@pie-players/pie-context": "pie-context",
};

/**
 * Every specifier `name`'s `exports` map publishes: the bare name for `"."`, and
 * `name/<subpath>` for each other entry. `./package.json` is metadata, not code.
 */
export function publishedSpecifiers(
	name: string,
	exportsMap: Record<string, unknown>,
): string[] {
	const specifiers: string[] = [];
	for (const key of Object.keys(exportsMap)) {
		if (key === "./package.json") continue;
		if (key.includes("*")) {
			throw new Error(
				`${name} exports "${key}", a pattern: list each subpath so the host-shared externals stay exact`,
			);
		}
		specifiers.push(key === "." ? name : `${name}/${key.slice(2)}`);
	}
	return specifiers;
}

/**
 * The Vite `external` function for the host-shared packages.
 *
 * `packagesDir` is the absolute path to the workspace's `packages/` directory.
 * Matching is exact, so a specifier no `exports` entry publishes returns false
 * and falls through to the build's aliases.
 */
export function hostSharedExternals(
	packagesDir: string,
): (specifier: string) => boolean {
	const external = new Set<string>();
	for (const [name, dir] of Object.entries(HOST_SHARED_PACKAGE_DIRS)) {
		const manifest = JSON.parse(
			readFileSync(join(packagesDir, dir, "package.json"), "utf8"),
		) as { exports?: Record<string, unknown> };
		if (!manifest.exports) {
			throw new Error(`${name} declares no exports map`);
		}
		for (const specifier of publishedSpecifiers(name, manifest.exports)) {
			external.add(specifier);
		}
	}
	return (specifier) => external.has(specifier);
}
