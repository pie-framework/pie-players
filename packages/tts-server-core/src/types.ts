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
	type: "word" | "sentence" | "ssml";

	/** Character index in original text (inclusive) */
	start: number;

	/** Character index in original text (exclusive) */
	end: number;

	/** The actual word or text */
	value: string;
}

/**
 * Standard TTS parameters based on W3C Web Speech API and SSML specifications.
 *
 * These parameters are widely supported across TTS providers (browsers, cloud services)
 * and follow established standards:
 * - W3C Web Speech API (SpeechSynthesisUtterance)
 * - W3C SSML 1.1 specification
 * - BCP47 language tags (RFC 5646)
 *
 * @see https://w3c.github.io/speech-api/
 * @see https://www.w3.org/TR/speech-synthesis/
 */
export interface StandardTTSParameters {
	/**
	 * Text to synthesize (plain text or SSML markup)
	 *
	 * @standard W3C Web Speech API
	 */
	text: string;

	/**
	 * Voice identifier (provider-specific voice names)
	 * Examples: "Joanna" (Polly), "en-US-Standard-A" (Google), browser voice names
	 *
	 * @standard W3C Web Speech API (concept)
	 * @note Voice names are provider-specific but the concept is standard
	 */
	voice?: string;

	/**
	 * Language code using BCP47 format (e.g., 'en-US', 'es-ES', 'fr-FR')
	 *
	 * @standard BCP47 (RFC 5646), W3C Web Speech API
	 * @see https://tools.ietf.org/html/rfc5646
	 */
	language?: string;

	/**
	 * Speech rate (speed multiplier)
	 * - Range: 0.25 to 4.0
	 * - Default: 1.0 (normal speed)
	 * - 0.5 = half speed, 2.0 = double speed
	 *
	 * @standard W3C Web Speech API, SSML <prosody rate>
	 */
	rate?: number;

	/**
	 * Pitch adjustment
	 * - Range: -20 to +20 semitones (or 0 to 2 as multiplier depending on provider)
	 * - Default: 0 (or 1.0 as multiplier)
	 * - Negative values = lower pitch, positive = higher pitch
	 *
	 * @standard W3C Web Speech API, SSML <prosody pitch>
	 * @note Some providers use semitones (-20 to +20), others use multipliers (0 to 2)
	 */
	pitch?: number;

	/**
	 * Volume level
	 * - Range: 0.0 to 1.0
	 * - Default: 1.0 (full volume)
	 * - 0.0 = silent, 0.5 = half volume
	 *
	 * @standard W3C Web Speech API, SSML <prosody volume>
	 */
	volume?: number;
}

/**
 * Provider-specific extensions for advanced TTS control.
 *
 * These parameters are NOT part of W3C standards and have varying support
 * across providers. Use with caution for portability.
 *
 * Common extensions include:
 * - Audio format selection (mp3, wav, ogg)
 * - Sample rate control
 * - Engine selection (neural vs standard)
 * - Regional endpoints
 * - Speech marks / word timing
 *
 * @note Providers may ignore unsupported extensions silently or throw errors
 */
export interface TTSProviderExtensions {
	/**
	 * Audio format for output
	 *
	 * @extension Common across providers but values vary
	 * @support AWS Polly (mp3, ogg, pcm), Google Cloud TTS (mp3, wav, ogg), Azure (mp3, wav, ogg)
	 */
	format?: "mp3" | "wav" | "ogg" | "pcm";

	/**
	 * Sample rate in Hz (e.g., 8000, 16000, 22050, 24000)
	 *
	 * @extension Common audio parameter
	 * @note Higher sample rates = better quality but larger file sizes
	 */
	sampleRate?: number;

	/**
	 * Request word-level timing data (speech marks)
	 *
	 * @extension Provider-specific but common pattern
	 * @support AWS Polly (SpeechMarks), Google Cloud TTS (timepoints), Azure (word boundaries)
	 * @default true
	 */
	includeSpeechMarks?: boolean;

	/**
	 * Provider-specific options (extensibility point)
	 *
	 * Examples:
	 * - AWS Polly: { engine: 'neural' | 'standard', lexiconNames: string[] }
	 * - Google Cloud TTS: { audioEncoding: string, effectsProfileId: string[] }
	 * - Azure: { voiceType: string, stylesList: string[] }
	 *
	 * @extension Arbitrary provider-specific data
	 */
	providerOptions?: Record<string, unknown>;
}

