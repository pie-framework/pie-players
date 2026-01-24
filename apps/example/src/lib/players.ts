// Ensure custom elements are registered for use in Svelte templates.
//
// IMPORTANT: these custom elements extend HTMLElement and must not be imported during SSR.
if (typeof window !== "undefined") {
	void import("@pie-framework/pie-inline-player");
	void import("@pie-framework/pie-fixed-player");
	void import("@pie-framework/pie-iife-player");
	void import("@pie-framework/pie-esm-player");
	void import("@pie-framework/pie-author");
}
