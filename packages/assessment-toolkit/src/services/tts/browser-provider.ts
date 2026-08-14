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
import { segmentSentences as segmentTextToSentences } from "./text-segmentation.js";

interface TTSSpeechSegment {
	text: string;
	startOffset: number;
	pauseMsAfter?: number;
}

const NATIVE_START_TIMEOUT_MS = 5_000;
const VOICE_INVENTORY_TIMEOUT_MS = 2_000;

const normalizeLanguageCode = (value: unknown): string =>
	String(value || "")
		.trim()
		.toLowerCase();

const browserLanguage = (): string => {
	const navigatorLanguage =
		typeof navigator !== "undefined"
			? navigator.language || navigator.languages?.[0]
			: "";
	return normalizeLanguageCode(navigatorLanguage || "en-US");
};

const findBrowserVoice = (
	voices: SpeechSynthesisVoice[],
	preferredVoice?: string,
): SpeechSynthesisVoice | null => {
	if (preferredVoice) {
		return (
			voices.find((voice) => voice.voiceURI === preferredVoice) ||
			voices.find((voice) => voice.name === preferredVoice) ||
			null
		);
	}
	const language = browserLanguage();
	const languagePrefix = language.split("-")[0] || "en";
	const matchesLanguage = (voice: SpeechSynthesisVoice) => {
		const voiceLanguage = normalizeLanguageCode(voice.lang);
		return (
			voiceLanguage === language ||
			voiceLanguage.startsWith(`${languagePrefix}-`)
		);
	};
	const ranked = [
		(voice: SpeechSynthesisVoice) =>
			voice.localService && matchesLanguage(voice),
		(voice: SpeechSynthesisVoice) => voice.default && matchesLanguage(voice),
		(voice: SpeechSynthesisVoice) => matchesLanguage(voice),
		(voice: SpeechSynthesisVoice) => voice.localService,
		(voice: SpeechSynthesisVoice) => voice.default,
	];
	for (const predicate of ranked) {
		const voice = voices.find(predicate);
		if (voice) return voice;
	}
	return voices[0] || null;
};

