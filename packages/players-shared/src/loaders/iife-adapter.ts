/**
 * IIFE backend adapter for the ElementLoader primitive.
 *
 * Loads PIE elements from IIFE bundles served by the PIE build service,
 * then registers them with `customElements`. On any per-tag failure
 * (missing package, non-constructor element class, define failure),
 * throws `AdapterFailure` with a structured `reasons` map that the
 * primitive unpacks into `ElementLoaderError.reasons`.
 *
 * This adapter deliberately does *not* gate its own promise on
 * `customElements.whenDefined` — the primitive performs that verification
 * uniformly for every backend, so the adapter's job is narrowly:
 *
 *   1. Fetch the bundle.
 *   2. Extract per-tag element classes from `window.pie.default`.
 *   3. Validate each class is a custom-element constructor.
 *   4. Call `customElements.define` via `defineCustomElementSafely`.
 *   5. Collect structured per-tag reasons for anything that failed.
 *   6. Resolve (everything OK) or throw `AdapterFailure` (anything failed).
 */

import { defineCustomElementSafely } from "../pie/custom-element-define.js";
import { pieRegistry } from "../pie/registry.js";
import { validateCustomElementTag } from "../pie/tag-names.js";
import {
	BundleType,
	isCustomElementConstructor,
	Status,
} from "../pie/types.js";
import { getPackageWithoutVersion } from "../pie/utils.js";
import type { ElementMap } from "./ElementLoader.js";
import {
	AdapterFailure,
	type BackendContext,
	type ElementLoaderBackend,
	type ElementTag,
	type RegistrationFailureReason,
} from "./element-loader-types.js";

export type IifeBackendConfig = {
	kind: "iife";
	/** Base URL for the PIE bundle service. */
	bundleHost: string;
	/** Bundle variant to request (player / client-player / editor). */
	bundleType?: BundleType;
	/** Whether the registered entries should carry their controller exports. */
	needsControllers?: boolean;
	/** Explicit bundle override (hash + optional URL) supplied by the host. */
	bundleInfo?: { hash?: string; url?: string };
	/** Debug flag hook. */
	debugEnabled?: () => boolean;
};

/**
 * Bundle-script loader seam. Default implementation injects a `<script>` tag
 * into the document head. Tests replace it with a scripted stub via
 * `IifeBackendTestSeams.replaceLoadBundleScript`.
 */
export type IifeBundleScriptLoader = (
	url: string,
	doc: Document,
) => Promise<void>;

export type IifeBackendTestSeams = {
	replaceLoadBundleScript(fn: IifeBundleScriptLoader): void;
	restore(): void;
};

export type IifeBackend = ElementLoaderBackend & {
	readonly __seams: IifeBackendTestSeams;
};

