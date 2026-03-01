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
} from "./config.js";
// Loaders
export type { EsmLoaderConfig } from "./esm-loader.js";
export { EsmPieLoader } from "./esm-loader.js";
export type { IifeLoaderConfig } from "./iife-loader.js";
export { DEFAULT_BUNDLE_HOST, IifePieLoader } from "./iife-loader.js";
// Initialization
export {
	initializePiesFromLoadedBundle,
	loadBundleFromString,
	loadPieModule,
	loadPieModuleFromString,
} from "./initialization.js";
// Item controller
export type { ItemControllerOptions } from "./item-controller.js";
export { ItemController, normalizeItemSessionContainer } from "./item-controller.js";
export type {
	ItemSessionContainer as CanonicalItemSessionContainer,
	ItemSessionUpdateIntent,
	NormalizedItemSessionChange,
} from "./item-session-contract.js";
export {
	hasResponseValue,
	normalizeItemSessionChange,
} from "./item-session-contract.js";
export type {
	ItemSessionContainer,
	ItemSessionStorageStrategy,
} from "./item-controller-storage.js";
export {
	MemoryItemSessionStorage,
	SessionStorageItemSessionStorage,
} from "./item-controller-storage.js";
// Logging
export type { PieLogger } from "./logger.js";
export { createPieLogger, isGlobalDebugEnabled } from "./logger.js";
// Player bootstrap helpers (used by inline/fixed players)
export type {
	ItemData,
	PiePlayerConfig,
	PiePlayerElements,
} from "./player-initializer.js";
export {
	buildApiParams,
	buildEventListenersMap,
	ensurePiePlayerLoaded,
	extractPassageMarkup,
	fetchItemData,
	initializePiePlayer,
} from "./player-initializer.js";
// Registry
export { pieRegistry } from "./registry.js";
// Scoring
export { findPieController, scorePieItem } from "./scoring.js";
// Types and interfaces
export type {
	Entry,
	EventListeners,
	EventListenersMap,
	LoadPieElementsOptions,
	PieElement,
	PieRegistry,
	UpdatePieElementOptions,
} from "./types.js";
export {
	BundleType,
	defaultPieElementOptions,
	isCustomElementConstructor,
	// Type guards (functions)
	isPieAvailable,
	isPieRegistryAvailable,
	Status,
} from "./types.js";
// Tag naming helpers
export {
	toPrintHashedTag,
	toViewTag,
	validateCustomElementTag,
	VIEW_TAG_SUFFIX,
} from "./tag-names.js";
export type { PieViewMode } from "./tag-names.js";
// Updates
export {
	updatePieElement,
	updatePieElements,
	updatePieElementWithRef,
} from "./updates.js";
// Utils
export {
	findOrAddSession,
	getPackageWithoutVersion,
	getPieElementBundlesUrl,
	parsePackageName,
} from "./utils.js";
