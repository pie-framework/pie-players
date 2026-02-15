/**
 * IIFE PIE Loader
 *
 * Dynamically loads PIE elements from IIFE bundles served by the PIE build service.
 * Matches the behavior of the original pie-player from @pie-players/pie-player-components.
 *
 * Integrates with the existing PIE registry system to enable shared
 * initialization code to work with IIFE-loaded elements.
 */

import { createPieLogger } from "./logger";
import { initializeMathRendering } from "./math-rendering";
import { pieRegistry } from "./registry";
import { validateCustomElementTag } from "./tag-names";
import { BundleType, isCustomElementConstructor, Status } from "./types";
import { getPackageWithoutVersion } from "./utils";

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
	 * When true, retries a failed script load by appending a cache-busting query param.
	 * Mirrors legacy `reFetchBundle` behavior used by `pie-author`.
	 */
	reFetchBundle?: boolean;

	/**
	 * Timeout (ms) for `customElements.whenDefined(...)` waiting.
	 * Prevents infinite loading hangs; mirrors legacy loader behavior.
	 */
	whenDefinedTimeoutMs?: number;
}

// Default PIE bundle service URL.
// Use the public proxy endpoint (stable + cached) rather than the builder origin directly.
export const DEFAULT_BUNDLE_HOST = "https://proxy.pie-api.com/bundles/";

// Initialize pieHelpers on window if not already present
if (typeof window !== "undefined" && !window.pieHelpers) {
	window.pieHelpers = {
		loadingScripts: {},
		loadingPromises: {},
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

	/**
	 * Get the bundle URL based on config elements
	 */
	private getBundleUrl(
		elements: Record<string, string>,
		bundleType: string,
		bundleInfo?: { url?: string },
	): string {
		// 1. If explicit bundle URL provided in config, use that
		if (bundleInfo?.url) {
			logger.debug("Using explicit bundle URL from config:", bundleInfo.url);
			return bundleInfo.url;
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
		const url = `${bundleHost}${encodeURI(packageVersions)}/${bundleType}`;
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
		// Matches legacy behavior (empty-configure) but intentionally does not emit model updates.
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
	): Promise<void> {
		const registry = pieRegistry();

		if (!window.pie || !window.pie.default) {
			throw new Error(
				"window.pie not found - IIFE bundle did not load correctly",
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
					throw new Error(
						`Package "${packageName}" not found in IIFE bundle. Available: ${Object.keys(pieModule).join(", ")}`,
					);
				}

				// For editor bundles, look for Configure class; otherwise use Element class.
				// If Configure is missing, fall back to an empty configure element (legacy parity).
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
				if (!customElements.get(actualTagName)) {
					if (isCustomElementConstructor(ElementClass)) {
						// Wrap the Element class to allow multiple registrations with the same constructor
						customElements.define(actualTagName, class extends ElementClass {});
						logger.debug(`Registered custom element: ${actualTagName}`);

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
				} else {
					logger.debug(`Element ${actualTagName} already registered`);
					registry[actualTagName] = {
						...registry[actualTagName],
						status: Status.loaded,
					};
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

		// 0. Initialize math-rendering (required by PIE elements)
		await initializeMathRendering();

		// 1. Determine bundle URL
		const bundleUrl = this.getBundleUrl(
			contentConfig.elements,
			bundleType,
			contentConfig.bundle, // May contain { hash, url }
		);

		// 2. Check if we need to load a different bundle
		// Remove any previously loaded bundle script to avoid conflicts
		const existingScript = doc.querySelector(`script[src="${bundleUrl}"]`);
		const existingScriptDifferent = Array.from(
			doc.querySelectorAll('script[data-pie-bundle="true"]'),
		).find((script) => script.getAttribute("src") !== bundleUrl);

		if (existingScriptDifferent) {
			logger.debug(
				"Removing previously loaded bundle:",
				existingScriptDifferent.getAttribute("src"),
			);
			existingScriptDifferent.remove();
			// Clear window.pie to force clean reload
			if (window.pie) {
				delete window.pie;
			}
		}

		// If the exact bundle we need is already loaded, just register elements
		if (existingScript && window.pie && window.pie.default) {
			logger.debug("Exact bundle already loaded, registering elements");
			await this.registerElementsFromBundle(
				contentConfig.elements,
				needsControllers,
				bundleType,
			);
			logger.debug("✅ Elements registered from existing bundle");
			return;
		}

		// 3. Check if bundle is currently loading - if so, wait for it
		if (window.pieHelpers?.loadingPromises?.[bundleUrl]) {
			logger.debug(
				"Bundle is already loading, waiting for existing load:",
				bundleUrl,
			);
			await window.pieHelpers.loadingPromises[bundleUrl];
			logger.debug("Existing bundle load completed, registering elements");
			await this.registerElementsFromBundle(
				contentConfig.elements,
				needsControllers,
				bundleType,
			);
			logger.debug("✅ Elements registered from already-loading bundle");
			return;
		}

		// 4. Mark as loading and create promise
		if (window.pieHelpers) {
			window.pieHelpers.loadingScripts[bundleUrl] = true;
		}

		// Create and store the loading promise
		const loadPromise = (async () => {
			try {
				// Load the IIFE bundle
				logger.debug("Loading IIFE bundle from:", bundleUrl);
				try {
					await this.loadBundleScript(bundleUrl, doc);
				} catch (e) {
					if (this.config.reFetchBundle) {
						const retryUrl =
							bundleUrl +
							(bundleUrl.includes("?") ? "&" : "?") +
							`t=${Date.now()}`;
						logger.warn(
							"[IifePieLoader] Initial bundle load failed, retrying with cache bust:",
							retryUrl,
						);
						await this.loadBundleScript(retryUrl, doc);
					} else {
						throw e;
					}
				}

				// Register elements from the loaded bundle
				logger.debug("Registering elements from loaded bundle");
				await this.registerElementsFromBundle(
					contentConfig.elements,
					needsControllers,
					bundleType,
				);

				logger.debug("✅ IIFE bundle loaded and elements registered");
			} catch (err) {
				logger.error("Failed to load IIFE bundle:", err);
				// Clean up on error
				if (window.pieHelpers) {
					delete window.pieHelpers.loadingPromises[bundleUrl];
					delete window.pieHelpers.loadingScripts[bundleUrl];
				}
				throw err;
			} finally {
				// Clean up promise after completion (success or failure)
				if (window.pieHelpers?.loadingPromises?.[bundleUrl]) {
					delete window.pieHelpers.loadingPromises[bundleUrl];
				}
			}
		})();

		// Store the promise so other loaders can wait for it
		if (window.pieHelpers) {
			window.pieHelpers.loadingPromises[bundleUrl] = loadPromise;
		}

		// Wait for the load to complete
		await loadPromise;
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
