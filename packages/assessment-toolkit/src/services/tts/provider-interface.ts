/**
 * TTS Provider Interfaces
 *
 * Defines the contract for text-to-speech providers.
 * Providers are stateless factories that create configured TTS implementations.
 *
 * Part of PIE Assessment Toolkit.
 */

import type { TTSConfig } from "../TTSService";

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
	 * Update settings dynamically (optional)
	 * Allows changing rate, pitch, and voice without full reinitialization.
	 * Changes take effect on the next speak() call.
	 */
	updateSettings?(settings: Partial<TTSConfig>): void | Promise<void>;

	/**
	 * Word boundary callback (optional)
	 * Called during speech for word highlighting
	 * @param word - The word being spoken (may be empty for server providers)
	 * @param position - Character position in the text
	 * @param length - Optional word length (for server providers with speech marks)
	 */
	onWordBoundary?: (word: string, position: number, length?: number) => void;
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
