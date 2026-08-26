/**
 * Type declarations for Svelte component imports
 * This allows TypeScript to recognize .svelte file imports
 *
 * `index.ts` re-exports a component default, so the ambient declaration has to be
 * this package's own. It previously arrived only because `vite.config.ts` sat in
 * the type program and pulled the Svelte plugin's types in behind it — an
 * accidental dependency that broke the moment the config was excluded to stop
 * `dist/vite.config.d.ts` being published.
 */
declare module "*.svelte" {
	import type { SvelteComponent } from "svelte";
	export default SvelteComponent;
}
