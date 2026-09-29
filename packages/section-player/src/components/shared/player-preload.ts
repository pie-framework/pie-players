/**
 * Section-player element warmup pipeline.
 *
 * This module is the functional pipeline that replaced the old stateful
 * orchestrator. The previous implementation carried three pieces of
 * reactive state (`elementsLoaded`, `preloadRunToken`, `lastPreloadSignature`)
 * inside `SectionItemsPane.svelte` and a second state machine here
 * (`PlayerPreloadState`, `createPlayerPreloadStateSetter`). The combination
 * produced the sporadic "missing tags" section-swap race: when the host
 * swapped sections under a live pane, the template re-rendered with new
 * items while a cached `elementsLoaded = true` was still in scope, so items
 * mounted with a false pre-registration claim.
 *
 * The deep `ElementLoader` primitive in `players-shared` now owns
 * registration truth end-to-end. The section-player's remaining job is
 * narrowly:
 *
 *   1. Validate the PIE config contract for every renderable.
 *   2. Translate the host's player props into an ElementLoader backend
 *      config (IIFE or ESM).
 *   3. Hand the aggregated elements to `ensureRegistered` for pre-warming.
 *
 * No retries, no signatures, no tokens. The primitive deduplicates
 * concurrent identical requests by itself, so the old retry + signature
 * bookkeeping has no role to play here.
 */

import {
	aggregateElements,
	alignPreloadedElementVersions,
	assertElementPackagesAllowed,
	assertPieConfigContract,
	assertRegistered,
	BundleType,
	defineAuthoredPreloadedTags,
	type ElementMap,
	type ElementPackagePolicy,
	ensureRegistered,
	type EsmBackendConfig,
	type EsmCdnProvider,
	type IifeBackendConfig,
	type IifeBundleRetryStatus,
	type ItemEntity,
	type LoaderConfig,
	createPieLogger,
	DEFAULT_ESM_CDN_URL,
	isGlobalDebugEnabled,
	resolveInstrumentationProvider,
	resolveLoadControllers,
	toViewTag,
	validatePieConfigContract,
} from "@pie-players/pie-players-shared";
import { ensureItemPlayerMathRenderingReady } from "@pie-players/pie-item-player";

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

function isAuthorMode(
	props: Record<string, unknown>,
	env: Record<string, unknown>,
): boolean {
	return (
		String(props?.mode ?? "").toLowerCase() === "author" ||
		env?.mode === "author"
	);
}

/** The element view the item players render, which pre-warm has to match. */
export function getLoaderView(
	props: Record<string, unknown>,
	env: Record<string, unknown>,
): string {
	const view = (props?.loaderOptions as { view?: unknown } | undefined)?.view;
	if (typeof view === "string" && view) return view;
	return isAuthorMode(props, env) ? "author" : "delivery";
}

/**
 * Stable string signature of a list of renderables, used as a react-key
 * hint for the composition snapshot plumbed through the layout tree.
 *
 * The signature is *not* used for preload dedup anymore — the deep
 * `ElementLoader` primitive handles that internally. It is retained only
 * because downstream template props still pass a string identifier
 * through the customElement boundary.
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

function validateRenderableConfigContracts(renderables: ItemEntity[]): void {
	for (const [index, renderable] of renderables.entries()) {
		try {
			assertPieConfigContract(renderable?.config);
		} catch (error) {
			const id =
				typeof (renderable as { id?: unknown })?.id === "string"
					? (renderable as { id: string }).id
					: `renderable-${index}`;
			const message = toErrorMessage(error);
			throw new Error(`${id}: ${message}`);
		}
	}
}

function logRenderableConfigWarnings(
	renderables: ItemEntity[],
	logger: ReturnType<typeof createPieLogger>,
): void {
	for (const [index, renderable] of renderables.entries()) {
		const id =
			typeof (renderable as { id?: unknown })?.id === "string"
				? (renderable as { id: string }).id
				: `renderable-${index}`;
		const result = validatePieConfigContract(renderable?.config);
		const maybeWarnings = (result as unknown as { warnings?: unknown })
			.warnings;
		const warnings = Array.isArray(maybeWarnings)
			? maybeWarnings.filter(
					(entry): entry is string => typeof entry === "string",
				)
			: [];
		for (const warning of warnings) {
			logger.warn(
				formatElementLoadError("validate-config", `${id}: ${warning}`),
			);
		}
	}
}

/**
 * Translate a section-player's resolved props into an `ElementLoader`
 * backend config. Throws when required host-supplied values (bundle host
 * for IIFE) are missing — callers should surface this as a preload error.
 *
 * `onBundleRetryStatus` is wired through to `IifeBackendConfig` for IIFE
 * strategy so hosts can render "bundle still building" UI while the
 * adapter polls the bundle service. ESM ignores it.
 */
