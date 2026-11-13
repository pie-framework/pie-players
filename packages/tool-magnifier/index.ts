/**
 * pie-tool-magnifier - PIE Assessment Tool
 *
 * This package exports a web component built from Svelte.
 * Import the built version for CDN usage, or the .svelte source for Svelte projects.
 */

import type { MagnifierElementProps } from "./element-props.js";

/** Native host interface for `<pie-tool-magnifier>`. Properties may be unset until it mounts. */
export interface PieToolMagnifierElement extends HTMLElement, MagnifierElementProps {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-tool-magnifier": PieToolMagnifierElement;
	}
}
