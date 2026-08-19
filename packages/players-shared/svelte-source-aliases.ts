/**
 * The players-shared modules a sibling package resolves from source rather than
 * from `dist`, declared once.
 *
 * These carry Svelte runes (`$state`, `$derived`) or are `.svelte` components, and
 * this package builds with plain `tsc` — `tsconfig.json` excludes
 * `src/**​/*.svelte.ts` and `src/components/**` because `tsc` cannot compile
 * either. So they never reach `dist`, and a sibling that needs them resolves the
 * source through a Vite alias.
 *
 * One declaration rather than three: item-player, section-player and
 * tool-tts-inline each had their own copy of this table, so the set of
 * source-resolved modules was whatever each config happened to list, and this
 * package's real surface was spread across three build files.
 *
 * These paths are deliberately NOT in the `exports` map. Putting them there means
 * publishing the source, which makes `PieItemPlayer.svelte` and the rune helpers
 * public API — a decision with consumer-facing consequences, not a packaging
 * detail. `scripts/check-undeclared-subpaths.mjs` holds the matching allowlist, so
 * the gap is one reviewable list rather than an invisible one.
 *
 * Lives at the package root, outside `src/`, so `tsconfig.json`'s `include` leaves
 * it out of the build and it never lands in `dist`; `files: ["dist"]` keeps it
 * unpublished, which `check-source-exports` requires of anything outside `dist`.
 *
 * Paths are relative, and each consumer resolves them against this package's
 * directory. That keeps the module free of `import.meta.url`, which a consumer
 * whose `tsconfig` treats repo files as CommonJS cannot type-check.
 */

/** Subpath -> path relative to the players-shared package root. */
export const PLAYERS_SHARED_SVELTE_SOURCE_RELATIVE: Record<string, string> = {
	"@pie-players/pie-players-shared/components": "src/components/index.ts",
	"@pie-players/pie-players-shared/ui/use-promise": "src/ui/use-promise.svelte.ts",
	"@pie-players/pie-players-shared/ui/use-zoom-compensation":
		"src/ui/use-zoom-compensation.svelte.ts",
};

/**
 * The alias map for a Vite `resolve.alias`, rooted at this package.
 *
 * `playersSharedDir` is the absolute path to `packages/players-shared`, which a
 * sibling config builds with `resolve(__dirname, "../players-shared")`.
 */
export function playersSharedSvelteSourceAliases(
	playersSharedDir: string,
	join: (base: string, relativePath: string) => string,
): Record<string, string> {
	const aliases: Record<string, string> = {};
	for (const [subpath, relativePath] of Object.entries(
		PLAYERS_SHARED_SVELTE_SOURCE_RELATIVE,
	)) {
		aliases[subpath] = join(playersSharedDir, relativePath);
	}
	return aliases;
}
