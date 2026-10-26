/**
 * Importing this package registers `<pie-tool-line-reader>`.
 * The built component supplies the runtime; this entry declares its native host type.
 */

import type { LineReaderProps } from "./element-props.js";

/** Native host interface for `<pie-tool-line-reader>`. Properties may be unset until it mounts. */
export interface PieToolLineReaderElement extends HTMLElement, LineReaderProps {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-tool-line-reader": PieToolLineReaderElement;
	}
}
