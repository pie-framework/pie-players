import type { RulerProps } from "./element-props.js";

/** Native host interface for `<pie-tool-ruler>`. Properties may be unset until it mounts. */
export interface PieToolRulerElement extends HTMLElement, RulerProps {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-tool-ruler": PieToolRulerElement;
	}
}
