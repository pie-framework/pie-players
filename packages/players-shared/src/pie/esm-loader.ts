/**
 * ESM PIE Loader
 *
 * Dynamically loads PIE elements from ESM CDN (esm.sh, jsDelivr, etc.)
 * using import maps for version resolution.
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

	private generateImportMap(elements: Record<string, string>): any {
		const imports: Record<string, string> = {};
		for (const [tag, packageVersion] of Object.entries(elements)) {
			const packageName = this.extractPackageName(packageVersion);
			// Use package name (not version) as the key in import map
			imports[packageName] = this.resolvePackageUrl(packageVersion);
			// Also add controller path
			imports[`${packageName}/controller`] =
				this.resolveControllerUrl(packageVersion);
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

	private injectImportMap(importMap: any, doc: Document): void {
		const script = doc.createElement("script");
		script.type = "importmap";
		script.textContent = JSON.stringify(importMap, null, 2);
		doc.head.appendChild(script);
	}

	private async loadElement(
		tag: string,
		packageVersion: string,
		needsController: boolean,
	): Promise<void> {
		const registry = pieRegistry();

		try {
			const packageName = this.extractPackageName(packageVersion);
			logger.debug(
				`Loading element ${tag} from ${packageName} (${packageVersion}), needsController:`,
				needsController,
			);

			// @vite-ignore - Dynamic import from CDN via import maps (runtime resolution)
			// Import using package name (which is in the import map)
			const module = await import(/* @vite-ignore */ packageName);
			logger.debug(`Module loaded for ${tag}:`, module);
			logger.debug(`Module exports:`, Object.keys(module));

			// ESM packages export the element class as 'default'
			const ElementClass = module.default || module.Element;

			// Load controller separately if needed
			let controller = null;
			if (needsController) {
				try {
					// @vite-ignore - Dynamic import from CDN via import maps (runtime resolution)
					// Import using package name (which is in the import map)
					const controllerModule = await import(
						/* @vite-ignore */ `${packageName}/controller`
					);
					logger.debug(
						`Controller module loaded for ${tag}:`,
						controllerModule,
					);

					// Controller exports as 'default'
					controller = controllerModule.default || controllerModule;

					if (controller) {
						logger.debug(`Controller registered for ${tag}`);
					} else {
						logger.warn(`No controller export found for ${tag}`);
					}
				} catch (err) {
					logger.warn(`Failed to load controller for ${tag}:`, err);
				}
			}

			// Register in the global PIE registry (used by shared initialization code)
			registry[tag] = {
				package: packageVersion,
				status: Status.loading,
				tagName: tag,
				element: ElementClass,
				controller: controller,
				config: null,
				bundleType: "esm" as any, // Mark as ESM-loaded
			};

			// Register custom element with the versioned tag name (to allow multiple versions)
			if (!customElements.get(tag)) {
				if (isCustomElementConstructor(ElementClass)) {
					// Wrap the Element class to allow multiple versions
					customElements.define(tag, class extends ElementClass {});
					logger.debug(`Registered custom element: ${tag}`);

					// Update status to loaded
					registry[tag] = {
						...registry[tag],
						status: Status.loaded,
					};
				} else {
					logger.warn(`No Element export found in module`);
				}
			} else {
				logger.debug(`Element ${tag} already registered`);
				registry[tag] = {
					...registry[tag],
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

	public async load(
		contentConfig: any,
		doc: Document,
		needsControllers: boolean,
	): Promise<void> {
		logger.debug("load() called, needsControllers:", needsControllers);
		logger.debug("contentConfig:", contentConfig);

		if (!contentConfig?.elements) {
			logger.warn("No elements in config");
			return;
		}

		// 0. Initialize math-rendering (required by PIE elements)
		await initializeMathRendering();

		// 1. Generate and inject import map (once per page)
		if (!this.importMapInjected) {
			logger.debug("Generating import map");
			const importMap = this.generateImportMap(contentConfig.elements);
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
				this.loadElement(tag, contentConfig.elements[tag], needsControllers),
			),
		);
		logger.debug("All elements loaded");

		// 3. Wait for all custom elements to be defined
		logger.debug("Waiting for custom elements to be defined");
		await Promise.all(
			elementTags.map((tag) => customElements.whenDefined(tag)),
		);
		logger.debug("All custom elements defined");
	}
}
