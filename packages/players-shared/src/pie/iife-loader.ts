/**
 * IIFE PIE Loader
 *
 * Dynamically loads PIE elements from IIFE bundles served by the PIE build service.
 * Matches the behavior of the original pie-player from @pie-players/pie-player-components.
 *
 * Integrates with the existing PIE registry system to enable shared
 * initialization code to work with IIFE-loaded elements.
 */

import { createPieLogger } from "./logger.js";
import { pieRegistry } from "./registry.js";
import { defineCustomElementSafely } from "./custom-element-define.js";
import { validateCustomElementTag } from "./tag-names.js";
import { BundleType, isCustomElementConstructor, Status } from "./types.js";
import { getPackageWithoutVersion } from "./utils.js";
import {
	DEFAULT_IIFE_BUNDLE_RETRY_CONFIG,
	type IifeBundleRetryConfig,
} from "../loader-config.js";
import type { InstrumentationProvider } from "../instrumentation/types.js";
import { isInstrumentationProvider } from "../instrumentation/provider-guards.js";

// Logger factory - will be initialized when loader is created
let logger: ReturnType<typeof createPieLogger>;

export interface IifeLoaderConfig {
	/**
	 * Base URL for the PIE bundle service
	 * This service builds and serves IIFE bundles dynamically based on element versions
	 * @example "https://proxy.pie-api.com/bundles/"
	 * @default "https://proxy.pie-api.com/bundles/"
	 */
	bundleHost: string;

	/**
	 * Debug function (returns whether debug is enabled)
	 */
	debugEnabled?: () => boolean;

	/**
	 * Timeout (ms) for `customElements.whenDefined(...)` waiting.
	 * Prevents infinite loading hangs.
	 */
	whenDefinedTimeoutMs?: number;

	/**
	 * Retry policy for transient bundle load failures.
	 */
	bundleRetry?: IifeBundleRetryConfig;

	/**
	 * Enable IIFE retry instrumentation events.
	 */
	trackPageActions?: boolean;

	/**
	 * Instrumentation provider used when tracking retry events.
	 */
	instrumentationProvider?: InstrumentationProvider;

	/**
	 * Optional callback that reports active retry/building status.
	 */
	onBundleRetryStatus?: (status: IifeBundleRetryStatus) => void;
}

export interface IifeBundleRetryStatus {
	state: "retrying" | "completed" | "timeout" | "cancelled";
	url: string;
	attempt: number;
	elapsedMs: number;
	timeoutMs: number;
	retryDelayMs?: number;
	reason?: string;
}

// Default PIE bundle service URL.
// Use the public proxy endpoint (stable + cached) rather than the builder origin directly.
export const DEFAULT_BUNDLE_HOST = "https://proxy.pie-api.com/bundles/";

// Initialize pieHelpers on window if not already present
if (typeof window !== "undefined" && !window.pieHelpers) {
	window.pieHelpers = {
		loadingScripts: {},
		loadingPromises: {},
		globalLoadQueue: Promise.resolve(),
		activeBundleUrl: null,
	};
}

export class IifePieLoader {
	private config: IifeLoaderConfig;

	constructor(config: IifeLoaderConfig) {
		this.config = config;
		// Initialize logger with debug function
		logger = createPieLogger(
			"iife-loader",
			config.debugEnabled || (() => false),
		);
	}

	private ensurePieHelpers(): NonNullable<Window["pieHelpers"]> {
		if (!window.pieHelpers) {
			window.pieHelpers = {
				loadingScripts: {},
				loadingPromises: {},
				globalLoadQueue: Promise.resolve(),
				activeBundleUrl: null,
			};
		}
		return window.pieHelpers;
	}

	private getRequestedPackageNames(elements: Record<string, string>): string[] {
		return Array.from(
			new Set(
				Object.values(elements)
					.map((packageVersion) => getPackageWithoutVersion(packageVersion))
					.filter((name) => typeof name === "string" && name.length > 0),
			),
		).sort();
	}

