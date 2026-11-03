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
export { generateHashedCacheKey, MemoryCache } from "./cache.js";

// Export provider interfaces
export type {
	ITTSServerProvider,
	TTSServerConfig,
} from "./provider.js";

export { BaseTTSProvider } from "./provider.js";

export { resolveTTSErrorCodeForHttpStatus } from "./http-error-mapping.js";

// Speech marks and speed-rate utilities live in the contract package, shared
// with the browser client; re-exported so this package's surface stays
// unchanged.
export {
	anchorSpeechMarks,
	normalizeSpeechMarks,
	resolveSpeedRateBucket,
	type SpeedRateBucket,
} from "@pie-players/pie-tts";
// Export types
export type {
	GetVoicesOptions,
	ServerProviderCapabilities,
	SpeechMark,
	StandardTTSParameters,
	SynthesizeMetadata,
	SynthesizedAudioBytes,
	SynthesizeRequest,
	SynthesizeResponse,
	TTSProviderExtensions,
	Voice,
	VoiceFeatures,
} from "./types.js";
export { TTSError, TTSErrorCode } from "./types.js";
