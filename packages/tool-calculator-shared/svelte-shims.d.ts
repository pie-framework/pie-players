/** Allow TypeScript declaration generation to resolve compiled Svelte imports. */
declare module "*.svelte" {
	import type { SvelteComponent } from "svelte";
	export const registration: { readonly tag: string };
	export default SvelteComponent;
}

declare module "*.svelte?customElement" {
	const element: CustomElementConstructor;
	export default element;
}
