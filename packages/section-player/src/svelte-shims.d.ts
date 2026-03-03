/**
 * Type declarations for Svelte component imports.
 * This allows TypeScript to resolve .svelte default exports in this package.
 */
declare module "*.svelte" {
	import type { SvelteComponent } from "svelte";
	export default SvelteComponent;
}
