/**
 * Importing this package registers `<pie-section-player-tools-tts-settings>`.
 * The built component supplies the runtime; this entry declares its native host type.
 */

export type {
	CustomProviderContext,
	CustomProviderDescriptor,
	CustomProviderPreviewResult,
	PreviewMode,
	PreviewSpeechMark,
	ProviderApplyResult,
	ProviderAvailabilityResult,
} from "./types.js";

import type { TtsSettingsProps } from "./element-props.js";

/** Native host interface for `<pie-section-player-tools-tts-settings>`. Properties may be unset until it mounts. */
export interface PieSectionPlayerToolsTtsSettingsElement extends HTMLElement, TtsSettingsProps {}

declare global {
	interface HTMLElementTagNameMap {
		"pie-section-player-tools-tts-settings": PieSectionPlayerToolsTtsSettingsElement;
	}
}
