/**
 * Browser TTS Provider
 *
 * Text-to-speech provider using the browser's Web Speech API.
 * Works in all modern browsers that support SpeechSynthesis.
 *
 * Part of PIE Assessment Toolkit.
 */

import {
	createPieLogger,
	isTtsDebugEnabled,
} from "@pie-players/pie-players-shared/pie";
import type {
	ITTSProvider,
	ITTSProviderImplementation,
	TTSConfig,
	TTSFeature,
	TTSProviderCapabilities,
	TTSSpeechSegment,
} from "@pie-players/pie-tts";
import type { ToolkitTTSConfig } from "./provider-options.js";
import { extractSpokenText, isSsmlDocument } from "./ssml/spoken-text.js";
import { segmentSentences as segmentTextToSentences } from "./text-segmentation.js";

const logger = createPieLogger("browser-tts-provider", isTtsDebugEnabled);

const NATIVE_START_TIMEOUT_MS = 5_000;
const VOICE_INVENTORY_TIMEOUT_MS = 2_000;

// The provider options the toolkit and this provider read. Every other option,
// and `voice`, belongs to the provider it was configured for: a Polly voice such
// as "Joanna" resolves to no browser voice, and an unresolved voice fails speak.
const PORTABLE_PROVIDER_OPTIONS = [
	"__pieTelemetry",
	"contentLanguage",
	"highlightMode",
	"locale",
	"mathSpeech",
	"segmenter",
	"structuralPauses",
	"textNormalization",
] as const;

/**
 * The part of another provider's configuration that keeps its meaning on
 * browser speech. Every path that replaces a provider with browser speech
 * starts it with this.
 */
export const browserFallbackConfig = (
	config: Partial<TTSConfig>,
): Partial<TTSConfig> => {
	const fallback: Partial<TTSConfig> = {};
	if (config.rate !== undefined) fallback.rate = config.rate;
	if (config.pitch !== undefined) fallback.pitch = config.pitch;
	if (config.mathTokenHighlighting !== undefined) {
		fallback.mathTokenHighlighting = config.mathTokenHighlighting;
	}
	const options = config.providerOptions;
	if (options && typeof options === "object") {
		const portable: Record<string, unknown> = {};
		for (const key of PORTABLE_PROVIDER_OPTIONS) {
			if (options[key] !== undefined) portable[key] = options[key];
		}
		if (Object.keys(portable).length > 0) fallback.providerOptions = portable;
	}
	return fallback;
};

/**
 * The Web Speech API reads SSML tags aloud, so a `<speak>` document is voiced
 * as its spoken text. Boundary offsets still index the text as sent: that is
 * the space the highlight pipeline resolves a raw-SSML chunk in.
 */
const toUtteranceText = (
	text: string,
): { text: string; sourceOffset: (offset: number) => number } => {
	if (!isSsmlDocument(text)) {
		return { text, sourceOffset: (offset) => offset };
	}
	const { spokenText, rawToSpokenOffsetMap } = extractSpokenText(text);
	const spokenToRaw: number[] = [];
	for (const [raw, spoken] of rawToSpokenOffsetMap) {
		const known = spokenToRaw[spoken];
		if (known === undefined || raw < known) spokenToRaw[spoken] = raw;
	}
	return {
		text: spokenText,
		// Alias text (`<sub alias>`) has no raw offset; it takes the nearest
		// preceding one.
		sourceOffset: (offset) => {
			for (let index = offset; index >= 0; index--) {
				const raw = spokenToRaw[index];
				if (raw !== undefined) return raw;
			}
			return 0;
		},
	};
};

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

/**
 * The voice traits browser voice selection reads. A `SpeechSynthesisVoice` has
 * them all; a host's own voice list may carry a subset.
 */
export interface BrowserVoiceTraits {
	voiceURI?: string;
	name?: string;
	lang?: string;
	localService?: boolean;
	default?: boolean;
}

/**
 * Whether a voice speaks `contentLanguage`, or the browser's own language when
 * the content names none: the same language, or the same primary subtag.
 */
