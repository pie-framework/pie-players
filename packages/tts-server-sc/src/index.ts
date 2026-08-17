/**
 * SchoolCity-backed server-side TTS provider.
 * @module @pie-players/tts-server-sc
 */

export type {
	SchoolCityProviderConfig,
	SchoolCitySynthesizeAssetsResult,
} from "./SchoolCityServerProvider.js";
export { SchoolCityServerProvider } from "./SchoolCityServerProvider.js";
export type { SchoolCityVoiceEntry } from "./sc-voices.js";
export {
	defaultVoiceForSchoolCityLanguage,
	isSupportedSchoolCityLanguage,
	SCHOOLCITY_DEFAULT_VOICES,
	schoolCityVoices,
} from "./sc-voices.js";