/**
 * Complete synthesis request combining standard parameters and extensions.
 *
 * This interface provides the full set of options for text-to-speech synthesis,
 * clearly separating W3C-standard parameters from provider-specific extensions.
 *
 * @example Basic usage (portable across providers)
 * ```typescript
 * const request: SynthesizeRequest = {
 *   text: "Hello world",
 *   voice: "Joanna",
 *   rate: 1.0,
 *   language: "en-US"
 * };
 * ```
 *
 * @example Advanced usage with extensions (provider-specific)
 * ```typescript
 * const request: SynthesizeRequest = {
 *   text: "Hello world",
 *   voice: "Joanna",
 *   rate: 1.0,
 *   // Extensions - may not be portable
 *   format: 'mp3',
 *   sampleRate: 24000,
 *   includeSpeechMarks: true,
 *   providerOptions: {
 *     engine: 'neural'  // AWS Polly specific
 *   }
 * };
 * ```
 */
export interface SynthesizeRequest
	extends StandardTTSParameters,
		TTSProviderExtensions {}

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
	gender?: "male" | "female" | "neutral";

	/** Voice quality level */
	quality: "standard" | "premium" | "neural";

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
	quality?: "standard" | "premium" | "neural";

	/** Filter by gender */
	gender?: "male" | "female" | "neutral";
}

/**
 * Provider capabilities split into standard features and extensions.
 *
 * This interface helps consumers understand what features are universally
 * supported (W3C standards) vs provider-specific extensions.
 */
export interface ServerProviderCapabilities {
	/**
	 * Standard W3C features that should be widely supported
	 */
	standard: {
		/**
		 * Supports SSML markup (W3C SSML 1.1)
		 *
		 * @standard W3C SSML 1.1
		 * @support Most cloud TTS providers, limited browser support
		 */
		supportsSSML: boolean;

		/**
		 * Supports pitch control via rate parameter or SSML <prosody>
		 *
		 * @standard W3C Web Speech API, SSML <prosody pitch>
		 * @note May be via API parameter or SSML only
		 */
		supportsPitch: boolean;

		/**
		 * Supports rate (speed) control via rate parameter or SSML <prosody>
		 *
		 * @standard W3C Web Speech API, SSML <prosody rate>
		 */
		supportsRate: boolean;

		/**
		 * Supports volume control via volume parameter or SSML <prosody>
		 *
		 * @standard W3C Web Speech API, SSML <prosody volume>
		 * @note Often better handled client-side for server TTS
		 */
		supportsVolume: boolean;

		/**
		 * Supports multiple voices (voice selection)
		 *
		 * @standard W3C Web Speech API (concept)
		 */
		supportsMultipleVoices: boolean;

		/**
		 * Maximum text length in characters
		 *
		 * @note Varies by provider: Polly=3000, Google=5000, browser=~32k
		 */
		maxTextLength: number;
	};

	/**
	 * Provider-specific extensions
	 */
	extensions: {
		/**
		 * Supports word-level timing data (speech marks)
		 *
		 * @extension Provider-specific but common
		 * @support AWS Polly ✅, Google Cloud TTS ✅, Azure TTS ✅, Browser ⚠️
		 * @note Format and precision vary by provider
		 */
		supportsSpeechMarks: boolean;

		/**
		 * Supported audio output formats
		 *
		 * @extension Common but not standardized
		 */
		supportedFormats: ("mp3" | "wav" | "ogg" | "pcm")[];

		/**
		 * Supports sample rate configuration
		 *
		 * @extension Common audio parameter
		 */
		supportsSampleRate: boolean;

		/**
		 * Provider-specific features (extensibility point)
		 *
		 * Examples:
		 * - AWS Polly: { engines: ['neural', 'standard'], lexicons: true }
		 * - Google Cloud TTS: { audioProfiles: true, voiceEffects: true }
		 * - Azure: { styles: true, emotions: true }
		 *
		 * @extension Arbitrary provider capabilities
		 */
		providerSpecific?: Record<string, unknown>;
	};
}

/**
 * TTS error codes
 */
export enum TTSErrorCode {
	INVALID_REQUEST = "INVALID_REQUEST",
	INVALID_VOICE = "INVALID_VOICE",
	INVALID_PROVIDER = "INVALID_PROVIDER",
	TEXT_TOO_LONG = "TEXT_TOO_LONG",
	PROVIDER_ERROR = "PROVIDER_ERROR",
	NETWORK_ERROR = "NETWORK_ERROR",
	AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
	RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
	INITIALIZATION_ERROR = "INITIALIZATION_ERROR",
}

/**
 * TTS error with structured information
 */
export class TTSError extends Error {
	constructor(
		public code: TTSErrorCode,
		message: string,
		public details?: Record<string, unknown>,
		public providerId?: string,
	) {
		super(message);
		this.name = "TTSError";

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