export const browserVoiceMatchesLanguage = (
	voice: Pick<BrowserVoiceTraits, "lang">,
	contentLanguage?: string,
): boolean => {
	const language = normalizeLanguageCode(contentLanguage) || browserLanguage();
	const languagePrefix = language.split("-")[0] || "en";
	const voiceLanguage = normalizeLanguageCode(voice.lang);
	return (
		voiceLanguage === language || voiceLanguage.startsWith(`${languagePrefix}-`)
	);
};

/**
 * The voice to read with: the configured one, else one for `contentLanguage`
 * (the language of the content being read), else one for the browser's own
 * language.
 */
export const findBrowserVoice = <Voice extends BrowserVoiceTraits>(
	voices: readonly Voice[],
	preferredVoice?: string,
	contentLanguage?: string,
): Voice | null => {
	if (preferredVoice) {
		return (
			voices.find((voice) => voice.voiceURI === preferredVoice) ||
			voices.find((voice) => voice.name === preferredVoice) ||
			null
		);
	}
	const matchesLanguage = (voice: Voice) =>
		browserVoiceMatchesLanguage(voice, contentLanguage);
	const ranked = [
		(voice: Voice) => voice.localService && matchesLanguage(voice),
		(voice: Voice) => voice.default && matchesLanguage(voice),
		(voice: Voice) => matchesLanguage(voice),
		(voice: Voice) => voice.localService,
		(voice: Voice) => voice.default,
	];
	for (const predicate of ranked) {
		const voice = voices.find(predicate);
		if (voice) return voice;
	}
	return voices[0] || null;
};

/**
 * Waits for `synth` to publish its voice inventory, which browsers fill
 * asynchronously after page load. Resolves `true` once `getVoices()` is
 * non-empty, at once when it already is; `false` after `timeoutMs`, once
 * `isCurrent` reports the wait superseded, or when `synth` offers no
 * `voiceschanged` channel to wait on. A previous `onvoiceschanged` handler
 * keeps running and is restored afterwards.
 */