	private isReusableActiveBundle(
		doc: Document,
		bundleUrl: string,
		requestedPackageNames: string[],
	): boolean {
		const pieModule = window.pie?.default;
		if (!pieModule || typeof pieModule !== "object") {
			return false;
		}
		const helpers = this.ensurePieHelpers();
		const hasMatchingScript = !!doc.querySelector(`script[src="${bundleUrl}"]`);
		const activeBundleMatches = helpers.activeBundleUrl === bundleUrl;
		if (!hasMatchingScript || !activeBundleMatches) {
			return false;
		}
		return requestedPackageNames.every((packageName) => !!pieModule[packageName]);
	}

	private clearActiveBundleState(): void {
		const helpers = this.ensurePieHelpers();
		helpers.activeBundleUrl = null;
		if (window.pie) {
			delete window.pie;
		}
	}

	private removePieBundleScripts(doc: Document): void {
		const scripts = Array.from(
			doc.querySelectorAll('script[data-pie-bundle="true"]'),
		);
		for (const script of scripts) {
			script.remove();
		}
	}

	private getActivePieBundleScriptUrls(doc: Document): string[] {
		const scripts = Array.from(
			doc.querySelectorAll('script[data-pie-bundle="true"]'),
		);
		return scripts
			.map((script) => {
				const fromAttr = script.getAttribute("src");
				if (typeof fromAttr === "string" && fromAttr.length > 0) return fromAttr;
				const maybeSrc = (script as unknown as { src?: unknown }).src;
				return typeof maybeSrc === "string" ? maybeSrc : "";
			})
			.filter((src) => src.length > 0);
	}

	private buildLoadDiagnostics(
		doc: Document,
		context: {
			bundleUrl: string;
			requestedPackageNames: string[];
			bundleType: BundleType;
			needsControllers: boolean;
			path:
				| "reuse-active-bundle"
				| "load-fresh-bundle"
				| "retry-after-reload";
		},
	): Record<string, unknown> {
		const helpers = this.ensurePieHelpers();
		const pieModule = window.pie?.default;
		const availablePackageNames =
			pieModule && typeof pieModule === "object" ? Object.keys(pieModule) : [];
		return {
			requestedBundleUrl: context.bundleUrl,
			requestedPackageNames: context.requestedPackageNames,
			bundleType: context.bundleType,
			needsControllers: context.needsControllers,
			loadPath: context.path,
			activeBundleUrl: helpers.activeBundleUrl,
			hasWindowPie: !!window.pie,
			hasWindowPieDefault:
				!!pieModule && typeof pieModule === "object" && !Array.isArray(pieModule),
			availablePackageNames,
			activePieBundleScriptUrls: this.getActivePieBundleScriptUrls(doc),
		};
	}

	private isRecoverableRegistrationError(err: unknown): boolean {
		const message =
			err instanceof Error ? err.message : typeof err === "string" ? err : "";
		return (
			message.includes("window.pie not found") ||
			message.includes("not found in IIFE bundle")
		);
	}

	private async registerWithReloadRecovery(args: {
		doc: Document;
		elements: Record<string, string>;
		needsControllers: boolean;
		bundleType: BundleType;
		bundleUrl: string;
		requestedPackageNames: string[];
		initialPath: "reuse-active-bundle" | "load-fresh-bundle";
	}): Promise<void> {
		const initialDiagnostics = this.buildLoadDiagnostics(args.doc, {
			bundleUrl: args.bundleUrl,
			requestedPackageNames: args.requestedPackageNames,
			bundleType: args.bundleType,
			needsControllers: args.needsControllers,
			path: args.initialPath,
		});
		try {
			await this.registerElementsFromBundle(
				args.elements,
				args.needsControllers,
				args.bundleType,
				initialDiagnostics,
			);
			return;
		} catch (err) {
			if (!this.isRecoverableRegistrationError(err)) {
				throw err;
			}
			logger.warn(
				"Recoverable registration mismatch detected; forcing bundle reload and retry",
				err,
				initialDiagnostics,
			);
		}

		this.removePieBundleScripts(args.doc);
		this.clearActiveBundleState();
		await this.loadBundleScriptWithRetry(args.bundleUrl, args.doc);
		this.ensurePieHelpers().activeBundleUrl = args.bundleUrl;

		const retryDiagnostics = this.buildLoadDiagnostics(args.doc, {
			bundleUrl: args.bundleUrl,
			requestedPackageNames: args.requestedPackageNames,
			bundleType: args.bundleType,
			needsControllers: args.needsControllers,
			path: "retry-after-reload",
		});
		await this.registerElementsFromBundle(
			args.elements,
			args.needsControllers,
			args.bundleType,
			retryDiagnostics,
		);
	}

