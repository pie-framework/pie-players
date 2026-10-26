/**
 * Importing this package registers `<pie-tool-graph>`.
 * The built component supplies the runtime; this entry declares its native host type.
 */

import type { GraphProps } from "./element-props.js";

/** Native host interface for `<pie-tool-graph>`. Properties may be unset until it mounts. */
export interface PieToolGraphElement extends HTMLElement, GraphProps {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-tool-graph": PieToolGraphElement;
	}
}
