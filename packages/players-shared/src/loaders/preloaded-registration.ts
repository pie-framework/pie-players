/**
 * Registration for the `preloaded` strategy: the host's bundler resolves the
 * element packages, and the players load nothing.
 *
 * Each element is defined under the versioned tag `toPackageVersionedTag`
 * derives from its base tag and the registered version, recorded in
 * `window.PIE_REGISTRY`, and recorded by package in
 * `window.PIE_PRELOADED_ELEMENTS`. The item player and the section player
 * rewrite every authored spec of a registered package to that version
 * (`alignPreloadedElementVersions`), derive the versioned tags from the result,
 * define the ones content names under another base tag
 * (`defineAuthoredPreloadedTags`) and assert them (`assertRegistered`).
 *
 * pie-elements-ng's `./browser/*` modules export `piePackage`, the
 * `{ name, version }` of the package they were built from, so an entry can
 * give its modules alone. A `package` or `version` it also gives must match,
 * which catches a registration an upgrade left behind.
 *
 * A hosted player takes models from the server and resolves no controller. A
 * player that is not hosted runs the controller's `model()` in the browser, so
 * it needs the `controller` an entry registers; the item player warns about
 * each tag it renders without one.
 *
 * Bundled by the host, the elements' copies of the MathJax adapter find no npm
 * root in their module URLs, so the registration also takes where they load
 * MathJax's fonts and speech from (`options.math`): a root, or each file's URL.
 */

import type { PieController } from "../types/index.js";
import { defineCustomElementSafely } from "../pie/custom-element-define.js";
import {
	type MathAssetOptions,
	mathAssetOptionsError,
	setMathAssetOptions,
} from "../pie/math-assets.js";
import { writeRegistryEntry } from "../pie/registry.js";
import { validateCustomElementTag } from "../pie/tag-names.js";
import { BundleType, isCustomElementConstructor, Status } from "../pie/types.js";
import { parsePackageName } from "../pie/utils.js";
import { toPackageVersionedTag } from "../pie/versioned-tag.js";
import { isExactSemver } from "./element-package-policy.js";
import { pickElementClass } from "./esm-adapter.js";

/** A controller module: the `model()` a player that is not hosted runs. */
export type PreloadedController = {
	readonly model: (...args: any[]) => unknown;
};

export interface PreloadedElement {
	/**
	 * Base tag to register, e.g. `pie-element-multiple-choice`. Content can
	 * author another base tag for the package, which the players define from
	 * this registration. Defaults to the package name without its `@`, with
	 * `-` for `/`.
	 */
	tag?: string;
	/**
	 * npm package name, e.g. `@pie-element/multiple-choice`. Defaults to the
	 * name in the modules' `piePackage`.
	 */
	package?: string;
	/**
	 * The installed version, exact, e.g. `13.4.4`. Defaults to the version in
	 * the modules' `piePackage`.
	 */
	version?: string;
	/** The package's `./browser/delivery` module, or its default export. */
	element: CustomElementConstructor | { readonly default: CustomElementConstructor };
	/**
	 * The package's `./browser/controller` module, or its default export.
	 * Required for a player that is not hosted.
	 */
	controller?: PreloadedController | { readonly default: PreloadedController };
}

export interface PreloadedRegistrationOptions {
	/**
	 * Where the elements' MathJax loads its fonts, its speech worker and, on the
	 * adapter's npm build, MathJax itself from, and whether math is in the tab
	 * order, written to `window['@pie-lib/math-rendering@2'].opts`. With neither
	 * an `assetRoot` nor the fonts in `assetUrls`, math renders without web fonts
	 * and speech.
	 */
	math?: MathAssetOptions;
}

type PackageIdentity = { name: string; version: string };

type ResolvedElement = {
	packageName: string;
	spec: string;
	tagName: string;
	elementClass: CustomElementConstructor;
	controller?: PieController;
};

/**
 * Register host-bundled elements for the `preloaded` strategy.
 *
 * Synchronous: every tag is in `customElements` when the call returns.
 * Idempotent: a tag that is already defined keeps its definition and its
 * registry entry, which only gains a controller it lacked. Every entry is
 * validated before any is registered. A package registers at one version per
 * page, because the players align every authored version of a package to the
 * registered one. `options.math` replaces the page's math asset options it
 * sets, and keeps the others.
 */
export function registerPreloadedElements(
	elements: readonly PreloadedElement[],
	options: PreloadedRegistrationOptions = {},
): void {
	if (typeof window === "undefined" || typeof customElements === "undefined") {
		throw new Error(
			"[registerPreloadedElements] requires a browser with customElements",
		);
	}

	const preloaded = preloadedPackageSpecs();
	const resolved = elements.map(resolveElement);
	assertOneVersionPerPackage(resolved, preloaded);
	const mathError =
		options.math === undefined ? undefined : mathAssetOptionsError(options.math);
	if (mathError) {
		throw new Error(`[registerPreloadedElements] options.math: ${mathError}`);
	}
	if (options.math) setMathAssetOptions(options.math);

	for (const { packageName, spec, tagName, elementClass, controller } of resolved) {
		defineCustomElementSafely(
			tagName,
			class extends elementClass {},
			`preloaded element tag for ${packageName}`,
		);
		writeRegistryEntry({
			package: spec,
			status: Status.loaded,
			tagName,
			element: elementClass,
			...(controller ? { controller } : {}),
			bundleType: controller ? BundleType.clientPlayer : BundleType.player,
		});
		preloaded[packageName] = spec;
	}
}

