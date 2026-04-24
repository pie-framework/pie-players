/**
 * ESM backend adapter for the ElementLoader primitive.
 *
 * Loads PIE elements via dynamic `import()` from an ESM CDN (esm.sh,
 * jsDelivr, etc.), optionally resolving bare specifiers through an
 * `<script type="importmap">` injected into the host document. On any
 * per-tag failure (module load, non-constructor element class, define
 * failure), throws `AdapterFailure` with a structured `reasons` map.
 *
 * Like the IIFE adapter, this module does not gate its own promise on
 * `customElements.whenDefined`; the primitive performs that verification
 * uniformly. Here the adapter's job is narrowly to fetch, extract, and
 * call `customElements.define`.
 */

import { defineCustomElementSafely } from "../pie/custom-element-define.js";
import { pieRegistry } from "../pie/registry.js";
import { validateCustomElementTag } from "../pie/tag-names.js";
import { isCustomElementConstructor, Status } from "../pie/types.js";
import type { ElementMap } from "./ElementLoader.js";
import {
	AdapterFailure,
	type BackendContext,
	type ElementLoaderBackend,
	type ElementTag,
	type RegistrationFailureReason,
} from "./element-loader-types.js";

/** View configuration: how a PIE package's subpath maps to a tag suffix. */
export type ViewConfig = {
	subpath: string;
	tagSuffix: string;
	fallback?: string;
};

export const BUILT_IN_VIEWS: Record<string, ViewConfig> = {
	delivery: { subpath: "", tagSuffix: "" },
	author: { subpath: "/author", tagSuffix: "-config", fallback: "delivery" },
	print: { subpath: "/print", tagSuffix: "-print", fallback: "delivery" },
};

export type EsmBackendConfig = {
	kind: "esm";
	/** Base URL for the ESM CDN (e.g., "https://esm.sh"). */
	cdnBaseUrl: string;
	/** `"url"` loads via fully-qualified URLs; `"import-map"` uses bare specifiers. */
	moduleResolution?: "url" | "import-map";
	/** View to load (`delivery`, `author`, `print`, or a custom name). */
	view?: string;
	/** Custom view configuration (overrides built-ins). */
	viewConfig?: ViewConfig;
	/** Whether to also load controller modules. */
	loadControllers?: boolean;
	/** Debug flag hook. */
	debugEnabled?: () => boolean;
};

export type EsmModuleImporter = (specifier: string) => Promise<unknown>;
export type EsmImportMapObserver = (json: string, doc: Document) => void;

export type EsmBackendTestSeams = {
	replaceImporter(fn: EsmModuleImporter): void;
	observeImportMapInjection(cb: EsmImportMapObserver): void;
	restore(): void;
};

export type EsmBackend = ElementLoaderBackend & {
	readonly __seams: EsmBackendTestSeams;
};

