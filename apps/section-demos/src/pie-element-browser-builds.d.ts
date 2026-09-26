// pie-elements-ng packages publish their `./browser/*` builds without
// declarations. These are the shapes `registerPreloadedElements` takes.
declare module "@pie-element/*/browser/delivery" {
	const element: CustomElementConstructor;
	export default element;
}

declare module "@pie-element/*/browser/controller" {
	export function model(...args: any[]): Promise<unknown>;
}