const shouldAssignBrowserVoice = (voice: SpeechSynthesisVoice): boolean =>
	!voice.default;

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
			// The Web Speech API voices plain text only; SSML tags are read aloud.
			supportsSSML: false,
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
	private settlePendingVoiceWait: (() => void) | null = null;
	private settlePendingChunk: (() => void) | null = null;
	onPlaybackStart: (() => void) | undefined = undefined;

	constructor(config: TTSConfig) {
		this.config = config;
	}

	private waitForBrowserVoices(
		runId: number,
		configuredVoice: string,
	): Promise<boolean> {
		return new Promise((resolve, reject) => {
			const synth = speechSynthesis;
			const canUseEventTarget =
				typeof synth.addEventListener === "function" &&
				typeof synth.removeEventListener === "function";
			const previousHandler = canUseEventTarget ? null : synth.onvoiceschanged;
			let settled = false;
			let timeout: ReturnType<typeof setTimeout> | null = null;
			let pendingSettlement: (() => void) | null = null;

			const cleanup = () => {
				if (timeout !== null) {
					clearTimeout(timeout);
					timeout = null;
				}
				if (canUseEventTarget) {
					synth.removeEventListener("voiceschanged", onVoicesChanged);
				} else if (synth.onvoiceschanged === propertyHandler) {
					synth.onvoiceschanged = previousHandler;
				}
				if (
					pendingSettlement &&
					this.settlePendingVoiceWait === pendingSettlement
				) {
					this.settlePendingVoiceWait = null;
				}
			};
			const finish = (voicesAvailable: boolean, error?: Error) => {
				if (settled) return;
				settled = true;
				cleanup();
				if (error) {
					reject(error);
				} else {
					resolve(voicesAvailable);
				}
			};
			const inspectVoiceInventory = () => {
				if (runId !== this.speakRunId) {
					finish(false);
					return;
				}
				if (synth.getVoices().length > 0) finish(true);
			};
			const onVoicesChanged = () => inspectVoiceInventory();
			const propertyHandler = (event: Event) => {
				try {
					previousHandler?.call(synth, event);
				} finally {
					inspectVoiceInventory();
				}
			};

			pendingSettlement = () => finish(false);
			this.settlePendingVoiceWait = pendingSettlement;
			timeout = setTimeout(
				() =>
					finish(
						false,
						new Error(
							`Configured browser voice "${configuredVoice}" could not be resolved because the browser did not publish its voice inventory within ${VOICE_INVENTORY_TIMEOUT_MS / 1_000} seconds.`,
						),
					),
				VOICE_INVENTORY_TIMEOUT_MS,
			);
			if (canUseEventTarget) {
				synth.addEventListener("voiceschanged", onVoicesChanged);
			} else {
				synth.onvoiceschanged = propertyHandler;
			}
			// Close the getVoices()/listener-registration race without polling.
			inspectVoiceInventory();
		});
	}

	private async resolveBrowserVoice(runId: number): Promise<{
		shouldContinue: boolean;
		voice: SpeechSynthesisVoice | null;
	}> {
		const configuredVoice =
			typeof this.config?.voice === "string" ? this.config.voice.trim() : "";
		let voices = speechSynthesis.getVoices();
		if (configuredVoice && voices.length === 0) {
			const voicesAvailable = await this.waitForBrowserVoices(
				runId,
				configuredVoice,
			);
			if (!voicesAvailable || runId !== this.speakRunId) {
				return { shouldContinue: false, voice: null };
			}
			voices = speechSynthesis.getVoices();
		}
		if (runId !== this.speakRunId) {
			return { shouldContinue: false, voice: null };
		}

		const voice = findBrowserVoice(voices, configuredVoice || undefined);
		if (configuredVoice && !voice) {
			throw new Error(
				`Configured browser voice "${configuredVoice}" is unavailable. Select a voice exposed by this browser using its voiceURI or name.`,
			);
		}
		return { shouldContinue: true, voice };
	}

	async speak(text: string): Promise<void> {
		if (!this.config) {
			throw new Error("TTS not initialized");
		}
		// Invalidate any in-flight run and cancel current utterance.
		this.stop();
		const runId = this.speakRunId;
		const voiceResolution = await this.resolveBrowserVoice(runId);
		if (!voiceResolution.shouldContinue) return;

		const chunks = this.splitIntoChunks(text);
		for (const chunk of chunks) {
			if (runId !== this.speakRunId) {
				break;
			}
			const shouldContinue = await this.speakChunk(
				chunk.text,
				chunk.offset,
				runId,
				voiceResolution.voice,
			);
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
		const voiceResolution = await this.resolveBrowserVoice(runId);
		if (!voiceResolution.shouldContinue) return;
		for (const segment of segments) {
			if (runId !== this.speakRunId) break;
			const chunks = this.splitIntoChunks(segment.text);
			for (const chunk of chunks) {
				if (runId !== this.speakRunId) break;
				const shouldContinue = await this.speakChunk(
					chunk.text,
					segment.startOffset + chunk.offset,
					runId,
					voiceResolution.voice,
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

	private splitIntoChunks(
		text: string,
	): Array<{ text: string; offset: number }> {
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
		const segmenter = (providerOptions.segmenter || {}) as Record<
			string,
			unknown
		>;
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

	private segmentSentences(
		text: string,
	): Array<{ text: string; offset: number }> {
		const policy = this.getSegmentationPolicy();
		return segmentTextToSentences(text, {
			locale: policy.locale,
			useSentenceSegmenter: policy.useSentenceSegmenter,
		});
	}

	private inferWordLength(text: string, index: number): number {
		const safeIndex = Math.max(
			0,
			Math.min(index, Math.max(0, text.length - 1)),
		);
		const slice = text.slice(safeIndex);
		const match = slice.match(/^\s*([^\s]+)/);
		return match?.[1]?.length || 1;
	}

	private async speakChunk(
		chunkText: string,
		chunkOffset: number,
		runId: number,
		voice: SpeechSynthesisVoice | null,
	): Promise<boolean> {
		return new Promise((resolve, reject) => {
			if (runId !== this.speakRunId) {
				resolve(false);
				return;
			}
			const utterance = new SpeechSynthesisUtterance(chunkText);
			this.utterance = utterance;

			// Apply config
			if (voice && shouldAssignBrowserVoice(voice)) utterance.voice = voice;

			if (this.config?.rate) utterance.rate = this.config.rate;
			if (this.config?.pitch) utterance.pitch = this.config.pitch;

			let didStart = false;
			let settled = false;
			let startTimeout: ReturnType<typeof setTimeout> | null = null;
			let pendingSettlement: (() => void) | null = null;

			const clearOwnedUtterance = () => {
				if (this.utterance === utterance) {
					this.utterance = null;
				}
			};
			const clearStartTimeout = () => {
				if (startTimeout !== null) {
					clearTimeout(startTimeout);
					startTimeout = null;
				}
			};
			const detachHandlers = () => {
				utterance.onstart = null;
				utterance.onend = null;
				utterance.onerror = null;
				utterance.onpause = null;
				utterance.onresume = null;
				utterance.onboundary = null;
			};
			const settle = (shouldContinue: boolean, error?: Error) => {
				if (settled) return;
				settled = true;
				clearStartTimeout();
				detachHandlers();
				clearOwnedUtterance();
				if (
					pendingSettlement &&
					this.settlePendingChunk === pendingSettlement
				) {
					this.settlePendingChunk = null;
				}
				if (runId === this.speakRunId) {
					this._isPlaying = false;
					this._isPaused = false;
				}
				if (error) {
					reject(error);
				} else {
					resolve(shouldContinue);
				}
			};
			const browserEngineStartError = (reason: "ended" | "timedOut") =>
				new Error(
					reason === "ended"
						? "Browser speech synthesis ended before audio started. The browser speech engine may be unavailable or stuck; try another voice or restart the browser."
						: `Browser speech synthesis did not start within ${NATIVE_START_TIMEOUT_MS / 1_000} seconds. The browser speech engine may be unavailable or stuck; try another voice or restart the browser.`,
				);

			pendingSettlement = () => settle(false);
			this.settlePendingChunk = pendingSettlement;

			utterance.onstart = () => {
				if (runId !== this.speakRunId) {
					settle(false);
					return;
				}
				didStart = true;
				clearStartTimeout();
				this._isPlaying = true;
				this._isPaused = false;
				try {
					this.onPlaybackStart?.();
				} catch (error) {
					console.error("Browser TTS playback-start callback failed", error);
				}
			};

			utterance.onend = () => {
				if (runId !== this.speakRunId) {
					settle(false);
					return;
				}
				if (!didStart) {
					settle(false, browserEngineStartError("ended"));
					return;
				}
				settle(true);
			};

			utterance.onerror = (event) => {
				if (runId !== this.speakRunId) {
					settle(false);
					return;
				}
				if (event.error === "interrupted" || event.error === "canceled") {
					settle(false);
					return;
				}
				settle(false, new Error(`Speech synthesis error: ${event.error}`));
			};

			utterance.onpause = () => {
				if (runId !== this.speakRunId) return;
				this._isPaused = true;
			};

			utterance.onresume = () => {
				if (runId !== this.speakRunId) return;
				this._isPaused = false;
			};

			utterance.onboundary = (event) => {
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
					.substring(
						charIndex,
						Math.min(chunkText.length, charIndex + wordLength),
					)
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

			startTimeout = setTimeout(() => {
				if (settled || didStart || runId !== this.speakRunId) return;
				settle(false, browserEngineStartError("timedOut"));
				speechSynthesis.cancel();
			}, NATIVE_START_TIMEOUT_MS);

			try {
				speechSynthesis.speak(utterance);
			} catch (error) {
				settle(
					false,
					error instanceof Error
						? error
						: new Error("Browser speech synthesis failed to queue speech"),
				);
			}
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
		const utterance = this.utterance;
		const shouldCancel = this._isPlaying || utterance !== null;
		this.speakRunId += 1;
		this.settlePendingVoiceWait?.();
		this.settlePendingChunk?.();
		if (shouldCancel) {
			speechSynthesis.cancel();
		}
		this.utterance = null;
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
