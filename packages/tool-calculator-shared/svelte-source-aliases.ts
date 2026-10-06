/**
 * The tool-calculator-shared modules a vendor wrapper resolves from source,
 * declared once.
 *
 * A precompiled Svelte component cannot attach effects beneath a parent running
 * another Svelte runtime, and hosts install no Svelte, so the shells are not
 * published: each wrapper compiles them into its own bundle. The subpaths are
 * absent from the `exports` map, and `scripts/check-undeclared-subpaths.mjs`
 * lists them as aliased-source exemptions.
 *
 * Lives at the package root outside `files`, so it never publishes. Paths are
 * relative to this package's directory, as in
 * `packages/players-shared/svelte-source-aliases.ts`.
 */

/** Subpath -> path relative to the tool-calculator-shared package root. */
export const CALCULATOR_SHARED_SVELTE_SOURCE_RELATIVE: Record<string, string> =
	{
		"@pie-players/pie-tool-calculator-shared/components": "components.ts",
	};

/**
 * The alias map for a Vite `resolve.alias`, rooted at this package.
 *
 * `calculatorSharedDir` is the absolute path to
 * `packages/tool-calculator-shared`.
 */
export function calculatorSharedSvelteSourceAliases(
	calculatorSharedDir: string,
	join: (base: string, relativePath: string) => string,
): Record<string, string> {
	const aliases: Record<string, string> = {};
	for (const [subpath, relativePath] of Object.entries(
		CALCULATOR_SHARED_SVELTE_SOURCE_RELATIVE,
	)) {
		aliases[subpath] = join(calculatorSharedDir, relativePath);
	}
	return aliases;
}
