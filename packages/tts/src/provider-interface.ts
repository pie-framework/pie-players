/**
 * TTS Provider Interfaces
 *
 * Defines the contract for text-to-speech providers.
 * Providers are stateless factories that create configured TTS implementations.
 *
 * Part of PIE TTS Core - No UI dependencies.
 */

/**
 * TTS configuration. `voice`, `rate` and `pitch` follow the W3C Web Speech API
 * and are portable across providers; `providerOptions` carry what one provider
 * reads.
 *
 * @see https://w3c.github.io/speech-api/
 *
 * @example
 * ```typescript
 * const config: TTSConfig = {
 *   voice: "Joanna",
 *   rate: 1.0,
 *   providerOptions: { engine: "neural" }
 * };
 * ```
 */
export interface TTSConfig {
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

	/**
	 * Provider options. A provider's configuration type narrows this to the
	 * options it reads.
	 *
	 * @example { engine: 'neural' } for AWS Polly
	 */
	providerOptions?: TTSProviderOptions;
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
 * The three-value speed vocabulary a server transport sends in place of a
 * numeric rate. The toolkit's settings and the server provider's options both
 * type `speedRate` with it.
 */
export type SpeedRateBucket = "slow" | "medium" | "fast";

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
	 * Initialize and create a configured TTS implementation
	 */
	initialize(config: TTSConfig): Promise<ITTSProviderImplementation>;

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
	 * Apply changed settings from the next speak on. The toolkit sends rate,
	 * pitch and voice changes, and the per-speak `providerOptions.contentLanguage`
	 * merged over the provider options already configured.
	 */
	updateSettings(settings: Partial<TTSConfig>): void | Promise<void>;

	/**
	 * Playback-start callback (optional).
	 * Providers that expose it call it only when native/media playback actually
	 * begins, allowing service state and highlighting to follow audible playback.
	 * A provider that knows whether this playback sends word boundaries passes
	 * {@link TTSPlaybackStart}; called without it, the toolkit assumes it does
	 * when the capabilities say so.
	 */
	onPlaybackStart?: (playback?: TTSPlaybackStart) => void;

	/**
	 * Word boundary callback (optional)
	 * Called during speech for word highlighting
	 */
	onWordBoundary?: (word: string, position: number, length?: number) => void;
}

/**
 * What a provider knows about one playback when it starts.
 */
export interface TTSPlaybackStart {
	/**
	 * Whether this playback sends word boundaries. False for a server response
	 * that carries no speech marks: the toolkit then highlights the sentence
	 * being read, whatever highlight mode is configured.
	 */
	wordBoundaries: boolean;
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
 * TTS Provider capabilities: what the toolkit reads to choose a highlight
 * mode, the text format and how long one speak may be.
 */
export interface TTSProviderCapabilities {
	/**
	 * Sends word boundary events for highlighting. A provider whose boundaries
	 * depend on the response, such as a server returning speech marks or not,
	 * reports each playback's at its start through
	 * {@link ITTSProviderImplementation.onPlaybackStart}.
	 */
	supportsWordBoundary: boolean;

	/**
	 * Highlight mode used when the host configures none. Omitted, it is `"word"`
	 * when `supportsWordBoundary` is true and `"sentence"` otherwise.
	 */
	defaultHighlightMode?: "word" | "sentence";

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

