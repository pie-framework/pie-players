/**
 * TTSService
 *
 * Text-to-speech service with pluggable provider architecture.
 * Manages playback state, coordinates multiple TTS entry points,
 * and integrates with HighlightCoordinator for word highlighting.
 *
 * Features:
 * - Pluggable TTS providers (browser, AWS Polly, etc.)
 * - QTI 3.0 accessibility catalogs (pre-authored spoken content)
 * - Unified playback state management
 * - Prevents conflicts from simultaneous speech
 * - Word highlighting integration
 * - Playback controls: play, pause, resume, stop
 *
 * Part of PIE Assessment Toolkit.
 */

import type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSConfig,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";
import type { AccessibilityCatalogResolver } from "./AccessibilityCatalogResolver";
import type { IHighlightCoordinator } from "./interfaces";

// Re-export core TTS types for convenience
export type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSConfig,
	TTSFeature,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";

/**
 * Playback state
 */
export enum PlaybackState {
	IDLE = "idle",
	LOADING = "loading",
	PLAYING = "playing",
	PAUSED = "paused",
	ERROR = "error",
}

/**
 * TTSService
 *
 * Instantiable service for text-to-speech functionality.
 * Each instance manages its own playback state.
 */
export class TTSService {
	private currentProvider: ITTSProvider | null = null;
	private provider: ITTSProviderImplementation | null = null;
	private highlightCoordinator: IHighlightCoordinator | null = null;
	private catalogResolver: AccessibilityCatalogResolver | null = null;
	private state: PlaybackState = PlaybackState.IDLE;
	private currentText: string | null = null;
	private listeners = new Map<string, Set<(state: PlaybackState) => void>>();

	constructor() {}

	/**
	 * Initialize TTS service with a provider
	 *
	 * @param provider TTS provider instance
	 * @param config Provider configuration
	 */
	async initialize(
		provider: ITTSProvider,
		config: Partial<TTSConfig> = {},
	): Promise<void> {
		this.currentProvider = provider;

		// Initialize provider and get implementation
		this.provider = await provider.initialize(config as TTSConfig);
	}

	/**
	 * Set highlight coordinator for word highlighting
	 */
	setHighlightCoordinator(coordinator: IHighlightCoordinator): void {
		this.highlightCoordinator = coordinator;
	}

	/**
	 * Set accessibility catalog resolver for spoken content
	 *
	 * When set, the speak() method will check for pre-authored spoken
	 * content in catalogs before falling back to generated TTS.
	 *
	 * @param resolver AccessibilityCatalogResolver instance
	 */
	setCatalogResolver(resolver: AccessibilityCatalogResolver): void {
		this.catalogResolver = resolver;
	}

	/**
	 * Get provider capabilities
	 */
	getCapabilities(): TTSProviderCapabilities | null {
		return this.currentProvider?.getCapabilities() || null;
	}

	/**
	 * Speak text with optional catalog support
	 *
	 * @param text Text to speak
	 * @param options Optional catalog ID and language
	 */
	async speak(
		text: string,
		options?: { catalogId?: string; language?: string },
	): Promise<void> {
		if (!this.provider) {
			throw new Error("TTS service not initialized");
		}

		// Try to resolve from accessibility catalog if catalogId provided
		let contentToSpeak = text;
		if (options?.catalogId && this.catalogResolver) {
			const catalogContent = this.catalogResolver.getAlternative(
				options.catalogId,
				{
					type: "spoken",
					language: options.language || "en-US",
					useFallback: true,
				},
			);

			if (catalogContent) {
				// Use pre-authored spoken content from catalog
				contentToSpeak = catalogContent.content;
				console.debug(
					`[TTSService] Using catalog content for "${options.catalogId}" (${catalogContent.language})`,
				);
			} else {
				console.debug(
					`[TTSService] No catalog found for "${options.catalogId}", falling back to generated TTS`,
				);
			}
		}

		this.currentText = contentToSpeak;
		this.setState(PlaybackState.LOADING);

		try {
			// Set up word boundary highlighting if coordinator available
			if (this.highlightCoordinator) {
				this.provider.onWordBoundary = (word, position) => {
					// This is simplified - production would need proper range calculation
					// this.highlightCoordinator.highlightTTSWord(textNode, start, end);
				};
			}

			this.setState(PlaybackState.PLAYING);
			await this.provider.speak(contentToSpeak);
			this.setState(PlaybackState.IDLE);

			// Clear highlights when done
			if (this.highlightCoordinator) {
				this.highlightCoordinator.clearHighlights("tts" as any);
			}
		} catch (error) {
			console.error("TTS error:", error);
			this.setState(PlaybackState.ERROR);
			throw error;
		}
	}

	/**
	 * Speak a text range
	 *
	 * @param range DOM Range to speak
	 */
	async speakRange(range: Range): Promise<void> {
		const text = range.toString();
		await this.speak(text);
	}

	/**
	 * Pause playback
	 */
	pause(): void {
		if (!this.provider) return;

		if (this.state === PlaybackState.PLAYING) {
			this.provider.pause();
			this.setState(PlaybackState.PAUSED);
		}
	}

	/**
	 * Resume playback
	 */
	resume(): void {
		if (!this.provider) return;

		if (this.state === PlaybackState.PAUSED) {
			this.provider.resume();
			this.setState(PlaybackState.PLAYING);
		}
	}

	/**
	 * Stop playback
	 */
	stop(): void {
		if (!this.provider) return;

		this.provider.stop();
		this.setState(PlaybackState.IDLE);
		this.currentText = null;

		// Clear highlights
		if (this.highlightCoordinator) {
			this.highlightCoordinator.clearHighlights("tts" as any);
		}
	}

	/**
	 * Check if currently playing
	 */
	isPlaying(): boolean {
		return this.state === PlaybackState.PLAYING;
	}

	/**
	 * Check if paused
	 */
	isPaused(): boolean {
		return this.state === PlaybackState.PAUSED;
	}

	/**
	 * Get current state
	 */
	getState(): PlaybackState {
		return this.state;
	}

	/**
	 * Get current text being spoken
	 */
	getCurrentText(): string | null {
		return this.currentText;
	}

	/**
	 * Subscribe to state changes
	 *
	 * @param id Unique listener ID
	 * @param callback Function to call on state change
	 */
	onStateChange(id: string, callback: (state: PlaybackState) => void): void {
		if (!this.listeners.has(id)) {
			this.listeners.set(id, new Set());
		}
		this.listeners.get(id)!.add(callback);
	}

	/**
	 * Unsubscribe from state changes
	 */
	offStateChange(id: string, callback: (state: PlaybackState) => void): void {
		const callbacks = this.listeners.get(id);
		if (callbacks) {
			callbacks.delete(callback);
			if (callbacks.size === 0) {
				this.listeners.delete(id);
			}
		}
	}

	/**
	 * Set state and notify listeners
	 */
	private setState(newState: PlaybackState): void {
		if (this.state === newState) return;

		this.state = newState;

		// Notify all listeners
		for (const callbacks of this.listeners.values()) {
			for (const callback of callbacks) {
				callback(newState);
			}
		}
	}
}
