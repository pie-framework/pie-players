import {
	assertPieConfigContract,
	BundleType,
	EsmElementLoader,
	IifeElementLoader,
	type ItemEntity,
	createPieLogger,
	isGlobalDebugEnabled,
	validatePieConfigContract,
} from "@pie-players/pie-players-shared";
import { ensureItemPlayerMathRenderingReady } from "@pie-players/pie-item-player";

export const PRELOAD_TIMEOUT_MS = 15000;
export const PRELOAD_RETRY_COUNT = 1;
export const PRELOAD_RETRY_DELAY_MS = 300;

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

function getPreloadLogger(componentTag: string) {
	return createPieLogger(componentTag, () => isGlobalDebugEnabled());
}

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

export function getLoaderView(
	env: Record<string, unknown>,
): "author" | "delivery" {
	return env?.mode === "author" ? "author" : "delivery";
}

export function buildPreloadSignature(args: {
	strategy: string;
	iifeBundleType: BundleType | null;
	loaderView: string;
	esmCdnUrl: string;
	moduleResolution: "url" | "import-map";
	bundleHost: string;
	renderablesSignature: string;
}) {
	return [
		args.strategy,
		args.strategy === "iife" ? String(args.iifeBundleType || "") : "",
		args.loaderView,
		args.strategy === "esm"
			? `${args.esmCdnUrl}|${args.moduleResolution}`
			: args.bundleHost,
		args.renderablesSignature,
	].join("|");
}

