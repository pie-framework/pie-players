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

interface TTSSpeechSegment {
	text: string;
	startOffset: number;
	pauseMsAfter?: number;
}

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

	async speakSegments(segments: TTSSpeechSegment[]): Promise<void> {
		if (!this.config) {
			throw new Error("TTS not initialized");
		}
		this.stop();
		const runId = this.speakRunId;
		for (const segment of segments) {
			if (runId !== this.speakRunId) break;
			const chunks = this.splitIntoChunks(segment.text);
			for (const chunk of chunks) {
				if (runId !== this.speakRunId) break;
				const shouldContinue = await this.speakChunk(
					chunk.text,
					segment.startOffset + chunk.offset,
					runId,
				);
				if (!shouldContinue) break;
			}
			const pauseMsAfter = Math.max(0, Number(segment.pauseMsAfter || 0));
			if (pauseMsAfter > 0 && runId === this.speakRunId) {
				const shouldContinue = await this.waitForPause(pauseMsAfter, runId);
				if (!shouldContinue) break;
			}
		}
	}

	private async waitForPause(pauseMs: number, runId: number): Promise<boolean> {
		await new Promise((resolve) => setTimeout(resolve, pauseMs));
		return runId === this.speakRunId;
	}

	private splitIntoChunks(text: string): Array<{ text: string; offset: number }> {
		const MAX_CHUNK_LENGTH = 260;
		if (text.length <= MAX_CHUNK_LENGTH) {
			return [{ text, offset: 0 }];
		}

		const sentences = this.segmentSentences(text);
		const chunks: Array<{ text: string; offset: number }> = [];
		let currentText = "";
		let currentOffset = 0;

		for (const sentence of sentences) {
			const trimmed = sentence.text.trim();
			if (!trimmed) continue;
			const firstNonWhitespace = sentence.text.search(/\S/);
			const trimmedStart =
				sentence.offset + (firstNonWhitespace === -1 ? 0 : firstNonWhitespace);

			if (!currentText) {
				currentText = trimmed;
				currentOffset = trimmedStart;
				continue;
			}

			const candidate = `${currentText} ${trimmed}`;
			if (candidate.length <= MAX_CHUNK_LENGTH) {
				currentText = candidate;
			} else {
				chunks.push({ text: currentText, offset: currentOffset });
				currentText = trimmed;
				currentOffset = trimmedStart;
			}
		}

		if (currentText) {
			chunks.push({ text: currentText, offset: currentOffset });
		}
		return chunks.length ? chunks : [{ text, offset: 0 }];
	}

	private getHighlightMode(): "word" | "sentence" {
		const providerOptions = (this.config?.providerOptions || {}) as Record<
			string,
			unknown
		>;
		return providerOptions.highlightMode === "word" ? "word" : "sentence";
	}

	private getSegmentationPolicy(): {
		useSentenceSegmenter: boolean;
		useWordSegmenter: boolean;
		locale?: string;
	} {
		const providerOptions = (this.config?.providerOptions || {}) as Record<
			string,
			unknown
		>;
		const segmenter = (providerOptions.segmenter || {}) as Record<string, unknown>;
		const mode = segmenter.mode;
		const useSegmenter = mode !== "regexOnly";
		const locale =
			typeof segmenter.locale === "string" && segmenter.locale.trim().length > 0
				? segmenter.locale
				: typeof providerOptions.locale === "string" &&
					  providerOptions.locale.trim().length > 0
					? providerOptions.locale
					: undefined;
		return {
			useSentenceSegmenter: useSegmenter,
			useWordSegmenter: useSegmenter,
			locale,
		};
	}

	private segmentSentences(text: string): Array<{ text: string; offset: number }> {
		try {
			const policy = this.getSegmentationPolicy();
			if (!policy.useSentenceSegmenter) {
				throw new Error("Segmenter disabled by policy");
			}
			const Segmenter = globalThis.Intl?.Segmenter;
			if (typeof Segmenter === "function") {
				const segmenter = new Segmenter(policy.locale, {
					granularity: "sentence",
				});
				const segments = Array.from(segmenter.segment(text));
				const parsed = segments
					.map((segment) => ({
						text: segment.segment,
						offset: segment.index,
					}))
					.filter((segment) => segment.text.trim().length > 0);
				if (parsed.length > 0) {
					return parsed;
				}
			}
		} catch {
			// Fallback below.
		}

		const sentenceRegex = /[^.!?]+(?:[.!?]+|$)/g;
		const raw = text.match(sentenceRegex) || [text];
		const parsed: Array<{ text: string; offset: number }> = [];
		let processed = 0;
		for (const sentence of raw) {
			const offset = text.indexOf(sentence, processed);
			if (offset === -1) continue;
			parsed.push({ text: sentence, offset });
			processed = offset + sentence.length;
		}
		return parsed.length > 0 ? parsed : [{ text, offset: 0 }];
	}

	private inferWordLength(text: string, index: number): number {
		const safeIndex = Math.max(0, Math.min(index, Math.max(0, text.length - 1)));
		const slice = text.slice(safeIndex);
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
				if (this.getHighlightMode() === "sentence") {
					return;
				}

				const charIndex = Math.max(
					0,
					Math.min(event.charIndex, Math.max(0, chunkText.length - 1)),
				);
				const reportedLength = Number(event.charLength || 0);
				const inferredLength = this.inferWordLength(chunkText, charIndex);
				const wordLength =
					Number.isFinite(reportedLength) &&
					reportedLength > 0 &&
					reportedLength <= 80 &&
					charIndex + reportedLength <= chunkText.length
						? reportedLength
						: inferredLength;
				const word = chunkText
					.substring(charIndex, Math.min(chunkText.length, charIndex + wordLength))
					.trim();
				const absoluteBoundaryStart = chunkOffset + charIndex;
				console.log(
					"[BrowserProvider] Calling onWordBoundary with word:",
					word,
					"at position:",
					absoluteBoundaryStart,
				);
				this.onWordBoundary(word, absoluteBoundaryStart, wordLength);
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
		if (settings.providerOptions !== undefined) {
			this.config.providerOptions = {
				...(this.config.providerOptions || {}),
				...(settings.providerOptions || {}),
			};
		}
	}

	onWordBoundary?: (word: string, position: number, length?: number) => void;
}
