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
	private speakRunId = 0;

	constructor(config: TTSConfig) {
		this.config = config;
	}

	async speak(text: string): Promise<void> {
		if (!this.config) {
			throw new Error("TTS not initialized");
		}
		// Invalidate any in-flight run and cancel current utterance.
		this.stop();
		const runId = this.speakRunId;

		const chunks = this.splitIntoChunks(text);
		for (const chunk of chunks) {
			if (runId !== this.speakRunId) {
				break;
			}
			const shouldContinue = await this.speakChunk(chunk.text, chunk.offset, runId);
			if (!shouldContinue) {
				break;
			}
		}
	}

	private splitIntoChunks(text: string): Array<{ text: string; offset: number }> {
		const MAX_CHUNK_LENGTH = 260;
		if (text.length <= MAX_CHUNK_LENGTH) {
			return [{ text, offset: 0 }];
		}

		const sentenceRegex = /[^.!?]+(?:[.!?]+|$)/g;
		const sentences = text.match(sentenceRegex) || [text];
		const chunks: Array<{ text: string; offset: number }> = [];
		let currentText = "";
		let currentOffset = 0;
		let processed = 0;

		for (const sentence of sentences) {
			const sentenceStart = text.indexOf(sentence, processed);
			if (sentenceStart === -1) continue;
			processed = sentenceStart + sentence.length;
			const trimmed = sentence.trim();
			if (!trimmed) continue;

			if (!currentText) {
				currentText = trimmed;
				currentOffset = sentenceStart;
				continue;
			}

			const candidate = `${currentText} ${trimmed}`;
			if (candidate.length <= MAX_CHUNK_LENGTH) {
				currentText = candidate;
			} else {
				chunks.push({ text: currentText, offset: currentOffset });
				currentText = trimmed;
				currentOffset = sentenceStart;
			}
		}

		if (currentText) {
			chunks.push({ text: currentText, offset: currentOffset });
		}
		return chunks.length ? chunks : [{ text, offset: 0 }];
	}

	private inferWordLength(text: string, index: number): number {
		const slice = text.slice(index);
		const match = slice.match(/^\s*([^\s]+)/);
		return match?.[1]?.length || 1;
	}

	private async speakChunk(
		chunkText: string,
		chunkOffset: number,
		runId: number,
	): Promise<boolean> {
		return new Promise((resolve, reject) => {
			if (runId !== this.speakRunId) {
				resolve(false);
				return;
			}
			this.utterance = new SpeechSynthesisUtterance(chunkText);

			// Track repeated boundary positions (some browsers emit broken events on long utterances)
			let lastBoundaryIndex = -1;
			let repeatedBoundaryCount = 0;

			// Apply config
			if (this.config?.voice) {
				const voices = speechSynthesis.getVoices();
				const voice = voices.find((v) => v.name === this.config!.voice);
				if (voice) this.utterance!.voice = voice;
			}

			if (this.config?.rate) this.utterance.rate = this.config.rate;
			if (this.config?.pitch) this.utterance.pitch = this.config.pitch;

			this.utterance.onstart = () => {
				if (runId !== this.speakRunId) return;
				this._isPlaying = true;
				this._isPaused = false;
			};

			this.utterance.onend = () => {
				if (runId !== this.speakRunId) {
					resolve(false);
					return;
				}
				this._isPlaying = false;
				this._isPaused = false;
				resolve(true);
			};

			this.utterance.onerror = (event) => {
				if (runId !== this.speakRunId) {
					resolve(false);
					return;
				}
				this._isPlaying = false;
				this._isPaused = false;
				if (event.error === "interrupted" || event.error === "canceled") {
					resolve(false);
					return;
				}
				reject(new Error(`Speech synthesis error: ${event.error}`));
			};

			this.utterance.onpause = () => {
				if (runId !== this.speakRunId) return;
				this._isPaused = true;
			};

			this.utterance.onresume = () => {
				if (runId !== this.speakRunId) return;
				this._isPaused = false;
			};

			this.utterance.onboundary = (event) => {
				if (runId !== this.speakRunId) return;
				console.log(
					"[BrowserProvider] Boundary event:",
					event.name,
					"charIndex:",
					event.charIndex,
					"charLength:",
					event.charLength,
				);
				if (event.name !== "word" || !this.onWordBoundary) return;

				if (event.charIndex === lastBoundaryIndex) {
					repeatedBoundaryCount += 1;
				} else {
					repeatedBoundaryCount = 0;
					lastBoundaryIndex = event.charIndex;
				}
				if (repeatedBoundaryCount > 2) {
					console.warn(
						"[BrowserProvider] Browser word boundaries repeating at same index; suppressing duplicates",
					);
					return;
				}

				const charIndex = Math.max(
					0,
					Math.min(event.charIndex, Math.max(0, chunkText.length - 1)),
				);
				const reportedLength = Number(event.charLength || 0);
				let wordLength =
					Number.isFinite(reportedLength) && reportedLength > 0
						? reportedLength
						: this.inferWordLength(chunkText, charIndex);
				if (wordLength > 80 || charIndex + wordLength > chunkText.length) {
					wordLength = this.inferWordLength(chunkText, charIndex);
				}
				const word = chunkText
					.substring(charIndex, Math.min(chunkText.length, charIndex + wordLength))
					.trim();
				console.log(
					"[BrowserProvider] Calling onWordBoundary with word:",
					word,
					"at position:",
					chunkOffset + charIndex,
				);
				this.onWordBoundary(word, chunkOffset + charIndex, wordLength);
			};

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
		this.speakRunId += 1;
		if (this._isPlaying) {
			speechSynthesis.cancel();
		}
		this._isPlaying = false;
		this._isPaused = false;
	}

	isPlaying(): boolean {
		return this._isPlaying && !this._isPaused;
	}

	isPaused(): boolean {
		return this._isPaused;
	}

	/**
	 * Update settings dynamically (rate, pitch, voice)
	 * Changes take effect on the next speak() call
	 */
	updateSettings(settings: Partial<TTSConfig>): void {
		if (!this.config) {
			this.config = {} as TTSConfig;
		}

		// Update config with new settings
		if (settings.rate !== undefined) {
			this.config.rate = settings.rate;
		}
		if (settings.pitch !== undefined) {
			this.config.pitch = settings.pitch;
		}
		if (settings.voice !== undefined) {
			this.config.voice = settings.voice;
		}
	}

	onWordBoundary?: (word: string, position: number, length?: number) => void;
}
