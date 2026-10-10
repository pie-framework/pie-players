/**
 * ESM backend adapter for the ElementLoader primitive.
 *
 * Loads PIE elements via dynamic `import()` from static browser ESM files on a
 * CDN, optionally resolving bare specifiers through an import map injected into
 * the host document. On any per-tag failure (module load, non-constructor
 * element class, define failure), throws `AdapterFailure` with a structured
 * `reasons` map.
 *
 * Like the IIFE adapter, this module does not gate its own promise on
 * `customElements.whenDefined`; the primitive performs that verification
 * uniformly. Here the adapter's job is narrowly to fetch, extract, and
 * call `customElements.define`.
 */

import {
	compare as compareSemver,
	major as semverMajor,
	minor as semverMinor,
} from "semver";

import { defineCustomElementSafely } from "../pie/custom-element-define.js";
import type { InstrumentationProvider } from "../instrumentation/types.js";
import { isInstrumentationProvider } from "../instrumentation/provider-guards.js";
import { writeRegistryEntry } from "../pie/registry.js";
import { validateCustomElementTag } from "../pie/tag-names.js";
import {
	BundleType,
	isCustomElementConstructor,
	Status,
} from "../pie/types.js";
import { parsePackageName } from "../pie/utils.js";
import type { ElementMap } from "./ElementLoader.js";
import {
	AdapterFailure,
	type BackendContext,
	type ElementLoaderBackend,
	type ElementTag,
	type RegistrationFailureReason,
} from "./element-loader-types.js";
import { isExactSemver } from "./element-package-policy.js";
import { forwardMathjaxEvents } from "./mathjax-events.js";
import { isPlainRecord } from "../object/index.js";

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

export type BuiltInEsmCdnProviderName = "jsdelivr" | "esm.sh";
export type EsmCdnProviderName = BuiltInEsmCdnProviderName | (string & {});

export type EsmCdnProvider = {
	name: EsmCdnProviderName;
	packageJsonUrl(packageVersion: string): string;
	/**
	 * URL of `dist/browser/<view>/index.js`. `view` can be a nested path: an
	 * element's editor-runtime variant is `editor-runtime/<view>`.
	 */
	browserViewUrl(packageVersion: string, view: string): string;
	browserControllerUrl(packageVersion: string): string;
	sharedDependencyUrl(
		dependencyName: string,
		version: string,
		subpath?: string,
	): string;
	/**
	 * URL of the package's `./runtime-support` module. Without it, the file
	 * `dist/runtime-support.js` beside `packageJsonUrl`.
	 */
	runtimeSupportUrl?(packageVersion: string): string;
};

export type EsmCdnProviderOption = EsmCdnProviderName | EsmCdnProvider;

export type EsmBackendConfig = {
	kind: "esm";
	/** Base URL for the ESM CDN (e.g., "https://esm.sh"). */
	cdnBaseUrl: string;
	/** CDN URL strategy. Defaults to jsDelivr, or is inferred from cdnBaseUrl when possible. */
	cdnProvider?: EsmCdnProviderOption;
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
	/** Whether ESM dependency conflict/failure events should be instrumented. */
	trackPageActions?: boolean;
	/** Instrumentation provider for ESM dependency conflict/failure events. */
	instrumentationProvider?: InstrumentationProvider;
};

type PackageMetadata = {
	exports?: Record<string, unknown>;
	dependencies?: Record<string, string>;
	optionalDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
	pie?: {
		browserSharedDependencies?: Record<string, string>;
		/** An element's editor-runtime variant; read by `readEditorRuntimeDeclaration`. */
		browserEditorRuntime?: unknown;
		/** The editor runtime's specifiers and views; read by `readBrowserModules`. */
		browserModules?: unknown;
	};
};

/** @internal */
export type EsmModuleImporter = (specifier: string) => Promise<unknown>;
/** @internal */
export type EsmImportMapObserver = (json: string, doc: Document) => void;
/**
 * The slice of es-module-shims' shim-mode `importShim` this backend uses.
 *
 * @internal
 */
export type EsmImportShim = ((specifier: string) => Promise<unknown>) & {
	addImportMap(importMap: { imports: Record<string, string> }): void;
};
/** @internal */
export type EsmImportShimLoader = () => Promise<EsmImportShim>;
/** @internal */
export type EsmPackageMetadataLoader = (
	packageVersion: string,
	packageJsonUrl: string,
) => Promise<PackageMetadata | null>;

/**
 * Test-only seam exposed via `EsmBackend.__seams`. Lets contract tests
 * inject scripted import behaviour and observe import-map injection
 * without going through the network or the document. Not part of the
 * runtime API; production code must not touch this field.
 *
 * @internal
 */
export type EsmBackendTestSeams = {
	replaceImporter(fn: EsmModuleImporter): void;
	observeImportMapInjection(cb: EsmImportMapObserver): void;
	replacePackageMetadataLoader(fn: EsmPackageMetadataLoader): void;
	replaceImportShimLoader(fn: EsmImportShimLoader): void;
	restore(): void;
};

export type EsmBackend = ElementLoaderBackend & {
	/** @internal Test-only seam — see {@link EsmBackendTestSeams}. */
	readonly __seams: EsmBackendTestSeams;
};

