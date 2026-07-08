/**
 * Reactive browser-zoom compensation factor.
 *
 * Browser zoom is approximated as outerWidth / innerWidth: outerWidth is the
 * OS window size (zoom-independent) while innerWidth is in CSS pixels (shrinks
 * as zoom increases). Zoom changes always fire a resize event, so listening to
 * resize keeps the value current.
 *
 * The factor is min(1, maxZoom / zoom): exactly 1 at zoom <= maxZoom (caller
 * behavior unchanged), shrinking proportionally above that. `minCompensation`
 * guards against inflated ratios (docked devtools, browser side panels, window
 * chrome) ever making the compensated element unusably small.
 */

export type ZoomCompensationOptions = {
	/**
	 * Zoom level (as a ratio, e.g. `2` for 200%) below which the factor is 1.
	 * Above this level the factor shrinks as `maxZoom / zoom`.
	 */
	maxZoom: number;
	/** Lower bound on the returned factor. */
	minCompensation: number;
};

export type ZoomCompensationHandle = {
	/** Compensation factor: min(1, maxZoom / zoom), clamped below by minCompensation. */
	readonly current: number;
	/** The raw approximated zoom ratio (1 at 100%, 2 at 200%, ...). */
	readonly zoom: number;
};

/**
 * Approximate the browser zoom level from an outer/inner width pair. Falls
 * back to 1 (100%) if the ratio isn't finite or is non-positive (which happens
 * during SSR, in headless envs, and briefly during resize on some browsers).
 */
export function approximateZoomFromWidths(
	outerWidth: number,
	innerWidth: number,
): number {
	const ratio = outerWidth / innerWidth;
	return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

/**
 * Pure zoom-compensation math: exactly 1 at zoom <= maxZoom, then shrinks as
 * `maxZoom / zoom`, floored at `minCompensation` to guard against inflated
 * ratios from window chrome / side panels making the element unusably small.
 */
export function computeZoomCompensation(
	zoom: number,
	maxZoom: number,
	minCompensation: number,
): number {
	return Math.max(minCompensation, Math.min(1, maxZoom / zoom));
}

export function useZoomCompensation(
	options: ZoomCompensationOptions,
): ZoomCompensationHandle {
	const { maxZoom, minCompensation } = options;
	let compensation = $state(1);
	let zoom = $state(1);

	function update() {
		const nextZoom = approximateZoomFromWidths(window.outerWidth, window.innerWidth);
		zoom = nextZoom;
		compensation = computeZoomCompensation(nextZoom, maxZoom, minCompensation);
	}

	$effect(() => {
		if (typeof window === "undefined") return;
		update();
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	});

	return {
		get current() {
			return compensation;
		},
		get zoom() {
			return zoom;
		},
	};
}
