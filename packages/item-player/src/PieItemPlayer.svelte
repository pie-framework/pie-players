<svelte:options
	customElement={{
		tag: "pie-item-player",
		shadow: "none",
		props: {
			config: { attribute: "config", type: "Object" },
			session: { attribute: "session", type: "Object" },
			env: { attribute: "env", type: "Object" },
			addCorrectResponse: { attribute: "add-correct-response", type: "Boolean" },
			showBottomBorder: { attribute: "show-bottom-border", type: "Boolean" },
			hosted: { attribute: "hosted", type: "Boolean" },
			debug: { attribute: "debug", type: "String" },
			customClassName: { attribute: "custom-class-name", type: "String" },
			containerClass: { attribute: "container-class", type: "String" },
			externalStyleUrls: { attribute: "external-style-urls", type: "String" },
			loaderConfig: { attribute: "loader-config", type: "Object" },
			strategy: { attribute: "strategy", type: "String" },
			skipElementLoading: { attribute: "skip-element-loading", type: "Boolean" },
			mode: { attribute: "mode", type: "String" },
			configuration: { attribute: "configuration", type: "Object" },
			loaderOptions: { type: "Object", reflect: false },
			ttsService: { type: "Object", reflect: false },
			toolCoordinator: { type: "Object", reflect: false },
			highlightCoordinator: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import type { ConfigEntity, Env, LoaderConfig } from "@pie-players/pie-players-shared";
	import {
		BundleType,
		createPieLogger,
		DEFAULT_BUNDLE_HOST,
		DEFAULT_LOADER_CONFIG,
		EsmPieLoader,
		hasResponseValue,
		IifePieLoader,
		ItemController,
		isGlobalDebugEnabled,
		makeUniqueTags,
		normalizeItemSessionContainer,
		normalizeItemPlayerStrategy,
		resolveItemPlayerView,
	} from "@pie-players/pie-players-shared";
	import { PieItemPlayer as PieItemRenderer, PieSpinner } from "@pie-players/pie-players-shared/components";
	import { tick, untrack } from "svelte";
	import "@pie-players/pie-theme/components.css";

	type ItemSession = {
		id: string;
		data: Array<{
			id: string;
			element: string;
			[key: string]: any;
		}>;
	};

	type UnifiedLoaderOptions = {
		bundleHost?: string;
		esmCdnUrl?: string;
		view?: string;
		loadControllers?: boolean;
	};

	let {
		config = null as any,
		session = { id: "", data: [] } as ItemSession,
		env = { mode: "gather", role: "student" } as Env,
		addCorrectResponse = false,
		showBottomBorder = false,
		hosted = false,
		debug = "" as string | boolean,
		customClassName = "",
		containerClass = "",
		externalStyleUrls = "",
		loaderConfig = DEFAULT_LOADER_CONFIG as LoaderConfig,
		strategy = "iife",
		skipElementLoading = false,
		mode = "view" as "view" | "author",
		configuration = {} as Record<string, any>,
		loaderOptions = {} as UnifiedLoaderOptions,
		ttsService = null as any,
		toolCoordinator = null as any,
		highlightCoordinator = null as any,
	} = $props();

	const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
	const normalizedStrategy = $derived(normalizeItemPlayerStrategy(strategy, "iife"));
	const resolvedMode = $derived(mode === "author" ? "author" : "view");
	const resolvedIifeBundleHost = $derived(
		loaderOptions?.bundleHost || DEFAULT_BUNDLE_HOST,
	);
	const resolvedEsmCdnUrl = $derived(loaderOptions?.esmCdnUrl || "https://esm.sh");

	const debugEnabled = $derived.by(() => {
		if (debug !== undefined && debug !== null) {
			const debugStr = String(debug);
			const debugValue = !(
				debugStr.toLowerCase() === "false" ||
				debugStr === "0" ||
				debugStr === ""
			);
			if (isBrowser) {
				try {
					(window as any).PIE_DEBUG = debugValue;
				} catch {}
			}
			return debugValue;
		}
		return isGlobalDebugEnabled();
	});

	const logger = createPieLogger("pie-item-player", () => debugEnabled);

	let loading = $state(true);
	let error: string | null = $state(null);
	let itemConfig: ConfigEntity | null = $state(null);
	let hostElement: HTMLElement | null = $state(null);
	let sessionController: ItemController | null = $state(null);
	let sessionControllerItemId = $state("pie-item-player");
	let sessionSignature = $state("");
	let sessionRevision = $state(0);

	function parseSessionProp(input: unknown): unknown {
		if (typeof input === "string") {
			try {
				return JSON.parse(input);
			} catch {
				return { id: "", data: [] };
			}
		}
		return input;
	}

	function ensureSessionController(itemId: string, initialSession: unknown): ItemController {
		if (!sessionController || sessionControllerItemId !== itemId) {
			sessionController = new ItemController({
				itemId,
				initialSession,
			});
			sessionControllerItemId = itemId;
			sessionSignature = JSON.stringify(sessionController.getSession());
		}
		return sessionController;
	}

	function syncControllerSession(
		controller: ItemController,
		input: unknown,
		options: { allowMetadataOverwrite: boolean },
	): boolean {
		const next = controller.setSession(input, {
			persist: false,
			allowMetadataOverwrite: options.allowMetadataOverwrite,
		});
		const nextSignature = JSON.stringify(next);
		if (nextSignature === sessionSignature) {
			return false;
		}
		sessionSignature = nextSignature;
		sessionRevision += 1;
		return true;
	}

	const rendererSession = $derived.by(() => {
		const _rev = sessionRevision;
		if (!sessionController) {
			return normalizeItemSessionContainer(parseSessionProp(session)).data;
		}
		return sessionController.getSession().data;
	});

	function stableHashBase36(input: string) {
		let h = 5381;
		for (let i = 0; i < input.length; i++) h = ((h << 5) + h) ^ input.charCodeAt(i);
		return (h >>> 0).toString(36);
	}

	const fallbackScopeClass = $derived.by(() => {
		if (customClassName) return customClassName;
		const hash = stableHashBase36("/packages/item-player/src/PieItemPlayer.svelte").slice(
			0,
			9,
		);
		return `pie-player-${hash}`;
	});
	const scopeClass = $derived((customClassName || fallbackScopeClass).trim());

	let lastProcessedConfig: any = null;
	let lastProcessedStrategy = "";
	let lastProcessedMode = "";
	let lastProcessedSkip = false;
	let isProcessing = false;

	async function loadConfig(currentConfig: any) {
		if (
			isProcessing ||
			(currentConfig === lastProcessedConfig &&
				normalizedStrategy === lastProcessedStrategy &&
				resolvedMode === lastProcessedMode &&
				skipElementLoading === lastProcessedSkip)
		) {
			return;
		}

		if (!currentConfig) {
			itemConfig = null;
			loading = true;
			return;
		}

		isProcessing = true;
		lastProcessedConfig = currentConfig;
		lastProcessedStrategy = normalizedStrategy;
		lastProcessedMode = resolvedMode;
		lastProcessedSkip = skipElementLoading;
		loading = true;
		error = null;

		let stage = "start";
		try {
			stage = "parse-config";
			const parsedConfig =
				typeof currentConfig === "string" ? JSON.parse(currentConfig) : currentConfig;

			stage = "validate-config";
			if (!parsedConfig.elements || !parsedConfig.models || !parsedConfig.markup) {
				throw new Error("Invalid config: must contain elements, models, and markup");
			}

			stage = "makeUniqueTags";
			const transformed = makeUniqueTags({ config: parsedConfig });
			const transformedConfig = transformed.config;

			if (skipElementLoading) {
				logger.debug(
					"[pie-item-player] Skipping element loading; host is responsible for preload.",
				);
			} else if (
				normalizedStrategy === "iife" ||
				normalizedStrategy === "preloaded"
			) {
				stage = "iife-load";
				const iifeLoader = new IifePieLoader({
					bundleHost: resolvedIifeBundleHost,
					debugEnabled: () => debugEnabled,
				});
				const bundleType =
					resolvedMode === "author"
						? BundleType.editor
						: hosted
							? BundleType.player
							: BundleType.clientPlayer;
				const needsControllers = bundleType !== BundleType.editor && !hosted;
				await iifeLoader.load(
					transformedConfig,
					document,
					bundleType,
					needsControllers,
				);
				const isEditorBundle = bundleType === BundleType.editor;
				const elements = Object.keys(transformedConfig.elements).map((el) => ({
					name: el,
					tag: isEditorBundle ? `${el}-config` : el,
				}));
				await iifeLoader.elementsHaveLoaded(elements);
			} else {
				stage = "esm-load";
				const esmLoader = new EsmPieLoader({
					cdnBaseUrl: resolvedEsmCdnUrl,
					debugEnabled: () => debugEnabled,
				});
				const view =
					loaderOptions?.view || resolveItemPlayerView(env?.mode, "delivery");
				await esmLoader.load(transformedConfig, document, {
					view,
					loadControllers: loaderOptions?.loadControllers ?? true,
				});
				const elements = Object.keys(transformedConfig.elements).map((el) => ({
					name: el,
					tag: view === "author" ? `${el}-config` : el,
				}));
				await esmLoader.elementsHaveLoaded(elements);
			}

			stage = "set-item-config";
			itemConfig = transformedConfig;
			loading = false;
			error = null;
		} catch (err: any) {
			const message = err?.message || String(err);
			error = `Error loading elements (${stage}): ${message}`;
			loading = false;
			logger.error("[pie-item-player] failed loading:", err);
		} finally {
			isProcessing = false;
		}
	}

	$effect(() => {
		const currentConfig = config;
		const _strategy = normalizedStrategy;
		const _mode = resolvedMode;
		const _skip = skipElementLoading;
		const _iifeHost = resolvedIifeBundleHost;
		const _esmCdn = resolvedEsmCdnUrl;
		queueMicrotask(() => {
			untrack(() => {
				loadConfig(currentConfig);
			});
		});
	});

	$effect(() => {
		const parsed = parseSessionProp(session);
		const controllerItemId = itemConfig?.id || "pie-item-player";
		const controller = ensureSessionController(controllerItemId, parsed);
		// Do not let metadata-only prop churn wipe user responses already in the controller.
		syncControllerSession(controller, parsed, { allowMetadataOverwrite: false });
	});

	const loadScopedExternalStyle = async (url: string) => {
		if (!isBrowser || !url || typeof url !== "string") return;
		if (document.querySelector(`style[data-pie-style="${url}"]`)) return;
		try {
			const response = await fetch(url);
			const cssText = await response.text();
			const scopedCss = cssText.replace(
				/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/g,
				`.pie-item-player.${scopeClass} $1$2`,
			);
			const style = document.createElement("style");
			style.setAttribute("data-pie-style", url);
			style.textContent = scopedCss;
			document.head.appendChild(style);
		} catch (err) {
			logger.error(`Failed to load external stylesheet: ${url}`, err);
		}
	};

	$effect(() => {
		if (!externalStyleUrls || typeof externalStyleUrls !== "string") return;
		const urls = externalStyleUrls.split(",").map((url) => url.trim());
		for (const url of urls) {
			if (url) loadScopedExternalStyle(url);
		}
	});

	$effect(() => {
		if (!itemConfig?.resources?.stylesheets) return;
		const stylesheets = itemConfig.resources.stylesheets;
		if (!Array.isArray(stylesheets)) return;
		for (const resource of stylesheets) {
			const url = resource?.url;
			if (url && typeof url === "string") {
				loadScopedExternalStyle(url);
			}
		}
	});

	$effect(() => {
		const cfg = itemConfig;
		if (showBottomBorder && env.mode === "evaluate" && cfg?.elements) {
			tick().then(() => {
				const elementTags = Object.keys(cfg.elements);
				for (const tag of elementTags) {
					const elements = document.querySelectorAll(tag);
					for (const el of elements) {
						if (el instanceof HTMLElement) {
							el.style.borderBottom = "1px solid #ddd";
							el.style.paddingBottom = "20px";
							el.style.marginBottom = "20px";
						}
					}
				}
			});
		}
	});

	const handlePlayerEvent = (event: CustomEvent) => {
		const newEvent = new CustomEvent(event.type, {
			detail: event.detail,
			bubbles: true,
			composed: true,
		});
		// Dispatch from the custom element host so direct listeners on <pie-item-player>
		// receive updates (item-demos attaches listeners on the element itself).
		hostElement?.dispatchEvent(newEvent);
		// Also dispatch on parent for compatibility with integrations that relied on this.
		hostElement?.parentElement?.dispatchEvent(newEvent);
	};

	const handleSessionChanged = (detail: unknown) => {
		const detailObj =
			detail && typeof detail === "object"
				? (detail as Record<string, unknown>)
				: null;
		// Ignore structural/heartbeat session events that do not carry actual session data.
		// Some PIE elements emit "session-changed" during model/session assignment with
		// metadata-only payloads, which can otherwise cause update loops.
		if (!detailObj) {
			return;
		}
		if (!("session" in detailObj) && !hasResponseValue(detailObj)) {
			return;
		}
		const controllerItemId = itemConfig?.id || "pie-item-player";
		const controller = ensureSessionController(controllerItemId, parseSessionProp(session));
		const beforeSignature = sessionSignature;
		const normalized = controller.updateFromEventDetail(detail, {
			persist: false,
			allowMetadataOverwrite: false,
		});
		const nextSignature = JSON.stringify(normalized);
		if (nextSignature === beforeSignature) {
			return;
		}
		sessionSignature = nextSignature;
		sessionRevision += 1;
		const forwardedDetail = { ...detailObj, session: normalized };
		handlePlayerEvent(new CustomEvent("session-changed", { detail: forwardedDetail }));
	};
</script>

<div class="pie-item-player {scopeClass}" bind:this={hostElement}>
	{#if error}
		<div
			class="pie-player-error"
			style="
				padding: 20px;
				margin: 20px;
				border: 2px solid #d32f2f;
				border-radius: 4px;
				background-color: #ffebee;
				color: #c62828;
				font-family: sans-serif;
			"
		>
			<h3 style="margin: 0 0 10px 0">Configuration Error</h3>
			<p style="margin: 0">{error}</p>
		</div>
	{:else if loading || !itemConfig}
		<PieSpinner />
	{:else}
		<div class="pie-player-item-container {containerClass}">
			<PieItemRenderer
				{itemConfig}
				env={typeof env === "string" ? JSON.parse(env) : env}
				session={rendererSession}
				{addCorrectResponse}
				customClassName={scopeClass}
				bundleType={resolvedMode === "author" ? BundleType.editor : BundleType.clientPlayer}
				{loaderConfig}
				mode={resolvedMode}
				configuration={typeof configuration === "string"
					? JSON.parse(configuration)
					: configuration}
				{ttsService}
				{toolCoordinator}
				{highlightCoordinator}
				onLoadComplete={(detail: unknown) =>
					handlePlayerEvent(new CustomEvent("load-complete", { detail }))}
				onPlayerError={(detail: unknown) =>
					handlePlayerEvent(new CustomEvent("player-error", { detail }))}
				onSessionChanged={(detail: unknown) => handleSessionChanged(detail)}
				onModelUpdated={(detail: unknown) =>
					handlePlayerEvent(new CustomEvent("model-updated", { detail }))}
			/>
		</div>
	{/if}
</div>

<style>
	:host {
		display: block;
	}

	:global(.pie-item-player) {
		width: 100%;
	}

	:global(.pie-player-item-container) {
		width: 100%;
	}
</style>