export function createEsmBackend(config: EsmBackendConfig): EsmBackend {
	const cdnBaseUrl = config.cdnBaseUrl.replace(/\/+$/, "");
	const cdnProvider = resolveCdnProvider(config.cdnProvider, cdnBaseUrl);
	const moduleResolution = config.moduleResolution ?? "url";
	const view = config.view ?? "delivery";
	const loadControllers = config.loadControllers ?? true;
	const viewConfig = resolveEsmViewConfig(view, config.viewConfig);
	const browserView = browserViewName(viewConfig, view);

	const injectedPackageVersions = new Set<string>();
	const importMappedPackageVersions = new Map<string, string>();
	/** Packages whose editor-runtime variant this backend loads. */
	const editorRuntimeVariants = new Map<string, EditorRuntimeVariant>();
	/** Packages that do not publish the browser ESM exports this backend loads. */
	const unpublishedPackages = new Map<string, string>();
	/** Windows whose MathJax events this backend forwards. */
	const mathjaxEventViews = new WeakSet<Window>();
	let sharedDependencyVersions: Record<string, string> = {};
	let importer: EsmModuleImporter = defaultImporter;
	let packageMetadataLoader: EsmPackageMetadataLoader =
		defaultPackageMetadataLoader;
	let importMapObserver: EsmImportMapObserver | undefined;
	let importShimLoader: EsmImportShimLoader = defaultImportShimLoader;
	let importShimRequest: Promise<EsmImportShim> | undefined;

	const __seams: EsmBackendTestSeams = {
		replaceImporter(fn) {
			importer = fn;
		},
		observeImportMapInjection(cb) {
			importMapObserver = cb;
		},
		replacePackageMetadataLoader(fn) {
			packageMetadataLoader = fn;
		},
		replaceImportShimLoader(fn) {
			importShimLoader = fn;
			importShimRequest = undefined;
		},
		restore() {
			importer = defaultImporter;
			packageMetadataLoader = defaultPackageMetadataLoader;
			importShimLoader = defaultImportShimLoader;
			importShimRequest = undefined;
			importMapObserver = undefined;
			injectedPackageVersions.clear();
			importMappedPackageVersions.clear();
			editorRuntimeVariants.clear();
			unpublishedPackages.clear();
			sharedDependencyVersions = {};
		},
	};

	async function load(
		elements: ElementMap,
		context: BackendContext,
	): Promise<void> {
		if (!elements || Object.keys(elements).length === 0) return;
		if (moduleResolution === "import-map") {
			assertImportMapSupported();
		}
		forwardMathjaxEventsOf(context.doc);

		const newEntries: ElementMap = {};
		for (const [tag, pkg] of Object.entries(elements)) {
			const packageName = parsePackageName(pkg).name;
			if (moduleResolution === "import-map") {
				const existingVersion = importMappedPackageVersions.get(packageName);
				if (existingVersion && existingVersion !== pkg) {
					throw new Error(
						`Conflicting browser ESM package version for ${packageName}: ${existingVersion} is already mapped, but ${pkg} was requested`,
					);
				}
			}
			if (!injectedPackageVersions.has(pkg)) {
				newEntries[tag] = pkg;
			}
		}
		if (Object.keys(newEntries).length > 0) {
			let importMapResult: BrowserImportMapBuildResult;
			try {
				importMapResult = await buildImportMap(
					newEntries,
					viewConfig,
					cdnProvider,
					loadControllers,
					moduleResolution === "import-map",
					packageMetadataLoader,
					sharedDependencyVersions,
					reportSharedDependencyConflict,
				);
			} catch (err) {
				reportSharedDependencyError(err);
				throw err;
			}
			for (const [pkg, cause] of importMapResult.unpublished) {
				unpublishedPackages.set(pkg, cause);
				if (typeof console !== "undefined" && console.error) {
					console.error(`[pie-esm] ${cause}`);
				}
			}
			const editorRuntime =
				moduleResolution === "url"
					? await prepareEditorRuntime(importMapResult.metadata, context.doc)
					: undefined;
			// Synchronous from here through the injection, so a loader that runs
			// next on this page reads the runtime this one maps.
			const runtimePlan = editorRuntime
				? planEditorRuntime(editorRuntime, context.doc)
				: undefined;
			const imports = withoutMappedSpecifiers(
				{ ...importMapResult.imports, ...runtimePlan?.imports },
				context.doc,
			);
			let injectedMap: HTMLScriptElement | undefined;
			if (Object.keys(imports).length > 0) {
				const json = JSON.stringify({ imports }, null, 2);
				assertImportMapSupported();
				injectedMap = injectImportMap(
					json,
					context.doc,
					runtimePlan?.mappedRuntime,
				);
				importMapObserver?.(json, context.doc);
			}
			for (const [pkg, variant] of runtimePlan?.served ?? []) {
				editorRuntimeVariants.set(pkg, variant);
			}
			sharedDependencyVersions = importMapResult.sharedDependencyVersions;
			for (const pkg of Object.values(newEntries)) {
				injectedPackageVersions.add(pkg);
				if (moduleResolution === "import-map") {
					importMappedPackageVersions.set(parsePackageName(pkg).name, pkg);
				}
			}
			if (injectedMap) {
				await applyImportMap(imports, injectedMap, context.doc);
			}
		}

		const reasons = new Map<ElementTag, RegistrationFailureReason>();

		await Promise.all(
			Object.entries(elements).map(async ([tag, packageVersion]) => {
				const packageName = parsePackageName(packageVersion).name;
				let actualTag: string;
				try {
					actualTag = validateCustomElementTag(
						tag,
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
					cdnProvider,
					view,
				);

				const unpublished = unpublishedPackages.get(packageVersion);
				if (unpublished) {
					reasons.set(tag, {
						kind: "module-load-failed",
						tag,
						specifier,
						cause: unpublished,
					});
					return;
				}

				const variant = editorRuntimeVariants.get(packageVersion);
				let ElementClass: unknown;
				if (variant) {
					ElementClass = await importVariantElementClass(
						packageVersion,
						variant,
						context.doc,
					);
				}

				if (!ElementClass) {
					let module: any;
					try {
						module = await importModule(specifier, context.doc);
					} catch (err) {
						if (viewConfig.fallback) {
							const fallbackConfig =
								BUILT_IN_VIEWS[viewConfig.fallback] ?? BUILT_IN_VIEWS.delivery;
							const fallbackSpecifier = resolveElementSpecifier(
								packageName,
								packageVersion,
								fallbackConfig,
								moduleResolution,
								cdnProvider,
								viewConfig.fallback,
							);
							try {
								module = await importModule(fallbackSpecifier, context.doc);
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

					ElementClass = pickElementClass(module, view);
					if (!ElementClass) {
						reasons.set(tag, {
							kind: "no-element-class",
							tag,
							packageName,
						});
						return;
					}
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
					const servedVariant = editorRuntimeVariants.get(packageVersion);
					const variantController = servedVariant?.views.controller;
					if (servedVariant && variantController) {
						try {
							const controllerModule: any = await importModule(
								cdnProvider.browserViewUrl(packageVersion, variantController),
								context.doc,
							);
							controller = controllerModule?.default ?? controllerModule;
						} catch (err) {
							reportEditorRuntimeFallback(
								packageVersion,
								servedVariant.declaration,
								servedVariant.runtime,
								`its editor-runtime controller failed to load: ${errorMessage(err)}`,
							);
						}
					}
					if (!controller) {
						const controllerSpecifier = resolveControllerSpecifier(
							packageName,
							packageVersion,
							moduleResolution,
							cdnProvider,
						);
						try {
							const controllerModule: any = await importModule(
								controllerSpecifier,
								context.doc,
							);
							controller = controllerModule?.default ?? controllerModule;
						} catch {
							// Controllers are best-effort; element registration is what the
							// primitive verifies.
						}
					}
				}

				writeRegistryEntry({
					package: packageVersion,
					status: Status.loaded,
					tagName: actualTag,
					element: ElementClass,
					controller,
					config: null,
					bundleType: BundleType.esm,
				});
			}),
		);

		if (reasons.size > 0) {
			throw new AdapterFailure(reasons);
		}
	}

	/**
	 * The element class of a package's editor-runtime variant, or `undefined`
	 * after reporting why it cannot load, so the caller loads `./browser/*`.
	 */
	async function importVariantElementClass(
		packageVersion: string,
		variant: EditorRuntimeVariant,
		doc: Document,
	): Promise<unknown> {
		const specifier = cdnProvider.browserViewUrl(
			packageVersion,
			variant.views[browserView],
		);
		try {
			const ElementClass = pickElementClass(
				await importModule(specifier, doc),
				view,
			);
			if (isCustomElementConstructor(ElementClass)) return ElementClass;
			throw new Error(`${specifier} exports no custom element class`);
		} catch (err) {
			editorRuntimeVariants.delete(packageVersion);
			reportEditorRuntimeFallback(
				packageVersion,
				variant.declaration,
				variant.runtime,
				`its editor-runtime ${browserView} view failed to load: ${errorMessage(err)}`,
			);
			return undefined;
		}
	}

	/**
	 * Imports through the browser, or through es-module-shims once the document
	 * has rejected an import map, after every map a backend added has settled.
	 */
	async function importModule(
		specifier: string,
		doc: Document,
	): Promise<unknown> {
		await importMapsSettled(doc);
		if (!documentUsesImportShim(doc)) return importer(specifier);
		return (await importShim(doc))(specifier);
	}

	/**
	 * Settles the map this backend just added: es-module-shims takes it in a
	 * document that already uses it, and otherwise the browser has either
	 * applied it or rejected it.
	 */
	async function applyImportMap(
		imports: Record<string, string>,
		script: HTMLScriptElement,
		doc: Document,
	): Promise<void> {
		let state: "applied" | "rejected" = "applied";
		try {
			if (script.type === SHIM_IMPORT_MAP_TYPE) {
				(await importShim(doc)).addImportMap({ imports });
			} else if (await importMapRejected(imports)) {
				state = "rejected";
				await importShim(doc);
			}
		} finally {
			settleImportMap(script, state);
		}
	}

	/**
	 * Whether the browser rejected a map this backend added. Firefox rejects
	 * every import map added after the page's first module load, so a specifier
	 * the map defines fails to resolve while the module it maps to loads. When
	 * that module fails too, the map is not the cause, and the element imports
	 * report the failure.
	 */
	async function importMapRejected(
		imports: Record<string, string>,
	): Promise<boolean> {
		const specifier = "react" in imports ? "react" : Object.keys(imports)[0];
		try {
			await importer(specifier);
			return false;
		} catch {
			// Resolved below: the map, or the module it maps to.
		}
		try {
			await importer(imports[specifier]);
		} catch {
			return false;
		}
		return true;
	}

	/**
	 * es-module-shims, holding every map in `doc`: the rejected ones, and any
	 * the browser applied before, so both resolve the same way.
	 */
	function importShim(doc: Document): Promise<EsmImportShim> {
		importShimRequest ??= importShimLoader().then(
			(shim) => {
				shim.addImportMap({ imports: documentImports(doc) });
				return shim;
			},
			(err) => {
				importShimRequest = undefined;
				throw err;
			},
		);
		return importShimRequest;
	}

	/**
	 * Collect the packages whose variant covers this backend's view and, when
	 * the page maps no editor runtime yet, fetch the metadata of the one to map.
	 */
	async function prepareEditorRuntime(
		metadataByPackage: Map<string, PackageMetadata | null>,
		doc: Document,
	): Promise<PreparedEditorRuntime> {
		const candidates: EditorRuntimeCandidate[] = [];
		for (const [packageVersion, metadata] of metadataByPackage) {
			const declaration = readEditorRuntimeDeclaration(metadata);
			if (declaration === undefined) continue;
			if (declaration === null) {
				reportEditorRuntimeFallback(
					packageVersion,
					undefined,
					undefined,
					"its pie.browserEditorRuntime declaration is invalid",
				);
				continue;
			}
			if (declaration.views[browserView]) {
				candidates.push({ packageVersion, declaration });
			}
		}
		if (candidates.length === 0) return { candidates };
		if (!importMapsSupported()) {
			for (const { packageVersion, declaration } of candidates) {
				reportEditorRuntimeFallback(
					packageVersion,
					declaration,
					undefined,
					"this browser does not support import maps",
				);
			}
			return { candidates: [] };
		}
		if (readMappedEditorRuntime(doc)) return { candidates };
		const runtime = highestDeclaredEditorRuntime(candidates);
		return {
			candidates,
			target: { runtime, ...(await loadEditorRuntimeModules(runtime)) },
		};
	}

	async function loadEditorRuntimeModules(
		runtime: EditorRuntimeRef,
	): Promise<{ modules?: Record<string, string>; failure?: string }> {
		const runtimeVersion = `${runtime.name}@${runtime.version}`;
		let metadata: PackageMetadata | null;
		try {
			metadata = await packageMetadataLoader(
				runtimeVersion,
				cdnProvider.packageJsonUrl(runtimeVersion),
			);
		} catch (err) {
			return {
				failure: `the package.json of ${runtimeVersion} could not be loaded: ${errorMessage(err)}`,
			};
		}
		if (!metadata) {
			return {
				failure: `the package.json of ${runtimeVersion} could not be loaded`,
			};
		}
		const modules = readBrowserModules(metadata);
		return modules
			? { modules }
			: { failure: `${runtimeVersion} declares no valid pie.browserModules` };
	}

	/**
	 * Decide which packages the page's editor runtime serves, and the entries
	 * that map it when the page maps none yet. Runs synchronously up to the
	 * import-map injection, so it reads the runtime any other loader mapped
	 * while this one awaited metadata.
	 */
	function planEditorRuntime(
		prepared: PreparedEditorRuntime,
		doc: Document,
	): EditorRuntimePlan {
		const plan: EditorRuntimePlan = { imports: {}, served: new Map() };
		if (prepared.candidates.length === 0) return plan;

		let runtime = readMappedEditorRuntime(doc);
		if (!runtime) {
			const { target } = prepared;
			let failure = target?.failure;
			if (target?.modules) {
				const taken = documentImports(doc);
				const mapped = Object.keys(target.modules).find(
					(specifier) => specifier in taken,
				);
				if (mapped) failure = `the page already maps ${mapped}`;
			}
			if (failure || !target?.modules) {
				for (const { packageVersion, declaration } of prepared.candidates) {
					reportEditorRuntimeFallback(
						packageVersion,
						declaration,
						undefined,
						failure ?? "the page no longer maps its editor runtime",
					);
				}
				return plan;
			}
			runtime = target.runtime;
			const runtimeVersion = `${runtime.name}@${runtime.version}`;
			for (const [specifier, runtimeView] of Object.entries(target.modules)) {
				plan.imports[specifier] = cdnProvider.browserViewUrl(
					runtimeVersion,
					runtimeView,
				);
			}
			plan.mappedRuntime = runtimeVersion;
		}

		for (const { packageVersion, declaration } of prepared.candidates) {
			if (!canServeEditorRuntime(runtime, declaration)) {
				reportEditorRuntimeFallback(
					packageVersion,
					declaration,
					runtime,
					`the page maps ${runtime.name}@${runtime.version}, which cannot serve ${declaration.name}@${declaration.version}`,
				);
				continue;
			}
			plan.served.set(packageVersion, {
				views: declaration.views,
				declaration,
				runtime,
			});
			if (declaration.version !== runtime.version) {
				reportSharedDependencyConflict({
					dependencyName: runtime.name,
					existingVersion: runtime.version,
					requestedVersion: declaration.version,
					resolvedVersion: runtime.version,
					packageVersion,
				});
			}
		}
		return plan;
	}

	function getInstrumentationProvider(): InstrumentationProvider | undefined {
		if (!config.trackPageActions) return undefined;
		const provider = config.instrumentationProvider;
		if (!isInstrumentationProvider(provider)) return undefined;
		if (!provider.isReady()) return undefined;
		return provider;
	}

	function forwardMathjaxEventsOf(doc: Document): void {
		const view = doc.defaultView;
		if (!view || mathjaxEventViews.has(view)) return;
		mathjaxEventViews.add(view);
		forwardMathjaxEvents(view, getInstrumentationProvider);
	}

	function reportSharedDependencyConflict(
		attributes: Record<string, unknown>,
		message = `[pie-esm] Shared dependency version conflict resolved for ${String(attributes.dependencyName)}`,
	): void {
		if (typeof console !== "undefined" && console.warn) {
			console.warn(message, attributes);
		}
		const provider = getInstrumentationProvider();
		if (!provider) return;
		try {
			provider.trackEvent("pie-esm-shared-dependency-conflict", attributes);
		} catch {
			// Swallow: instrumentation must never break loading.
		}
	}

	/** Report a package that loads `./browser/*` although it declares a variant. */
	function reportEditorRuntimeFallback(
		packageVersion: string,
		declaration: EditorRuntimeDeclaration | undefined,
		runtime: EditorRuntimeRef | undefined,
		reason: string,
	): void {
		reportSharedDependencyConflict(
			{
				dependencyName: declaration?.name,
				existingVersion: runtime?.version,
				requestedVersion: declaration?.version,
				packageVersion,
				fallback: "./browser/*",
				reason,
			},
			`[pie-esm] ${packageVersion} loads ./browser/* in place of its editor-runtime variant: ${reason}`,
		);
	}

	function reportSharedDependencyError(error: unknown): void {
		const err = error instanceof Error ? error : new Error(String(error));
		if (typeof console !== "undefined" && console.error) {
			console.error("[pie-esm] Shared dependency resolution failed", err);
		}
		const provider = getInstrumentationProvider();
		if (!provider) return;
		try {
			provider.trackError(err, {
				component: "esm-adapter",
				errorType: "EsmSharedDependencyError",
			});
		} catch {
			// Swallow: instrumentation must never break loading.
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

export function mapEsmViewElements(
	elements: ElementMap,
	view = "delivery",
	viewConfig?: ViewConfig,
): ElementMap {
	const resolvedViewConfig = resolveEsmViewConfig(view, viewConfig);
	return Object.fromEntries(
		Object.entries(elements).map(([tag, packageVersion]) => [
			`${tag}${resolvedViewConfig.tagSuffix}`,
			packageVersion,
		]),
	);
}

function defaultImporter(specifier: string): Promise<unknown> {
	// @vite-ignore — dynamic import resolved at runtime.
	return import(/* webpackIgnore: true */ /* @vite-ignore */ specifier);
}

/**
 * One request per package.json URL, shared by every backend on the page: the
 * players on a page read the metadata of the same element versions and of the
 * same editor runtime. A request that fails or finds no metadata is dropped
 * once it settles, so a later load asks again.
 */
const packageMetadataRequests = new Map<
	string,
	Promise<PackageMetadata | null>
>();

/** @internal Test-only: drops every shared package.json request. */
export function clearPackageMetadataRequests(): void {
	packageMetadataRequests.clear();
}

function defaultPackageMetadataLoader(
	packageVersion: string,
	packageJsonUrl: string,
): Promise<PackageMetadata | null> {
	const pending = packageMetadataRequests.get(packageJsonUrl);
	if (pending) return pending;
	const request = fetchPackageMetadata(packageJsonUrl);
	packageMetadataRequests.set(packageJsonUrl, request);
	const forget = () => {
		if (packageMetadataRequests.get(packageJsonUrl) === request) {
			packageMetadataRequests.delete(packageJsonUrl);
		}
	};
	request.then((metadata) => {
		if (metadata === null) forget();
	}, forget);
	return request;
}

async function fetchPackageMetadata(
	packageJsonUrl: string,
): Promise<PackageMetadata | null> {
	const browserFetch =
		typeof window !== "undefined" &&
		typeof (window as Window & { fetch?: typeof fetch }).fetch === "function"
			? (window as Window & { fetch: typeof fetch }).fetch.bind(window)
			: undefined;
	if (!browserFetch) {
		return null;
	}

	const response = await browserFetch(packageJsonUrl);
	if (!response.ok) {
		return null;
	}
	return (await response.json()) as PackageMetadata;
}

const RUNTIME_SUPPORT_PATH = "dist/runtime-support.js";

/**
 * URL of a package's `./runtime-support` module on the ESM CDN the players load
 * elements from, or `undefined` when a custom provider names no package root.
 */
export function resolveEsmRuntimeSupportUrl(
	packageVersion: string,
	options: { cdnBaseUrl: string; cdnProvider?: EsmCdnProviderOption },
): string | undefined {
	const cdnBaseUrl = options.cdnBaseUrl.replace(/\/+$/, "");
	const provider = resolveCdnProvider(options.cdnProvider, cdnBaseUrl);
	if (typeof provider.runtimeSupportUrl === "function") {
		return provider.runtimeSupportUrl(packageVersion);
	}
	const packageJsonUrl = provider.packageJsonUrl(packageVersion);
	return packageJsonUrl.endsWith("/package.json")
		? `${packageJsonUrl.slice(0, -"package.json".length)}${RUNTIME_SUPPORT_PATH}`
		: undefined;
}

/** A package the probe below names, so a provider URL ends in its `<package>@<version>` path. */
const ROOT_PROBE_PACKAGE = "@pie-element/shared-math-rendering-mathjax@0.0.0";

/**
 * The npm root the ESM CDN the players load elements from serves raw package
 * files under, `<root>/<package>@<version>/<path>`: the base URL for jsDelivr,
 * raw.esm.sh for esm.sh, and for a custom provider whatever its
 * `packageJsonUrl` puts before the package. `undefined` when that URL names
 * no such root.
 */
export function resolveEsmAssetRoot(options: {
	cdnBaseUrl: string;
	cdnProvider?: EsmCdnProviderOption;
}): string | undefined {
	const cdnBaseUrl = options.cdnBaseUrl.replace(/\/+$/, "");
	const provider = resolveCdnProvider(options.cdnProvider, cdnBaseUrl);
	const suffix = `/${ROOT_PROBE_PACKAGE}/package.json`;
	const packageJsonUrl = provider.packageJsonUrl(ROOT_PROBE_PACKAGE);
	return packageJsonUrl.endsWith(suffix)
		? packageJsonUrl.slice(0, -suffix.length) || undefined
		: undefined;
}

function resolveCdnProvider(
	provider: EsmCdnProviderOption | undefined,
	cdnBaseUrl: string,
): EsmCdnProvider {
	if (isEsmCdnProvider(provider)) return provider;
	const resolvedProviderName =
		provider ?? (cdnBaseUrl.includes("esm.sh") ? "esm.sh" : "jsdelivr");
	if (resolvedProviderName === "esm.sh") {
		return createEsmShProvider(cdnBaseUrl);
	}
	return createJsDelivrProvider(cdnBaseUrl, resolvedProviderName);
}

function isEsmCdnProvider(value: unknown): value is EsmCdnProvider {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<Record<keyof EsmCdnProvider, unknown>>;
	return (
		typeof candidate.name === "string" &&
		typeof candidate.packageJsonUrl === "function" &&
		typeof candidate.browserViewUrl === "function" &&
		typeof candidate.browserControllerUrl === "function" &&
		typeof candidate.sharedDependencyUrl === "function"
	);
}

function createJsDelivrProvider(
	cdnBaseUrl: string,
	name: EsmCdnProviderName = "jsdelivr",
): EsmCdnProvider {
	return {
		name,
		packageJsonUrl: (packageVersion) =>
			`${cdnBaseUrl}/${packageVersion}/package.json`,
		browserViewUrl: (packageVersion, view) =>
			`${cdnBaseUrl}/${packageVersion}/dist/browser/${view}/index.js`,
		browserControllerUrl: (packageVersion) =>
			`${cdnBaseUrl}/${packageVersion}/dist/browser/controller/index.js`,
		runtimeSupportUrl: (packageVersion) =>
			`${cdnBaseUrl}/${packageVersion}/${RUNTIME_SUPPORT_PATH}`,
		sharedDependencyUrl: (dependencyName, version, subpath) => {
			const suffix = subpath ? `/${subpath}/+esm` : "/+esm";
			return `${cdnBaseUrl}/${dependencyName}@${version}${suffix}`;
		},
	};
}

function createEsmShProvider(cdnBaseUrl: string): EsmCdnProvider {
	const esmBaseUrl = cdnBaseUrl.replace(/\/+$/, "");
	const rawBaseUrl = toRawEsmShBaseUrl(esmBaseUrl);
	return {
		name: "esm.sh",
		packageJsonUrl: (packageVersion) =>
			`${rawBaseUrl}/${packageVersion}/package.json`,
		browserViewUrl: (packageVersion, view) =>
			`${rawBaseUrl}/${packageVersion}/dist/browser/${view}/index.js`,
		browserControllerUrl: (packageVersion) =>
			`${rawBaseUrl}/${packageVersion}/dist/browser/controller/index.js`,
		runtimeSupportUrl: (packageVersion) =>
			`${rawBaseUrl}/${packageVersion}/${RUNTIME_SUPPORT_PATH}`,
		sharedDependencyUrl: (dependencyName, version, subpath) => {
			const suffix = subpath ? `/${subpath}` : "";
			return `${esmBaseUrl}/${dependencyName}@${version}${suffix}`;
		},
	};
}

function toRawEsmShBaseUrl(cdnBaseUrl: string): string {
	try {
		const url = new URL(cdnBaseUrl);
		if (url.hostname === "raw.esm.sh")
			return url.toString().replace(/\/+$/, "");
		if (url.hostname === "esm.sh") {
			url.hostname = "raw.esm.sh";
			return url.toString().replace(/\/+$/, "");
		}
	} catch {
		// Fall through to the public raw endpoint for non-URL test fixtures.
	}
	return "https://raw.esm.sh";
}

function resolveEsmViewConfig(
	view: string,
	viewConfig?: ViewConfig,
): ViewConfig {
	return viewConfig ?? BUILT_IN_VIEWS[view] ?? BUILT_IN_VIEWS.delivery;
}

/**
 * Why a package cannot load this view as browser ESM, or `undefined` when its
 * metadata publishes every export the view needs or names no exports.
 */
function missingBrowserEsmExport(
	metadata: PackageMetadata | null,
	packageVersion: string,
	viewConfig: ViewConfig,
	loadControllers: boolean,
	viewName: string,
): string | undefined {
	if (!metadata?.exports) return undefined;

	const requiredExports = new Set<string>([
		`./browser/${browserViewName(viewConfig, viewName)}`,
	]);
	if (viewConfig.fallback) {
		const fallbackConfig = BUILT_IN_VIEWS[viewConfig.fallback];
		if (fallbackConfig) {
			requiredExports.add(
				`./browser/${browserViewName(fallbackConfig, viewConfig.fallback)}`,
			);
		}
	}
	if (loadControllers) {
		requiredExports.add("./browser/controller");
	}

	for (const exportKey of requiredExports) {
		if (!(exportKey in metadata.exports)) {
			return `${packageVersion} does not publish browser ESM export ${exportKey}; use IIFE/preloaded mode or publish browser ESM artifacts first`;
		}
	}
	return undefined;
}

function cleanViewSubpath(subpath: string): string | null {
	const cleanSubpath = subpath.replace(/^\/+|\/+$/g, "");
	return cleanSubpath.length > 0 ? cleanSubpath : null;
}

function browserViewName(
	viewConfig: ViewConfig,
	viewName = "delivery",
): string {
	const subpathView = cleanViewSubpath(viewConfig.subpath);
	return subpathView ?? viewName;
}

function resolveBrowserViewUrl(
	packageVersion: string,
	viewConfig: ViewConfig,
	cdnProvider: EsmCdnProvider,
	viewName = "delivery",
): string {
	const view = browserViewName(viewConfig, viewName);
	return cdnProvider.browserViewUrl(packageVersion, view);
}

function resolveBrowserControllerUrl(
	packageVersion: string,
	cdnProvider: EsmCdnProvider,
): string {
	return cdnProvider.browserControllerUrl(packageVersion);
}

function resolveElementSpecifier(
	packageName: string,
	packageVersion: string,
	viewConfig: ViewConfig,
	moduleResolution: "url" | "import-map",
	cdnProvider: EsmCdnProvider,
	viewName: string,
): string {
	if (moduleResolution === "import-map") {
		return viewConfig.subpath
			? `${packageName}${viewConfig.subpath}`
			: packageName;
	}
	return resolveBrowserViewUrl(
		packageVersion,
		viewConfig,
		cdnProvider,
		viewName,
	);
}

function resolveControllerSpecifier(
	packageName: string,
	packageVersion: string,
	moduleResolution: "url" | "import-map",
	cdnProvider: EsmCdnProvider,
): string {
	if (moduleResolution === "import-map") {
		return `${packageName}/controller`;
	}
	return resolveBrowserControllerUrl(packageVersion, cdnProvider);
}

export function pickElementClass(module: any, view: string): unknown {
	if (!module || typeof module !== "object") return undefined;
	if (view === "author") {
		return module.default ?? module.Configure ?? module.Element;
	}
	if (view === "print") {
		return module.default ?? module.Print ?? module.Element;
	}
	return module.default ?? module.Element;
}

const SHARED_BROWSER_DEPENDENCIES = ["react", "react-dom"] as const;

function declaredSharedDependencyVersion(
	metadata: PackageMetadata | null,
	dependencyName: (typeof SHARED_BROWSER_DEPENDENCIES)[number],
	packageVersion: string,
): string | undefined {
	const version = metadata?.pie?.browserSharedDependencies?.[dependencyName];
	if (!version) {
		throw new Error(
			`${packageVersion} is missing required pie.browserSharedDependencies.${dependencyName}`,
		);
	}
	if (!isExactSemver(version)) {
		throw new Error(
			`${packageVersion} pie.browserSharedDependencies.${dependencyName} must be an exact version; received "${version}"`,
		);
	}
	return version;
}

function packageUsesSharedDependency(
	metadata: PackageMetadata | null,
	dependencyName: (typeof SHARED_BROWSER_DEPENDENCIES)[number],
): boolean {
	return Boolean(
		metadata?.pie?.browserSharedDependencies?.[dependencyName] ||
			metadata?.peerDependencies?.[dependencyName] ||
			metadata?.dependencies?.[dependencyName] ||
			metadata?.optionalDependencies?.[dependencyName],
	);
}

function addSharedDependencyImports(
	imports: Record<string, string>,
	selectedVersions: Record<string, string>,
	lockedVersions: Set<string>,
	dependencyName: (typeof SHARED_BROWSER_DEPENDENCIES)[number],
	version: string | undefined,
	cdnProvider: EsmCdnProvider,
	packageVersion: string,
	onConflict: (attributes: Record<string, unknown>) => void,
): void {
	if (!version) {
		return;
	}

	const currentVersion = selectedVersions[dependencyName];
	let resolvedVersion = version;
	if (currentVersion && currentVersion !== version) {
		resolvedVersion = resolveSharedDependencyVersion(
			dependencyName,
			currentVersion,
			version,
			packageVersion,
			lockedVersions.has(dependencyName),
		);
		onConflict({
			dependencyName,
			existingVersion: currentVersion,
			requestedVersion: version,
			resolvedVersion,
			packageVersion,
		});
	}
	selectedVersions[dependencyName] = resolvedVersion;

	imports[dependencyName] = cdnProvider.sharedDependencyUrl(
		dependencyName,
		resolvedVersion,
	);
	if (dependencyName === "react") {
		imports["react/jsx-runtime"] = cdnProvider.sharedDependencyUrl(
			"react",
			resolvedVersion,
			"jsx-runtime",
		);
		imports["react/jsx-dev-runtime"] = cdnProvider.sharedDependencyUrl(
			"react",
			resolvedVersion,
			"jsx-dev-runtime",
		);
	}
	if (dependencyName === "react-dom") {
		imports["react-dom/client"] = cdnProvider.sharedDependencyUrl(
			"react-dom",
			resolvedVersion,
			"client",
		);
	}
}

/** Versions are exact semver, validated before they are compared. */
function resolveSharedDependencyVersion(
	dependencyName: string,
	currentVersion: string,
	requestedVersion: string,
	packageVersion: string,
	isLocked: boolean,
): string {
	if (semverMajor(currentVersion) !== semverMajor(requestedVersion)) {
		throw new Error(
			`Conflicting shared browser dependency ${dependencyName}: ${currentVersion} vs ${requestedVersion} from ${packageVersion}; different major versions cannot share one browser singleton`,
		);
	}
	if (isLocked && compareSemver(requestedVersion, currentVersion) > 0) {
		throw new Error(
			`Conflicting shared browser dependency ${dependencyName}: ${currentVersion} is already selected, but ${packageVersion} requires higher version ${requestedVersion}; the browser singleton cannot be upgraded after import-map injection`,
		);
	}
	return compareSemver(currentVersion, requestedVersion) >= 0
		? currentVersion
		: requestedVersion;
}

type BrowserImportMapBuildResult = {
	imports: Record<string, string>;
	sharedDependencyVersions: Record<string, string>;
	/** Metadata of each package that publishes the exports the view needs. */
	metadata: Map<string, PackageMetadata | null>;
	/** Why each other package cannot load the view. */
	unpublished: Map<string, string>;
};

async function buildImportMap(
	elements: ElementMap,
	viewConfig: ViewConfig,
	cdnProvider: EsmCdnProvider,
	loadControllers: boolean,
	includeElementImports: boolean,
	packageMetadataLoader: EsmPackageMetadataLoader,
	currentSharedDependencyVersions: Record<string, string>,
	onConflict: (attributes: Record<string, unknown>) => void,
): Promise<BrowserImportMapBuildResult> {
	const imports: Record<string, string> = {};
	const selectedVersions: Record<string, string> = {
		...currentSharedDependencyVersions,
	};
	const lockedVersions = new Set(Object.keys(currentSharedDependencyVersions));
	const metadataByPackage = new Map<string, PackageMetadata | null>();
	const unpublished = new Map<string, string>();
	for (const [, pkg] of Object.entries(elements)) {
		const metadata = await packageMetadataLoader(
			pkg,
			cdnProvider.packageJsonUrl(pkg),
		);
		const missingExport = missingBrowserEsmExport(
			metadata,
			pkg,
			viewConfig,
			loadControllers,
			cleanViewSubpath(viewConfig.subpath) ?? "delivery",
		);
		if (missingExport) {
			unpublished.set(pkg, missingExport);
			continue;
		}
		metadataByPackage.set(pkg, metadata);
		const packageName = parsePackageName(pkg).name;
		if (includeElementImports) {
			imports[packageName] = resolveBrowserViewUrl(
				pkg,
				BUILT_IN_VIEWS.delivery,
				cdnProvider,
				"delivery",
			);
			if (viewConfig.subpath) {
				imports[`${packageName}${viewConfig.subpath}`] = resolveBrowserViewUrl(
					pkg,
					viewConfig,
					cdnProvider,
					cleanViewSubpath(viewConfig.subpath) ?? "delivery",
				);
			}
			if (loadControllers) {
				imports[`${packageName}/controller`] = resolveBrowserControllerUrl(
					pkg,
					cdnProvider,
				);
			}
			if (viewConfig.fallback) {
				const fallbackConfig = BUILT_IN_VIEWS[viewConfig.fallback];
				if (fallbackConfig) {
					const fallbackSpecifier = fallbackConfig.subpath
						? `${packageName}${fallbackConfig.subpath}`
						: packageName;
					imports[fallbackSpecifier] = resolveBrowserViewUrl(
						pkg,
						fallbackConfig,
						cdnProvider,
						viewConfig.fallback,
					);
				}
			}
		}

		for (const dependencyName of SHARED_BROWSER_DEPENDENCIES) {
			if (!packageUsesSharedDependency(metadata, dependencyName)) {
				continue;
			}
			addSharedDependencyImports(
				imports,
				selectedVersions,
				lockedVersions,
				dependencyName,
				declaredSharedDependencyVersion(metadata, dependencyName, pkg),
				cdnProvider,
				pkg,
				onConflict,
			);
		}
	}
	return {
		imports,
		sharedDependencyVersions: selectedVersions,
		metadata: metadataByPackage,
		unpublished,
	};
}

// ─── Shared editor runtime ───────────────────────────────────────────────────

/**
 * Names the editor runtime an injected import map maps, as `<name>@<version>`.
 * The document holds it because every loader on the page, whichever backend
 * or players-shared copy runs it, shares the one import map.
 */
const EDITOR_RUNTIME_ATTRIBUTE = "data-pie-editor-runtime";

/** A variant's module path under `dist/browser`, by browser view name. */
type EditorRuntimeViews = Readonly<Record<string, string>>;

type EditorRuntimeRef = { name: string; version: string };

/** An element's `pie.browserEditorRuntime`. */
type EditorRuntimeDeclaration = EditorRuntimeRef & {
	views: EditorRuntimeViews;
};

type EditorRuntimeCandidate = {
	packageVersion: string;
	declaration: EditorRuntimeDeclaration;
};

type EditorRuntimeVariant = {
	views: EditorRuntimeViews;
	declaration: EditorRuntimeDeclaration;
	/** The runtime the page serves the variant from. */
	runtime: EditorRuntimeRef;
};

type PreparedEditorRuntime = {
	/** Packages whose variant covers the backend's view. */
	candidates: EditorRuntimeCandidate[];
	/** When the page mapped no runtime: the one to map, with its modules. */
	target?: {
		runtime: EditorRuntimeRef;
		modules?: Record<string, string>;
		failure?: string;
	};
};

type EditorRuntimePlan = {
	/** Entries mapping the runtime; empty when the page already maps one. */
	imports: Record<string, string>;
	/** `<name>@<version>` of the runtime `imports` maps. */
	mappedRuntime?: string;
	served: Map<string, EditorRuntimeVariant>;
};

const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;
/** Slash-separated segments, none starting with a dot. */
const BROWSER_VIEW_PATH =
	/^[A-Za-z0-9_-][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;
const BARE_SPECIFIER =
	/^(?:@[A-Za-z0-9_-][A-Za-z0-9._-]*\/)?[A-Za-z0-9_-][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;

/**
 * A package's `pie.browserEditorRuntime`: `undefined` when it declares none,
 * `null` when the declaration is malformed.
 */
function readEditorRuntimeDeclaration(
	metadata: PackageMetadata | null | undefined,
): EditorRuntimeDeclaration | null | undefined {
	const declared = metadata?.pie?.browserEditorRuntime;
	if (declared === undefined) return undefined;
	if (!isPlainRecord(declared) || !isPlainRecord(declared.views)) return null;
	const { name, version } = declared;
	if (typeof name !== "string" || !PACKAGE_NAME.test(name)) return null;
	if (typeof version !== "string" || !isExactSemver(version)) return null;
	const views = Object.entries(declared.views);
	if (
		views.length === 0 ||
		!views.every(
			([, path]) => typeof path === "string" && BROWSER_VIEW_PATH.test(path),
		)
	) {
		return null;
	}
	return {
		name,
		version,
		views: Object.fromEntries(views) as Record<string, string>,
	};
}

/**
 * The editor runtime's `pie.browserModules`, or `null` when it is missing or
 * malformed. A runtime has no React import, so it maps no React specifier.
 */
function readBrowserModules(
	metadata: PackageMetadata,
): Record<string, string> | null {
	const declared = metadata.pie?.browserModules;
	if (!isPlainRecord(declared)) return null;
	const modules = Object.entries(declared);
	const valid =
		modules.length > 0 &&
		modules.every(
			([specifier, view]) =>
				BARE_SPECIFIER.test(specifier) &&
				!SHARED_BROWSER_DEPENDENCIES.some(
					(dependency) =>
						specifier === dependency || specifier.startsWith(`${dependency}/`),
				) &&
				typeof view === "string" &&
				BROWSER_VIEW_PATH.test(view),
		);
	return valid ? (Object.fromEntries(modules) as Record<string, string>) : null;
}

/** The highest runtime version the candidates declare, by semver precedence. */
function highestDeclaredEditorRuntime(
	candidates: EditorRuntimeCandidate[],
): EditorRuntimeRef {
	const { name } = candidates[0].declaration;
	let { version } = candidates[0].declaration;
	for (const { declaration } of candidates) {
		if (
			declaration.name === name &&
			compareSemver(declaration.version, version) > 0
		) {
			version = declaration.version;
		}
	}
	return { name, version };
}

/**
 * A runtime serves a variant built against a version in its caret range (the
 * same major, and below 1.0.0 the same minor) at or below its own.
 */
function canServeEditorRuntime(
	runtime: EditorRuntimeRef,
	declaration: EditorRuntimeRef,
): boolean {
	if (runtime.name !== declaration.name) return false;
	if (semverMajor(runtime.version) !== semverMajor(declaration.version)) {
		return false;
	}
	if (
		semverMajor(runtime.version) === 0 &&
		semverMinor(runtime.version) !== semverMinor(declaration.version)
	) {
		return false;
	}
	return compareSemver(runtime.version, declaration.version) >= 0;
}

function importMapScripts(doc: Document): Element[] {
	return typeof doc.querySelectorAll === "function"
		? Array.from(
				doc.querySelectorAll(
					`script[type="importmap"], script[type="${SHIM_IMPORT_MAP_TYPE}"]`,
				),
			)
		: [];
}

/** The editor runtime an import map in the document maps, first map first. */
function readMappedEditorRuntime(doc: Document): EditorRuntimeRef | null {
	for (const script of importMapScripts(doc)) {
		const mapped = script.getAttribute(EDITOR_RUNTIME_ATTRIBUTE);
		const at = mapped?.lastIndexOf("@") ?? -1;
		if (!mapped || at <= 0) continue;
		const name = mapped.slice(0, at);
		const version = mapped.slice(at + 1);
		if (PACKAGE_NAME.test(name) && isExactSemver(version)) {
			return { name, version };
		}
	}
	return null;
}

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/**
 * Drop the specifiers an import map already in the document maps. The browser
 * keeps the first rule for a specifier and discards a later one with a console
 * warning, so injecting them changes no resolution.
 */
function withoutMappedSpecifiers(
	imports: Record<string, string>,
	doc: Document,
): Record<string, string> {
	const mapped = documentImports(doc);
	return Object.fromEntries(
		Object.entries(imports).filter(([specifier]) => !(specifier in mapped)),
	);
}

/**
 * Whether the browser applied an import map this backend added, recorded on
 * the map so every player and every copy of this module on the page reads the
 * same answer: `pending` until the backend knows, then `applied` or
 * `rejected`. A document with a rejected map loads elements through
 * es-module-shims.
 */
const IMPORT_MAP_STATE_ATTRIBUTE = "data-pie-import-map";
const IMPORT_MAP_SETTLED_EVENT = "pie-import-map-settled";
const SHIM_IMPORT_MAP_TYPE = "importmap-shim";

function injectImportMap(
	json: string,
	doc: Document,
	editorRuntime?: string,
): HTMLScriptElement {
	const script = doc.createElement("script") as HTMLScriptElement;
	script.type = documentUsesImportShim(doc)
		? SHIM_IMPORT_MAP_TYPE
		: "importmap";
	script.setAttribute(IMPORT_MAP_STATE_ATTRIBUTE, "pending");
	if (editorRuntime)
		script.setAttribute(EDITOR_RUNTIME_ATTRIBUTE, editorRuntime);
	script.textContent = json;
	doc.head.appendChild(script);
	return script;
}

function settleImportMap(
	script: HTMLScriptElement,
	state: "applied" | "rejected",
): void {
	script.setAttribute(IMPORT_MAP_STATE_ATTRIBUTE, state);
	script.dispatchEvent(new Event(IMPORT_MAP_SETTLED_EVENT));
}

function documentUsesImportShim(doc: Document): boolean {
	return importMapScripts(doc).some(
		(script) => script.getAttribute(IMPORT_MAP_STATE_ATTRIBUTE) === "rejected",
	);
}

/** Resolves once no import map a PIE backend added to `doc` is pending. */
async function importMapsSettled(doc: Document): Promise<void> {
	const pending = importMapScripts(doc).filter(
		(script) => script.getAttribute(IMPORT_MAP_STATE_ATTRIBUTE) === "pending",
	);
	await Promise.all(
		pending.map(
			(script) =>
				new Promise<void>((resolve) =>
					script.addEventListener(IMPORT_MAP_SETTLED_EVENT, () => resolve(), {
						once: true,
					}),
				),
		),
	);
}

/**
 * Every mapping the import maps in `doc` define, the first map's rule winning
 * for a specifier as it does in the browser.
 */
function documentImports(doc: Document): Record<string, string> {
	const imports: Record<string, string> = Object.create(null);
	for (const script of importMapScripts(doc)) {
		try {
			const mapped = JSON.parse(script.textContent || "{}")?.imports;
			if (!mapped || typeof mapped !== "object") continue;
			for (const [specifier, url] of Object.entries(mapped)) {
				if (typeof url === "string" && !(specifier in imports)) {
					imports[specifier] = url;
				}
			}
		} catch {
			// The browser rejects a map it cannot parse, so it maps nothing.
		}
	}
	return imports;
}

/**
 * es-module-shims in shim mode: it resolves through the import maps this
 * backend hands it and leaves the page's own scripts and load events alone.
 * A page that already runs es-module-shims keeps its instance, which has to be
 * in shim mode to take maps from this backend.
 */
async function defaultImportShimLoader(): Promise<EsmImportShim> {
	const scope = globalThis as {
		importShim?: unknown;
		esmsInitOptions?: Record<string, unknown>;
	};
	if (!scope.importShim) {
		scope.esmsInitOptions = {
			...scope.esmsInitOptions,
			shimMode: true,
			noLoadEventRetriggers: true,
		};
		await import("./module-shim.js");
	}
	const shim = scope.importShim as EsmImportShim | undefined;
	if (typeof shim !== "function" || typeof shim.addImportMap !== "function") {
		throw new Error(
			"es-module-shims did not initialize, so this browser cannot load browser ESM elements after the page's first module load. Use the iife or preloaded strategy.",
		);
	}
	try {
		shim.addImportMap({ imports: {} });
	} catch {
		throw new Error(
			"This page runs es-module-shims in polyfill mode, and this browser rejects import maps added after the page's first module load. Load es-module-shims in shim mode, or use the iife or preloaded strategy.",
		);
	}
	return shim;
}

function importMapsSupported(): boolean {
	const htmlScriptElement = (
		typeof HTMLScriptElement !== "undefined" ? HTMLScriptElement : undefined
	) as
		| (typeof HTMLScriptElement & {
				supports?: (type: string) => boolean;
		  })
		| undefined;
	return (
		typeof htmlScriptElement?.supports === "function" &&
		htmlScriptElement.supports("importmap")
	);
}

function assertImportMapSupported(): void {
	if (!importMapsSupported()) {
		throw new Error(
			'This browser does not support import maps. Use moduleResolution="url" or switch to iife/preloaded strategy.',
		);
	}
}
