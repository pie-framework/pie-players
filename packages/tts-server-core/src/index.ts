/**
 * Core types and interfaces for server-side TTS providers
 * @module @pie-players/tts-server-core
 */

// Export cache interfaces
export type {
	CacheKeyComponents,
	CacheStats,
	ITTSCache,
} from "./cache.js";
export {
	generateCacheKey,
	generateHashedCacheKey,
	hashText,
	MemoryCache,
} from "./cache.js";

// Export provider interfaces
export type {
	ITTSServerProvider,
	TTSServerConfig,
} from "./provider.js";

export { BaseTTSProvider } from "./provider.js";

export { resolveTTSErrorCodeForHttpStatus } from "./http-error-mapping.js";

// Export speech marks utilities
export {
	adjustSpeechMarksForRate,
	estimateSpeechMarks,
	filterSpeechMarksByType,
	getSpeechMarkAtTime,
	getSpeechMarksStats,
	mergeSpeechMarks,
	normalizeSpeechMarks,
	validateSpeechMarks,
} from "./speech-marks.js";
export {
	resolveSpeedRateBucket,
	type SpeedRateBucket,
} from "./speed-rate.js";
// Export types
export type {
	GetVoicesOptions,
	ServerProviderCapabilities,
	SpeechMark,
	StandardTTSParameters,
	SynthesizeMetadata,
	SynthesizeRequest,
	SynthesizeResponse,
	TTSProviderExtensions,
	Voice,
	VoiceFeatures,
} from "./types.js";
export { TTSError, TTSErrorCode } from "./types.js";
