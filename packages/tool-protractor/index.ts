import type { ProtractorProps } from "./element-props.js";

/** Native host interface for `<pie-tool-protractor>`. Importing the package registers it. */
export interface PieToolProtractorElement extends HTMLElement, Required<ProtractorProps> {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-tool-protractor": PieToolProtractorElement;
	}
}
