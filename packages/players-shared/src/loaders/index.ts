/**
 * PIE Element Loaders
 *
 * Element-level loading abstractions for PIE players.
 * Provides both IIFE and ESM loaders with element aggregation capabilities.
 *
 * @example
 * ```typescript
 * // ESM (modern, preferred)
 * import { EsmElementLoader } from '@pie-players/pie-players-shared/loaders';
 *
 * const loader = new EsmElementLoader({ esmCdnUrl: 'https://esm.sh' });
 * await loader.loadFromItems(section.items);
 *
 * // IIFE (legacy compatibility)
 * import { IifeElementLoader } from '@pie-players/pie-players-shared/loaders';
 *
 * const loader = new IifeElementLoader({ bundleHost: 'https://bundles.pie.org' });
 * await loader.loadFromItems(section.items);
 * ```
 */

export type {
	ElementLoaderInterface,
	ElementMap,
	LoadOptions,
} from "./ElementLoader.js";
export { aggregateElements } from "./ElementLoader.js";
export type { EsmElementLoaderConfig } from "./EsmElementLoader.js";
export { EsmElementLoader } from "./EsmElementLoader.js";
export type { IifeElementLoaderConfig } from "./IifeElementLoader.js";
export { IifeElementLoader } from "./IifeElementLoader.js";

// ElementLoader primitive — truthful-promise loader. The public entry point
// that replaces IifePieLoader/EsmPieLoader as the deep loader.
export type {
	BackendContext,
	BackendOption,
	ElementLoaderBackend,
	ElementTag,
	EnsureRegisteredOptions,
	EsmBackendConfig,
	IifeBackendConfig,
	RegistrationFailureReason,
} from "./element-loader.js";
export {
	AdapterFailure,
	ElementAssertionError,
	ElementLoaderError,
	assertRegistered,
	ensureRegistered,
} from "./element-loader.js";
export type {
	EsmBackend,
	EsmBackendTestSeams,
	EsmImportMapObserver,
	EsmModuleImporter,
	ViewConfig,
} from "./esm-adapter.js";
export { BUILT_IN_VIEWS, createEsmBackend } from "./esm-adapter.js";
export type {
	IifeBackend,
	IifeBackendTestSeams,
	IifeBundleRetryStatus,
	IifeBundleScriptLoader,
} from "./iife-adapter.js";
export { createIifeBackend } from "./iife-adapter.js";
