/**
 * Importing this package registers `<pie-tool-answer-eliminator>`.
 * The built component supplies the runtime; this entry declares its native host type.
 */

import type { AnswerEliminatorProps } from "./element-props.js";

/** Native host interface for `<pie-tool-answer-eliminator>`. Properties may be unset until it mounts. */
export interface PieToolAnswerEliminatorElement extends HTMLElement, AnswerEliminatorProps {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-tool-answer-eliminator": PieToolAnswerEliminatorElement;
	}
}
