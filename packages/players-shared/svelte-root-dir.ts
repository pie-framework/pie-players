/**
 * The `rootDir` every Svelte build in the workspace compiles with: the
 * workspace root, as a real path.
 *
 * Svelte hashes a component's scoped CSS class from its filename relative to
 * `rootDir`, which defaults to the working directory, and a component outside
 * that directory, such as a players-shared source reached through
 * `svelte-source-aliases.ts`, hashes its absolute path. Rooting every build at
 * the workspace keeps the checkout path out of class names and, through the
 * minifier's character-frequency naming, out of identifiers. A real path,
 * because module ids are real paths and Svelte relativizes only a filename
 * that starts with `rootDir`.
 *
 * Lives at the package root beside `svelte-source-aliases.ts`, outside `src/`,
 * so it never lands in `dist`.
 */
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

/** `packageDir` is the directory of a package under `packages/`. */
export const svelteRootDir = (packageDir: string) =>
	realpathSync(resolve(packageDir, "../.."));