function waitForRetryDelay(delayMs: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

function toErrorMessage(error: unknown): string {
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

export function formatElementLoadError(stage: string, error: unknown): string {
	return `Error loading elements (${stage}): ${toErrorMessage(error)}`;
}

export async function preloadPlayerElements(args: {
	strategy: string;
	renderables: ItemEntity[];
	iifeBundleType: BundleType | null;
	loaderView: "author" | "delivery";
	esmCdnUrl: string;
	moduleResolution: "url" | "import-map";
	bundleHost: string;
	onTimeout: () => void;
	timeoutMs?: number;
}): Promise<void> {
	if (args.renderables.length === 0 || args.strategy === "preloaded") {
		return;
	}
	let loader: IifeElementLoader | EsmElementLoader | null = null;
	if (args.strategy === "esm") {
		loader = new EsmElementLoader({
			esmCdnUrl: args.esmCdnUrl,
			moduleResolution: args.moduleResolution,
			debugEnabled: () => false,
		} as any);
	} else {
		if (!args.bundleHost) {
			throw new Error("Missing iife bundleHost");
		}
		loader = new IifeElementLoader({
			bundleHost: args.bundleHost,
			debugEnabled: () => false,
		});
	}
	const timeoutHandle = window.setTimeout(
		() => args.onTimeout(),
		args.timeoutMs || PRELOAD_TIMEOUT_MS,
	);
	try {
		await ensureItemPlayerMathRenderingReady();
		await loader.loadFromItems(args.renderables, {
			view: args.loaderView,
			needsControllers: true,
			bundleType: args.iifeBundleType || undefined,
		});
	} finally {
		window.clearTimeout(timeoutHandle);
	}
}

export async function preloadPlayerElementsWithRetry(args: {
	componentTag: string;
	strategy: string;
	renderables: ItemEntity[];
	iifeBundleType: BundleType | null;
	loaderView: "author" | "delivery";
	esmCdnUrl: string;
	moduleResolution: "url" | "import-map";
	bundleHost: string;
	timeoutMs?: number;
	retryCount?: number;
	retryDelayMs?: number;
	logger: ReturnType<typeof createPieLogger>;
	onRetry?: (detail: ElementPreloadRetryDetail) => void;
	onFinalError?: (detail: ElementPreloadErrorDetail) => void;
	loadOnce?: (args: {
		strategy: string;
		renderables: ItemEntity[];
		iifeBundleType: BundleType | null;
		loaderView: "author" | "delivery";
		esmCdnUrl: string;
		moduleResolution: "url" | "import-map";
		bundleHost: string;
		onTimeout: () => void;
		timeoutMs?: number;
	}) => Promise<void>;
}): Promise<void> {
	const maxRetries = Math.max(0, Math.floor(args.retryCount ?? PRELOAD_RETRY_COUNT));
	const retryDelayMs = Math.max(
		0,
		Math.floor(args.retryDelayMs ?? PRELOAD_RETRY_DELAY_MS),
	);
	const loadOnce = args.loadOnce || preloadPlayerElements;
	let lastError: unknown = null;
	for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
		const stage = attempt === 0 ? "iife-load" : "iife-load-retry";
		try {
			await loadOnce({
				strategy: args.strategy,
				renderables: args.renderables,
				iifeBundleType: args.iifeBundleType,
				loaderView: args.loaderView,
				esmCdnUrl: args.esmCdnUrl,
				moduleResolution: args.moduleResolution,
				bundleHost: args.bundleHost,
				timeoutMs: args.timeoutMs,
				onTimeout: () => {
					args.logger.warn(
						formatElementLoadError(
							"iife-load-timeout",
							new Error(`Element preloading exceeded ${args.timeoutMs || PRELOAD_TIMEOUT_MS}ms`),
						),
					);
				},
			});
			return;
		} catch (error) {
			lastError = error;
			const formattedError = formatElementLoadError(stage, error);
			if (attempt >= maxRetries) {
				args.onFinalError?.({
					stage,
					componentTag: args.componentTag,
					error: toErrorMessage(error),
					strategy: args.strategy,
					bundleType: args.iifeBundleType ? String(args.iifeBundleType) : null,
					bundleHost: args.bundleHost,
					renderablesCount: args.renderables.length,
				});
				throw new Error(formattedError);
			}
			args.onRetry?.({
				stage,
				componentTag: args.componentTag,
				attempt: attempt + 1,
				maxRetries,
				error: toErrorMessage(error),
				strategy: args.strategy,
				bundleType: args.iifeBundleType ? String(args.iifeBundleType) : null,
				bundleHost: args.bundleHost,
				renderablesCount: args.renderables.length,
			});
			args.logger.warn(
				`${formattedError} Retrying (${attempt + 1}/${maxRetries})...`,
			);
			if (retryDelayMs > 0) {
				await waitForRetryDelay(retryDelayMs);
			}
		}
	}
	throw new Error(formatElementLoadError("iife-load", lastError));
}

export type PlayerPreloadState = {
	lastPreloadSignature: string;
	preloadRunToken: number;
	elementsLoaded: boolean;
};

export function createPlayerPreloadStateSetter(args: {
	setLastPreloadSignature: (value: string) => void;
	setPreloadRunToken: (value: number) => void;
	setElementsLoaded: (value: boolean) => void;
}) {
	return (next: Partial<PlayerPreloadState>) => {
		if (next.lastPreloadSignature !== undefined) {
			args.setLastPreloadSignature(next.lastPreloadSignature);
		}
		if (next.preloadRunToken !== undefined) {
			args.setPreloadRunToken(next.preloadRunToken);
		}
		if (next.elementsLoaded !== undefined) {
			args.setElementsLoaded(next.elementsLoaded);
		}
	};
}

export function orchestratePlayerElementPreload(args: {
	componentTag: string;
	strategy: string;
	renderables: ItemEntity[];
	renderablesSignature: string;
	resolvedPlayerProps: Record<string, unknown>;
	resolvedPlayerEnv: Record<string, unknown>;
	iifeBundleHost?: string | null;
	getState: () => PlayerPreloadState;
	setState: (next: Partial<PlayerPreloadState>) => void;
	onPreloadRetry?: (detail: ElementPreloadRetryDetail) => void;
	onPreloadError?: (detail: ElementPreloadErrorDetail) => void;
}) {
	const logger = getPreloadLogger(args.componentTag);
	const esmCdnUrl = String(
		(args.resolvedPlayerProps?.loaderOptions as Record<string, unknown> | undefined)
			?.esmCdnUrl || "https://cdn.jsdelivr.net/npm",
	);
	const bundleHost = String(
		(args.resolvedPlayerProps?.loaderOptions as Record<string, unknown> | undefined)
			?.bundleHost ||
			args.iifeBundleHost ||
			"",
	).trim();
	const moduleResolution =
		(args.resolvedPlayerProps?.loaderOptions as Record<string, unknown> | undefined)
			?.moduleResolution === "import-map"
			? "import-map"
			: "url";
	const preloadRetryCount = Number(
		(args.resolvedPlayerProps?.loaderOptions as Record<string, unknown> | undefined)
			?.preloadRetryCount ?? PRELOAD_RETRY_COUNT,
	);
	const preloadRetryDelayMs = Number(
		(args.resolvedPlayerProps?.loaderOptions as Record<string, unknown> | undefined)
			?.preloadRetryDelayMs ?? PRELOAD_RETRY_DELAY_MS,
	);
	const loaderView = getLoaderView(args.resolvedPlayerEnv);
	const iifeBundleType = (() => {
		if (args.strategy !== "iife") return null;
		const mode = String((args.resolvedPlayerProps?.mode as string) || "").toLowerCase();
		if (mode === "author") return BundleType.editor;
		return args.resolvedPlayerProps?.hosted === true
			? BundleType.player
			: BundleType.clientPlayer;
	})();
	const preloadSignature = buildPreloadSignature({
		strategy: args.strategy,
		iifeBundleType,
		loaderView,
		esmCdnUrl,
		moduleResolution,
		bundleHost,
		renderablesSignature: args.renderablesSignature,
	});
	const currentState = args.getState();
	if (preloadSignature === currentState.lastPreloadSignature) {
		return;
	}
	args.setState({ lastPreloadSignature: preloadSignature });
	if (args.renderables.length === 0) {
		args.setState({ elementsLoaded: true });
		return;
	}

	const runToken = currentState.preloadRunToken + 1;
	args.setState({
		preloadRunToken: runToken,
		elementsLoaded: false,
	});
	try {
		validateRenderableConfigContracts(args.renderables);
		logRenderableConfigWarnings(args.renderables, logger);
	} catch (error) {
		const formattedError = formatElementLoadError("validate-config", error);
		args.onPreloadError?.({
			componentTag: args.componentTag,
			stage: "validate-config",
			error: toErrorMessage(error),
			strategy: args.strategy,
			bundleType: iifeBundleType ? String(iifeBundleType) : null,
			bundleHost,
			renderablesCount: args.renderables.length,
		});
		logger.error(formattedError);
		return;
	}
	if (args.strategy === "preloaded") {
		args.setState({ elementsLoaded: true });
		return;
	}
	if (args.strategy !== "esm" && !bundleHost) {
		const error = new Error("Missing iifeBundleHost for element preloading");
		args.onPreloadError?.({
			componentTag: args.componentTag,
			stage: "iife-load",
			error: toErrorMessage(error),
			strategy: args.strategy,
			bundleType: iifeBundleType ? String(iifeBundleType) : null,
			bundleHost,
			renderablesCount: args.renderables.length,
		});
		logger.error(formatElementLoadError("iife-load", error));
		return;
	}
	void preloadPlayerElementsWithRetry({
		componentTag: args.componentTag,
		strategy: args.strategy,
		renderables: args.renderables,
		iifeBundleType,
		loaderView,
		esmCdnUrl,
		moduleResolution,
		bundleHost,
		logger,
		retryCount: Number.isFinite(preloadRetryCount)
			? preloadRetryCount
			: PRELOAD_RETRY_COUNT,
		retryDelayMs: Number.isFinite(preloadRetryDelayMs)
			? preloadRetryDelayMs
			: PRELOAD_RETRY_DELAY_MS,
		onRetry: args.onPreloadRetry,
		onFinalError: args.onPreloadError,
	})
		.then(() => {
			if (runToken === args.getState().preloadRunToken) {
				args.setState({ elementsLoaded: true });
			}
		})
		.catch((error) => {
			logger.error(
				error instanceof Error
					? error.message
					: formatElementLoadError("iife-load", error),
			);
		});
}
