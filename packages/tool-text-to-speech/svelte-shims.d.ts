/**
 * Type declarations for Svelte component imports
 * This allows TypeScript to recognize .svelte file imports
 */
declare module "*.svelte" {
	import type { SvelteComponent } from "svelte";
	export default SvelteComponent;
}
