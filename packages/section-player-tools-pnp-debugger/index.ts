/**
 * Importing this package registers `<pie-section-player-tools-pnp-debugger>`.
 * The built component supplies the runtime; this entry declares its native host type.
 */

import type { PnpDebuggerProps } from "./element-props.js";

/** Native host interface for `<pie-section-player-tools-pnp-debugger>`. Properties may be unset until it mounts. */
export interface PieSectionPlayerToolsPnpDebuggerElement extends HTMLElement, Partial<PnpDebuggerProps> {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-section-player-tools-pnp-debugger": PieSectionPlayerToolsPnpDebuggerElement;
	}
}
