<svelte:options
	customElement={{
		tag: "pie-item-player",
		// Keep light DOM so rendered assessment content can inherit required host/runtime styles.
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
			mode: { attribute: "mode", type: "String" },
			configuration: { attribute: "configuration", type: "Object" },
			authoringBackend: { attribute: "authoring-backend", type: "String" },
			allowedStyleOrigins: { attribute: "allowed-style-origins", type: "String" },
			loaderOptions: { type: "Object", reflect: false },
			trustMarkup: { attribute: "trust-markup", type: "Boolean" },
			sanitizeMarkup: { type: "Object", reflect: false },
			onInsertImage: { type: "Object", reflect: false },
			onDeleteImage: { type: "Object", reflect: false },
			onInsertSound: { type: "Object", reflect: false },
			onDeleteSound: { type: "Object", reflect: false },
		},
	}}
/>

<script lang="ts">
	import type {
		ConfigEntity,
		Env,
		IifeBundleRetryStatus,
		ItemMarkupSanitizer,
		LoaderConfig,
	} from "@pie-players/pie-players-shared";
	import {
		focusFirstFocusableInElement,
		parseAllowedStyleOrigins,
		validateExternalStyleUrl,
	} from "@pie-players/pie-players-shared";
	import type {
		AuthoringBackendMode,
		DeleteDone,
		ImageHandler,
		SoundHandler,
	} from "./types.js";
	import {
		BundleType,
		assertPieConfigContract,
		assertRegistered,
		createPieLogger,
		DEFAULT_BUNDLE_HOST,
		DEFAULT_LOADER_CONFIG,
		ensureRegistered,
		hasResponseValue,
		ItemController,
		isGlobalDebugEnabled,
		initializeMathRendering,
		makeUniqueTags,
		validatePieConfigContract,
		normalizeItemSessionContainer,
		normalizeItemPlayerStrategy,
		parsePackageName,
		resolveInstrumentationProvider,
		resolveItemPlayerView,
	} from "@pie-players/pie-players-shared";
	import type {
		EsmBackendConfig,
		IifeBackendConfig,
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
		moduleResolution?: "url" | "import-map";
		runtimeSupportCheck?: "off" | "on";
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
		mode = "view" as "view" | "author",
		configuration = {} as Record<string, any>,
		authoringBackend = "demo" as AuthoringBackendMode,
		allowedStyleOrigins = "",
		loaderOptions = {} as UnifiedLoaderOptions,
		trustMarkup = false,
		sanitizeMarkup = null as ItemMarkupSanitizer | null,
		onInsertImage = null as ((handler: ImageHandler) => void) | null,
		onDeleteImage = null as ((src: string, done: DeleteDone) => void) | null,
		onInsertSound = null as ((handler: SoundHandler) => void) | null,
		onDeleteSound = null as ((src: string, done: DeleteDone) => void) | null,
	} = $props();

	const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
	const normalizedStrategy = $derived(normalizeItemPlayerStrategy(strategy, "iife"));
	const resolvedMode = $derived(mode === "author" ? "author" : "view");
	const resolvedIifeBundleHost = $derived(
		loaderOptions?.bundleHost || DEFAULT_BUNDLE_HOST,
	);
	const resolvedEsmCdnUrl = $derived(
		loaderOptions?.esmCdnUrl || "https://cdn.jsdelivr.net/npm",
	);
	const loaderRetrySignature = $derived.by(() =>
		JSON.stringify(loaderConfig?.iifeBundleRetry || {}),
	);
	const RUNTIME_SUPPORT_NEGATIVE_CACHE_MS = 30_000;
	const runtimeSupportCache = new Map<
		string,
		{
			schemaVersion?: number;
			supports?: Partial<
				Record<"esm" | "iife", Partial<Record<"delivery" | "author" | "print", boolean>>>
			>;
		}
	>();
	const runtimeSupportMissingCache = new Map<string, number>();

	function normalizeRuntimeSupportCheck(
		value: unknown,
		fallback: "off" | "on" = "off",
	): "off" | "on" {
		if (value === "off" || value === "on") {
			return value;
		}
		return fallback;
	}

	function resolveRuntimeSupportUrl(packageVersion: string): string {
		const isJsDelivr = resolvedEsmCdnUrl.includes("cdn.jsdelivr.net/npm");
		if (isJsDelivr) {
			return `${resolvedEsmCdnUrl}/${packageVersion}/runtime-support/+esm`;
		}
		return `${resolvedEsmCdnUrl}/${packageVersion}/runtime-support`;
	}

	function isStrategySupportedForView(
		runtimeSupport: {
			supports?: Partial<
				Record<"esm" | "iife", Partial<Record<"delivery" | "author" | "print", boolean>>>
			>;
		},
		strategy: "esm" | "iife",
		view: "delivery" | "author" | "print",
	): boolean {
		const strategyMap = runtimeSupport.supports?.[strategy];
		if (!strategyMap) return true;
		const value = strategyMap[view];
		if (value === undefined) return true;
		return value;
	}

	function classifyRuntimeSupportMissing(error: unknown): boolean {
		const message = String(error || "").toLowerCase();
		return (
			message.includes("cannot find module") ||
			message.includes("failed to fetch dynamically imported module") ||
			message.includes("404") ||
			message.includes("runtime-support")
		);
	}

	async function resolveRuntimeSupportForPackage(
		packageVersion: string,
		mode: "off" | "on",
	): Promise<
		| {
				schemaVersion?: number;
				supports?: Partial<
					Record<"esm" | "iife", Partial<Record<"delivery" | "author" | "print", boolean>>>
				>;
		  }
		| undefined
	> {
		if (mode !== "on") {
			return undefined;
		}
		const key = packageVersion;
		const cached = runtimeSupportCache.get(key);
		if (cached) {
			return cached;
		}
		const missingAt = runtimeSupportMissingCache.get(key);
		if (missingAt && Date.now() - missingAt < RUNTIME_SUPPORT_NEGATIVE_CACHE_MS) {
			return undefined;
		}
		try {
			// @vite-ignore
			const module = await import(/* @vite-ignore */ resolveRuntimeSupportUrl(packageVersion));
			const runtimeSupport = module.default || module.runtimeSupport || module;
			if (!runtimeSupport || typeof runtimeSupport !== "object") {
				throw new Error(`Invalid runtime-support export for ${packageVersion}`);
			}
			runtimeSupportCache.set(key, runtimeSupport);
			runtimeSupportMissingCache.delete(key);
			return runtimeSupport;
		} catch (error) {
			if (classifyRuntimeSupportMissing(error)) {
				runtimeSupportMissingCache.set(key, Date.now());
				return undefined;
			}
			return undefined;
		}
	}

	async function collectRuntimeSupportHints(
		elements: Record<string, string>,
		strategy: "iife" | "esm" | "preloaded",
		view: "delivery" | "author" | "print",
		mode: "off" | "on",
	): Promise<{ unsupportedPackages: string[] }> {
		if (mode !== "on") return { unsupportedPackages: [] };
		const strategyForChecks: "esm" | "iife" =
			strategy === "iife" || strategy === "preloaded" ? "iife" : "esm";
		const unsupportedPackages: string[] = [];

		for (const packageVersion of Object.values(elements || {})) {
			const runtimeSupport = await resolveRuntimeSupportForPackage(packageVersion, mode);
			if (!runtimeSupport) {
				continue;
			}
			const supported = isStrategySupportedForView(runtimeSupport, strategyForChecks, view);
			if (supported) {
				continue;
			}
			const { name } = parsePackageName(packageVersion);
			unsupportedPackages.push(name);
		}
		return { unsupportedPackages };
	}

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
	const resolvedInstrumentationProvider = $derived.by(
		() =>
			resolveInstrumentationProvider({
				player: { loaderConfig },
				component: "pie-item-player",
				debug: debugEnabled,
			}) as LoaderConfig["instrumentationProvider"],
	);

	let loading = $state(true);
	let error: string | null = $state(null);
	let bundleRetryStatus: IifeBundleRetryStatus | null = $state(null);
	let itemConfig: ConfigEntity | null = $state(null);
	let hostElement: HTMLElement | null = $state(null);
	let sessionController: ItemController | null = $state(null);
	let sessionControllerItemId = $state("pie-item-player");
	let sessionSignature = $state("");
	let sessionRevision = $state(0);

	const bundleBuildWarning = $derived.by(() => {
		const retryState = (bundleRetryStatus as { state?: string } | null)?.state;
		if (!bundleRetryStatus || retryState !== "retrying") return null;
		const elapsedSeconds = Math.max(
			1,
			Math.ceil(bundleRetryStatus.elapsedMs / 1000),
		);
		const timeoutSeconds = Math.max(
			1,
			Math.ceil(bundleRetryStatus.timeoutMs / 1000),
		);
		return `Bundle is still building. Retrying load attempt ${bundleRetryStatus.attempt} (elapsed ${elapsedSeconds}s of ${timeoutSeconds}s).`;
	});

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

	function hasExplicitResponseField(value: unknown): boolean {
		if (value == null) return false;
		if (Array.isArray(value)) {
			return value.some((entry) => hasExplicitResponseField(entry));
		}
		if (typeof value !== "object") return false;
		for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
			if (key === "value") return true;
			if (hasExplicitResponseField(nested)) return true;
		}
		return false;
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

	// Dedup of the last successfully-processed inputs. The deep ElementLoader
	// primitive also deduplicates concurrent identical requests internally,
	// so this guard exists purely to skip the outer pipeline (config parsing,
	// transform, runtime-support, etc.) when the effect re-fires with the
	// same props. It does not gate readiness.
	let lastProcessedConfig: any = null;
	let lastProcessedStrategy = "";
	let lastProcessedMode = "";
	let lastProcessedLoaderRetrySignature = "";

	function normalizePreloadedElementVersions(configEntity: any): any {
		if (!isBrowser || normalizedStrategy !== "preloaded") return configEntity;
		if (!configEntity?.elements || typeof configEntity.elements !== "object") {
			return configEntity;
		}
		const preloadedElements = (window as any).PIE_PRELOADED_ELEMENTS;
		if (!preloadedElements || typeof preloadedElements !== "object") {
			return configEntity;
		}

		let changed = false;
		const normalizedElements = Object.entries(configEntity.elements).reduce(
			(acc, [tagName, packageSpec]) => {
				const packageSpecStr = String(packageSpec);
				try {
					const packageName = parsePackageName(packageSpecStr).name;
					const bundledSpec = preloadedElements[packageName];
					if (typeof bundledSpec === "string" && bundledSpec.length > 0) {
						acc[tagName] = bundledSpec;
						if (bundledSpec !== packageSpecStr) {
							changed = true;
						}
						return acc;
					}
				} catch {
					// Keep original packageSpec when parsing fails.
				}
				acc[tagName] = packageSpecStr;
				return acc;
			},
			{} as Record<string, string>,
		);

		if (!changed) return configEntity;
		logger.debug(
			"[pie-item-player] Normalized preloaded config.elements to bundled versions",
		);
		return {
			...configEntity,
			elements: normalizedElements,
		};
	}

	// ─── loadConfig pipeline ─────────────────────────────────────────────────
	//
	// The pipeline is a sequence of pure transforms over `(config, env,
	// strategy, loaderOptions)` producing `(resolvedConfig | error)`.
	//
	//     parse → validate → normalizePreloaded → makeUniqueTags
	//       → collectRuntimeSupportHints → initializeMathRendering
	//       → (preloaded: assertRegistered | iife|esm: ensureRegistered)
	//       → setItemConfig
	//
	// The deep ElementLoader primitive owns registration truth end-to-end
	// and deduplicates concurrent identical requests, so this function no
	// longer needs:
	//   - an `isProcessing` guard (the primitive already deduplicates)
	//   - an `allowPreloadedFallbackLoad` escape hatch (preloaded means
	//     "host pre-registered; assert loudly or throw")
	//   - a manual "all elements already registered" shortcut (the primitive
	//     short-circuits when every tag is in `customElements` already)

	function resolveBundleType(): BundleType {
		if (resolvedMode === "author") return BundleType.editor;
		return hosted ? BundleType.player : BundleType.clientPlayer;
	}

	function buildIifeBackendConfig(
		bundleType: BundleType,
	): IifeBackendConfig {
		const needsControllers = bundleType !== BundleType.editor && !hosted;
		return {
			kind: "iife",
			bundleHost: resolvedIifeBundleHost,
			bundleType,
			needsControllers,
			debugEnabled: () => debugEnabled,
			bundleRetry: loaderConfig?.iifeBundleRetry,
			trackPageActions: loaderConfig?.trackPageActions,
			instrumentationProvider: resolvedInstrumentationProvider,
			onBundleRetryStatus: (status) => {
				bundleRetryStatus = status;
				handlePlayerEvent(
					new CustomEvent("bundle-retry-status", {
						detail: status,
					}),
				);
			},
		};
	}

	function buildEsmBackendConfig(view: string): EsmBackendConfig {
		const moduleResolution =
			(loaderOptions as Record<string, unknown> | undefined)
				?.moduleResolution === "import-map"
				? "import-map"
				: "url";
		return {
			kind: "esm",
			cdnBaseUrl: resolvedEsmCdnUrl,
			moduleResolution,
			view: view === "author" ? "author" : "delivery",
			loadControllers: loaderOptions?.loadControllers ?? true,
		};
	}

	function tagsForConfig(
		transformedConfig: any,
		context: { strategy: string; view: string; bundleType: BundleType },
	): string[] {
		if (!transformedConfig?.elements) return [];
		const isEditor =
			context.bundleType === BundleType.editor || context.view === "author";
		return Object.keys(transformedConfig.elements).map((el) =>
			isEditor ? `${el}-config` : el,
		);
	}

	async function loadConfig(currentConfig: any) {
		if (
			currentConfig === lastProcessedConfig &&
			normalizedStrategy === lastProcessedStrategy &&
			resolvedMode === lastProcessedMode &&
			loaderRetrySignature === lastProcessedLoaderRetrySignature
		) {
			return;
		}

		if (!currentConfig) {
			itemConfig = null;
			loading = true;
			return;
		}

		lastProcessedConfig = currentConfig;
		lastProcessedStrategy = normalizedStrategy;
		lastProcessedMode = resolvedMode;
		lastProcessedLoaderRetrySignature = loaderRetrySignature;
		loading = true;
		error = null;
		bundleRetryStatus = null;

		let stage = "start";
		let runtimeSupportErrorHint: string | null = null;
		try {
			stage = "parse-config";
			const parsedConfig =
				typeof currentConfig === "string" ? JSON.parse(currentConfig) : currentConfig;

			stage = "validate-config";
			assertPieConfigContract(parsedConfig);
			const contractValidation = validatePieConfigContract(parsedConfig);
			const contractWarnings = (
				contractValidation as unknown as { warnings?: unknown }
			).warnings;
			const warnings = Array.isArray(contractWarnings)
				? contractWarnings.filter((entry): entry is string => typeof entry === "string")
				: [];
			for (const warning of warnings) {
				logger.warn(`[pie-item-player] ${warning}`);
			}

			stage = "normalize-preloaded-elements";
			const normalizedConfig = normalizePreloadedElementVersions(parsedConfig);

			stage = "makeUniqueTags";
			const transformed = makeUniqueTags({ config: normalizedConfig });
			const transformedConfig = transformed.config;
			const runtimeSupportCheck = normalizeRuntimeSupportCheck(
				(loaderOptions as UnifiedLoaderOptions | undefined)?.runtimeSupportCheck,
				"off",
			);
			const runtimeSupportView =
				(loaderOptions as UnifiedLoaderOptions | undefined)?.view ||
				resolveItemPlayerView(env?.mode, "delivery");
			const runtimeSupportHints = await collectRuntimeSupportHints(
				transformedConfig.elements || {},
				normalizedStrategy,
				runtimeSupportView as "delivery" | "author" | "print",
				runtimeSupportCheck,
			);
			const strategyForChecks: "esm" | "iife" =
				normalizedStrategy === "esm" ? "esm" : "iife";
			runtimeSupportErrorHint =
				runtimeSupportHints.unsupportedPackages.length > 0
					? ` Runtime support metadata indicates ${strategyForChecks}/${runtimeSupportView} is unsupported for ${runtimeSupportHints.unsupportedPackages.join(", ")}.`
					: null;

			stage = "math-rendering-init";
			await initializeMathRendering();

			const elementMap = (transformedConfig?.elements || {}) as Record<
				string,
				string
			>;

			if (normalizedStrategy === "preloaded") {
				stage = "preloaded-readiness";
				const bundleType = resolveBundleType();
				const tags = tagsForConfig(transformedConfig, {
					strategy: normalizedStrategy,
					view: runtimeSupportView,
					bundleType,
				});
				// `assertRegistered` throws `ElementAssertionError` with a
				// diagnostic message (expected, missing, currently-registered)
				// when any tag is missing. No loading, no fallback.
				assertRegistered(tags);
			} else if (normalizedStrategy === "iife") {
				stage = "iife-load";
				const bundleType = resolveBundleType();
				await ensureRegistered(elementMap, {
					backend: buildIifeBackendConfig(bundleType),
				});
			} else {
				stage = "esm-load";
				const view =
					loaderOptions?.view || resolveItemPlayerView(env?.mode, "delivery");
				await ensureRegistered(elementMap, {
					backend: buildEsmBackendConfig(view),
				});
			}

			stage = "set-item-config";
			itemConfig = transformedConfig;
			loading = false;
			error = null;
			bundleRetryStatus = null;
		} catch (err: any) {
			const baseMessage = err?.message || String(err);
			const message = `${baseMessage}${runtimeSupportErrorHint || ""}`;
			error = `Error loading elements (${stage}): ${message}`;
			loading = false;
			bundleRetryStatus = null;
			logger.error("[pie-item-player] failed loading:", err);
			handlePlayerEvent(
				new CustomEvent("player-error", {
					detail: {
						code: "ITEM_PLAYER_LOAD_ERROR",
						message,
						stage,
						strategy: normalizedStrategy,
						mode: resolvedMode,
					},
				}),
			);
		}
	}

	$effect(() => {
		const currentConfig = config;
		void normalizedStrategy;
		void resolvedMode;
		void resolvedIifeBundleHost;
		void resolvedEsmCdnUrl;
		void loaderRetrySignature;
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

	const allowedStyleOriginList = $derived(
		parseAllowedStyleOrigins(allowedStyleOrigins),
	);

	const cssEscapeValue = (value: string): string => {
		const cssApi = (globalThis as { CSS?: { escape?: (v: string) => string } })
			.CSS;
		if (typeof cssApi?.escape === "function") {
			return cssApi.escape(value);
		}
		return value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
	};

	const loadScopedExternalStyle = async (url: string) => {
		if (!isBrowser || !url || typeof url !== "string") return;
		const validation = validateExternalStyleUrl(url, {
			baseUrl: window.location.href,
			allowedOrigins: allowedStyleOriginList,
		});
		if (!validation.ok) {
			logger.error(
				`[pie-item-player] ${validation.message} (url=${url})`,
			);
			return;
		}
		const resolvedUrl = validation.resolvedUrl;
		const escapedUrl = cssEscapeValue(url);
		if (document.querySelector(`style[data-pie-style="${escapedUrl}"]`)) return;
		if (document.querySelector(`link[data-pie-style-link="${escapedUrl}"]`))
			return;
		try {
			const isCrossOrigin = resolvedUrl.origin !== window.location.origin;
			if (isCrossOrigin) {
				// Cross-origin stylesheets may block fetch() without CORS headers.
				// Use a link tag so the browser can apply CSS directly.
				const link = document.createElement("link");
				link.setAttribute("rel", "stylesheet");
				link.setAttribute("href", resolvedUrl.toString());
				link.setAttribute("data-pie-style-link", url);
				document.head.appendChild(link);
				return;
			}
			const response = await fetch(resolvedUrl.toString());
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
	};

	/**
	 * Move keyboard focus to the first focusable control inside this item
	 * (including inside **open** shadow roots of nested PIE custom elements).
	 * Safe to call after section navigation when the item host is already
	 * focused or visible.
	 */
	export function focusFirst(): boolean {
		if (!hostElement) return false;
		return focusFirstFocusableInElement(hostElement);
	}

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
		if (
			!("session" in detailObj) &&
			!hasResponseValue(detailObj) &&
			!hasExplicitResponseField(detailObj)
		) {
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
		<div class="pie-item-player-loading">
			<PieSpinner />
			{#if bundleBuildWarning}
				<p
					class="pie-item-player-build-warning"
					role="status"
					aria-live="polite"
					aria-atomic="true"
				>
					{bundleBuildWarning}
				</p>
			{/if}
		</div>
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
				authoringBackend={authoringBackend}
				{trustMarkup}
				sanitizeMarkup={sanitizeMarkup ?? undefined}
				configuration={typeof configuration === "string"
					? JSON.parse(configuration)
					: configuration}
				onInsertImage={onInsertImage ?? undefined}
				onDeleteImage={onDeleteImage ?? undefined}
				onInsertSound={onInsertSound ?? undefined}
				onDeleteSound={onDeleteSound ?? undefined}
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

	.pie-item-player-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
	}

	.pie-item-player-build-warning {
		margin: 0;
		font-size: 0.95rem;
		color: #9a6700;
		text-align: center;
	}
</style>
