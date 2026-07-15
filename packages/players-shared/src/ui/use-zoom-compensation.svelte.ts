/**
 * Reactive browser-zoom compensation factor (Svelte 5 runes wrapper).
 *
 * The pure math lives in `./zoom-compensation.ts` (framework-agnostic, shipped
 * in `dist`); this file adds the reactive glue and is consumed from source via
 * a Vite alias by Svelte packages. Zoom changes always fire a resize event, so
 * listening to resize keeps the value current.
 *
 * The factor is min(1, maxZoom / zoom): exactly 1 at zoom <= maxZoom (caller
 * behavior unchanged), shrinking proportionally above that. `minCompensation`
 * guards against inflated ratios (docked devtools, browser side panels, window
 * chrome) ever making the compensated element unusably small.
 */

import {
	approximateZoomFromWidths,
	computeZoomCompensation,
	type ZoomCompensationOptions,
} from "./zoom-compensation.js";

// Re-exported so existing source-alias consumers can pull the pure helpers,
// shared options, and options type from this module too.
export {
	approximateZoomFromWidths,
	computeZoomCompensation,
	ICON_BUTTON_ZOOM_OPTIONS,
	type ZoomCompensationOptions,
} from "./zoom-compensation.js";

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
