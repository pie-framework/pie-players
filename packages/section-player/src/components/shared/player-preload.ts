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
	assertPieConfigContract,
	BundleType,
	type ElementMap,
	ensureRegistered,
	type EsmBackendConfig,
	type IifeBackendConfig,
	type ItemEntity,
	createPieLogger,
	isGlobalDebugEnabled,
	validatePieConfigContract,
} from "@pie-players/pie-players-shared";
import { ensureItemPlayerMathRenderingReady } from "@pie-players/pie-item-player";

export type ElementPreloadRetryDetail = {
	componentTag: string;
	stage: string;
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
	stage: string;
	error: string;
	strategy: string;
	bundleType: string | null;
	bundleHost: string;
	renderablesCount: number;
};

export function getPreloadLogger(componentTag: string) {
	return createPieLogger(componentTag, () => isGlobalDebugEnabled());
}

export function getLoaderView(
	env: Record<string, unknown>,
): "author" | "delivery" {
	return env?.mode === "author" ? "author" : "delivery";
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
		const maybeWarnings = (result as unknown as { warnings?: unknown }).warnings;
		const warnings = Array.isArray(maybeWarnings)
			? maybeWarnings.filter((entry): entry is string => typeof entry === "string")
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
 */
export function buildBackendConfigFromProps(args: {
	strategy: string;
	resolvedPlayerProps: Record<string, unknown>;
	resolvedPlayerEnv: Record<string, unknown>;
	iifeBundleHost?: string | null;
}): IifeBackendConfig | EsmBackendConfig {
	const loaderOptions = args.resolvedPlayerProps?.loaderOptions as
		| Record<string, unknown>
		| undefined;

	if (args.strategy === "esm") {
		return {
			kind: "esm",
			cdnBaseUrl: String(loaderOptions?.esmCdnUrl || "https://cdn.jsdelivr.net/npm"),
			moduleResolution:
				loaderOptions?.moduleResolution === "import-map" ? "import-map" : "url",
			view: getLoaderView(args.resolvedPlayerEnv),
			loadControllers: true,
		};
	}

	const bundleHost = String(
		loaderOptions?.bundleHost || args.iifeBundleHost || "",
	).trim();
	if (!bundleHost) {
		throw new Error("Missing iifeBundleHost for element preloading");
	}

	const mode = String((args.resolvedPlayerProps?.mode as string) || "").toLowerCase();
	const bundleType: BundleType =
		mode === "author"
			? BundleType.editor
			: args.resolvedPlayerProps?.hosted === true
				? BundleType.player
				: BundleType.clientPlayer;

	return {
		kind: "iife",
		bundleHost,
		bundleType,
		needsControllers: true,
	};
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
 * - `strategy === "preloaded"` — no-op. Host pre-registers elements
 *   out-of-band; per-item assertion happens in `PieItemPlayer`.
 * - `renderables.length === 0` — no-op. Nothing to load.
 * - Otherwise: aggregate tags, build backend, await `ensureRegistered`.
 *
 * On any validation or load failure, rejects with a descriptive Error.
 * The caller (section-player widget) is expected to surface the failure
 * through an `element-preload-error` event; item-players then attempt
 * their own registration and typically get a clean per-tag error.
 */
export async function warmupSectionElements(args: {
	strategy: string;
	renderables: ItemEntity[];
	resolvedPlayerProps: Record<string, unknown>;
	resolvedPlayerEnv: Record<string, unknown>;
	iifeBundleHost?: string | null;
	logger?: ReturnType<typeof createPieLogger>;
}): Promise<void> {
	const logger = args.logger ?? getPreloadLogger("pie-section-player-items-pane");

	validateRenderableConfigContracts(args.renderables);
	logRenderableConfigWarnings(args.renderables, logger);

	if (args.strategy === "preloaded") return;
	if (args.renderables.length === 0) return;

	const elements: ElementMap = aggregateElements(args.renderables);
	const backend = buildBackendConfigFromProps({
		strategy: args.strategy,
		resolvedPlayerProps: args.resolvedPlayerProps,
		resolvedPlayerEnv: args.resolvedPlayerEnv,
		iifeBundleHost: args.iifeBundleHost,
	});

	await ensureItemPlayerMathRenderingReady();
	await ensureRegistered(elements, { backend });
}
