import type {
	TTSLayoutMode,
	TTSSpeedOption,
} from "@pie-players/pie-assessment-toolkit/tools/registration";

import type { TtsInlineProps, TtsInlineSize } from "./element-props.js";

export type PieToolTtsInlineSize = TtsInlineSize;
export type PieToolTtsInlineLayoutMode = TTSLayoutMode;
export type PieToolTtsInlineSpeedOption = TTSSpeedOption;

/** Native host interface for `<pie-tool-tts-inline>`. Importing the package registers it. */
export interface PieToolTtsInlineElement extends HTMLElement,
	Required<Omit<TtsInlineProps, "speedOptions" | "pitch" | "volume">>,
	Pick<TtsInlineProps, "speedOptions" | "pitch" | "volume"> {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-tool-tts-inline": PieToolTtsInlineElement;
	}
}
