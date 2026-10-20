/**
 * Section-player element warmup pipeline.
 *
 * `ElementLoader` in `players-shared` owns element registration and dedupes
 * concurrent identical requests. This module:
 *
 *   1. Validates the PIE config contract for every renderable.
 *   2. Translates the host's player props into the item players' load
 *      inputs, so the pre-warm loads what they load.
 *   3. Pre-warms the aggregate element set with `preloadItemElements`, or
 *      asserts its registration under `strategy="preloaded"`.
 *
 * It also shapes the `element-preload-retry` and `element-preload-error`
 * telemetry details.
 */

import {
	aggregateElements,
	alignPreloadedElementVersions,
	assertElementPackagesAllowed,
	assertPieConfigContract,
	assertRegistered,
	defineAuthoredPreloadedTags,
	type ElementMap,
	type EsmBackendConfig,
	type IifeBackendConfig,
	type IifeBundleRetryStatus,
	type ItemEntity,
	type LoaderConfig,
	createPieLogger,
	isGlobalDebugEnabled,
	resolveInstrumentationProvider,
	validatePieConfigContract,
} from "@pie-players/pie-players-shared";
import type { ItemConfig } from "@pie-players/pie-players-shared/types";
import {
	type ItemElementLoadOptions,
	type ItemPlayerLoadInputs,
	itemPlayerBackend,
	itemPlayerElementTags,
	preloadItemElements,
} from "@pie-players/pie-item-player";

export type IifeBundleRetryStatusHandler = (
	status: IifeBundleRetryStatus,
) => void;

/**
 * Narrow string union of section-preload pipeline stages reported on
 * `element-preload-retry` and `element-preload-error` events. Hosts use
 * this to disambiguate "the renderable's PIE config is invalid" from
 * "the IIFE bundle won't load" from "the ESM module won't import" from
 * "the host claimed strategy='preloaded' but didn't pre-register".
 */
export type PreloadStage =
	| "validate-config"
	| "iife-load"
	| "esm-load"
	| "preloaded-assert";

export type ElementPreloadRetryDetail = {
	componentTag: string;
	stage: PreloadStage;
	attempt: number;
	maxRetries: number;
	error: string;
	strategy: string;
	bundleType: string | null;
	bundleHost: string;
	renderablesCount: number;
};

export type ElementPreloadErrorDetail = {
	componentTag: string;
	stage: PreloadStage;
	error: string;
	strategy: string;
	bundleType: string | null;
	bundleHost: string;
	renderablesCount: number;
};

/**
 * Carries which stage of `warmupSectionElements` rejected, so the
 * `SectionItemsPane.svelte` `usePromise` rejection effect can surface
 * the right `stage` on the host's `element-preload-error` event.
 *
 * Catastrophic adapter rejections (network freeze, bundle timeout) bubble
 * up through `ensureRegistered` as `ElementLoaderError` and get wrapped
 * in `PreloadStageError` with stage `"iife-load"` or `"esm-load"`
 * depending on the requested strategy. Config-contract failures wrap
 * with stage `"validate-config"`.
 */
export class PreloadStageError extends Error {
	override readonly name = "PreloadStageError";
	readonly stage: PreloadStage;
	override readonly cause: unknown;

	constructor(stage: PreloadStage, cause: unknown) {
		super(toErrorMessage(cause));
		this.stage = stage;
		this.cause = cause;
	}
}

export function getPreloadLogger(componentTag: string) {
	return createPieLogger(componentTag, () => isGlobalDebugEnabled());
}

/**
 * Stable string signature of a list of renderables: id, version and element
 * set of each entry's `entity`. The layout composition snapshot carries it,
 * and the kernel matches the items pane's warmup report against it, so a
 * report counts only for the composition it was made for.
 */
