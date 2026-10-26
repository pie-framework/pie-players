/**
 * Importing this package registers `<pie-tool-periodic-table>`.
 * The built component supplies the runtime; this entry declares its native host type.
 */

import type { PeriodicTableProps } from "./element-props.js";

/** Native host interface for `<pie-tool-periodic-table>`. Properties may be unset until it mounts. */
export interface PieToolPeriodicTableElement extends HTMLElement, PeriodicTableProps {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-tool-periodic-table": PieToolPeriodicTableElement;
	}
}
