/** Allow TypeScript declaration generation to resolve compiled Svelte imports. */
declare module "*.svelte" {
	import type { SvelteComponent } from "svelte";
	export default SvelteComponent;
}