export function createIifeBackend(config: IifeBackendConfig): IifeBackend {
	const bundleType = config.bundleType ?? BundleType.clientPlayer;
	const needsControllers = config.needsControllers ?? true;

	let loadBundleScript: IifeBundleScriptLoader = defaultLoadBundleScript;
	const inFlightBundleLoads = new Map<string, Promise<void>>();

	const __seams: IifeBackendTestSeams = {
		replaceLoadBundleScript(fn) {
			loadBundleScript = fn;
			inFlightBundleLoads.clear();
		},
		restore() {
			loadBundleScript = defaultLoadBundleScript;
			inFlightBundleLoads.clear();
		},
	};

	async function ensureBundleLoaded(
		url: string,
		doc: Document,
	): Promise<void> {
		const existing = inFlightBundleLoads.get(url);
		if (existing) return existing;
		const promise = loadBundleScript(url, doc).finally(() => {
			inFlightBundleLoads.delete(url);
		});
		inFlightBundleLoads.set(url, promise);
		return promise;
	}

	async function load(
		elements: ElementMap,
		context: BackendContext,
	): Promise<void> {
		if (!elements || Object.keys(elements).length === 0) return;

		const bundleUrl = buildBundleUrl(elements, bundleType, config);
		try {
			await ensureBundleLoaded(bundleUrl, context.doc);
		} catch (err) {
			const cause = err instanceof Error ? err.message : String(err);
			const reasons = new Map<ElementTag, RegistrationFailureReason>();
			for (const tag of Object.keys(elements)) {
				reasons.set(tag, {
					kind: "bundle-load-failed",
					tag,
					url: bundleUrl,
					cause,
				});
			}
			throw new AdapterFailure(reasons);
		}

		const pieModule = readPieModule();
		if (!pieModule) {
			const reasons = new Map<ElementTag, RegistrationFailureReason>();
			for (const tag of Object.keys(elements)) {
				reasons.set(tag, {
					kind: "bundle-load-failed",
					tag,
					url: bundleUrl,
					cause: "window.pie.default missing after bundle load",
				});
			}
			throw new AdapterFailure(reasons);
		}

		const reasons = new Map<ElementTag, RegistrationFailureReason>();
		const isEditorBundle = bundleType === BundleType.editor;
		const registry = pieRegistry();

		for (const [tag, packageVersion] of Object.entries(elements)) {
			const packageName = getPackageWithoutVersion(packageVersion);
			const elementData = pieModule[packageName];
			if (!elementData) {
				reasons.set(tag, {
					kind: "package-not-in-bundle",
					tag,
					packageName,
					availablePackages: Object.keys(pieModule),
				});
				continue;
			}

			const ElementClass = isEditorBundle
				? (elementData.Configure ?? createEmptyConfigure())
				: elementData.Element;

			if (!ElementClass) {
				reasons.set(tag, {
					kind: "no-element-class",
					tag,
					packageName,
				});
				continue;
			}

			if (!isCustomElementConstructor(ElementClass)) {
				reasons.set(tag, {
					kind: "not-a-constructor",
					tag,
					packageName,
				});
				continue;
			}

			let actualTag: string;
			try {
				actualTag = validateCustomElementTag(
					isEditorBundle ? `${tag}-config` : tag,
					`element tag for ${packageName}`,
				);
			} catch (err) {
				reasons.set(tag, {
					kind: "define-failed",
					tag,
					cause: err instanceof Error ? err.message : String(err),
				});
				continue;
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
				continue;
			}

			registry[actualTag] = {
				package: packageVersion,
				status: Status.loaded,
				tagName: actualTag,
				element: ElementClass,
				controller: needsControllers ? (elementData.controller ?? null) : null,
				config: elementData.config ?? null,
				bundleType,
			};
		}

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

function defaultLoadBundleScript(url: string, doc: Document): Promise<void> {
	return new Promise((resolve, reject) => {
		const script = doc.createElement("script") as HTMLScriptElement;
		script.src = url;
		script.defer = true;
		script.setAttribute("data-pie-bundle", "true");
		script.onload = () => resolve();
		script.onerror = () =>
			reject(new Error(`Failed to load IIFE bundle from: ${url}`));
		doc.head.appendChild(script);
	});
}

function readPieModule(): Record<string, any> | undefined {
	const maybeWindow = (globalThis as { window?: { pie?: { default?: unknown } } })
		.window;
	const pieDefault = maybeWindow?.pie?.default;
	if (!pieDefault || typeof pieDefault !== "object") return undefined;
	return pieDefault as Record<string, any>;
}

function buildBundleUrl(
	elements: ElementMap,
	bundleType: BundleType,
	config: IifeBackendConfig,
): string {
	const elementTags = Object.keys(elements).sort().join(",");

	if (config.bundleInfo?.url) {
		const separator = config.bundleInfo.url.includes("?") ? "&" : "?";
		return elementTags
			? `${config.bundleInfo.url}${separator}elements=${encodeURIComponent(elementTags)}`
			: config.bundleInfo.url;
	}

	const packageVersions = Object.values(elements).join("+");
	const host = normalizeBundleHost(config.bundleHost);
	const base = `${host}${encodeURI(packageVersions)}/${bundleType}`;
	return elementTags
		? `${base}?elements=${encodeURIComponent(elementTags)}`
		: base;
}

function normalizeBundleHost(host: string): string {
	return `${host.trim().replace(/\/+$/, "")}/`;
}

function createEmptyConfigure(): CustomElementConstructor {
	// Minimal configure fallback used for editor bundles that omit a Configure
	// export. Intentionally silent; the host will see a blank configuration UI
	// rather than a hard failure.
	return class EmptyConfigureElement extends HTMLElement {
		private _model: unknown;
		private _configuration: unknown;
		get model() {
			return this._model;
		}
		set model(v: unknown) {
			this._model = v;
		}
		get configuration() {
			return this._configuration;
		}
		set configuration(v: unknown) {
			this._configuration = v;
		}
	};
}
