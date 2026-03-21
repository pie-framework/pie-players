import {
	BundleType,
	EsmElementLoader,
	IifeElementLoader,
	type ItemEntity,
	createPieLogger,
	isGlobalDebugEnabled,
} from "@pie-players/pie-players-shared";
import { ensureItemPlayerMathRenderingReady } from "@pie-players/pie-item-player";

export const PRELOAD_TIMEOUT_MS = 15000;

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
	if (args.strategy === "preloaded") {
		args.setState({ elementsLoaded: true });
		return;
	}
	if (args.strategy !== "esm" && !bundleHost) {
		logger.warn(
			"Missing iifeBundleHost for element preloading; rendering without preload.",
		);
		args.setState({ elementsLoaded: true });
		return;
	}
	void preloadPlayerElements({
		strategy: args.strategy,
		renderables: args.renderables,
		iifeBundleType,
		loaderView,
		esmCdnUrl,
		moduleResolution,
		bundleHost,
		onTimeout: () => {
			if (runToken !== args.getState().preloadRunToken) return;
			logger.warn("Element preloading timed out; continuing render without preload.");
			args.setState({ elementsLoaded: true });
		},
	})
		.then(() => {
			if (runToken === args.getState().preloadRunToken) {
				args.setState({ elementsLoaded: true });
			}
		})
		.catch((error) => {
			logger.error("Failed to preload PIE elements:", error);
			if (runToken === args.getState().preloadRunToken) {
				args.setState({ elementsLoaded: true });
			}
		});
}
