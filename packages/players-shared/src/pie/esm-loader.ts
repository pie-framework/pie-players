/**
 * ESM PIE Loader
 *
 * Dynamically loads PIE elements from ESM CDN (esm.sh, jsDelivr, etc.)
 * using import maps for version resolution.
 *
 * Supports loading different views/variants of elements (delivery, author, print,
 * or custom UI variants) by importing from different subpaths.
 *
 * Integrates with the existing PIE registry system to enable shared
 * initialization code to work with ESM-loaded elements.
 */

import { createPieLogger } from "./logger";
import { initializeMathRendering } from "./math-rendering";
import { pieRegistry } from "./registry";
import { isCustomElementConstructor, Status } from "./types";

// Logger factory - will be initialized when loader is created
let logger: ReturnType<typeof createPieLogger>;

export interface EsmLoaderConfig {
	cdnBaseUrl: string;
	debugEnabled?: () => boolean;
}

/**
 * View configuration for element loading
 * Maps view names to their subpath and tag suffix
 */
export interface ViewConfig {
	/** Subpath to import from (e.g., '/author', '/print', '/delivery-mobile') */
	subpath: string;
	/** Suffix to append to tag name (e.g., '-config', '-print', '') */
	tagSuffix: string;
	/** Optional fallback view if this view doesn't exist */
	fallback?: string;
}

/**
 * Options for loading elements
 */
export interface EsmLoadOptions {
	/**
	 * View to load (e.g., 'delivery', 'author', 'print', 'delivery-mobile')
	 * Can be any subpath defined in the element's package.json exports
	 */
	view: string;
	/** Whether to also load controller modules */
	loadControllers?: boolean;
	/** Custom view configuration (overrides built-in views) */
	viewConfig?: ViewConfig;
}

/**
 * Built-in view configurations
 * Extensible - elements can define custom views (e.g., 'delivery-mobile', 'delivery-a11y')
 */
export const BUILT_IN_VIEWS: Record<string, ViewConfig> = {
	delivery: {
		subpath: "",
		tagSuffix: "",
	},
	author: {
		subpath: "/author",
		tagSuffix: "-config",
		fallback: "delivery", // Fall back to delivery if author doesn't exist
	},
	print: {
		subpath: "/print",
		tagSuffix: "-print",
		fallback: "delivery",
	},
	// Custom views can follow patterns like:
	// 'delivery-mobile': { subpath: '/delivery-mobile', tagSuffix: '', fallback: 'delivery' }
	// 'delivery-a11y': { subpath: '/delivery-a11y', tagSuffix: '', fallback: 'delivery' }
	// 'delivery-simple': { subpath: '/delivery-simple', tagSuffix: '', fallback: 'delivery' }
};

export class EsmPieLoader {
	private cdnBaseUrl: string;
	private importMapInjected = false;

	constructor(config: EsmLoaderConfig) {
		this.cdnBaseUrl = config.cdnBaseUrl;
		// Initialize logger with debug function
		logger = createPieLogger(
			"esm-loader",
			config.debugEnabled || (() => false),
		);
	}

	private extractPackageName(packageVersion: string): string {
		// Extract package name from version string
		// e.g., "@pie-element/multiple-choice@11.0.1-esmbeta.3" => "@pie-element/multiple-choice"
		const parts = packageVersion.split("@");
		return parts.length >= 3 ? `@${parts[1]}` : parts[0];
	}

	private generateImportMap(
		elements: Record<string, string>,
		options: EsmLoadOptions,
	): any {
		const imports: Record<string, string> = {};
		const viewConfig =
			options.viewConfig ||
			BUILT_IN_VIEWS[options.view] ||
			BUILT_IN_VIEWS.delivery;

		for (const [_tag, packageVersion] of Object.entries(elements)) {
			const packageName = this.extractPackageName(packageVersion);

			// Add root package import (for delivery/default view)
			imports[packageName] = this.resolvePackageUrl(packageVersion);

			// Add view-specific subpath if not root
			if (viewConfig.subpath) {
				imports[`${packageName}${viewConfig.subpath}`] = this.resolveSubpathUrl(
					packageVersion,
					viewConfig.subpath,
				);
			}

			// Add controller path if requested
			if (options.loadControllers) {
				imports[`${packageName}/controller`] =
					this.resolveControllerUrl(packageVersion);
			}

			// Add fallback view if specified
			if (viewConfig.fallback) {
				const fallbackConfig = BUILT_IN_VIEWS[viewConfig.fallback];
				if (fallbackConfig?.subpath) {
					imports[`${packageName}${fallbackConfig.subpath}`] =
						this.resolveSubpathUrl(packageVersion, fallbackConfig.subpath);
				}
			}
		}
		return { imports };
	}

