/**
 * pie-tool-answer-eliminator - PIE Assessment Tool
 *
 * Importing this package registers `<pie-tool-answer-eliminator>`. The build
 * entry is the component, so this file is the type entry alone.
 */

// No re-export here. The root entry a consumer imports is the built bundle,
// which exports the component and nothing named, so a value re-exported from
// this file would type-check and then be undefined at runtime. `AdapterRegistry`
// is reached through its own `./adapters/adapter-registry` subpath.
export type {};
