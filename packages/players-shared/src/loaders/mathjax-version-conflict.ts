/**
 * Forwards the MathJax version-conflict event to instrumentation.
 *
 * The MathJax 4 adapter that browser ESM elements render with dispatches
 * `pie-mathjax-version-conflict` on `window`, once per condition per page, when
 * MathJax 3 runs on the same page — an unsupported page, see
 * docs/item-player/loading-strategies.md#one-mathjax-version-per-page. The
 * event name is repeated here because players do not depend on the element
 * packages.
 */

import type { InstrumentationProvider } from "../instrumentation/types.js";

export const MATHJAX_VERSION_CONFLICT_EVENT = "pie-mathjax-version-conflict";

// Every ESM backend on a page listens, and each player bundle carries its own
// copy of this module, so the providers that tracked an event are kept on the
// page.
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
 * Tracks each `pie-mathjax-version-conflict` event on `target` with the
 * provider `getProvider` returns when it fires, once per provider.
 */
export function forwardMathjaxVersionConflicts(
	target: EventTarget,
	getProvider: () => InstrumentationProvider | undefined,
): void {
	target.addEventListener(MATHJAX_VERSION_CONFLICT_EVENT, (event) => {
		const provider = getProvider();
		if (!provider) return;
		const tracked = providersThatTracked(event);
		if (tracked.has(provider)) return;
		tracked.add(provider);
		const detail = (event as CustomEvent<unknown>).detail;
		const { condition, docsUrl } = (
			detail && typeof detail === "object" ? detail : {}
		) as { condition?: unknown; docsUrl?: unknown };
		try {
			provider.trackEvent(MATHJAX_VERSION_CONFLICT_EVENT, {
				condition,
				docsUrl,
			});
		} catch {
			// Swallow: instrumentation must never break rendering.
		}
	});
}
