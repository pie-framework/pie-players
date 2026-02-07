/**
 * Core types for server-side TTS providers
 * @module @pie-players/tts-server-core
 */

/**
 * Speech mark representing a timing event in synthesized speech
 * Unified format across all TTS providers
 */
export interface SpeechMark {
  /** Milliseconds from start of audio */
  time: number;

  /** Type of speech mark */
  type: 'word' | 'sentence' | 'ssml';

  /** Character index in original text (inclusive) */
  start: number;

  /** Character index in original text (exclusive) */
  end: number;

  /** The actual word or text */
  value: string;
}

/**
 * Request to synthesize speech
 */
export interface SynthesizeRequest {
  /** Text to synthesize */
  text: string;

  /** Voice ID (provider-specific) */
  voice?: string;

  /** Language code (e.g., 'en-US', 'es-ES') */
  language?: string;

  /** Speech rate (0.25 to 4.0, default 1.0) */
  rate?: number;

  /** Pitch adjustment (-20 to 20, default 0) */
  pitch?: number;

  /** Volume level (0.0 to 1.0, default 1.0) */
  volume?: number;

  /** Audio format */
  format?: 'mp3' | 'wav' | 'ogg';

  /** Sample rate in Hz (e.g., 22050, 24000) */
  sampleRate?: number;

  /** Include speech marks for word timing (default true) */
  includeSpeechMarks?: boolean;
}

/**
 * Response from speech synthesis
 */
export interface SynthesizeResponse {
  /** Audio data (Buffer for server, base64 string for client) */
  audio: Buffer | string;

  /** MIME type of audio (e.g., 'audio/mpeg') */
  contentType: string;

  /** Speech marks for word-level timing */
  speechMarks: SpeechMark[];

  /** Metadata about the synthesis */
  metadata: SynthesizeMetadata;
}

/**
 * Metadata about synthesized speech
 */
export interface SynthesizeMetadata {
  /** Provider that generated the audio */
  providerId: string;

  /** Voice ID used */
  voice: string;

  /** Audio duration in seconds */
  duration: number;

  /** Character count of input text */
  charCount: number;

  /** Whether response was served from cache */
  cached: boolean;

  /** ISO timestamp of synthesis */
  timestamp?: string;
}

/**
 * Voice definition
 */
export interface Voice {
  /** Unique voice identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Language name (e.g., "English", "Spanish") */
  language: string;

  /** Language code (e.g., "en-US", "es-ES") */
  languageCode: string;

  /** Gender of voice */
  gender?: 'male' | 'female' | 'neutral';

  /** Voice quality level */
  quality: 'standard' | 'premium' | 'neural';

  /** Supported features */
  supportedFeatures: VoiceFeatures;

  /** Provider-specific metadata */
  providerMetadata?: Record<string, unknown>;
}

/**
 * Voice feature flags
 */
export interface VoiceFeatures {
  /** Supports SSML markup */
  ssml: boolean;

  /** Supports emotional expression */
  emotions: boolean;

  /** Supports speaking styles */
  styles: boolean;
}

/**
 * Options for listing voices
 */
export interface GetVoicesOptions {
  /** Filter by language code */
  language?: string;

  /** Filter by quality level */
  quality?: 'standard' | 'premium' | 'neural';

  /** Filter by gender */
  gender?: 'male' | 'female' | 'neutral';
}

/**
 * Provider capabilities
 */
export interface ServerProviderCapabilities {
  /** Provider supports speech marks */
  supportsSpeechMarks: boolean;

  /** Provider supports SSML */
  supportsSSML: boolean;

  /** Provider supports pitch control */
  supportsPitch: boolean;

  /** Provider supports rate control */
  supportsRate: boolean;

  /** Provider supports volume control */
  supportsVolume: boolean;

  /** Provider supports multiple voices */
  supportsMultipleVoices: boolean;

  /** Maximum text length in characters */
  maxTextLength: number;

  /** Supported audio formats */
  supportedFormats: ('mp3' | 'wav' | 'ogg')[];
}

/**
 * TTS error codes
 */
export enum TTSErrorCode {
  INVALID_REQUEST = 'INVALID_REQUEST',
  INVALID_VOICE = 'INVALID_VOICE',
  INVALID_PROVIDER = 'INVALID_PROVIDER',
  TEXT_TOO_LONG = 'TEXT_TOO_LONG',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
}

/**
 * TTS error with structured information
 */
export class TTSError extends Error {
  constructor(
    public code: TTSErrorCode,
    message: string,
    public details?: Record<string, unknown>,
    public providerId?: string
  ) {
    super(message);
    this.name = 'TTSError';

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TTSError);
    }
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        provider: this.providerId,
      },
    };
  }
}
