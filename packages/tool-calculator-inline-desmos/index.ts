/**
 * Importing this package registers `<pie-tool-calculator-inline>`.
 * The built component supplies the runtime; this entry declares its native host type.
 */

import type { CalculatorInlineProps } from "./element-props.js";

/** Native host interface for `<pie-tool-calculator-inline>`. Properties may be unset until it mounts. */
export interface PieToolCalculatorInlineElement extends HTMLElement, CalculatorInlineProps {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-tool-calculator-inline": PieToolCalculatorInlineElement;
	}
}