function resolveElement(
	element: PreloadedElement,
	index: number,
): ResolvedElement {
	const at = `[registerPreloadedElements] entry ${index}`;
	if (!element || typeof element !== "object") {
		throw new Error(`${at}: expected { element, controller?, tag?, package?, version? }`);
	}
	const identity = moduleIdentity(element, at);
	if (!identity && element.package === undefined && element.version === undefined) {
		throw new Error(
			`${at}: package and version are required for modules that export no piePackage`,
		);
	}
	const packageName = element.package ?? identity?.name;
	const version = element.version ?? identity?.version;

	if (!isBarePackageName(packageName)) {
		throw new Error(
			`${at}: package must be a bare package name, got ${JSON.stringify(packageName)}`,
		);
	}
	if (typeof version !== "string" || !isExactSemver(version)) {
		throw new Error(
			`${at} (${packageName}): version must be the installed version, exact, such as 1.2.3; got ${JSON.stringify(version)}`,
		);
	}
	if (identity && (identity.name !== packageName || identity.version !== version)) {
		throw new Error(
			`${at}: the modules were built from ${identity.name}@${identity.version}, not ${packageName}@${version}`,
		);
	}
	const tag = element.tag ?? packageName.replace(/^@/, "").replace("/", "-");
	if (typeof tag !== "string" || !tag) {
		throw new Error(
			`${at} (${packageName}): tag must be the base tag to register, got ${JSON.stringify(tag)}`,
		);
	}

	const candidate =
		typeof element.element === "function"
			? element.element
			: pickElementClass(element.element, "delivery");
	if (!isCustomElementConstructor(candidate)) {
		throw new Error(
			`${at} (${packageName}): element must be the ./browser/delivery module or its default export`,
		);
	}

	let controller: PieController | undefined;
	if (element.controller !== undefined) {
		controller = resolveController(element.controller);
		if (!controller) {
			throw new Error(
				`${at} (${packageName}): controller must be the ./browser/controller module or its default export`,
			);
		}
	}

	const spec = `${packageName}@${version}`;
	const tagName = validateCustomElementTag(
		toPackageVersionedTag(tag, spec),
		element.tag === undefined
			? `${at} (${packageName}) tag derived from the package name; give tag`
			: `${at} (${packageName}) tag`,
	);
	return { packageName, spec, tagName, elementClass: candidate, controller };
}

/** The `piePackage` of the entry's modules, which agree when both export one. */
function moduleIdentity(
	element: PreloadedElement,
	at: string,
): PackageIdentity | undefined {
	const fromElement = readPackageIdentity(element.element, `${at}: element`);
	const fromController = readPackageIdentity(element.controller, `${at}: controller`);
	if (
		fromElement &&
		fromController &&
		(fromElement.name !== fromController.name ||
			fromElement.version !== fromController.version)
	) {
		throw new Error(
			`${at}: the element module is ${fromElement.name}@${fromElement.version}, ` +
				`but the controller module is ${fromController.name}@${fromController.version}`,
		);
	}
	return fromElement ?? fromController;
}

function readPackageIdentity(module: unknown, at: string): PackageIdentity | undefined {
	if (!module || typeof module !== "object" || !("piePackage" in module)) {
		return undefined;
	}
	const identity = (module as { piePackage?: Partial<PackageIdentity> | null }).piePackage;
	if (typeof identity?.name !== "string" || typeof identity.version !== "string") {
		throw new Error(`${at} module's piePackage must be { name, version }`);
	}
	return { name: identity.name, version: identity.version };
}

function resolveController(value: unknown): PieController | undefined {
	if (!value || typeof value !== "object") return undefined;
	const module = value as { model?: unknown; default?: unknown };
	const candidate = (
		typeof module.model === "function" ? module : module.default
	) as { model?: unknown } | undefined;
	return candidate && typeof candidate.model === "function"
		? (candidate as PieController)
		: undefined;
}

function assertOneVersionPerPackage(
	resolved: readonly ResolvedElement[],
	preloaded: Record<string, string>,
): void {
	const specs = new Map(Object.entries(preloaded));
	for (const { packageName, spec } of resolved) {
		const existing = specs.get(packageName);
		if (existing !== undefined && existing !== spec) {
			throw new Error(
				`[registerPreloadedElements] ${packageName} is registered as ${existing}; ` +
					`${spec} cannot also be registered, because the players align every ` +
					"authored version of a package to the registered one",
			);
		}
		specs.set(packageName, spec);
	}
}

function isBarePackageName(value: unknown): value is string {
	if (typeof value !== "string" || !value) return false;
	try {
		return parsePackageName(value).name === value;
	} catch {
		return false;
	}
}

function preloadedPackageSpecs(): Record<string, string> {
	const host = window as unknown as {
		PIE_PRELOADED_ELEMENTS?: Record<string, string>;
	};
	host.PIE_PRELOADED_ELEMENTS ??= {};
	return host.PIE_PRELOADED_ELEMENTS;
}