export function getRenderablesSignature(renderables: unknown[]): string {
	const createElementsSignature = (entity: Record<string, unknown>): string => {
		const elements =
			(entity.config as Record<string, unknown> | undefined)?.elements || {};
		if (!elements || typeof elements !== "object") return "";
		return Object.entries(elements as Record<string, unknown>)
			.filter(
				([tagName, packageVersion]) =>
					typeof tagName === "string" &&
					tagName.trim().length > 0 &&
					typeof packageVersion === "string" &&
					packageVersion.trim().length > 0,
			)
			.sort(([tagA], [tagB]) => tagA.localeCompare(tagB))
			.map(([tagName, packageVersion]) => `${tagName}=${packageVersion}`)
			.join(",");
	};

	return renderables
		.map((entry, index) => {
			const entity = ((entry as { entity?: unknown })?.entity || {}) as Record<
				string,
				unknown
			>;
			const entityId =
				(typeof entity.id === "string" && entity.id) || `renderable-${index}`;
			const entityVersion =
				(typeof entity.version === "string" && entity.version) ||
				(typeof entity.version === "number" ? String(entity.version) : "") ||
				(typeof (entity.config as Record<string, unknown> | undefined)
					?.version === "string"
					? ((entity.config as Record<string, unknown>).version as string)
					: "");
			return `${entityId}:${entityVersion}:${createElementsSignature(entity)}`;
		})
		.join("|");
}

export function formatElementLoadError(stage: string, error: unknown): string {
	return `Error loading elements (${stage}): ${toErrorMessage(error)}`;
}

export function toErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

function renderableLabel(renderable: ItemEntity, index: number): string {
	const id = renderable?.id;
	return typeof id === "string" ? id : `renderable-${index}`;
}

function validateRenderableConfigContracts(renderables: ItemEntity[]): void {
	for (const [index, renderable] of renderables.entries()) {
		try {
			assertPieConfigContract(renderable?.config);
		} catch (error) {
			const message = toErrorMessage(error);
			throw new Error(`${renderableLabel(renderable, index)}: ${message}`);
		}
	}
}

function logRenderableConfigWarnings(
	renderables: ItemEntity[],
	logger: ReturnType<typeof createPieLogger>,
): void {
	for (const [index, renderable] of renderables.entries()) {
		const id = renderableLabel(renderable, index);
		const { warnings } = validatePieConfigContract(renderable?.config);
		for (const warning of warnings) {
			logger.warn(
				formatElementLoadError("validate-config", `${id}: ${warning}`),
			);
		}
	}
}

/**
 * The load inputs of the section's item players. Their `mode`, `hosted`,
 * `loaderOptions` and `loaderConfig` come from the same resolved props, so the
 * pre-warm loads the bundle, view and tags the players then find registered.
 */
function itemLoadInputs(
	strategy: string,
	props: Record<string, unknown>,
): ItemPlayerLoadInputs {
	return {
		strategy:
			strategy === "esm" || strategy === "preloaded" ? strategy : "iife",
		loaderOptions: props?.loaderOptions as ItemPlayerLoadInputs["loaderOptions"],
		loaderConfig: props?.loaderConfig as LoaderConfig | undefined,
		mode: props?.mode === "author" ? "author" : "view",
		hosted: props?.hosted === true,
	};
}

function sectionLoadOptions(
	props: Record<string, unknown>,
	onBundleRetryStatus?: IifeBundleRetryStatusHandler,
): ItemElementLoadOptions {
	return {
		instrumentationProvider: resolveInstrumentationProvider({
			player: { loaderConfig: props?.loaderConfig as LoaderConfig | undefined },
			component: "pie-section-player",
		}),
		onBundleRetryStatus,
	};
}

/**
 * The backend the section's pre-warm loads through, for telemetry; `null`
 * under `strategy="preloaded"`.
 */
export function buildBackendConfigFromProps(args: {
	strategy: string;
	resolvedPlayerProps: Record<string, unknown>;
}): IifeBackendConfig | EsmBackendConfig | null {
	return itemPlayerBackend(
		itemLoadInputs(args.strategy, args.resolvedPlayerProps),
		sectionLoadOptions(args.resolvedPlayerProps),
	);
}

