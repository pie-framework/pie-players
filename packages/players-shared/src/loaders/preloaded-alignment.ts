/**
 * Version alignment for the `preloaded` strategy.
 *
 * A preloaded page registers one version of each element package and records it
 * by package in `window.PIE_PRELOADED_ELEMENTS`, written by
 * `registerPreloadedElements` or a generated `pie-preloaded-player` build.
 * Authored content can name another version of the same package, so each player
 * aligns the authored specs to the registered ones before deriving the tags it
 * asserts. Alignment rewrites the runtime copy of a config; authored content
 * keeps its specs.
 */

import { parsePackageName } from "../pie/utils.js";

/** Registered spec by package name, e.g. `{ "@pie-element/passage": "@pie-element/passage@5.3.3" }`. */
export type PreloadedElementSpecs = Readonly<Record<string, string>>;

/**
 * Return `config` with each `elements` spec replaced by the registered spec of
 * the same package, or `config` itself when no spec changes. A spec whose
 * package has no registered version, or that does not parse, is kept. The input
 * is never mutated.
 *
 * `preloaded` defaults to the page's `window.PIE_PRELOADED_ELEMENTS`.
 */
export function alignPreloadedElementVersions<T extends { elements?: unknown }>(
	config: T,
	preloaded:
		| PreloadedElementSpecs
		| null
		| undefined = readPreloadedElementSpecs(),
): T {
	const elements = config?.elements;
	if (!preloaded || !elements || typeof elements !== "object") return config;

	let changed = false;
	const aligned: Record<string, string> = {};
	for (const [tag, spec] of Object.entries(elements)) {
		const authored = String(spec);
		const registered = registeredSpec(authored, preloaded);
		aligned[tag] = registered ?? authored;
		if (registered !== undefined && registered !== authored) changed = true;
	}
	return changed ? { ...config, elements: aligned } : config;
}

function registeredSpec(
	spec: string,
	preloaded: PreloadedElementSpecs,
): string | undefined {
	let packageName: string;
	try {
		packageName = parsePackageName(spec).name;
	} catch {
		return undefined;
	}
	const registered = preloaded[packageName];
	return typeof registered === "string" && registered.length > 0
		? registered
		: undefined;
}

function readPreloadedElementSpecs(): PreloadedElementSpecs | undefined {
	if (typeof window === "undefined") return undefined;
	const specs = (window as { PIE_PRELOADED_ELEMENTS?: unknown })
		.PIE_PRELOADED_ELEMENTS;
	return specs && typeof specs === "object"
		? (specs as PreloadedElementSpecs)
		: undefined;
}
