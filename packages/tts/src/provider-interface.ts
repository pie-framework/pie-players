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
	 * @standard W3C Web Speech API (concept)
	 * @example "Joanna" (Polly), "en-US-Standard-A" (Google), browser voice name
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
	 * Organization/tenant identifier
	 *
	 * @extension Application-specific
	 * @use Multi-tenant applications
	 */
	organizationId?: string;

	/**
	 * Provider region or endpoint
	 *
	 * @extension Provider-specific
	 * @example "us-east-1" (AWS), "us-central1" (Google Cloud)
	 */
	region?: string;

	/**
	 * Arbitrary provider-specific options
	 *
	 * @extension Extensibility point
	 * @example { engine: 'neural' } for AWS Polly
	 */
	providerOptions?: Record<string, unknown>;
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
 *   region: "us-east-1",
 *   organizationId: "acme-corp",
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
	 * Pause playback
	 */
	pause(): void;

	/**
	 * Resume playback
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
	 * Word boundary callback (optional)
	 * Called during speech for word highlighting
	 */
	onWordBoundary?: (word: string, position: number) => void;
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
