/**
 * Importing this package registers `<pie-section-player-tools-session-debugger>`.
 * The built component supplies the runtime; this entry declares its native host type.
 */

import type { SessionDebuggerProps } from "./element-props.js";

/** Native host interface for `<pie-section-player-tools-session-debugger>`. Properties may be unset until it mounts. */
export interface PieSectionPlayerToolsSessionDebuggerElement extends HTMLElement, Partial<SessionDebuggerProps> {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-section-player-tools-session-debugger": PieSectionPlayerToolsSessionDebuggerElement;
	}
}
