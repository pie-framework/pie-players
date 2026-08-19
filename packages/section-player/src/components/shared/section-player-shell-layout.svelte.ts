/**
 * The layout plumbing every section-player custom-element shell needs.
 *
 * The three shells — vertical, tabbed, split-pane — differ in how they arrange
 * panes and in nothing else at this level: each clamps the same host-configurable
 * pixel values, finds its own host element through the same root-node walk, and
 * watches the same narrow-layout media query. That was copied three times, so a
 * changed clamp bound reached whichever shells someone remembered.
 *
 * What cannot be shared, and is not this module's failure: the `props` map inside
 * `<svelte:options customElement={{…}}>`. The Svelte compiler rejects anything but
 * a statically analyzable object literal there — `svelte_options_invalid_customelement_props`
 * — so that block stays duplicated per shell by construction. The command
 * forwarders are the same story: the compiler exposes a component's
 * `export function` declarations as custom-element methods, so they must be
 * declared in each `.svelte` file, though their bodies are one line each.
 */

export const DEFAULT_NARROW_BREAKPOINT_PX = 1100;
const NARROW_BREAKPOINT_MIN_PX = 400;
const NARROW_BREAKPOINT_MAX_PX = 2000;
const CONTENT_MAX_WIDTH_MIN_PX = 320;
const CONTENT_MAX_WIDTH_MAX_PX = 2200;

/**
 * A host-supplied pixel value, clamped into range. `undefined` for anything the
 * host left unset or wrote as a non-number, so a caller can fall back rather than
 * render at zero.
 */
export function resolveConfiguredPx(
	value: unknown,
	min: number,
	max: number,
): number | undefined {
	if (value === undefined || value === null || value === "") return undefined;
	const num = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(num)) return undefined;
	return Math.max(min, Math.min(max, num));
}

/** The narrow-layout breakpoint, clamped, defaulting when the host set nothing. */
export function clampNarrowBreakpoint(value: unknown): number {
	const num = typeof value === "number" ? value : Number(value);
	const resolved = Number.isFinite(num) ? num : DEFAULT_NARROW_BREAKPOINT_PX;
	return Math.max(
		NARROW_BREAKPOINT_MIN_PX,
		Math.min(NARROW_BREAKPOINT_MAX_PX, resolved),
	);
}

/**
 * The two content-width caps, clamped.
 *
 * `withPassage` is floored at `noPassage`: a passage adds a column, so the
 * two-column cap narrower than the one-column cap would shrink the content on
 * the wider layout.
 */
export function resolveContentMaxWidths(
	contentMaxWidthNoPassage: unknown,
	contentMaxWidthWithPassage: unknown,
): { noPassagePx: number | undefined; withPassagePx: number | undefined } {
	const noPassagePx = resolveConfiguredPx(
		contentMaxWidthNoPassage,
		CONTENT_MAX_WIDTH_MIN_PX,
		CONTENT_MAX_WIDTH_MAX_PX,
	);
	const withPassage = resolveConfiguredPx(
		contentMaxWidthWithPassage,
		CONTENT_MAX_WIDTH_MIN_PX,
		CONTENT_MAX_WIDTH_MAX_PX,
	);
	if (withPassage === undefined) {
		return { noPassagePx, withPassagePx: undefined };
	}
	return {
		noPassagePx,
		withPassagePx:
			noPassagePx === undefined
				? withPassage
				: Math.max(noPassagePx, withPassage),
	};
}

/**
 * The custom element hosting this shell, reached from the shell's anchor node.
 *
 * Through `getRootNode` so it works whether the shell renders into a shadow root
 * or into light DOM, which these shells do (`shadow: "none"`, so item-player and
 * runtime styles can cascade into rendered item content).
 */
export function getShellHostElement(
	anchor: HTMLElement | null,
): HTMLElement | null {
	if (!anchor) return null;
	const rootNode = anchor.getRootNode();
	if (rootNode && "host" in rootNode) {
		return (rootNode as ShadowRoot).host as HTMLElement;
	}
	return anchor.parentElement as HTMLElement | null;
}

/**
 * Track whether the viewport is below the shell's narrow-layout breakpoint.
 *
 * Call from a component's init; the effect it registers is torn down with that
 * component. `getBreakpoint` is read reactively, so a host changing the
 * breakpoint attribute re-subscribes to the new query.
 */
export function createNarrowLayoutWatch(getBreakpoint: () => number): {
	readonly isNarrow: boolean;
} {
	let isNarrow = $state(false);

	$effect(() => {
		const breakpoint = getBreakpoint();
		if (typeof window === "undefined") return;
		const query: MediaQueryList = window.matchMedia(
			`(max-width: ${breakpoint}px)`,
		);
		const update = () => {
			isNarrow = query.matches;
		};
		update();
		query.addEventListener("change", update);
		return () => query.removeEventListener("change", update);
	});

	return {
		get isNarrow() {
			return isNarrow;
		},
	};
}