	private isJsDelivrNpm(): boolean {
		return this.cdnBaseUrl.includes("cdn.jsdelivr.net/npm");
	}

	private resolvePackageUrl(packageVersion: string): string {
		// jsDelivr requires `+esm` to serve ESM-compatible output.
		// Example: https://cdn.jsdelivr.net/npm/@pie-element/passage@5.3.3/+esm
		if (this.isJsDelivrNpm()) {
			return `${this.cdnBaseUrl}/${packageVersion}/+esm`;
		}
		// Default: treat baseUrl as a direct ESM CDN base (esm.sh, etc.)
		return `${this.cdnBaseUrl}/${packageVersion}`;
	}

	private resolveControllerUrl(packageVersion: string): string {
		if (this.isJsDelivrNpm()) {
			return `${this.cdnBaseUrl}/${packageVersion}/controller/+esm`;
		}
		return `${this.cdnBaseUrl}/${packageVersion}/controller`;
	}

	private resolveSubpathUrl(packageVersion: string, subpath: string): string {
		// Remove leading slash from subpath if present
		const cleanSubpath = subpath.startsWith("/") ? subpath.slice(1) : subpath;

		if (this.isJsDelivrNpm()) {
			return `${this.cdnBaseUrl}/${packageVersion}/${cleanSubpath}/+esm`;
		}
		return `${this.cdnBaseUrl}/${packageVersion}/${cleanSubpath}`;
	}

	private injectImportMap(importMap: any, doc: Document): void {
		const script = doc.createElement("script");
		script.type = "importmap";
		script.textContent = JSON.stringify(importMap, null, 2);
		doc.head.appendChild(script);
	}

	private async loadElement(
		tag: string,
		packageVersion: string,
		options: EsmLoadOptions,
	): Promise<void> {
		const registry = pieRegistry();
		const viewConfig =
			options.viewConfig ||
			BUILT_IN_VIEWS[options.view] ||
			BUILT_IN_VIEWS.delivery;

		try {
			const packageName = this.extractPackageName(packageVersion);
			const actualTag = `${tag}${viewConfig.tagSuffix}`;

			logger.debug(
				`Loading element ${actualTag} from ${packageName} (${packageVersion})`,
			);
			logger.debug(`View: ${options.view}, subpath: ${viewConfig.subpath}`);

			// Determine import path based on view
			const importPath = viewConfig.subpath
				? `${packageName}${viewConfig.subpath}`
				: packageName;

			let module: any;
			let ElementClass: any;

			try {
				// @vite-ignore - Dynamic import from CDN via import maps (runtime resolution)
				module = await import(/* @vite-ignore */ importPath);
				logger.debug(`Module loaded for ${actualTag}:`, module);
				logger.debug(`Module exports:`, Object.keys(module));

				// Try different export patterns based on view
				if (options.view === "author") {
					ElementClass = module.default || module.Configure || module.Element;
				} else if (options.view === "print") {
					ElementClass = module.default || module.Print || module.Element;
				} else {
					ElementClass = module.default || module.Element;
				}
			} catch (err) {
				// If loading fails and there's a fallback, try the fallback
				if (viewConfig.fallback) {
					logger.warn(
						`Failed to load ${importPath}, trying fallback: ${viewConfig.fallback}`,
					);
					const fallbackConfig = BUILT_IN_VIEWS[viewConfig.fallback];
					// Construct fallback path
					let fallbackPath: string;
					if (fallbackConfig.subpath) {
						fallbackPath = `${packageName}${fallbackConfig.subpath}`;
					} else {
						fallbackPath = packageName;
					}

					// @vite-ignore - Dynamic import from CDN via import maps (runtime resolution)
					module = await import(/* @vite-ignore */ fallbackPath);
					ElementClass = module.default || module.Element;
					logger.debug(`Loaded fallback view for ${actualTag}`);
				} else {
					throw err;
				}
			}

			if (!ElementClass) {
				throw new Error(
					`No suitable element class found in ${importPath} for view ${options.view}`,
				);
			}

			// Load controller separately if needed
			let controller = null;
			if (options.loadControllers) {
				try {
					// @vite-ignore - Dynamic import from CDN via import maps (runtime resolution)
					const controllerModule = await import(
						/* @vite-ignore */ `${packageName}/controller`
					);
					logger.debug(
						`Controller module loaded for ${actualTag}:`,
						controllerModule,
					);

					// Controller exports as 'default'
					controller = controllerModule.default || controllerModule;

					if (controller) {
						logger.debug(`Controller registered for ${actualTag}`);
					} else {
						logger.warn(`No controller export found for ${actualTag}`);
					}
				} catch (err) {
					logger.warn(`Failed to load controller for ${actualTag}:`, err);
				}
			}

			// Register in the global PIE registry (used by shared initialization code)
			registry[actualTag] = {
				package: packageVersion,
				status: Status.loading,
				tagName: actualTag,
				element: ElementClass,
				controller: controller,
				config: null,
				bundleType: "esm" as any, // Mark as ESM-loaded
			};

			// Register custom element with the tag name (including suffix)
			if (!customElements.get(actualTag)) {
				if (isCustomElementConstructor(ElementClass)) {
					// Wrap the Element class to allow multiple versions
					customElements.define(actualTag, class extends ElementClass {});
					logger.debug(`Registered custom element: ${actualTag}`);

					// Update status to loaded
					registry[actualTag] = {
						...registry[actualTag],
						status: Status.loaded,
					};
				} else {
					logger.warn(`No Element export found in module`);
				}
			} else {
				logger.debug(`Element ${actualTag} already registered`);
				registry[actualTag] = {
					...registry[actualTag],
					status: Status.loaded,
				};
			}
		} catch (err) {
			logger.error(`Failed to load element ${tag}:`, err);
			throw err;
		}
	}

