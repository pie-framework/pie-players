/**
 * Registration for the `preloaded` strategy: the host's bundler resolves the
 * element packages, and the players load nothing.
 *
 * Each element is defined under the versioned tag `toPackageVersionedTag`
 * derives from its authored base tag and the registered version, recorded in
 * `window.PIE_REGISTRY`, and recorded by package in
 * `window.PIE_PRELOADED_ELEMENTS`. The item player and the section player
 * rewrite every authored spec of a registered package to that version
 * (`alignPreloadedElementVersions`), derive the versioned tags from the result
 * and assert them (`assertRegistered`).
 *
 * A hosted player takes models from the server and resolves no controller. A
 * player that is not hosted runs the controller's `model()` in the browser, so
 * it needs the `controller` an entry registers; the item player warns about
 * each tag it renders without one.
 */

import type { PieController } from "../types/index.js";
import { defineCustomElementSafely } from "../pie/custom-element-define.js";
import { writeRegistryEntry } from "../pie/registry.js";
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
	/** Base tag the content authors, e.g. `pie-element-multiple-choice`. */
	tag: string;
	/** npm package name, e.g. `@pie-element/multiple-choice`. */
	package: string;
	/** The installed version, exact, e.g. `13.4.4`. */
	version: string;
	/** The package's `./browser/delivery` module, or its default export. */
	element: CustomElementConstructor | { readonly default: CustomElementConstructor };
	/**
	 * The package's `./browser/controller` module, or its default export.
	 * Required for a player that is not hosted.
	 */
	controller?: PreloadedController | { readonly default: PreloadedController };
}

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
 * registered one.
 */
export function registerPreloadedElements(
	elements: readonly PreloadedElement[],
): void {
	if (typeof window === "undefined" || typeof customElements === "undefined") {
		throw new Error(
			"[registerPreloadedElements] requires a browser with customElements",
		);
	}

	const preloaded = preloadedPackageSpecs();
	const resolved = elements.map(resolveElement);
	assertOneVersionPerPackage(resolved, preloaded);

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
		throw new Error(`${at}: expected { tag, package, version, element }`);
	}
	const { package: packageName, version, tag } = element;

	if (!isBarePackageName(packageName)) {
		throw new Error(
			`${at}: package must be a bare package name, got ${JSON.stringify(packageName)}`,
		);
	}
	if (typeof version !== "string" || !isExactSemver(version)) {
		throw new Error(
			`${at} (${packageName}): version must be the installed version, exact, such as 13.4.4; got ${JSON.stringify(version)}`,
		);
	}
	if (typeof tag !== "string" || !tag) {
		throw new Error(
			`${at} (${packageName}): tag must be the authored base tag, got ${JSON.stringify(tag)}`,
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
	return {
		packageName,
		spec,
		tagName: toPackageVersionedTag(tag, spec),
		elementClass: candidate,
		controller,
	};
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
