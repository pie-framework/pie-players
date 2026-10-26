/**
 * Importing this package registers `<pie-section-player-tools-event-debugger>`.
 * The built component supplies the runtime; this entry declares its native host type.
 */

import type { EventDebuggerProps } from "./element-props.js";

/** Native host interface for `<pie-section-player-tools-event-debugger>`. Properties may be unset until it mounts. */
export interface PieSectionPlayerToolsEventDebuggerElement extends HTMLElement, EventDebuggerProps {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-section-player-tools-event-debugger": PieSectionPlayerToolsEventDebuggerElement;
	}
}
