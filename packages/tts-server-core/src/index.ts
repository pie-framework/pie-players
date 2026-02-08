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

// Export speech marks utilities
export {
	adjustSpeechMarksForRate,
	estimateSpeechMarks,
	filterSpeechMarksByType,
	getSpeechMarkAtTime,
	getSpeechMarksStats,
	mergeSpeechMarks,
	validateSpeechMarks,
} from "./speech-marks.js";
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
