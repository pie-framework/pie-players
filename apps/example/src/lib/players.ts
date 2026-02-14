// Ensure custom elements are registered for use in Svelte templates.
//
// IMPORTANT: these custom elements extend HTMLElement and must not be imported during SSR.
if (typeof window !== "undefined") {
	void import("@pie-players/pie-inline-player");
	void import("@pie-players/pie-fixed-player");
	void import("@pie-players/pie-iife-player");
	void import("@pie-players/pie-esm-player");
	// void import("@pie-players/pie-author"); // Package not available yet
}
