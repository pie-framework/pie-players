import type { ProtractorProps } from "./element-props.js";

/** Native host interface for `<pie-tool-protractor>`. Properties may be unset until it mounts. */
export interface PieToolProtractorElement extends HTMLElement, ProtractorProps {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-tool-protractor": PieToolProtractorElement;
	}
}