export function createEsmBackend(config: EsmBackendConfig): EsmBackend {
	const cdnBaseUrl = config.cdnBaseUrl.replace(/\/+$/, "");
	const moduleResolution = config.moduleResolution ?? "url";
	const view = config.view ?? "delivery";
	const loadControllers = config.loadControllers ?? true;
	const viewConfig =
		config.viewConfig ??
		BUILT_IN_VIEWS[view] ??
		BUILT_IN_VIEWS.delivery;

	const injectedPackages = new Set<string>();
	let importer: EsmModuleImporter = defaultImporter;
	let importMapObserver: EsmImportMapObserver | undefined;

	const __seams: EsmBackendTestSeams = {
		replaceImporter(fn) {
			importer = fn;
		},
		observeImportMapInjection(cb) {
			importMapObserver = cb;
		},
		restore() {
			importer = defaultImporter;
			importMapObserver = undefined;
			injectedPackages.clear();
		},
	};

	async function load(
		elements: ElementMap,
		context: BackendContext,
	): Promise<void> {
		if (!elements || Object.keys(elements).length === 0) return;

		if (moduleResolution === "import-map") {
			assertImportMapSupported();
			const newEntries: ElementMap = {};
			for (const [tag, pkg] of Object.entries(elements)) {
				const packageName = extractPackageName(pkg);
				if (!injectedPackages.has(packageName)) {
					newEntries[tag] = pkg;
					injectedPackages.add(packageName);
				}
			}
			if (Object.keys(newEntries).length > 0) {
				const json = buildImportMapJson(
					newEntries,
					viewConfig,
					cdnBaseUrl,
					loadControllers,
				);
				injectImportMap(json, context.doc);
				importMapObserver?.(json, context.doc);
			}
		}

		const reasons = new Map<ElementTag, RegistrationFailureReason>();
		const registry = pieRegistry();

		await Promise.all(
			Object.entries(elements).map(async ([tag, packageVersion]) => {
				const packageName = extractPackageName(packageVersion);
				let actualTag: string;
				try {
					actualTag = validateCustomElementTag(
						`${tag}${viewConfig.tagSuffix}`,
						`element tag for ${packageName}`,
					);
				} catch (err) {
					reasons.set(tag, {
						kind: "define-failed",
						tag,
						cause: err instanceof Error ? err.message : String(err),
					});
					return;
				}

				const specifier = resolveElementSpecifier(
					packageName,
					packageVersion,
					viewConfig,
					moduleResolution,
					cdnBaseUrl,
				);

				let module: any;
				try {
					module = await importer(specifier);
				} catch (err) {
					if (viewConfig.fallback) {
						const fallbackConfig =
							BUILT_IN_VIEWS[viewConfig.fallback] ?? BUILT_IN_VIEWS.delivery;
						const fallbackSpecifier = resolveElementSpecifier(
							packageName,
							packageVersion,
							fallbackConfig,
							moduleResolution,
							cdnBaseUrl,
						);
						try {
							module = await importer(fallbackSpecifier);
						} catch (fallbackErr) {
							reasons.set(tag, {
								kind: "module-load-failed",
								tag,
								specifier: fallbackSpecifier,
								cause:
									fallbackErr instanceof Error
										? fallbackErr.message
										: String(fallbackErr),
							});
							return;
						}
					} else {
						reasons.set(tag, {
							kind: "module-load-failed",
							tag,
							specifier,
							cause: err instanceof Error ? err.message : String(err),
						});
						return;
					}
				}

				const ElementClass = pickElementClass(module, view);
				if (!ElementClass) {
					reasons.set(tag, {
						kind: "no-element-class",
						tag,
						packageName,
					});
					return;
				}

				if (!isCustomElementConstructor(ElementClass)) {
					reasons.set(tag, {
						kind: "not-a-constructor",
						tag,
						packageName,
					});
					return;
				}

				try {
					defineCustomElementSafely(
						actualTag,
						class extends ElementClass {},
						`element tag for ${packageName}`,
					);
				} catch (err) {
					reasons.set(tag, {
						kind: "define-failed",
						tag,
						cause: err instanceof Error ? err.message : String(err),
					});
					return;
				}

				let controller: any = null;
				if (loadControllers) {
					const controllerSpecifier = resolveControllerSpecifier(
						packageName,
						packageVersion,
						moduleResolution,
						cdnBaseUrl,
					);
					try {
						const controllerModule: any = await importer(controllerSpecifier);
						controller = controllerModule?.default ?? controllerModule;
					} catch {
						// Controllers are best-effort; element registration is what the
						// primitive verifies.
					}
				}

				registry[actualTag] = {
					package: packageVersion,
					status: Status.loaded,
					tagName: actualTag,
					element: ElementClass,
					controller,
					config: null,
					bundleType: "esm" as unknown as import("../pie/types.js").BundleType,
				};
			}),
		);

		if (reasons.size > 0) {
			throw new AdapterFailure(reasons);
		}
	}

	return {
		load,
		get __seams() {
			return __seams;
		},
	};
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function defaultImporter(specifier: string): Promise<unknown> {
	// @vite-ignore — dynamic import resolved at runtime.
	return import(/* @vite-ignore */ specifier);
}

function extractPackageName(packageVersion: string): string {
	const parts = packageVersion.split("@");
	return parts.length >= 3 ? `@${parts[1]}` : parts[0];
}

function isJsDelivrNpm(cdnBaseUrl: string): boolean {
	return cdnBaseUrl.includes("cdn.jsdelivr.net/npm");
}

function resolvePackageUrl(packageVersion: string, cdnBaseUrl: string): string {
	if (isJsDelivrNpm(cdnBaseUrl)) {
		return `${cdnBaseUrl}/${packageVersion}/+esm`;
	}
	return `${cdnBaseUrl}/${packageVersion}`;
}

function resolveSubpathUrl(
	packageVersion: string,
	subpath: string,
	cdnBaseUrl: string,
): string {
	const cleanSubpath = subpath.startsWith("/") ? subpath.slice(1) : subpath;
	if (isJsDelivrNpm(cdnBaseUrl)) {
		return `${cdnBaseUrl}/${packageVersion}/${cleanSubpath}/+esm`;
	}
	return `${cdnBaseUrl}/${packageVersion}/${cleanSubpath}`;
}

function resolveControllerUrl(
	packageVersion: string,
	cdnBaseUrl: string,
): string {
	if (isJsDelivrNpm(cdnBaseUrl)) {
		return `${cdnBaseUrl}/${packageVersion}/controller/+esm`;
	}
	return `${cdnBaseUrl}/${packageVersion}/controller`;
}

function resolveElementSpecifier(
	packageName: string,
	packageVersion: string,
	viewConfig: ViewConfig,
	moduleResolution: "url" | "import-map",
	cdnBaseUrl: string,
): string {
	if (moduleResolution === "import-map") {
		return viewConfig.subpath
			? `${packageName}${viewConfig.subpath}`
			: packageName;
	}
	return viewConfig.subpath
		? resolveSubpathUrl(packageVersion, viewConfig.subpath, cdnBaseUrl)
		: resolvePackageUrl(packageVersion, cdnBaseUrl);
}

function resolveControllerSpecifier(
	packageName: string,
	packageVersion: string,
	moduleResolution: "url" | "import-map",
	cdnBaseUrl: string,
): string {
	if (moduleResolution === "import-map") {
		return `${packageName}/controller`;
	}
	return resolveControllerUrl(packageVersion, cdnBaseUrl);
}

function pickElementClass(module: any, view: string): unknown {
	if (!module || typeof module !== "object") return undefined;
	if (view === "author") {
		return module.default ?? module.Configure ?? module.Element;
	}
	if (view === "print") {
		return module.default ?? module.Print ?? module.Element;
	}
	return module.default ?? module.Element;
}

function buildImportMapJson(
	elements: ElementMap,
	viewConfig: ViewConfig,
	cdnBaseUrl: string,
	loadControllers: boolean,
): string {
	const imports: Record<string, string> = {};
	for (const [, pkg] of Object.entries(elements)) {
		const packageName = extractPackageName(pkg);
		imports[packageName] = resolvePackageUrl(pkg, cdnBaseUrl);
		if (viewConfig.subpath) {
			imports[`${packageName}${viewConfig.subpath}`] = resolveSubpathUrl(
				pkg,
				viewConfig.subpath,
				cdnBaseUrl,
			);
		}
		if (loadControllers) {
			imports[`${packageName}/controller`] = resolveControllerUrl(
				pkg,
				cdnBaseUrl,
			);
		}
		if (viewConfig.fallback) {
			const fallbackConfig = BUILT_IN_VIEWS[viewConfig.fallback];
			if (fallbackConfig?.subpath) {
				imports[`${packageName}${fallbackConfig.subpath}`] = resolveSubpathUrl(
					pkg,
					fallbackConfig.subpath,
					cdnBaseUrl,
				);
			}
		}
	}
	return JSON.stringify({ imports }, null, 2);
}

function injectImportMap(json: string, doc: Document): void {
	const script = doc.createElement("script") as HTMLScriptElement;
	script.type = "importmap";
	script.textContent = json;
	doc.head.appendChild(script);
}

function assertImportMapSupported(): void {
	const htmlScriptElement = (
		typeof HTMLScriptElement !== "undefined"
			? HTMLScriptElement
			: undefined
	) as (typeof HTMLScriptElement & {
		supports?: (type: string) => boolean;
	}) | undefined;
	const supports =
		typeof htmlScriptElement?.supports === "function" &&
		htmlScriptElement.supports("importmap");
	if (!supports) {
		throw new Error(
			'This browser does not support import maps. Use moduleResolution="url" or switch to iife/preloaded strategy.',
		);
	}
}
