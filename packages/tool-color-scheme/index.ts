/**
 * Importing this package registers `<pie-tool-theme>`.
 * The built component supplies the runtime; this entry declares its native host type.
 */

import type { ThemeProps } from "./element-props.js";

/** Native host interface for `<pie-tool-theme>`. Properties may be unset until it mounts. */
export interface PieToolThemeElement extends HTMLElement, ThemeProps {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-tool-theme": PieToolThemeElement;
	}
}
