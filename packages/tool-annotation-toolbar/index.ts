/**
 * Importing this package registers `<pie-tool-annotation-toolbar>`.
 * The built component supplies the runtime; this entry declares its native host type.
 */

import type { AnnotationToolbarProps } from "./element-props.js";

/** Native host interface for `<pie-tool-annotation-toolbar>`. Properties may be unset until it mounts. */
export interface PieToolAnnotationToolbarElement extends HTMLElement, AnnotationToolbarProps {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-tool-annotation-toolbar": PieToolAnnotationToolbarElement;
	}
}
