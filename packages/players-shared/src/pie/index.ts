/**
 * PIE Utilities Index
 *
 * Barrel export for backward compatibility.
 * For better tree-shaking, import directly from specific modules:
 *
 * - `pie/types` - Interfaces and enums
 * - `pie/registry` - Registry management
 * - `pie/utils` - URL building and session utilities
 * - `pie/config` - Config manipulation
 * - `pie/updates` - Element update functions
 * - `pie/scoring` - Scoring and controller lookup
 * - `pie/initialization` - Bundle loading and element initialization
 */

// Config
export {
	addMarkupForPackage,
	addRubricIfNeeded,
	elementForPackage,
	makeUniqueTags,
	modelsForPackage,
} from "./config";
// Loaders
export type { EsmLoaderConfig } from "./esm-loader";
export { EsmPieLoader } from "./esm-loader";
export type { IifeLoaderConfig } from "./iife-loader";
export { DEFAULT_BUNDLE_HOST, IifePieLoader } from "./iife-loader";
// Initialization
export {
	initializePiesFromLoadedBundle,
	loadBundleFromString,
	loadPieModule,
	loadPieModuleFromString,
} from "./initialization";
// Logging
export type { PieLogger } from "./logger";
export { createPieLogger, isGlobalDebugEnabled } from "./logger";
// Player bootstrap helpers (used by inline/fixed players)
export type {
	ItemData,
	PiePlayerConfig,
	PiePlayerElements,
} from "./player-initializer";
export {
	buildApiParams,
	buildEventListenersMap,
	ensurePiePlayerLoaded,
	extractPassageMarkup,
	fetchItemData,
	initializePiePlayer,
} from "./player-initializer";
// Registry
export { pieRegistry } from "./registry";
// Scoring
export { findPieController, scorePieItem } from "./scoring";
// Types and interfaces
export type {
	Entry,
	EventListeners,
	EventListenersMap,
	LoadPieElementsOptions,
	PieElement,
	PieRegistry,
	UpdatePieElementOptions,
} from "./types";
export {
	BundleType,
	defaultPieElementOptions,
	isCustomElementConstructor,
	// Type guards (functions)
	isPieAvailable,
	isPieRegistryAvailable,
	Status,
} from "./types";
// Updates
export {
	updatePieElement,
	updatePieElements,
	updatePieElementWithRef,
} from "./updates";
// Utils
export {
	findOrAddSession,
	getPackageWithoutVersion,
	getPieElementBundlesUrl,
	parsePackageName,
} from "./utils";
