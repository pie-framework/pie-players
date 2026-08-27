/**
 * pie-tool-answer-eliminator - PIE Assessment Tool
 *
 * This package exports a web component built from Svelte.
 * Import the built version for CDN usage, or the .svelte source for Svelte projects.
 */

// No re-export here. The root entry a consumer imports is the built bundle,
// which exports the component and nothing named, so a value re-exported from
// this file would type-check and then be undefined at runtime. `AdapterRegistry`
// is reached through its own `./adapters/adapter-registry` subpath.