	private withGlobalLoadQueue(operation: () => Promise<void>): Promise<void> {
		const helpers = this.ensurePieHelpers();
		const previous = helpers.globalLoadQueue || Promise.resolve();
		const run = previous.then(operation, operation);
		helpers.globalLoadQueue = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}

	private toErrorMessage(error: unknown): string {
		if (error instanceof Error) return error.message;
		return typeof error === "string" ? error : String(error);
	}

	private getBundleRetryConfig(): Required<IifeBundleRetryConfig> {
		const configured = this.config.bundleRetry || {};
		const retryDelayMs =
			typeof configured.retryDelayMs === "number" && configured.retryDelayMs > 0
				? configured.retryDelayMs
				: DEFAULT_IIFE_BUNDLE_RETRY_CONFIG.retryDelayMs;
		const timeoutMs =
			typeof configured.timeoutMs === "number" && configured.timeoutMs > 0
				? configured.timeoutMs
				: DEFAULT_IIFE_BUNDLE_RETRY_CONFIG.timeoutMs;
		return { retryDelayMs, timeoutMs };
	}

	private emitBundleRetryStatus(status: IifeBundleRetryStatus): void {
		try {
			this.config.onBundleRetryStatus?.(status);
		} catch (error) {
			logger.warn("Failed to emit IIFE bundle retry status callback", error);
		}
	}

	private getInstrumentationProvider(): InstrumentationProvider | undefined {
		const provider = this.config.instrumentationProvider;
		if (!this.config.trackPageActions) return undefined;
		if (!isInstrumentationProvider(provider)) return undefined;
		if (!provider.isReady()) return undefined;
		return provider;
	}

	private trackRetryEvent(
		eventName: string,
		attributes: Record<string, unknown>,
	): void {
		const provider = this.getInstrumentationProvider();
		if (!provider) return;
		provider.trackEvent(eventName, attributes);
	}

	private trackRetryError(
		error: Error,
		attributes: Record<string, unknown>,
	): void {
		const provider = this.getInstrumentationProvider();
		if (!provider) return;
		provider.trackError(error, {
			...attributes,
			component: "iife-loader",
			errorType: "IifeBundleRetryError",
		});
	}

