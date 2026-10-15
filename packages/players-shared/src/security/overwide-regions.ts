/**
 * Keeps the image and table scroll wrappers under a live root in step with
 * whether they scroll. See {@link syncOverwideRegions}.
 *
 * Overflow changes without any mutation: zoom and a resized column change the
 * wrapper's width, an image load or a dropped drag tile changes its content's.
 * A `ResizeObserver` on each wrapper and its content catches both, and its first
 * delivery for a newly observed target is the initial sync. A wrapper that is
 * not laid out measures zero and syncs as non-scrolling; showing it resizes it,
 * which syncs it again.
 *
 * Without `ResizeObserver` nothing is synced, so every wrapper stays a region —
 * the reachable default.
 */

import { IMAGE_SPEC } from "./wrap-overwide-images.js";
import { TABLE_SPEC } from "./wrap-overwide-tables.js";
import { type OverwideWrapSpec, syncOverwideRegions } from "./wrap-overwide.js";

const SPECS: OverwideWrapSpec[] = [IMAGE_SPEC, TABLE_SPEC];
const WRAPPER_SELECTOR = SPECS.map((spec) => `.${spec.wrapperClass}`).join(",");

export interface OverwideRegionTracker {
	/** Starts observing every wrapper under the root not yet observed. */
	track(): void;
	disconnect(): void;
}

export function createOverwideRegionTracker(
	root: Element,
): OverwideRegionTracker {
	if (typeof ResizeObserver === "undefined") {
		return { track() {}, disconnect() {} };
	}

	// Wrapper to the content observed with it. Held strongly, as the observer
	// holds its targets, so each `track()` releases wrappers that have left the
	// document — an element re-rendering over its subtree drops them every time.
	const observed = new Map<Element, Element | null>();
	const observer = new ResizeObserver((entries) => {
		const wrappers = new Set<Element>();
		for (const { target } of entries) {
			const wrapper = target.matches(WRAPPER_SELECTOR)
				? target
				: target.parentElement;
			if (wrapper) wrappers.add(wrapper);
		}
		for (const spec of SPECS) syncOverwideRegions(wrappers, spec);
	});

	return {
		track() {
			for (const [wrapper, content] of observed) {
				if (wrapper.isConnected) continue;
				observer.unobserve(wrapper);
				if (content) observer.unobserve(content);
				observed.delete(wrapper);
			}
			for (const wrapper of Array.from(
				root.querySelectorAll(WRAPPER_SELECTOR),
			)) {
				if (observed.has(wrapper)) continue;
				const content = wrapper.firstElementChild;
				observed.set(wrapper, content);
				observer.observe(wrapper);
				if (content) observer.observe(content);
			}
		},
		disconnect() {
			observer.disconnect();
			observed.clear();
		},
	};
}
