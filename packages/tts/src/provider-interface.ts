/**
 * TTS Provider Interfaces
 *
 * Defines the contract for text-to-speech providers.
 * Providers are stateless factories that create configured TTS implementations.
 *
 * Part of PIE TTS Core - No UI dependencies.
 */

/**
 * Standard TTS configuration parameters based on W3C Web Speech API.
 *
 * These are portable across all TTS providers (browser, AWS Polly, Google Cloud, etc.)
 * and align with the W3C Web Speech API specification.
 *
 * @see https://w3c.github.io/speech-api/
 */
export interface StandardTTSConfig {
	/**
	 * Voice identifier (provider-specific)
	 *
	 * For the Browser provider, prefer `SpeechSynthesisVoice.voiceURI`; the
	 * exposed voice `name` is also accepted. An explicit Browser identifier must
	 * resolve to a voice exposed by that browser.
	 *
	 * @standard W3C Web Speech API (concept)
	 * @example "Joanna" (Polly), "en-US-Standard-A" (Google), browser voiceURI or name
	 */
	voice?: string;

	/**
	 * Speech rate (speed multiplier)
	 *
	 * @standard W3C Web Speech API
	 * @range 0.25 to 4.0
	 * @default 1.0
	 */
	rate?: number;

	/**
	 * Pitch adjustment
	 *
	 * @standard W3C Web Speech API
	 * @range 0 to 2 (as multiplier)
	 * @default 1.0
	 */
	pitch?: number;
}

/**
 * Provider-specific extensions for TTS configuration.
 *
 * These are NOT part of W3C standards and support varies by provider.
 */
export interface TTSConfigExtensions {
	/**
	 * Provider options. A provider's configuration type narrows this to the
	 * options it reads.
	 *
	 * @extension Extensibility point
	 * @example { engine: 'neural' } for AWS Polly
	 */
	providerOptions?: TTSProviderOptions;

	/**
	 * Internal read-along hint used by the assessment toolkit to choose between
	 * per-token math highlighting and expression-level math highlighting.
	 */
	mathTokenHighlighting?: boolean;
}

/**
 * The provider options every provider may receive. The assessment toolkit sets
 * them; a provider reads the ones it acts on, and its own options extend these.
 * Keys no provider declares pass through untouched.
 */
export interface TTSProviderOptions {
	/** Telemetry callback the toolkit installs for a provider's backend calls. */
	__pieTelemetry?: (
		eventName: string,
		payload?: Record<string, unknown>,
	) => void | Promise<void>;
	/**
	 * BCP 47 language of the content being read, set per speak when the content
	 * or the host names one.
	 */
	contentLanguage?: string;
	[option: string]: unknown;
}

/**
 * Complete TTS configuration combining standard parameters and extensions.
 *
 * @example Basic usage (portable)
 * ```typescript
 * const config: TTSConfig = {
 *   voice: "Joanna",
 *   rate: 1.0,
 *   pitch: 1.0
 * };
 * ```
 *
 * @example Advanced usage with extensions
 * ```typescript
 * const config: TTSConfig = {
 *   voice: "Joanna",
 *   rate: 1.0,
 *   // Extensions
 *   providerOptions: { engine: "neural" }
 * };
 * ```
 */
export interface TTSConfig extends StandardTTSConfig, TTSConfigExtensions {}

/**
 * TTS Provider interface
 *
 * Providers are stateless factories that create TTS implementations.
 * They describe capabilities and create configured instances.
 */
export interface ITTSProvider {
	/**
	 * Unique identifier for this provider
	 */
	readonly providerId: string;

	/**
	 * Human-readable provider name
	 */
	readonly providerName: string;

	/**
	 * Provider version
	 */
	readonly version: string;

	/**
	 * Initialize and create a configured TTS implementation
	 */
	initialize(config: TTSConfig): Promise<ITTSProviderImplementation>;

	/**
	 * Check if a specific feature is supported
	 */
	supportsFeature(feature: TTSFeature): boolean;

	/**
	 * Get provider capabilities
	 */
	getCapabilities(): TTSProviderCapabilities;

	/**
	 * Clean up provider resources
	 */
	destroy(): void;
}

/**
 * TTS Provider Implementation interface
 *
 * The actual TTS implementation that handles playback.
 * Created by ITTSProvider.initialize()
 */
export interface ITTSProviderImplementation {
	/**
	 * Speak text
	 */
	speak(text: string): Promise<void>;

	/**
	 * Speak pre-segmented text with optional pause metadata.
	 *
	 * Providers that support this can preserve segment boundaries
	 * while still emitting word boundaries in global offsets.
	 */
	speakSegments?(segments: TTSSpeechSegment[]): Promise<void>;

	/**
	 * Pause playback. A pause issued while a speak is still preparing its audio
	 * holds it: the audio does not start until {@link resume}.
	 */
	pause(): void;

	/**
	 * Resume playback, starting audio a pause held before it began.
	 */
	resume(): void;

	/**
	 * Stop playback
	 */
	stop(): void;

	/**
	 * Check if currently playing
	 */
	isPlaying(): boolean;

	/**
	 * Check if paused
	 */
	isPaused(): boolean;

	/**
	 * Apply changed settings from the next speak on. The toolkit sends rate,
	 * pitch and voice changes, and the per-speak `providerOptions.contentLanguage`
	 * merged over the provider options already configured.
	 */
	updateSettings(settings: Partial<TTSConfig>): void | Promise<void>;

	/**
	 * Playback-start callback (optional).
	 * Providers that expose it call it only when native/media playback actually
	 * begins, allowing service state and highlighting to follow audible playback.
	 */
	onPlaybackStart?: () => void;

	/**
	 * Word boundary callback (optional)
	 * Called during speech for word highlighting
	 */
	onWordBoundary?: (word: string, position: number, length?: number) => void;
}

/**
 * Pre-segmented speech unit with global offsets.
 */
export interface TTSSpeechSegment {
	text: string;
	startOffset: number;
	pauseMsAfter?: number;
}

/**
 * TTS Provider capabilities
 *
 * Describes which features a provider supports
 */
export interface TTSProviderCapabilities {
	/**
	 * Supports pause/resume
	 */
	supportsPause: boolean;

	/**
	 * Supports resume after pause
	 */
	supportsResume: boolean;

	/**
	 * Supports word boundary events for highlighting
	 */
	supportsWordBoundary: boolean;

	/**
	 * Supports voice selection
	 */
	supportsVoiceSelection: boolean;

	/**
	 * Supports rate control (speed)
	 */
	supportsRateControl: boolean;

	/**
	 * Supports pitch control
	 */
	supportsPitchControl: boolean;

	/**
	 * Supports SSML markup (W3C SSML 1.1) in the text passed to `speak`.
	 *
	 * When `true`, callers may pass an SSML document (e.g. `<speak>…</speak>`)
	 * and the provider will voice the markup rather than read the tags aloud.
	 * When `false` or omitted, callers must pass plain text — the browser Web
	 * Speech API, for example, speaks tags literally.
	 *
	 * Treat a missing value as `false`.
	 *
	 * @standard W3C SSML 1.1
	 */
	supportsSSML?: boolean;

	/**
	 * Maximum text length (if limited)
	 */
	maxTextLength?: number;
}

/**
 * TTS features for capability checking
 */
export type TTSFeature =
	| "pause"
	| "resume"
	| "wordBoundary"
	| "voiceSelection"
	| "rateControl"
	| "pitchControl";
