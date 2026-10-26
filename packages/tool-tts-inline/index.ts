import type {
	TTSLayoutMode,
	TTSSpeedOption,
} from "@pie-players/pie-assessment-toolkit/tools/registration";

import type { TtsInlineProps, TtsInlineSize } from "./element-props.js";

export type PieToolTtsInlineSize = TtsInlineSize;
export type PieToolTtsInlineLayoutMode = TTSLayoutMode;
export type PieToolTtsInlineSpeedOption = TTSSpeedOption;

/** Native host interface for `<pie-tool-tts-inline>`. Properties may be unset until it mounts. */
export interface PieToolTtsInlineElement extends HTMLElement, TtsInlineProps {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-tool-tts-inline": PieToolTtsInlineElement;
	}
}
