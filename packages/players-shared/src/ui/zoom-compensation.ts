/**
 * Pure browser-zoom compensation math (framework-agnostic, no Svelte runes).
 *
 * Browser zoom is approximated as outerWidth / innerWidth: outerWidth is the
 * OS window size (zoom-independent) while innerWidth is in CSS pixels (shrinks
 * as zoom increases). Callers apply the returned factor via CSS `zoom` so an
 * element that would otherwise keep enlarging past `maxZoom` compounds back
 * down to the cap.
 *
 * This module is tsc-buildable and shipped in `dist`, so it can be consumed by
 * packages that resolve `@pie-players/pie-players-shared` from its published
 * build (e.g. the assessment-toolkit CE bundle) as well as by the reactive
 * Svelte wrapper in `./use-zoom-compensation.svelte.ts`, which packages built
 * with Vite alias to source.
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

/**
 * Shared zoom-cap settings for the toolbar icon buttons (the TTS play button and
 * the calculator button) so both compensate identically and can't drift apart.
 * Grow normally up to 200%, then freeze; the 0.25 floor keeps the cap holding
 * past 500% browser zoom (see the minCompensation note in
 * section-player's SectionPlayerTabbedContent).
 */
export const ICON_BUTTON_ZOOM_OPTIONS: ZoomCompensationOptions = {
	maxZoom: 2,
	minCompensation: 0.25,
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
