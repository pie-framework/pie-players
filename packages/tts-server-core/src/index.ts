/**
 * Core types and interfaces for server-side TTS providers
 * @module @pie-players/tts-server-core
 */

// Export types
export type {
  SpeechMark,
  SynthesizeRequest,
  SynthesizeResponse,
  SynthesizeMetadata,
  Voice,
  VoiceFeatures,
  GetVoicesOptions,
  ServerProviderCapabilities,
} from './types.js';

export { TTSErrorCode, TTSError } from './types.js';

// Export provider interfaces
export type {
  TTSServerConfig,
  ITTSServerProvider,
} from './provider.js';

export { BaseTTSProvider } from './provider.js';

// Export speech marks utilities
export {
  estimateSpeechMarks,
  adjustSpeechMarksForRate,
  validateSpeechMarks,
  mergeSpeechMarks,
  filterSpeechMarksByType,
  getSpeechMarkAtTime,
  getSpeechMarksStats,
} from './speech-marks.js';

// Export cache interfaces
export type {
  CacheKeyComponents,
  ITTSCache,
  CacheStats,
} from './cache.js';

export {
  generateCacheKey,
  hashText,
  generateHashedCacheKey,
  MemoryCache,
} from './cache.js';
