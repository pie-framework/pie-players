declare module "*.svelte" {
	import type { Component } from "svelte";
	const component: Component<Record<string, unknown>>;
	export default component;
}

declare module "*.css?inline" {
	const css: string;
	export default css;
}