	public getController(tag: string): any | null {
		const registry = pieRegistry();
		return registry[tag]?.controller || null;
	}

	public async elementsHaveLoaded(
		elements: Array<{ name: string; tag: string }>,
	): Promise<{ elements: typeof elements; val: boolean }> {
		// Wait for versioned tags to be defined
		const promises = elements.map((el) => {
			logger.debug(`Waiting for ${el.tag} to be defined`);
			return customElements.whenDefined(el.tag);
		});
		await Promise.all(promises);
		return { elements, val: true };
	}

	/**
	 * Load PIE elements with specified view/variant
	 *
	 * @param contentConfig - Item config with elements
	 * @param doc - Document to inject import maps into
	 * @param options - Loading options (view, controllers, etc.)
	 *
	 * @example
	 * // Load delivery view with controllers
	 * await loader.load(config, document, { view: 'delivery', loadControllers: true });
	 *
	 * @example
	 * // Load author view (configuration UI)
	 * await loader.load(config, document, { view: 'author', loadControllers: false });
	 *
	 * @example
	 * // Load custom mobile-optimized view with fallback
	 * await loader.load(config, document, {
	 *   view: 'delivery-mobile',
	 *   viewConfig: { subpath: '/delivery-mobile', tagSuffix: '', fallback: 'delivery' },
	 *   loadControllers: true
	 * });
	 */
	public async load(
		contentConfig: any,
		doc: Document,
		options: EsmLoadOptions,
	): Promise<void> {
		logger.debug("load() called with options:", options);
		logger.debug("contentConfig:", contentConfig);

		if (!contentConfig?.elements) {
			logger.warn("No elements in config");
			return;
		}

		const viewConfig =
			options.viewConfig ||
			BUILT_IN_VIEWS[options.view] ||
			BUILT_IN_VIEWS.delivery;

		// 0. Initialize math-rendering (required by PIE elements)
		await initializeMathRendering();

		// 1. Generate and inject import map (once per page)
		if (!this.importMapInjected) {
			logger.debug("Generating import map for view:", options.view);
			const importMap = this.generateImportMap(contentConfig.elements, options);
			logger.debug("Import map:", importMap);
			this.injectImportMap(importMap, doc);
			this.importMapInjected = true;
			logger.debug("Import map injected");
		} else {
			logger.debug("Import map already injected, skipping");
		}

		// 2. Dynamically import and register each element
		const elementTags = Object.keys(contentConfig.elements);
		logger.debug("Loading elements:", elementTags);
		await Promise.all(
			elementTags.map((tag) =>
				this.loadElement(tag, contentConfig.elements[tag], options),
			),
		);
		logger.debug("All elements loaded");

		// 3. Wait for all custom elements to be defined
		logger.debug("Waiting for custom elements to be defined");
		const tagsWithSuffix = elementTags.map(
			(tag) => `${tag}${viewConfig.tagSuffix}`,
		);
		await Promise.all(
			tagsWithSuffix.map((tag) => customElements.whenDefined(tag)),
		);
		logger.debug("All custom elements defined");
	}
}