	private wait(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Get the bundle URL based on config elements
	 */
	private getBundleUrl(
		elements: Record<string, string>,
		bundleType: string,
		bundleInfo?: { url?: string },
	): string {
		const elementTags = Object.keys(elements || {}).sort().join(",");

		// 1. If explicit bundle URL provided in config, use that
		if (bundleInfo?.url) {
			const separator = bundleInfo.url.includes("?") ? "&" : "?";
			const taggedUrl = elementTags
				? `${bundleInfo.url}${separator}elements=${encodeURIComponent(elementTags)}`
				: bundleInfo.url;
			logger.debug("Using explicit bundle URL from config:", taggedUrl);
			return taggedUrl;
		}

		// 2. Build URL from element versions using bundle host
		const packageVersions = Object.values(elements).join("+");
		// Normalize bundleHost to ensure proper URL construction
		// - Remove trailing slash if present (we'll add it back)
		// - Handle empty string (use default)
		let bundleHost = this.config.bundleHost || DEFAULT_BUNDLE_HOST;
		bundleHost = bundleHost.trim();
		// Remove trailing slash and re-add to ensure exactly one
		bundleHost = bundleHost.replace(/\/+$/, "") + "/";
		const baseUrl = `${bundleHost}${encodeURI(packageVersions)}/${bundleType}`;
		const url = elementTags
			? `${baseUrl}?elements=${encodeURIComponent(elementTags)}`
			: baseUrl;
		logger.debug("Using bundle host URL:", url);
		return url;
	}

	/**
	 * Load an IIFE bundle from the specified URL
	 */
	private async loadBundleScript(url: string, doc: Document): Promise<void> {
		return new Promise((resolve, reject) => {
			const script = doc.createElement("script");
			script.src = url;
			script.defer = true;
			script.setAttribute("data-pie-bundle", "true"); // Mark as PIE bundle for cleanup

			script.onload = () => {
				logger.debug("Bundle loaded successfully from:", url);
				resolve();
			};

			script.onerror = () => {
				const error = `Failed to load IIFE bundle from: ${url}`;
				logger.error(error);
				reject(new Error(error));
			};

			doc.head.appendChild(script);
		});
	}

	private async loadBundleScriptWithRetry(
		url: string,
		doc: Document,
	): Promise<void> {
		const retryConfig = this.getBundleRetryConfig();
		const startedAt = Date.now();
		let attempt = 0;

		while (true) {
			attempt += 1;
			try {
				await this.loadBundleScript(url, doc);
				const elapsedMs = Date.now() - startedAt;
				if (attempt > 1) {
					logger.info(
						`✅ IIFE bundle load recovered after ${attempt} attempts (${elapsedMs}ms): ${url}`,
					);
					this.trackRetryEvent("pie-iife-bundle-retry-success", {
						url,
						attempt,
						elapsedMs,
						timeoutMs: retryConfig.timeoutMs,
					});
				}
				this.emitBundleRetryStatus({
					state: "completed",
					url,
					attempt,
					elapsedMs,
					timeoutMs: retryConfig.timeoutMs,
				});
				return;
			} catch (error) {
				const elapsedMs = Date.now() - startedAt;
				const remainingMs = retryConfig.timeoutMs - elapsedMs;
				const errorMessage = this.toErrorMessage(error);
				if (remainingMs <= 0) {
					const timeoutError = new Error(
						`IIFE bundle load timed out after ${retryConfig.timeoutMs}ms: ${url}`,
					);
					logger.error(
						`${timeoutError.message}. Last error: ${errorMessage}`,
					);
					this.trackRetryEvent("pie-iife-bundle-retry-timeout", {
						url,
						attempt,
						elapsedMs,
						timeoutMs: retryConfig.timeoutMs,
						lastError: errorMessage,
					});
					this.trackRetryError(timeoutError, {
						component: "iife-loader",
						url,
						attempt,
						elapsedMs,
						timeoutMs: retryConfig.timeoutMs,
						lastError: errorMessage,
					});
					this.emitBundleRetryStatus({
						state: "timeout",
						url,
						attempt,
						elapsedMs,
						timeoutMs: retryConfig.timeoutMs,
						reason: errorMessage,
					});
					throw timeoutError;
				}

				const retryDelayMs = Math.min(retryConfig.retryDelayMs, remainingMs);
				logger.warn(
					`⚠️ IIFE bundle load failed (attempt ${attempt}); bundle may still be building. Retrying in ${retryDelayMs}ms: ${url}`,
				);
				this.trackRetryEvent("pie-iife-bundle-retry", {
					url,
					attempt,
					elapsedMs,
					retryDelayMs,
					timeoutMs: retryConfig.timeoutMs,
					lastError: errorMessage,
				});
				this.emitBundleRetryStatus({
					state: "retrying",
					url,
					attempt,
					elapsedMs,
					retryDelayMs,
					timeoutMs: retryConfig.timeoutMs,
					reason: errorMessage,
				});
				await this.wait(retryDelayMs);
			}
		}
	}

	private whenDefinedWithTimeout(tagName: string): Promise<void> {
		const ms = this.config.whenDefinedTimeoutMs ?? 5000;
		return Promise.race([
			customElements.whenDefined(tagName).then(() => undefined),
			new Promise<void>((_, reject) =>
				setTimeout(
					() => reject(new Error(`Timeout waiting for ${tagName}`)),
					ms,
				),
			),
		]);
	}

	private createEmptyConfigure(): CustomElementConstructor {
		// Minimal configure element to avoid hard failures when a package lacks Configure export.
		// Intentionally does not emit model updates.
		return class EmptyConfigureElement extends HTMLElement {
			private _model: any;
			private _configuration: any;

			set model(m: any) {
				this._model = m;
			}
			get model() {
				return this._model;
			}

			set configuration(c: any) {
				this._configuration = c;
			}
			get configuration() {
				return this._configuration;
			}
		};
	}

	/**
	 * Register elements from the loaded IIFE bundle into the PIE registry
	 */
	private async registerElementsFromBundle(
		elements: Record<string, string>,
		needsControllers: boolean,
		bundleType?: BundleType,
		diagnostics?: Record<string, unknown>,
	): Promise<void> {
		const registry = pieRegistry();

		if (!window.pie || !window.pie.default) {
			logger.error("IIFE bundle registration failed: window.pie missing", {
				...(diagnostics || {}),
				elementTags: Object.keys(elements),
			});
			throw new Error(
				"window.pie not found - IIFE bundle did not load correctly. Check IIFE bundle request/response and runtime bundle diagnostics.",
			);
		}

		const pieModule = window.pie.default;
		logger.debug(
			"Found window.pie.default with packages:",
			Object.keys(pieModule),
		);
		logger.debug("Elements to register:", elements);
		logger.debug("Bundle type:", bundleType);

		const promises: Promise<void>[] = [];
		const isEditorBundle = bundleType === BundleType.editor;

		for (const [tagName, packageVersion] of Object.entries(elements)) {
			try {
				const packageName = getPackageWithoutVersion(packageVersion);
				logger.debug(
					`Registering element ${tagName} from package ${packageName} (full: ${packageVersion})`,
				);

				const elementData = pieModule[packageName];
				if (!elementData) {
					logger.error("IIFE bundle registration failed: requested package missing", {
						...(diagnostics || {}),
						missingPackageName: packageName,
						elementTag: tagName,
						availablePackageNames: Object.keys(pieModule),
					});
					throw new Error(
						`Package "${packageName}" not found in IIFE bundle. Available: ${Object.keys(pieModule).join(", ")}`,
					);
				}

				// For editor bundles, look for Configure class; otherwise use Element class.
				// If Configure is missing, fall back to an empty configure element.
				const ElementClass = isEditorBundle
					? elementData.Configure || this.createEmptyConfigure()
					: elementData.Element;
				const controller = needsControllers ? elementData.controller : null;

				// For editor bundles, append -config suffix to tag name
				const actualTagName = validateCustomElementTag(
					isEditorBundle ? `${tagName}-config` : tagName,
					`element tag for ${packageName}`,
				);

				if (!ElementClass) {
					const classType = isEditorBundle ? "Configure" : "Element";
					throw new Error(
						`No ${classType} class found in package ${packageName}`,
					);
				}

				// Register in the global PIE registry (used by shared initialization code)
				registry[actualTagName] = {
					package: packageVersion,
					status: Status.loading,
					tagName: actualTagName,
					element: ElementClass,
					controller: controller,
					config: elementData.config || null,
					bundleType: bundleType || ("iife" as any), // Mark bundle type
				};

				// Register custom element if not already defined
				if (isCustomElementConstructor(ElementClass)) {
					const defineResult = defineCustomElementSafely(
						actualTagName,
						class extends ElementClass {},
						`element tag for ${packageName}`,
					);
					if (defineResult.status === "defined") {
						logger.debug(`Registered custom element: ${actualTagName}`);
					} else {
						logger.debug(`Element ${actualTagName} already registered`);
					}

					// Wait for element to be defined, then update status
					const promise = this.whenDefinedWithTimeout(actualTagName)
						.then(() => {
							registry[actualTagName] = {
								...registry[actualTagName],
								status: Status.loaded,
							};
							logger.debug(`Element ${actualTagName} fully loaded`);
						})
						.catch((err) => {
							logger.error(`Failed to define element ${actualTagName}:`, err);
						});

					promises.push(promise);
				} else {
					logger.warn(
						`Element class for ${packageName} is not a valid custom element constructor`,
					);
				}
			} catch (err) {
				logger.error(`Failed to register element ${tagName}:`, err);
				throw err;
			}
		}

		// Wait for all elements to be defined
		await Promise.all(promises);
		logger.debug("All elements registered and defined");
	}

	/**
	 * Load PIE elements from IIFE bundle
	 *
	 * @param contentConfig - Item config with elements
	 * @param doc - Document to inject script into
	 * @param bundleType - Type of bundle (BundleType.player, BundleType.clientPlayer, or BundleType.editor)
	 * @param needsControllers - Whether controllers are needed
	 */
	public async load(
		contentConfig: any,
		doc: Document,
		bundleType: BundleType,
		needsControllers: boolean,
	): Promise<void> {
		logger.debug("load() called");
		logger.debug("Bundle type:", bundleType);
		logger.debug("Needs controllers:", needsControllers);
		logger.debug("Content config:", contentConfig);

		if (!contentConfig?.elements) {
			logger.warn("No elements in config");
			return;
		}
		const elements = Object.fromEntries(
			Object.entries(contentConfig.elements as Record<string, unknown>).filter(
				([tagName, packageVersion]) =>
					typeof tagName === "string" &&
					tagName.trim().length > 0 &&
					typeof packageVersion === "string" &&
					packageVersion.trim().length > 0,
			),
		) as Record<string, string>;
		if (Object.keys(elements).length === 0) {
			logger.debug("No valid element package versions found; skipping bundle load");
			return;
		}

		const helpers = this.ensurePieHelpers();

		// 0. Determine bundle URL
		const bundleUrl = this.getBundleUrl(
			elements,
			bundleType,
			contentConfig.bundle, // May contain { hash, url }
		);
		const requestedPackageNames = this.getRequestedPackageNames(elements);
		logger.debug("Requested package names:", requestedPackageNames);

		if (helpers.loadingPromises[bundleUrl]) {
			logger.debug("Waiting for in-flight bundle load:", bundleUrl);
			await helpers.loadingPromises[bundleUrl];
			return;
		}

		const loadPromise = this.withGlobalLoadQueue(async () => {
			if (
				this.isReusableActiveBundle(doc, bundleUrl, requestedPackageNames) &&
				window.pie?.default
			) {
				logger.debug("Reusing active IIFE bundle:", bundleUrl);
				await this.registerWithReloadRecovery({
					doc,
					elements,
					needsControllers,
					bundleType,
					bundleUrl,
					requestedPackageNames,
					initialPath: "reuse-active-bundle",
				});
				return;
			}

			logger.debug("Loading fresh IIFE bundle:", bundleUrl);
			this.removePieBundleScripts(doc);
			this.clearActiveBundleState();

			await this.loadBundleScriptWithRetry(bundleUrl, doc);
			this.ensurePieHelpers().activeBundleUrl = bundleUrl;

			await this.registerWithReloadRecovery({
				doc,
				elements,
				needsControllers,
				bundleType,
				bundleUrl,
				requestedPackageNames,
				initialPath: "load-fresh-bundle",
			});
			logger.debug("✅ IIFE bundle loaded and elements registered");
		}).catch((err) => {
			logger.error(
				"Failed to load IIFE bundle:",
				err,
				this.buildLoadDiagnostics(doc, {
					bundleUrl,
					requestedPackageNames,
					bundleType,
					needsControllers,
					path: "load-fresh-bundle",
				}),
			);
			this.clearActiveBundleState();
			throw err;
		});

		helpers.loadingPromises[bundleUrl] = loadPromise;
		try {
			await loadPromise;
		} finally {
			if (helpers.loadingPromises[bundleUrl] === loadPromise) {
				delete helpers.loadingPromises[bundleUrl];
			}
		}
	}

	/**
	 * Get controller for a specific element tag
	 */
	public getController(tag: string): any | null {
		const registry = pieRegistry();
		return registry[tag]?.controller || null;
	}

	/**
	 * Wait for elements to be fully loaded
	 */
	public async elementsHaveLoaded(
		elements: Array<{ name: string; tag: string }>,
	): Promise<{ elements: typeof elements; val: boolean }> {
		const promises = elements.map((el) => {
			logger.debug(`Waiting for ${el.tag} to be defined`);
			return this.whenDefinedWithTimeout(el.tag);
		});
		await Promise.all(promises);
		return { elements, val: true };
	}
}