export function buildBackendConfigFromProps(args: {
	strategy: string;
	resolvedPlayerProps: Record<string, unknown>;
	resolvedPlayerEnv: Record<string, unknown>;
	iifeBundleHost?: string | null;
	onBundleRetryStatus?: IifeBundleRetryStatusHandler;
}): IifeBackendConfig | EsmBackendConfig {
	const loaderOptions = args.resolvedPlayerProps?.loaderOptions as
		| Record<string, unknown>
		| undefined;
	// The item players read the same `loaderConfig`, so a pre-warm load reports
	// to the host's telemetry and retries as theirs do.
	const loaderConfig = args.resolvedPlayerProps?.loaderConfig as
		| LoaderConfig
		| undefined;
	const instrumentation = {
		trackPageActions: loaderConfig?.trackPageActions,
		instrumentationProvider: resolveInstrumentationProvider({
			player: { loaderConfig },
			component: "pie-section-player",
		}),
	};

	if (args.strategy === "esm") {
		const esmCdnProvider = readEsmCdnProvider(loaderOptions?.esmCdnProvider);
		const view = getLoaderView(
			args.resolvedPlayerProps,
			args.resolvedPlayerEnv,
		);
		return {
			kind: "esm",
			cdnBaseUrl: String(loaderOptions?.esmCdnUrl || DEFAULT_ESM_CDN_URL),
			cdnProvider: esmCdnProvider,
			moduleResolution:
				loaderOptions?.moduleResolution === "import-map" ? "import-map" : "url",
			view,
			loadControllers: resolveLoadControllers({
				loadControllers:
					typeof loaderOptions?.loadControllers === "boolean"
						? loaderOptions.loadControllers
						: undefined,
				author: isAuthorMode(args.resolvedPlayerProps, args.resolvedPlayerEnv),
				hosted: args.resolvedPlayerProps?.hosted === true,
			}),
			...instrumentation,
		};
	}

	const bundleHost = String(
		loaderOptions?.bundleHost || args.iifeBundleHost || "",
	).trim();
	if (!bundleHost) {
		throw new Error("Missing iifeBundleHost for element preloading");
	}

	const bundleType: BundleType = isAuthorMode(
		args.resolvedPlayerProps,
		args.resolvedPlayerEnv,
	)
		? BundleType.editor
		: args.resolvedPlayerProps?.hosted === true
			? BundleType.player
			: BundleType.clientPlayer;

	return {
		kind: "iife",
		bundleHost,
		bundleType,
		// A hosted player's server runs the controllers.
		needsControllers: bundleType !== BundleType.player,
		bundleRetry: loaderConfig?.iifeBundleRetry,
		onBundleRetryStatus: args.onBundleRetryStatus,
		...instrumentation,
	};
}

function readEsmCdnProvider(
	value: unknown,
): EsmBackendConfig["cdnProvider"] | undefined {
	if (typeof value === "string") return value;
	if (!value || typeof value !== "object") return undefined;
	const candidate = value as Partial<Record<keyof EsmCdnProvider, unknown>>;
	return typeof candidate.name === "string" &&
		typeof candidate.packageJsonUrl === "function" &&
		typeof candidate.browserViewUrl === "function" &&
		typeof candidate.browserControllerUrl === "function" &&
		typeof candidate.sharedDependencyUrl === "function"
		? (value as NonNullable<EsmBackendConfig["cdnProvider"]>)
		: undefined;
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
 * - Otherwise: aggregate tags, build backend, install the math renderer
 *   unless the strategy is ESM, await `ensureRegistered`.
 *
 * On any validation or load failure, rejects with a descriptive Error.
 * The caller (`SectionItemsPane`) keeps the items unmounted, reports an
 * `element-preload` framework error and dispatches `element-preload-error`.
 */
export async function warmupSectionElements(args: {
	strategy: string;
	renderables: ItemEntity[];
	resolvedPlayerProps: Record<string, unknown>;
	resolvedPlayerEnv: Record<string, unknown>;
	iifeBundleHost?: string | null;
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

	const elementPackagePolicy = (
		args.resolvedPlayerProps?.loaderOptions as
			| { elementPackagePolicy?: ElementPackagePolicy }
			| undefined
	)?.elementPackagePolicy;

	if (args.strategy === "preloaded") {
		try {
			const elements: ElementMap = aggregateElements(
				args.renderables.map(alignRenderableVersions),
			);
			assertElementPackagesAllowed(elements, elementPackagePolicy);
			const view = getLoaderView(
				args.resolvedPlayerProps,
				args.resolvedPlayerEnv,
			);
			// The author view registers each element's editor under `<tag>-config`.
			const expected: ElementMap =
				view === "author"
					? Object.fromEntries(
							Object.entries(elements).map(([tag, spec]) => [
								toViewTag(tag, "author"),
								spec,
							]),
						)
					: elements;
			defineAuthoredPreloadedTags(expected);
			assertRegistered(expected);
		} catch (error) {
			throw new PreloadStageError("preloaded-assert", error);
		}
		return;
	}

	const elements: ElementMap = aggregateElements(args.renderables);

	const backend = buildBackendConfigFromProps({
		strategy: args.strategy,
		resolvedPlayerProps: args.resolvedPlayerProps,
		resolvedPlayerEnv: args.resolvedPlayerEnv,
		iifeBundleHost: args.iifeBundleHost,
		onBundleRetryStatus: args.onBundleRetryStatus,
	});

	const loadStage: PreloadStage =
		args.strategy === "esm" ? "esm-load" : "iife-load";

	try {
		// IIFE bundles read the math renderer as they evaluate; ESM builds bring their own.
		if (args.strategy === "iife") {
			await ensureItemPlayerMathRenderingReady();
		}
		await ensureRegistered(elements, { backend, elementPackagePolicy });
	} catch (error) {
		throw new PreloadStageError(loadStage, error);
	}
}

function alignRenderableVersions(renderable: ItemEntity): ItemEntity {
	const config = renderable?.config;
	if (!config) return renderable;
	const aligned = alignPreloadedElementVersions(config);
	return aligned === config ? renderable : { ...renderable, config: aligned };
}
