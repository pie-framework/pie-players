/**
 * PIE Element Loaders
 *
 * Deep `ElementLoader` primitive — the public entry point for registering
 * PIE custom elements at runtime. Exposes `ensureRegistered` (async) and
 * `assertRegistered` (sync) with a truthful promise contract: the returned
 * promise resolves iff every requested tag is actually in `customElements`.
 *
 * Backends (IIFE, ESM) are internal adapter modules; they implement the
 * `ElementLoaderBackend` interface and are wired via `{ backend: ... }`
 * options.
 *
 * @example
 * ```typescript
 * import {
 *   ensureRegistered,
 *   BundleType,
 * } from "@pie-players/pie-players-shared/loaders";
 *
 * await ensureRegistered(
 *   { "pie-multiple-choice": "@pie-element/multiple-choice@11.0.1" },
 *   {
 *     backend: {
 *       kind: "iife",
 *       bundleHost: "https://proxy.pie-api.com/bundles/",
 *       bundleType: BundleType.clientPlayer,
 *       needsControllers: true,
 *     },
 *   },
 * );
 * ```
 */

export type { ElementMap } from "./ElementLoader.js";
export { aggregateElements } from "./ElementLoader.js";

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
export { createIifeBackend, DEFAULT_BUNDLE_HOST } from "./iife-adapter.js";
