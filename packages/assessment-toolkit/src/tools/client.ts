/**
 * Client-only tool system exports
 *
 * This entry point exports only browser-safe code for use in custom elements.
 * It excludes server-side services like accommodationResolver, variantResolver, etc.
 *
 * Tools should import from '$lib/assessment-toolkit/tools/client' instead of '$lib/assessment-toolkit/tools' to ensure
 * they don't accidentally pull in server-side dependencies.
 */

// Calculator providers (client-safe, have SSR guards)
// Deprecated singleton exports (kept for backward compatibility)
// @deprecated Instantiate providers directly instead
export {
	DesmosCalculatorProvider,
	desmosProvider,
} from "./calculators/desmos-provider.js";
// @deprecated Instantiate providers directly instead
export {
	MathJsCalculatorProvider,
	mathjsProvider,
} from "./calculators/mathjs-provider.js";
// @deprecated Instantiate providers directly instead
export { TICalculatorProvider, tiProvider } from "./calculators/ti-provider.js";
// Library loader (client-safe, has SSR guards)
export {
	COMMON_LIBRARIES,
	LibraryLoaderImpl,
	libraryLoader,
} from "./library-loader.js";
// Response discovery (client-safe, browser-only)
export {
	ResponseDiscoveryServiceImpl,
	responseDiscovery,
} from "./response-discovery.js";
// Tool coordinator (client-safe, uses Svelte stores)
export * from "./tool-coordinator.js";
// Core types (client-safe)
export * from "./types.js";
