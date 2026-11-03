/**
 * @pie-players/pie-tts
 *
 * Core TTS interfaces and types for PIE Assessment Toolkit.
 * No UI dependencies - pure TypeScript interfaces.
 */

export type {
	ITTSProvider,
	ITTSProviderImplementation,
	SpeedRateBucket,
	TTSSpeechSegment,
	TTSConfig,
	TTSPlaybackStart,
	TTSProviderCapabilities,
	TTSProviderOptions,
} from "./provider-interface.js";

// The word-timing wire format and its correction, shared by the browser client
// and the server providers.
export type { SpeechMark } from "./speech-marks.js";
export {
	anchorSpeechMarks,
	normalizeSpeechMarks,
} from "./speech-marks.js";
export { resolveSpeedRateBucket } from "./speed-rate.js";
