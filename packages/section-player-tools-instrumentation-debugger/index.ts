/**
 * Importing this package registers `<pie-section-player-tools-instrumentation-debugger>`.
 * The built component supplies the runtime; this entry declares its native host type.
 */

import type { InstrumentationDebuggerProps } from "./element-props.js";

/** Native host interface for `<pie-section-player-tools-instrumentation-debugger>`. Properties may be unset until it mounts. */
export interface PieSectionPlayerToolsInstrumentationDebuggerElement extends HTMLElement, InstrumentationDebuggerProps {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-section-player-tools-instrumentation-debugger": PieSectionPlayerToolsInstrumentationDebuggerElement;
	}
}