export const waitForBrowserVoices = (
	synth: SpeechSynthesis,
	timeoutMs: number,
	isCurrent: () => boolean = () => true,
): Promise<boolean> => {
	if (synth.getVoices().length > 0) return Promise.resolve(true);
	const canUseEventTarget =
		typeof synth.addEventListener === "function" &&
		typeof synth.removeEventListener === "function";
	if (!canUseEventTarget && !("onvoiceschanged" in synth)) {
		return Promise.resolve(false);
	}
	return new Promise((resolve) => {
		const previousHandler = canUseEventTarget ? null : synth.onvoiceschanged;
		let settled = false;
		const finish = (voicesAvailable: boolean) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			if (canUseEventTarget) {
				synth.removeEventListener("voiceschanged", onVoicesChanged);
			} else if (synth.onvoiceschanged === propertyHandler) {
				synth.onvoiceschanged = previousHandler;
			}
			resolve(voicesAvailable);
		};
		const inspectVoiceInventory = () => {
			if (!isCurrent()) finish(false);
			else if (synth.getVoices().length > 0) finish(true);
		};
		const onVoicesChanged = () => inspectVoiceInventory();
		const propertyHandler = (event: Event) => {
			try {
				previousHandler?.call(synth, event);
			} finally {
				inspectVoiceInventory();
			}
		};
		const timeout = setTimeout(() => finish(false), timeoutMs);
		if (canUseEventTarget) {
			synth.addEventListener("voiceschanged", onVoicesChanged);
		} else {
			synth.onvoiceschanged = propertyHandler;
		}
		// Close the getVoices()/listener-registration race without polling.
		inspectVoiceInventory();
	});
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

		// Only a configured voice needs the inventory; waiting otherwise would
		// hold readiness on a browser that publishes no voices.
		if (typeof config.voice === "string" && config.voice.trim()) {
			await waitForBrowserVoices(
				window.speechSynthesis,
				VOICE_INVENTORY_TIMEOUT_MS,
			);
		}
		return new BrowserTTSProviderImpl(config);
	}

	supportsFeature(feature: TTSFeature): boolean {
		const capabilities = this.getCapabilities();
		switch (feature) {
			case "pause":
				return capabilities.supportsPause;
			case "resume":
				return capabilities.supportsResume;
			case "wordBoundary":
				return capabilities.supportsWordBoundary;
			case "voiceSelection":
				return capabilities.supportsVoiceSelection;
			case "rateControl":
				return capabilities.supportsRateControl;
			case "pitchControl":
				return capabilities.supportsPitchControl;
			default:
				return false;
		}
	}

	getCapabilities(): TTSProviderCapabilities {
		return {
			supportsPause: true,
			supportsResume: true,
			// Boundary events depend on the voice: several network voices send none.
			supportsWordBoundary: false,
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
	private config: ToolkitTTSConfig | null = null;
	private _isPlaying = false;
	// The run's pause, which outlasts the utterance it paused: a pause between
	// utterances holds the next one until resume.
	private _isPaused = false;
	private speakRunId = 0;
	// The run speaking now, between its utterances as well as during them.
	private activeRunId: number | null = null;
	private releasePauseHold: (() => void) | null = null;
	private settlePendingChunk: (() => void) | null = null;
	private settlePendingGap: (() => void) | null = null;
	onPlaybackStart: (() => void) | undefined = undefined;

	constructor(config: TTSConfig) {
		this.config = config;
	}

	/** Whether run `runId` is still current once any pause between utterances ends. */
	private async waitWhilePaused(runId: number): Promise<boolean> {
		while (this._isPaused && runId === this.speakRunId) {
			await new Promise<void>((resolve) => {
				this.releasePauseHold = resolve;
			});
		}
		return runId === this.speakRunId;
	}

	private releaseHold(): void {
		const release = this.releasePauseHold;
		this.releasePauseHold = null;
		release?.();
	}

	/** The voice to read with; `initialize()` already waited for the inventory. */
	private resolveBrowserVoice(): SpeechSynthesisVoice | null {
		const configuredVoice =
			typeof this.config?.voice === "string" ? this.config.voice.trim() : "";
		const voices = speechSynthesis.getVoices();
		if (configuredVoice && voices.length === 0) {
			throw new Error(
				`Configured browser voice "${configuredVoice}" could not be resolved because the browser did not publish its voice inventory within ${VOICE_INVENTORY_TIMEOUT_MS / 1_000} seconds.`,
			);
		}
		const voice = findBrowserVoice(
			voices,
			configuredVoice || undefined,
			this.getContentLocale(),
		);
		if (configuredVoice && !voice) {
			throw new Error(
				`Configured browser voice "${configuredVoice}" is unavailable. Select a voice exposed by this browser using its voiceURI or name.`,
			);
		}
		return voice;
	}

	async speak(text: string): Promise<void> {
		if (!this.config) {
			throw new Error("TTS not initialized");
		}
		// Invalidate any in-flight run and cancel current utterance.
		this.stop();
		const runId = this.speakRunId;
		this.activeRunId = runId;
		try {
			const voice = this.resolveBrowserVoice();

			const utterance = toUtteranceText(text);
			const chunks = this.splitIntoChunks(utterance.text);
			for (const chunk of chunks) {
				if (this._isPaused && !(await this.waitWhilePaused(runId))) break;
				const shouldContinue = await this.speakChunk(
					chunk.text,
					chunk.offset,
					runId,
					voice,
					utterance.sourceOffset,
				);
				if (!shouldContinue) {
					break;
				}
			}
		} finally {
			if (this.activeRunId === runId) this.activeRunId = null;
		}
	}

	async speakSegments(segments: TTSSpeechSegment[]): Promise<void> {
		if (!this.config) {
			throw new Error("TTS not initialized");
		}
		this.stop();
		const runId = this.speakRunId;
		this.activeRunId = runId;
		try {
			const voice = this.resolveBrowserVoice();
			for (const segment of segments) {
				if (runId !== this.speakRunId) break;
				const utterance = toUtteranceText(segment.text);
				const chunks = this.splitIntoChunks(utterance.text);
				for (const chunk of chunks) {
					if (this._isPaused && !(await this.waitWhilePaused(runId))) break;
					const shouldContinue = await this.speakChunk(
						chunk.text,
						chunk.offset,
						runId,
						voice,
						(offset) => segment.startOffset + utterance.sourceOffset(offset),
					);
					if (!shouldContinue) break;
				}
				const pauseMsAfter = Math.max(0, Number(segment.pauseMsAfter || 0));
				if (pauseMsAfter > 0 && runId === this.speakRunId) {
					const shouldContinue = await this.waitForPause(pauseMsAfter, runId);
					if (!shouldContinue) break;
				}
			}
		} finally {
			if (this.activeRunId === runId) this.activeRunId = null;
		}
	}

	private async waitForPause(pauseMs: number, runId: number): Promise<boolean> {
		await new Promise<void>((resolve) => {
			const settle = () => {
				clearTimeout(timer);
				if (this.settlePendingGap === settle) this.settlePendingGap = null;
				resolve();
			};
			const timer = setTimeout(settle, pauseMs);
			this.settlePendingGap = settle;
		});
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

	/**
	 * The language of the content being read, which the toolkit sets per speak as
	 * `providerOptions.contentLanguage` when the content or the host names one.
	 */
	private getContentLocale(): string | undefined {
		const language = this.config?.providerOptions?.contentLanguage;
		return typeof language === "string" && language.trim()
			? language.trim()
			: undefined;
	}

	private getHighlightMode(): "word" | "sentence" {
		return this.config?.providerOptions?.highlightMode === "word"
			? "word"
			: "sentence";
	}

	private getSegmentationPolicy(): {
		useSentenceSegmenter: boolean;
		useWordSegmenter: boolean;
		locale?: string;
	} {
		const providerOptions = this.config?.providerOptions || {};
		const segmenter = providerOptions.segmenter || {};
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

	/**
	 * `chunkOffset` places the chunk in the utterance text; `sourceOffset` maps an
	 * utterance offset to the boundary position reported for it.
	 */
	private async speakChunk(
		chunkText: string,
		chunkOffset: number,
		runId: number,
		voice: SpeechSynthesisVoice | null,
		sourceOffset: (offset: number) => number,
	): Promise<boolean> {
		return new Promise((resolve, reject) => {
			if (runId !== this.speakRunId) {
				resolve(false);
				return;
			}
			const utterance = new SpeechSynthesisUtterance(chunkText);
			this.utterance = utterance;

			// Apply config. The language tells the engine how to read the text, and
			// lets it choose a voice when the default one is left in place.
			const contentLocale = this.getContentLocale();
			if (contentLocale) utterance.lang = contentLocale;
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
				// A pause that landed while the engine was starting holds this utterance.
				if (this._isPaused) speechSynthesis.pause();
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
				logger.debug(
					`boundary event: ${event.name}, charIndex ${event.charIndex}, charLength ${event.charLength}`,
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
				const utteranceStart = chunkOffset + charIndex;
				const absoluteBoundaryStart = sourceOffset(utteranceStart);
				const boundaryLength =
					sourceOffset(utteranceStart + wordLength - 1) +
					1 -
					absoluteBoundaryStart;
				logger.debug(`word boundary "${word}" at ${absoluteBoundaryStart}`);
				this.onWordBoundary(word, absoluteBoundaryStart, boundaryLength);
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
		if (this._isPaused) return;
		if (this._isPlaying) {
			speechSynthesis.pause();
			this._isPaused = true;
		} else if (this.activeRunId === this.speakRunId) {
			// Between utterances, or in a structural gap: the next one holds.
			this._isPaused = true;
		}
	}

	resume(): void {
		if (!this._isPaused) return;
		this._isPaused = false;
		if (this._isPlaying) speechSynthesis.resume();
		this.releaseHold();
	}

	stop(): void {
		const utterance = this.utterance;
		const shouldCancel = this._isPlaying || utterance !== null;
		this.speakRunId += 1;
		this.activeRunId = null;
		this.settlePendingChunk?.();
		this.settlePendingGap?.();
		if (shouldCancel) {
			speechSynthesis.cancel();
		}
		this.utterance = null;
		this._isPlaying = false;
		this._isPaused = false;
		this.releaseHold();
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
	updateSettings(settings: Partial<ToolkitTTSConfig>): void {
		if (!this.config) {
			this.config = {};
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
