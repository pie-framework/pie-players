import {
	aggregateElements,
	BundleType,
	DEFAULT_BUNDLE_HOST,
	DEFAULT_ESM_CDN_URL,
	type ElementMap,
	ensureRegistered,
	type EsmBackendConfig,
	type IifeBackendConfig,
	type IifeBundleRetryStatus,
	type ItemEntity,
	mapEsmViewElements,
	resolveEsmAssetRoot,
	resolveInstrumentationProvider,
	resolveLoadControllers,
} from "@pie-players/pie-players-shared";
import type { LoaderConfig } from "@pie-players/pie-players-shared/loader-config";
import type { ItemConfig, PieContent } from "@pie-players/pie-players-shared/types";
import { ensureItemPlayerMathRenderingReady } from "./math-rendering-ready.js";
import type { PieItemPlayerLoaderOptions } from "./types.js";

/** The player inputs that decide which element code loads and from where. */
export interface ItemPlayerLoadInputs {
	/** Default `iife`, as on the player. */
	strategy?: "iife" | "esm" | "preloaded";
	loaderOptions?: PieItemPlayerLoaderOptions;
	loaderConfig?: LoaderConfig;
	/** Default `view`. */
	mode?: "view" | "author";
	hosted?: boolean;
}

/** `loaderOptions` fields the backends read; the player's option type leaves them open. */
interface BackendLoaderOptions {
	bundleHost?: string;
	esmCdnUrl?: string;
	esmCdnProvider?: EsmBackendConfig["cdnProvider"];
	moduleResolution?: string;
	view?: string;
	loadControllers?: boolean;
}

function backendOptions(loaderOptions: PieItemPlayerLoaderOptions | undefined): BackendLoaderOptions {
	return (loaderOptions ?? {}) as BackendLoaderOptions;
}

export function itemPlayerBundleType(inputs: ItemPlayerLoadInputs): BundleType {
	if (inputs.mode === "author") return BundleType.editor;
	return inputs.hosted ? BundleType.player : BundleType.clientPlayer;
}

/** The element view an ESM load registers. */
export function itemPlayerEsmView(inputs: ItemPlayerLoadInputs): string {
	return backendOptions(inputs.loaderOptions).view || (inputs.mode === "author" ? "author" : "delivery");
}

/** The IIFE backend a player with `inputs` loads through. */
export function itemPlayerIifeBackend(
	inputs: ItemPlayerLoadInputs,
	extra: {
		bundleType?: BundleType;
		debugEnabled?: () => boolean;
		instrumentationProvider?: IifeBackendConfig["instrumentationProvider"];
		onBundleRetryStatus?: (status: IifeBundleRetryStatus) => void;
	} = {},
): IifeBackendConfig {
	const bundleType = extra.bundleType ?? itemPlayerBundleType(inputs);
	return {
		kind: "iife",
		bundleHost: backendOptions(inputs.loaderOptions).bundleHost || DEFAULT_BUNDLE_HOST,
		bundleType,
		// A hosted player's server runs the controllers.
		needsControllers: bundleType !== BundleType.player,
		debugEnabled: extra.debugEnabled,
		bundleRetry: inputs.loaderConfig?.iifeBundleRetry,
		trackPageActions: inputs.loaderConfig?.trackPageActions,
		instrumentationProvider: extra.instrumentationProvider ?? defaultInstrumentation(inputs),
		onBundleRetryStatus: extra.onBundleRetryStatus,
	};
}

/** The ESM backend a player with `inputs` loads through. */
export function itemPlayerEsmBackend(
	inputs: ItemPlayerLoadInputs,
	extra: {
		view?: string;
		instrumentationProvider?: EsmBackendConfig["instrumentationProvider"];
	} = {},
): EsmBackendConfig {
	const options = backendOptions(inputs.loaderOptions);
	return {
		kind: "esm",
		cdnBaseUrl: options.esmCdnUrl || DEFAULT_ESM_CDN_URL,
		cdnProvider: options.esmCdnProvider,
		moduleResolution: options.moduleResolution === "import-map" ? "import-map" : "url",
		view: extra.view || itemPlayerEsmView(inputs),
		loadControllers: resolveLoadControllers({
			loadControllers: options.loadControllers,
			author: inputs.mode === "author",
			hosted: inputs.hosted === true,
		}),
		trackPageActions: inputs.loaderConfig?.trackPageActions,
		instrumentationProvider: extra.instrumentationProvider ?? defaultInstrumentation(inputs),
	};
}

function defaultInstrumentation(inputs: ItemPlayerLoadInputs) {
	return resolveInstrumentationProvider({
		player: { loaderConfig: inputs.loaderConfig },
		component: "pie-item-player",
	});
}

/** The editor bundle registers each element's editor under `<tag>-config`. */
export function itemPlayerIifeElements(elements: ElementMap, bundleType: BundleType): ElementMap {
	if (bundleType !== BundleType.editor) return elements;
	return Object.fromEntries(
		Object.entries(elements).map(([tagName, packageSpec]) => [`${tagName}-config`, packageSpec]),
	);
}

function contentsOf(config: ItemConfig): PieContent[] {
	if ("pie" in config) return config.passage ? [config.pie, config.passage] : [config.pie];
	return [config];
}

/**
 * Registers the elements of every item in `configs` in one aggregated load, through the backend
 * that item players with `inputs` load through, so the players that mount next find their elements
 * defined. One IIFE bundle serves the whole set. Under `preloaded` it does nothing: the host
 * registered the elements and each player asserts them. Rejects when the load fails; a player then
 * reports its own load failure.
 */
export async function preloadItemElements(
	configs: readonly ItemConfig[],
	inputs: ItemPlayerLoadInputs = {},
): Promise<void> {
	const strategy = inputs.strategy ?? "iife";
	if (strategy === "preloaded") return;
	const entities = configs.flatMap(contentsOf).map((config) => ({ config }) as ItemEntity);
	const elements = aggregateElements(entities);
	if (Object.keys(elements).length === 0) return;
	const elementPackagePolicy = inputs.loaderOptions?.elementPackagePolicy;
	if (strategy === "esm") {
		const view = itemPlayerEsmView(inputs);
		await ensureRegistered(mapEsmViewElements(elements, view), {
			backend: itemPlayerEsmBackend(inputs, { view }),
			elementPackagePolicy,
		});
		return;
	}
	const options = backendOptions(inputs.loaderOptions);
	// IIFE bundles read the math renderer as they evaluate.
	await ensureItemPlayerMathRenderingReady({
		assetRoot: resolveEsmAssetRoot({
			cdnBaseUrl: options.esmCdnUrl || DEFAULT_ESM_CDN_URL,
			cdnProvider: options.esmCdnProvider,
		}),
	});
	const bundleType = itemPlayerBundleType(inputs);
	await ensureRegistered(itemPlayerIifeElements(elements, bundleType), {
		backend: itemPlayerIifeBackend(inputs, { bundleType }),
		elementPackagePolicy,
	});
}
