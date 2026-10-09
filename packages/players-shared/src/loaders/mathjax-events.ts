/**
 * Forwards the MathJax adapter's page events to instrumentation.
 *
 * Every copy of the MathJax 4 adapter that browser ESM elements render with
 * dispatches these on `window`, once per condition per page:
 * `pie-mathjax-version-conflict` when MathJax 3 runs on the same page — an
 * unsupported page, see
 * docs/item-player/loading-strategies.md#one-mathjax-version-per-page — and
 * `pie-mathjax-no-asset-root` when a copy has nowhere to load MathJax's files
 * from, see docs/item-player/loading-strategies.md#mathjax-assets. The event
 * names are repeated here because players do not depend on the element
 * packages.
 */

import type { InstrumentationProvider } from "../instrumentation/types.js";

export const MATHJAX_VERSION_CONFLICT_EVENT = "pie-mathjax-version-conflict";
export const MATHJAX_NO_ASSET_ROOT_EVENT = "pie-mathjax-no-asset-root";

/** The detail fields each event is tracked with. */
const TRACKED_FIELDS: Record<string, readonly string[]> = {
	[MATHJAX_VERSION_CONFLICT_EVENT]: ["condition", "docsUrl"],
	[MATHJAX_NO_ASSET_ROOT_EVENT]: ["effect", "docsUrl"],
};

// Every player on a page listens, and each player bundle carries its own copy
// of this module, so the providers that tracked an event are kept on the page.
const TRACKED: unique symbol = Symbol.for(
	"@pie-players/pie-players-shared/mathjax-version-conflict-tracked",
);

type TrackedRegistry = {
	[TRACKED]?: WeakMap<Event, WeakSet<InstrumentationProvider>>;
};

function providersThatTracked(event: Event): WeakSet<InstrumentationProvider> {
	const registry = globalThis as TrackedRegistry;
	registry[TRACKED] ??= new WeakMap();
	let providers = registry[TRACKED].get(event);
	if (!providers) {
		providers = new WeakSet();
		registry[TRACKED].set(event, providers);
	}
	return providers;
}

/**
 * Tracks each MathJax event on `target` with the provider `getProvider`
 * returns when it fires, once per provider. Returns the function that stops
 * forwarding.
 */
export function forwardMathjaxEvents(
	target: EventTarget,
	getProvider: () => InstrumentationProvider | undefined,
): () => void {
	const forward = (event: Event) => {
		const provider = getProvider();
		if (!provider) return;
		const tracked = providersThatTracked(event);
		if (tracked.has(provider)) return;
		tracked.add(provider);
		const detail = (event as CustomEvent<unknown>).detail;
		const fields = (detail && typeof detail === "object" ? detail : {}) as Record<
			string,
			unknown
		>;
		try {
			provider.trackEvent(
				event.type,
				Object.fromEntries(
					TRACKED_FIELDS[event.type].map((field) => [field, fields[field]]),
				),
			);
		} catch {
			// Swallow: instrumentation must never break rendering.
		}
	};
	for (const type of Object.keys(TRACKED_FIELDS)) {
		target.addEventListener(type, forward);
	}
	return () => {
		for (const type of Object.keys(TRACKED_FIELDS)) {
			target.removeEventListener(type, forward);
		}
	};
}
