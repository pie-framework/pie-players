/**
 * Re-export surface for section-player preload utilities.
 *
 * This module used to expose a stateful orchestrator
 * (`orchestratePlayerElementPreload`, `buildPreloadSignature`,
 * `getRenderablesSignature`, `PlayerPreloadState`,
 * `preloadPlayerElements`). Those were the inverted abstraction behind
 * the section-swap "missing tags" race and have been replaced by a
 * functional pipeline owned by the deep `ElementLoader` primitive in
 * `@pie-players/pie-players-shared`. The new public surface here is
 * narrow: config helpers and a single pipeline entry point.
 */
export {
	buildBackendConfigFromProps,
	describeBundleHost,
	describeBundleType,
	type ElementPreloadErrorDetail,
	type ElementPreloadRetryDetail,
	formatElementLoadError,
	getLoaderView,
	getPreloadLogger,
	getRenderablesSignature,
	toErrorMessage,
	warmupSectionElements,
} from "../components/shared/player-preload.js";
