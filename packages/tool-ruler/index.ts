import type { RulerProps } from "./element-props.js";

/** Native host interface for `<pie-tool-ruler>`. Importing the package registers it. */
export interface PieToolRulerElement extends HTMLElement, Required<RulerProps> {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-tool-ruler": PieToolRulerElement;
	}
}