/**
 * Returns the bundle type (IIFE) or `null` (ESM, preloaded, empty) that
 * should be reported on `element-preload-error` events. Host telemetry
 * needs this as a string to distinguish editor bundles from player bundles.
 */
export function describeBundleType(
	backend: IifeBackendConfig | EsmBackendConfig | null,
): string | null {
	if (!backend || backend.kind !== "iife") return null;
	return backend.bundleType ? String(backend.bundleType) : null;
}

/**
 * Return the bundle host (IIFE only) for telemetry. Empty string for any
 * other backend so the host event shape stays stable.
 */
export function describeBundleHost(
	backend: IifeBackendConfig | EsmBackendConfig | null,
): string {
	if (!backend || backend.kind !== "iife") return "";
	return backend.bundleHost;
}

/**
 * Pre-warm the aggregate element set for a section before items mount.
 *
 * Contract:
 * - `renderables.length === 0` — no-op. Nothing to load.
 * - `strategy === "preloaded"` — align each renderable's authored versions
 *   to the page's registrations (`alignPreloadedElementVersions`, as the
 *   item player does), define each authored tag of a package registered
 *   under another base tag (`defineAuthoredPreloadedTags`), then assert
 *   every aggregate tag is registered with `customElements`. Throws
 *   `ElementAssertionError` (wrapped in `PreloadStageError` with stage
 *   `"preloaded-assert"`) on any missing tag, surfacing one section-level
 *   diagnostic instead of N small per-item rejections.
 * - Otherwise: `preloadItemElements` with the item players' load inputs.
 *
 * On any validation or load failure, rejects with a descriptive Error.
 * The caller (`SectionItemsPane`) keeps the items unmounted, reports an
 * `element-preload` framework error and dispatches `element-preload-error`.
 */
export async function warmupSectionElements(args: {
	strategy: string;
	renderables: ItemEntity[];
	resolvedPlayerProps: Record<string, unknown>;
	logger?: ReturnType<typeof createPieLogger>;
	onBundleRetryStatus?: IifeBundleRetryStatusHandler;
}): Promise<void> {
	const logger =
		args.logger ?? getPreloadLogger("pie-section-player-items-pane");

	try {
		validateRenderableConfigContracts(args.renderables);
		logRenderableConfigWarnings(args.renderables, logger);
	} catch (error) {
		throw new PreloadStageError("validate-config", error);
	}

	if (args.renderables.length === 0) return;

	const inputs = itemLoadInputs(args.strategy, args.resolvedPlayerProps);

	if (inputs.strategy === "preloaded") {
		try {
			const elements: ElementMap = aggregateElements(
				args.renderables.map(alignRenderableVersions),
			);
			assertElementPackagesAllowed(
				elements,
				inputs.loaderOptions?.elementPackagePolicy,
			);
			const expected = itemPlayerElementTags(elements, inputs);
			defineAuthoredPreloadedTags(expected);
			assertRegistered(expected);
		} catch (error) {
			throw new PreloadStageError("preloaded-assert", error);
		}
		return;
	}

	try {
		await preloadItemElements(
			// Their PIE config contract held above.
			args.renderables.map((renderable) => renderable.config as ItemConfig),
			inputs,
			sectionLoadOptions(args.resolvedPlayerProps, args.onBundleRetryStatus),
		);
	} catch (error) {
		throw new PreloadStageError(
			inputs.strategy === "esm" ? "esm-load" : "iife-load",
			error,
		);
	}
}

function alignRenderableVersions(renderable: ItemEntity): ItemEntity {
	const config = renderable?.config;
	if (!config) return renderable;
	const aligned = alignPreloadedElementVersions(config);
	return aligned === config ? renderable : { ...renderable, config: aligned };
}
