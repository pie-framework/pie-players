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

export function useZoomCompensation(
	options: ZoomCompensationOptions,
): ZoomCompensationHandle {
	const { maxZoom, minCompensation } = options;
	let compensation = $state(1);
	let zoom = $state(1);

	function update() {
		const ratio = window.outerWidth / window.innerWidth;
		const nextZoom = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
		zoom = nextZoom;
		compensation = Math.max(minCompensation, Math.min(1, maxZoom / nextZoom));
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
