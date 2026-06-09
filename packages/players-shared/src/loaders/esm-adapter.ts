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

import { defineCustomElementSafely } from "../pie/custom-element-define.js";
import type { InstrumentationProvider } from "../instrumentation/types.js";
import { isInstrumentationProvider } from "../instrumentation/provider-guards.js";
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

export type BuiltInEsmCdnProviderName = "jsdelivr" | "esm.sh";
export type EsmCdnProviderName = BuiltInEsmCdnProviderName | (string & {});

export type EsmCdnProvider = {
	name: EsmCdnProviderName;
	packageJsonUrl(packageVersion: string): string;
	browserViewUrl(packageVersion: string, view: string): string;
	browserControllerUrl(packageVersion: string): string;
	sharedDependencyUrl(
		dependencyName: string,
		version: string,
		subpath?: string,
	): string;
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
	};
};

/** @internal */
export type EsmModuleImporter = (specifier: string) => Promise<unknown>;
/** @internal */
export type EsmImportMapObserver = (json: string, doc: Document) => void;
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

	const injectedPackageVersions = new Set<string>();
	const importMappedPackageVersions = new Map<string, string>();
	let sharedDependencyVersions: Record<string, string> = {};
	let importer: EsmModuleImporter = defaultImporter;
	let packageMetadataLoader: EsmPackageMetadataLoader =
		defaultPackageMetadataLoader;
	let importMapObserver: EsmImportMapObserver | undefined;

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
		restore() {
			importer = defaultImporter;
			packageMetadataLoader = defaultPackageMetadataLoader;
			importMapObserver = undefined;
			injectedPackageVersions.clear();
			importMappedPackageVersions.clear();
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

		const newEntries: ElementMap = {};
		for (const [tag, pkg] of Object.entries(elements)) {
			const packageName = extractPackageName(pkg);
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
				importMapResult = await buildImportMapJson(
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
			const json = importMapResult.json;
			if (json) {
				assertImportMapSupported();
				injectImportMap(json, context.doc);
				importMapObserver?.(json, context.doc);
			}
			sharedDependencyVersions = importMapResult.sharedDependencyVersions;
			for (const pkg of Object.values(newEntries)) {
				injectedPackageVersions.add(pkg);
				if (moduleResolution === "import-map") {
					importMappedPackageVersions.set(extractPackageName(pkg), pkg);
				}
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
							cdnProvider,
							viewConfig.fallback,
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
						cdnProvider,
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

	function getInstrumentationProvider(): InstrumentationProvider | undefined {
		if (!config.trackPageActions) return undefined;
		const provider = config.instrumentationProvider;
		if (!isInstrumentationProvider(provider)) return undefined;
		if (!provider.isReady()) return undefined;
		return provider;
	}

	function reportSharedDependencyConflict(
		attributes: Record<string, unknown>,
	): void {
		if (typeof console !== "undefined" && console.warn) {
			console.warn(
				`[pie-esm] Shared dependency version conflict resolved for ${String(attributes.dependencyName)}`,
				attributes,
			);
		}
		const provider = getInstrumentationProvider();
		if (!provider) return;
		try {
			provider.trackEvent("pie-esm-shared-dependency-conflict", attributes);
		} catch {
			// Swallow: instrumentation must never break loading.
		}
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
	return import(/* @vite-ignore */ specifier);
}

async function defaultPackageMetadataLoader(
	packageVersion: string,
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

function resolveEsmViewConfig(view: string, viewConfig?: ViewConfig): ViewConfig {
	return viewConfig ?? BUILT_IN_VIEWS[view] ?? BUILT_IN_VIEWS.delivery;
}

function assertBrowserEsmExports(
	metadata: PackageMetadata | null,
	packageVersion: string,
	viewConfig: ViewConfig,
	loadControllers: boolean,
	viewName: string,
): void {
	if (!metadata?.exports) return;

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
			throw new Error(
				`${packageVersion} does not publish browser ESM export ${exportKey}; use IIFE/preloaded mode or publish browser ESM artifacts first`,
			);
		}
	}
}

function extractPackageName(packageVersion: string): string {
	const parts = packageVersion.split("@");
	return parts.length >= 3 ? `@${parts[1]}` : parts[0];
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
	if (!isExactVersion(version)) {
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

function isExactVersion(version: string): boolean {
	return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version);
}

function parseVersion(version: string): {
	major: number;
	minor: number;
	patch: number;
} {
	const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
	if (!match) {
		throw new Error(`Invalid shared browser dependency version "${version}"`);
	}
	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
	};
}

function compareVersions(a: string, b: string): number {
	const parsedA = parseVersion(a);
	const parsedB = parseVersion(b);
	if (parsedA.major !== parsedB.major) return parsedA.major - parsedB.major;
	if (parsedA.minor !== parsedB.minor) return parsedA.minor - parsedB.minor;
	return parsedA.patch - parsedB.patch;
}

function resolveSharedDependencyVersion(
	dependencyName: string,
	currentVersion: string,
	requestedVersion: string,
	packageVersion: string,
	isLocked: boolean,
): string {
	const current = parseVersion(currentVersion);
	const requested = parseVersion(requestedVersion);
	if (current.major !== requested.major) {
		throw new Error(
			`Conflicting shared browser dependency ${dependencyName}: ${currentVersion} vs ${requestedVersion} from ${packageVersion}; different major versions cannot share one browser singleton`,
		);
	}
	if (isLocked && compareVersions(requestedVersion, currentVersion) > 0) {
		throw new Error(
			`Conflicting shared browser dependency ${dependencyName}: ${currentVersion} is already selected, but ${packageVersion} requires higher version ${requestedVersion}; the browser singleton cannot be upgraded after import-map injection`,
		);
	}
	return compareVersions(currentVersion, requestedVersion) >= 0
		? currentVersion
		: requestedVersion;
}

type BrowserImportMapBuildResult = {
	json: string | null;
	sharedDependencyVersions: Record<string, string>;
};

async function buildImportMapJson(
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
	for (const [, pkg] of Object.entries(elements)) {
		const packageName = extractPackageName(pkg);
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

		const metadata = await packageMetadataLoader(
			pkg,
			cdnProvider.packageJsonUrl(pkg),
		);
		assertBrowserEsmExports(
			metadata,
			pkg,
			viewConfig,
			loadControllers,
			cleanViewSubpath(viewConfig.subpath) ?? "delivery",
		);
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
	if (Object.keys(imports).length === 0) {
		return { json: null, sharedDependencyVersions: selectedVersions };
	}
	return {
		json: JSON.stringify({ imports }, null, 2),
		sharedDependencyVersions: selectedVersions,
	};
}

function injectImportMap(json: string, doc: Document): void {
	const script = doc.createElement("script") as HTMLScriptElement;
	script.type = "importmap";
	script.textContent = json;
	doc.head.appendChild(script);
}

function assertImportMapSupported(): void {
	const htmlScriptElement = (
		typeof HTMLScriptElement !== "undefined" ? HTMLScriptElement : undefined
	) as
		| (typeof HTMLScriptElement & {
				supports?: (type: string) => boolean;
		  })
		| undefined;
	const supports =
		typeof htmlScriptElement?.supports === "function" &&
		htmlScriptElement.supports("importmap");
	if (!supports) {
		throw new Error(
			'This browser does not support import maps. Use moduleResolution="url" or switch to iife/preloaded strategy.',
		);
	}
}
