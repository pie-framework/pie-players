/**
 * Registration for the `preloaded` strategy: the host's bundler resolves the
 * element packages, and the players only assert that their tags are
 * registered (`assertRegistered`).
 *
 * Each element is defined under the versioned tag `toPackageVersionedTag`
 * derives from its authored base tag, recorded in `window.PIE_REGISTRY`, which
 * the players bind model and session through, and recorded by package in
 * `window.PIE_PRELOADED_ELEMENTS`, from which the players align authored
 * versions to the installed one.
 *
 * Entries carry no controller: preloaded delivery runs hosted, with `model()`
 * and `outcome()` on the server, and a hosted player resolves no controller
 * (`findPieController`).
 */

import { defineCustomElementSafely } from "../pie/custom-element-define.js";
import { pieRegistry } from "../pie/registry.js";
import { BundleType, isCustomElementConstructor, Status } from "../pie/types.js";
import { parsePackageName } from "../pie/utils.js";
import { toPackageVersionedTag } from "../pie/versioned-tag.js";
import { pickElementClass } from "./esm-adapter.js";

export interface PreloadedElement {
	/** Base tag the content authors, e.g. `pie-element-multiple-choice`. */
	tag: string;
	/** npm package name, e.g. `@pie-element/multiple-choice`. */
	package: string;
	/** The installed version, e.g. `13.4.4`. */
	version: string;
	/** The package's `./browser/delivery` module, or its default export. */
	element: CustomElementConstructor | { readonly default: CustomElementConstructor };
}

type ResolvedElement = {
	packageName: string;
	spec: string;
	tagName: string;
	elementClass: CustomElementConstructor;
};

/**
 * Register host-bundled elements for the `preloaded` strategy.
 *
 * Synchronous: every tag is in `customElements` when the call returns.
 * Idempotent: a tag that is already defined keeps its definition and its
 * registry entry. Every entry is validated before any is registered, and a
 * package registers at one version per page, because the players align every
 * authored version of a package to the registered one.
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

	const registry = pieRegistry();
	for (const { packageName, spec, tagName, elementClass } of resolved) {
		defineCustomElementSafely(
			tagName,
			class extends elementClass {},
			`preloaded element tag for ${packageName}`,
		);
		registry[tagName] ??= {
			package: spec,
			status: Status.loaded,
			tagName,
			element: elementClass,
			bundleType: BundleType.player,
		};
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
	if (typeof version !== "string" || !version || /\s/.test(version)) {
		throw new Error(
			`${at} (${packageName}): version must be the installed version, got ${JSON.stringify(version)}`,
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

	const spec = `${packageName}@${version}`;
	return {
		packageName,
		spec,
		tagName: toPackageVersionedTag(tag, spec),
		elementClass: candidate,
	};
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
