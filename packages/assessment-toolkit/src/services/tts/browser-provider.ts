/**
 * Browser TTS Provider
 *
 * Text-to-speech provider using the browser's Web Speech API.
 * Works in all modern browsers that support SpeechSynthesis.
 *
 * Part of PIE Assessment Toolkit.
 */

import type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSConfig,
	TTSFeature,
	TTSProviderCapabilities,
} from "@pie-players/pie-tts";

/**
 * Browser TTS Provider
 *
 * Stateless factory for creating browser-based TTS implementations.
 */
export class BrowserTTSProvider implements ITTSProvider {
	readonly providerId = "browser";
	readonly providerName = "Browser Speech Synthesis";
	readonly version = "1.0.0";

	async initialize(config: TTSConfig): Promise<ITTSProviderImplementation> {
		// SSR guard
		if (typeof window === "undefined") {
			throw new Error("BrowserTTSProvider requires browser environment");
		}

		// Check browser support
		if (!("speechSynthesis" in window)) {
			throw new Error("Browser does not support Speech Synthesis API");
		}

		return new BrowserTTSProviderImpl(config);
	}

	supportsFeature(feature: TTSFeature): boolean {
		// Browser supports all TTS features
		return true;
	}

	getCapabilities(): TTSProviderCapabilities {
		return {
			supportsPause: true,
			supportsResume: true,
			supportsWordBoundary: true,
			supportsVoiceSelection: true,
			supportsRateControl: true,
			supportsPitchControl: true,
		};
	}

	destroy(): void {
		// No cleanup needed for browser provider
	}
}

/**
 * Browser TTS Provider Implementation
 *
 * Handles actual speech synthesis using the Web Speech API.
 */
class BrowserTTSProviderImpl implements ITTSProviderImplementation {
	private utterance: SpeechSynthesisUtterance | null = null;
	private config: TTSConfig | null = null;
	private _isPlaying = false;
	private _isPaused = false;

	constructor(config: TTSConfig) {
		this.config = config;
	}

	async speak(text: string): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.config) {
				reject(new Error("TTS not initialized"));
				return;
			}

			this.stop(); // Stop any ongoing speech

			this.utterance = new SpeechSynthesisUtterance(text);

			// Apply config
			if (this.config.voice) {
				const voices = speechSynthesis.getVoices();
				const voice = voices.find((v) => v.name === this.config!.voice);
				if (voice) this.utterance.voice = voice;
			}

			if (this.config.rate) this.utterance.rate = this.config.rate;
			if (this.config.pitch) this.utterance.pitch = this.config.pitch;

			// Set up event handlers
			this.utterance.onstart = () => {
				this._isPlaying = true;
				this._isPaused = false;
			};

			this.utterance.onend = () => {
				this._isPlaying = false;
				this._isPaused = false;
				resolve();
			};

			this.utterance.onerror = (event) => {
				this._isPlaying = false;
				this._isPaused = false;
				reject(new Error(`Speech synthesis error: ${event.error}`));
			};

			this.utterance.onpause = () => {
				this._isPaused = true;
			};

			this.utterance.onresume = () => {
				this._isPaused = false;
			};

			// Word boundary events (if supported)
			this.utterance.onboundary = (event) => {
				if (event.name === "word" && this.onWordBoundary) {
					// Extract word from text
					const word = text.substring(
						event.charIndex,
						event.charIndex + event.charLength,
					);
					this.onWordBoundary(word, event.charIndex);
				}
			};

			// Start speaking
			speechSynthesis.speak(this.utterance);
		});
	}

	pause(): void {
		if (this._isPlaying && !this._isPaused) {
			speechSynthesis.pause();
		}
	}

	resume(): void {
		if (this._isPlaying && this._isPaused) {
			speechSynthesis.resume();
		}
	}

	stop(): void {
		if (this._isPlaying) {
			speechSynthesis.cancel();
			this._isPlaying = false;
			this._isPaused = false;
		}
	}

	isPlaying(): boolean {
		return this._isPlaying && !this._isPaused;
	}

	isPaused(): boolean {
		return this._isPaused;
	}

	onWordBoundary?: (word: string, position: number) => void;
}
