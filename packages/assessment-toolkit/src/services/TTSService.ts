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
import type { AccessibilityCatalogResolver } from "./AccessibilityCatalogResolver.js";
import type { IHighlightCoordinator } from "./interfaces.js";
import {
	type BoundarySpacingMode,
	collectVisibleTextAndMap,
	extractVisibleText as extractVisibleTextFromDOM,
	isElementHiddenForTTS,
	normalizeTextForSpeech,
} from "./tts/text-processing.js";
import {
	segmentSentences as segmentTextToSentences,
	type SentenceSegment as SharedSentenceSegment,
} from "./tts/text-segmentation.js";

interface TTSSpeechSegment {
	text: string;
	startOffset: number;
	pauseMsAfter?: number;
}

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

type StructuralPauseStrength = "minor" | "section" | "major";

interface StructuralPauseProfile {
	baseMs: number;
	units: Record<StructuralPauseStrength, number>;
	minMs: number;
	maxMs: number;
}

type HighlightMode = "word" | "sentence";

interface SpeakOptions {
	catalogId?: string;
	language?: string;
	contentElement?: Element;
	wordBoundaryOffset?: number;
	highlightModeOverride?: HighlightMode;
}

interface ResolvedSpeechContent {
	contentToSpeak: string;
	usedCatalogSpoken: boolean;
	speechSource: "catalog-spoken" | "dom-or-input";
	normalizedText: string;
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
	private ttsConfig: Partial<TTSConfig> = {};
	private currentText: string | null = null;
	private currentContentElement: Element | null = null;
	private normalizedToDOM: Map<number, { node: Text; offset: number }> =
		new Map();
	private listeners = new Map<string, Set<(state: PlaybackState) => void>>();
	private lastError: string | null = null;
	private speakRunId = 0;
	private currentBoundaryOffset = 0;
	private seekSegments: TTSSpeechSegment[] = [];
	private currentSeekSegmentIndex = 0;
	private activeHighlightMode: HighlightMode = "word";

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
		this.ttsConfig = { ...config };

		// Initialize provider and get implementation
		this.provider = await provider.initialize(config as TTSConfig);
	}

	/**
	 * Update TTS settings dynamically without full reinitialization
	 *
	 * This allows changing rate, pitch, and voice on the fly.
	 * Note: Some providers may require reinitialization for voice changes.
	 *
	 * @param settings Partial settings to update (rate, pitch, voice)
	 */
	async updateSettings(settings: Partial<TTSConfig>): Promise<void> {
		if (!this.provider) {
			throw new Error("TTSService not initialized. Call initialize() first.");
		}

		// If the provider implementation has an updateSettings method, use it
		if (
			"updateSettings" in this.provider &&
			typeof (this.provider as any).updateSettings === "function"
		) {
			await (this.provider as any).updateSettings(settings);
			this.ttsConfig = { ...this.ttsConfig, ...settings };
		} else {
			// Fallback: Reinitialize with merged config
			// This requires storing the original config, which we don't have
			// So for now, just log a warning
			console.warn(
				"[TTSService] Provider does not support dynamic settings updates. Some settings may require reinitialization.",
			);
		}
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
	 * Build a character-by-character map from normalized text positions to DOM positions
	 * This handles the complexity of whitespace normalization
	 */
	private getTextProcessingOptions(language?: string): {
		locale?: string;
		boundarySpacingMode?: BoundarySpacingMode;
	} {
		const providerOptions = (this.ttsConfig.providerOptions || {}) as Record<
			string,
			unknown
		>;
		const textNormalization = (providerOptions.textNormalization || {}) as Record<
			string,
			unknown
		>;
		const mode = textNormalization.boundarySpacingMode;
		const boundarySpacingMode: BoundarySpacingMode | undefined =
			mode === "none" || mode === "alnum" || mode === "segmenterPreferred"
				? mode
				: undefined;
		const locale =
			language ||
			(typeof textNormalization.locale === "string"
				? textNormalization.locale
				: undefined);
		return { locale, boundarySpacingMode };
	}

	private buildPositionMap(
		element: Element,
		spokenText: string,
		language?: string,
	): void {
		this.normalizedToDOM.clear();
		const { text: normalizedDomText, map } = collectVisibleTextAndMap(
			element,
			this.getTextProcessingOptions(language),
		);
		this.normalizedToDOM = map;

		console.log("[TTSService] Text comparison:", {
			spokenLength: spokenText.length,
			normalizedDomLength: normalizedDomText.length,
			match: spokenText === normalizedDomText,
			spokenPreview: spokenText.substring(0, 150),
			normalizedPreview: normalizedDomText.substring(0, 150),
			differAtIndex:
				spokenText === normalizedDomText
					? null
					: (() => {
							for (
								let i = 0;
								i < Math.min(spokenText.length, normalizedDomText.length);
								i++
							) {
								if (spokenText[i] !== normalizedDomText[i]) {
									return {
										index: i,
										spokenChar: spokenText[i],
										normalizedChar: normalizedDomText[i],
										spokenContext: spokenText.substring(
											Math.max(0, i - 20),
											i + 20,
										),
										normalizedContext: normalizedDomText.substring(
											Math.max(0, i - 20),
											i + 20,
										),
									};
								}
							}
							return null;
						})(),
		});

		console.log("[TTSService] Position map built:", {
			entries: this.normalizedToDOM.size,
			spokenTextLength: spokenText.length,
			normalizedDomLength: normalizedDomText.length,
			mapLengthMatchesSpoken: this.normalizedToDOM.size === spokenText.length,
			firstFewMappings: Array.from(this.normalizedToDOM.entries())
				.slice(0, 10)
				.map(([pos, { node, offset }]) => ({
					pos,
					offset,
					char: node.textContent?.[offset],
					expected: spokenText[pos],
				})),
		});
	}

	private getStructuralPauseProfile(): StructuralPauseProfile {
		const providerOptions = (this.ttsConfig.providerOptions || {}) as Record<
			string,
			unknown
		>;
		const custom = (providerOptions.structuralPauses || {}) as Record<
			string,
			unknown
		>;
		const customUnits = (custom.units || {}) as Record<string, unknown>;
		const toNumber = (value: unknown, fallback: number): number => {
			if (typeof value === "number" && Number.isFinite(value)) return value;
			if (typeof value === "string" && value.trim()) {
				const parsed = Number(value);
				return Number.isFinite(parsed) ? parsed : fallback;
			}
			return fallback;
		};
		return {
			baseMs: toNumber(custom.baseMs, 280),
			units: {
				minor: toNumber(customUnits.minor, 0.65),
				section: toNumber(customUnits.section, 1.0),
				major: toNumber(customUnits.major, 1.35),
			},
			minMs: toNumber(custom.minMs, 120),
			maxMs: toNumber(custom.maxMs, 900),
		};
	}

	private resolvePauseMsFromUnits(units: number): number {
		const profile = this.getStructuralPauseProfile();
		const rate = Math.max(0.25, Math.min(4, Number(this.ttsConfig.rate || 1)));
		const raw = (profile.baseMs * Math.max(0, units)) / rate;
		return Math.max(profile.minMs, Math.min(profile.maxMs, Math.round(raw)));
	}

	private resolveHighlightMode(): HighlightMode {
		const providerOptions = (this.ttsConfig.providerOptions || {}) as Record<
			string,
			unknown
		>;
		const configuredMode = providerOptions.highlightMode;
		if (configuredMode === "word" || configuredMode === "sentence") {
			return configuredMode;
		}
		const providerId = (this.currentProvider?.providerId || "").toLowerCase();
		if (providerId === "browser") {
			return "sentence";
		}
		const supportsWordBoundary =
			this.currentProvider?.getCapabilities().supportsWordBoundary ?? false;
		return supportsWordBoundary ? "word" : "sentence";
	}

	private hasExplicitBreakSemantics(text: string): boolean {
		if (!text.includes("<")) return false;
		return /<\s*break\b|<\s*speak\b|<\s*prosody\b|<\s*p\b|<\s*s\b/i.test(text);
	}

	private isElementHidden(element: Element): boolean {
		return isElementHiddenForTTS(element);
	}

	private extractVisibleText(element: Element, language?: string): string {
		return extractVisibleTextFromDOM(
			element,
			this.getTextProcessingOptions(language),
		);
	}

	private getBoundaryStrength(element: Element): StructuralPauseStrength {
		const explicitBreakMs = Number(element.getAttribute("data-tts-break-ms"));
		if (Number.isFinite(explicitBreakMs) && explicitBreakMs > 0) return "major";
		const tagName = element.tagName.toUpperCase();
		if (tagName.match(/^H[1-6]$/)) return "major";
		const role = (element.getAttribute("role") || "").toLowerCase();
		if (role === "heading") return "major";
		if (
			role === "listitem" ||
			role === "row" ||
			role === "option" ||
			role === "radio" ||
			tagName === "LI"
		) {
			return "section";
		}
		if (typeof window !== "undefined") {
			const display = window.getComputedStyle(element).display;
			if (
				display === "block" ||
				display === "list-item" ||
				display.startsWith("table") ||
				display === "flex" ||
				display === "grid"
			) {
				return "minor";
			}
		}
		return "minor";
	}

	private getBoundaryAnchor(
		textNode: Text,
		root: Element,
	): { anchor: Element; units: number } | null {
		let current = textNode.parentElement;
		let best: Element | null = null;
		while (current && current !== root) {
			if (this.isElementHidden(current)) return null;
			const explicitBreakMs = Number(current.getAttribute("data-tts-break-ms"));
			if (Number.isFinite(explicitBreakMs) && explicitBreakMs > 0) {
				return {
					anchor: current,
					units: explicitBreakMs / this.getStructuralPauseProfile().baseMs,
				};
			}
			const role = (current.getAttribute("role") || "").toLowerCase();
			const tagName = current.tagName.toUpperCase();
			if (tagName.match(/^H[1-6]$/) || role === "heading" || role === "listitem" || tagName === "LI") {
				best = current;
				break;
			}
			if (!best) {
				if (typeof window !== "undefined") {
					const display = window.getComputedStyle(current).display;
					if (
						display === "block" ||
						display === "list-item" ||
						display.startsWith("table") ||
						display === "flex" ||
						display === "grid"
					) {
						best = current;
					}
				}
			}
			current = current.parentElement;
		}
		if (!best) return null;
		const strength = this.getBoundaryStrength(best);
		return {
			anchor: best,
			units: this.getStructuralPauseProfile().units[strength],
		};
	}

	private createSpeechPlan(
		contentElement: Element,
		normalizedText: string,
	): TTSSpeechSegment[] {
		const boundaries = this.collectSpeechPlanBoundaries(
			contentElement,
			normalizedText,
		);
		return this.createSpeechPlanSegments(normalizedText, boundaries);
	}

	private collectSpeechPlanBoundaries(
		contentElement: Element,
		normalizedText: string,
	): Map<number, number> {
		const boundaries = new Map<number, number>();
		const { map } = collectVisibleTextAndMap(
			contentElement,
			this.getTextProcessingOptions(),
		);
		const nodeStartOffsets = this.createNodeStartOffsets(map);

		const walker = document.createTreeWalker(contentElement, NodeFilter.SHOW_TEXT);
		let currentNode = walker.nextNode();
		let previousBoundaryAnchor: Element | null = null;
		while (currentNode) {
			const textNode = currentNode as Text;
			const parent = textNode.parentElement;
			if (parent && !this.isElementHidden(parent)) {
				const boundary = this.getBoundaryAnchor(textNode, contentElement);
				const boundaryPoint = nodeStartOffsets.get(textNode);
				if (
					boundary &&
					boundaryPoint !== undefined &&
					boundary.anchor !== previousBoundaryAnchor &&
					boundaryPoint > 0
				) {
					boundaries.set(
						boundaryPoint,
						Math.max(boundaries.get(boundaryPoint) || 0, boundary.units),
					);
					previousBoundaryAnchor = boundary.anchor;
				}
			}
			currentNode = walker.nextNode();
		}
		return boundaries;
	}

	private createNodeStartOffsets(
		map: Map<number, { node: Text; offset: number }>,
	): Map<Text, number> {
		const nodeStartOffsets = new Map<Text, number>();
		for (const [normalizedIndex, mapping] of map.entries()) {
			if (!nodeStartOffsets.has(mapping.node)) {
				nodeStartOffsets.set(mapping.node, normalizedIndex);
			}
		}
		return nodeStartOffsets;
	}

	private createSpeechPlanSegments(
		normalizedText: string,
		boundaries: Map<number, number>,
	): TTSSpeechSegment[] {
		const points = Array.from(boundaries.keys())
			.filter((point) => point > 0 && point < normalizedText.length)
			.sort((a, b) => a - b);
		const segments: TTSSpeechSegment[] = [];
		let start = 0;
		for (const point of points) {
			const raw = normalizedText.substring(start, point);
			const leading = raw.match(/^\s*/)?.[0].length || 0;
			const trailing = raw.match(/\s*$/)?.[0].length || 0;
			const segmentStart = start + leading;
			const segmentEnd = point - trailing;
			if (segmentEnd > segmentStart) {
				const text = normalizedText.substring(segmentStart, segmentEnd);
				segments.push({
					text,
					startOffset: segmentStart,
					pauseMsAfter: this.resolvePauseMsFromUnits(boundaries.get(point) || 0),
				});
			}
			start = point;
		}
		const tail = normalizedText.substring(start);
		const tailLeading = tail.match(/^\s*/)?.[0].length || 0;
		const tailStart = start + tailLeading;
		if (tailStart < normalizedText.length) {
			segments.push({
				text: normalizedText.substring(tailStart).trimEnd(),
				startOffset: tailStart,
				pauseMsAfter: 0,
			});
		}
		return segments.filter((segment) => segment.text.trim().length > 0);
	}

	private segmentSentences(text: string): SharedSentenceSegment[] {
		const locale =
			((this.ttsConfig.providerOptions as Record<string, unknown> | undefined)
				?.locale as string | undefined) || undefined;
		return segmentTextToSentences(text, { locale });
	}

	private createSeekSegmentsFromText(text: string): TTSSpeechSegment[] {
		return this.segmentSentences(text)
			.map((segment) => {
				const leadingWhitespace = segment.text.match(/^\s*/)?.[0].length || 0;
				const trimmed = segment.text.trim();
				return {
					text: trimmed,
					startOffset: segment.offset + leadingWhitespace,
					pauseMsAfter: 0,
				};
			})
			.filter((segment) => segment.text.length > 0);
	}

	private getCurrentSeekSegmentIndex(): number {
		if (this.seekSegments.length === 0) return 0;
		let index = 0;
		for (let i = 0; i < this.seekSegments.length; i++) {
			if (this.seekSegments[i].startOffset <= this.currentBoundaryOffset) {
				index = i;
			} else {
				break;
			}
		}
		return index;
	}

	private async speakWithPlan(
		segments: TTSSpeechSegment[],
		runId: number,
		options?: { highlightMode?: HighlightMode },
	): Promise<void> {
		if (!this.provider || segments.length === 0) return;
		const shouldTrackSentenceProgress = options?.highlightMode === "sentence";
		const providerWithPlan = this.provider as ITTSProviderImplementation & {
			speakSegments?: (segments: TTSSpeechSegment[]) => Promise<void>;
		};
		if (
			!shouldTrackSentenceProgress &&
			typeof providerWithPlan.speakSegments === "function"
		) {
			this.currentBoundaryOffset = 0;
			const originalOnWordBoundary = this.provider.onWordBoundary;
			this.provider.onWordBoundary = (
				word: string,
				position: number,
				length?: number,
			) => {
				if (Number.isFinite(position)) {
					this.currentBoundaryOffset = position;
					this.currentSeekSegmentIndex = this.getCurrentSeekSegmentIndex();
				}
				originalOnWordBoundary?.(word, position, length);
			};
			try {
				await providerWithPlan.speakSegments(segments);
			} finally {
				this.provider.onWordBoundary = originalOnWordBoundary;
			}
			return;
		}
		for (const segment of segments) {
			if (runId !== this.speakRunId) return;
			const seekIndex = this.seekSegments.findIndex(
				(candidate) => candidate.startOffset === segment.startOffset,
			);
			if (seekIndex >= 0) {
				this.currentSeekSegmentIndex = seekIndex;
			}
			this.currentBoundaryOffset = segment.startOffset;
			if (shouldTrackSentenceProgress) {
				this.highlightSentenceSegment(segment.startOffset, segment.text);
			}
			await this.provider.speak(segment.text);
			const pauseMs = segment.pauseMsAfter ?? 0;
			if (pauseMs > 0) {
				await new Promise((resolve) => setTimeout(resolve, pauseMs));
			}
		}
	}

	private highlightSentenceSegment(startOffset: number, text: string): void {
		if (!this.highlightCoordinator || typeof document === "undefined") return;
		const length = text.trimEnd().length;
		if (length <= 0) return;
		const start = this.normalizedToDOM.get(startOffset);
		const end = this.normalizedToDOM.get(startOffset + length - 1);
		if (!start || !end) return;
		const range = document.createRange();
		range.setStart(start.node, start.offset);
		range.setEnd(end.node, end.offset + 1);
		this.highlightCoordinator.highlightTTSSentence([range]);
	}

	/**
	 * Find text node and offsets for highlighting a word
	 *
	 * @param charIndex Character position in normalized/spoken text
	 * @param length Length of the word
	 * @returns Text node and local offsets, or null if not found
	 */
	private findHighlightRange(
		charIndex: number,
		length: number,
	): { node: Text; start: number; end: number } | null {
		const startPos = this.normalizedToDOM.get(charIndex);
		if (!startPos) {
			console.warn(
				`[TTSService] No mapping found for start position ${charIndex}`,
				{
					totalMappings: this.normalizedToDOM.size,
					nearbyMappings: Array.from(this.normalizedToDOM.entries())
						.filter(([pos]) => Math.abs(pos - charIndex) < 5)
						.map(([pos, { offset, node }]) => ({
							pos,
							offset,
							char: node.textContent?.[offset],
						})),
				},
			);
			return null;
		}

		// Find the end position (last character of the word)
		const endIndex = charIndex + length - 1;
		const endPos = this.normalizedToDOM.get(endIndex);
		if (!endPos) {
			console.warn(
				`[TTSService] No mapping found for end position ${endIndex}`,
				{
					startChar: charIndex,
					length,
					totalMappings: this.normalizedToDOM.size,
				},
			);
			return null;
		}

		// For simplicity, if the word spans multiple nodes, just highlight in the first node
		// (This is a rare edge case and would require creating multiple ranges)
		if (startPos.node !== endPos.node) {
			console.warn(
				`[TTSService] Word spans multiple nodes, highlighting in first node only`,
			);
			return {
				node: startPos.node,
				start: startPos.offset,
				end: (startPos.node.textContent || "").length,
			};
		}

		return {
			node: startPos.node,
			start: startPos.offset,
			end: endPos.offset + 1, // +1 because we want to include the character at endPos
		};
	}

	/**
	 * Speak text with optional catalog support
	 *
	 * @param text Text to speak (will be normalized: trimmed and whitespace collapsed)
	 * @param options Optional catalog ID, language, and content element for highlighting
	 */
	async speak(text: string, options?: SpeakOptions): Promise<void> {
		if (!this.provider) {
			throw new Error("TTS service not initialized");
		}
		const runId = ++this.speakRunId;
		await this.applyLanguageSettings(options);
		const { contentToSpeak, normalizedText, usedCatalogSpoken, speechSource } =
			this.resolveSpeechContent(text, options);
		this.logResolvedSpeechContent({
			contentToSpeak,
			speechSource,
			catalogId: options?.catalogId,
		});
		this.initializeSpeakTracking(contentToSpeak, options);
		const highlightMode =
			options?.highlightModeOverride || this.resolveHighlightMode();
		this.activeHighlightMode = highlightMode;
		const shouldUsePlan =
			!!this.currentContentElement &&
			!usedCatalogSpoken &&
			!this.hasExplicitBreakSemantics(contentToSpeak);
		this.seekSegments = this.hasExplicitBreakSemantics(contentToSpeak)
			? []
			: shouldUsePlan && this.currentContentElement
				? this.createSpeechPlan(this.currentContentElement, normalizedText)
				: this.createSeekSegmentsFromText(contentToSpeak);
		this.setState(PlaybackState.LOADING);
		this.prepareHighlightsForSpeak({
			contentToSpeak,
			options,
			highlightMode,
			shouldUsePlan,
		});

		try {
			this.configureWordBoundaryHighlighting({
				highlightMode,
				wordBoundaryOffset: options?.wordBoundaryOffset || 0,
			});
			this.setState(PlaybackState.PLAYING);
			await this.executeSpeakPlayback({
				shouldUsePlan,
				runId,
				highlightMode,
				contentToSpeak,
			});
			if (runId !== this.speakRunId) return;
			this.setState(PlaybackState.IDLE);
			this.clearHighlightsAndTracking();
		} catch (error) {
			console.error("TTS error:", error);
			this.lastError = error instanceof Error ? error.message : String(error);
			if (runId !== this.speakRunId) return;
			this.setState(PlaybackState.ERROR);
			this.clearHighlightsAndTracking();
			throw error;
		}
	}

	private async applyLanguageSettings(options?: SpeakOptions): Promise<void> {
		if (!options?.language || !this.provider) return;
		const providerOptions = (this.ttsConfig.providerOptions ||
			{}) as Record<string, unknown>;
		const textNormalization = (providerOptions.textNormalization ||
			{}) as Record<string, unknown>;
		const segmenter = (providerOptions.segmenter || {}) as Record<
			string,
			unknown
		>;
		const mergedProviderOptions = {
			...providerOptions,
			locale: options.language,
			textNormalization: {
				...textNormalization,
				locale: options.language,
			},
			segmenter: {
				...segmenter,
				locale: options.language,
			},
		};
		this.ttsConfig = {
			...this.ttsConfig,
			providerOptions: mergedProviderOptions,
		};
		if (
			"updateSettings" in this.provider &&
			typeof (this.provider as { updateSettings?: unknown }).updateSettings ===
				"function"
		) {
			await (
				this.provider as {
					updateSettings: (settings: Partial<TTSConfig>) => Promise<void> | void;
				}
			).updateSettings({ providerOptions: mergedProviderOptions });
		}
	}

	private resolveSpeechContent(
		text: string,
		options?: SpeakOptions,
	): ResolvedSpeechContent {
		const normalizedInputText = normalizeTextForSpeech(text);
		const normalizedText = options?.contentElement
			? this.extractVisibleText(options.contentElement, options.language) ||
				normalizedInputText
			: normalizedInputText;

		let contentToSpeak = normalizedText;
		let usedCatalogSpoken = false;
		let speechSource: "catalog-spoken" | "dom-or-input" = "dom-or-input";
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
				contentToSpeak = catalogContent.content;
				usedCatalogSpoken = true;
				speechSource = "catalog-spoken";
				console.debug(
					`[TTSService] Using catalog content for "${options.catalogId}" (${catalogContent.language})`,
				);
			} else {
				console.debug(
					`[TTSService] No catalog found for "${options.catalogId}", falling back to generated TTS`,
				);
			}
		}
		return {
			contentToSpeak,
			usedCatalogSpoken,
			speechSource,
			normalizedText,
		};
	}

	private logResolvedSpeechContent(args: {
		contentToSpeak: string;
		speechSource: "catalog-spoken" | "dom-or-input";
		catalogId?: string;
	}): void {
		const preview = args.contentToSpeak.replace(/\s+/g, " ").trim().slice(0, 200);
		console.debug("[TTSService] Speak resolved content", {
			source: args.speechSource,
			catalogId: args.catalogId || null,
			length: args.contentToSpeak.length,
			preview,
		});
	}

	private initializeSpeakTracking(
		contentToSpeak: string,
		options?: SpeakOptions,
	): void {
		this.currentText = contentToSpeak;
		this.currentContentElement = options?.contentElement || null;
		this.lastError = null;
		this.currentBoundaryOffset = 0;
		this.currentSeekSegmentIndex = 0;
	}

	private prepareHighlightsForSpeak(args: {
		contentToSpeak: string;
		options?: SpeakOptions;
		highlightMode: HighlightMode;
		shouldUsePlan: boolean;
	}): void {
		if (!this.currentContentElement || !this.highlightCoordinator) return;
		this.buildPositionMap(
			this.currentContentElement,
			args.contentToSpeak,
			args.options?.language,
		);
		if (!(args.highlightMode === "sentence" && args.shouldUsePlan)) {
			const range = document.createRange();
			range.selectNodeContents(this.currentContentElement);
			this.highlightCoordinator.highlightTTSSentence([range]);
			console.log("[TTSService] Applied sentence-level highlighting");
		}
	}

	private configureWordBoundaryHighlighting(args: {
		highlightMode: HighlightMode;
		wordBoundaryOffset: number;
	}): void {
		if (
			!this.provider ||
			args.highlightMode !== "word" ||
			!this.highlightCoordinator ||
			!this.currentContentElement
		) {
			return;
		}
		this.provider.onWordBoundary = (word: string, charIndex: number, length?: number) => {
			const wordLength = length || word.length;
			const globalIndex = charIndex + this.currentBoundaryOffset + args.wordBoundaryOffset;
			const highlightRange = this.findHighlightRange(globalIndex, wordLength);
			if (highlightRange && this.highlightCoordinator) {
				const highlightText =
					highlightRange.node.textContent?.substring(
						highlightRange.start,
						highlightRange.end,
					) || "";
				console.log(
					`[TTSService] Highlighting "${highlightText}" (word: "${word}") at position ${globalIndex}`,
				);
				this.highlightCoordinator.highlightTTSWord(
					highlightRange.node,
					highlightRange.start,
					highlightRange.end,
				);
			} else {
				console.warn(
					`[TTSService] Could not find highlight range for position ${globalIndex}, length ${wordLength}`,
				);
			}
		};
	}

	private async executeSpeakPlayback(args: {
		shouldUsePlan: boolean;
		runId: number;
		highlightMode: HighlightMode;
		contentToSpeak: string;
	}): Promise<void> {
		if (args.shouldUsePlan && this.currentContentElement) {
			const segments = this.seekSegments;
			if (segments.length > 0) {
				await this.speakWithPlan(segments, args.runId, {
					highlightMode: args.highlightMode,
				});
			} else if (this.provider) {
				await this.provider.speak(args.contentToSpeak);
			}
			return;
		}
		if (this.provider) {
			await this.provider.speak(args.contentToSpeak);
		}
	}

	private clearHighlightsAndTracking(): void {
		if (this.highlightCoordinator) {
			this.highlightCoordinator.clearTTS();
		}
		this.currentContentElement = null;
		this.normalizedToDOM.clear();
		this.currentBoundaryOffset = 0;
		this.seekSegments = [];
		this.currentSeekSegmentIndex = 0;
	}

	/**
	 * Speak a text range with accurate word highlighting
	 *
	 * This calculates the offset of the range within its parent element
	 * to ensure word highlighting aligns correctly with the selected text.
	 *
	 * @param range DOM Range to speak
	 */
	async speakRange(
		range: Range,
		options?: { contentRoot?: Element | null },
	): Promise<void> {
		if (!this.provider) {
			throw new Error("TTS service not initialized");
		}

		const text = range.toString().trim();
		if (!text) return;

		// Use explicit content root when provided; otherwise keep highlighting scoped
		// to the selected range's nearest element ancestor.
		const fromOptions = options?.contentRoot || null;
		let root: Element | null = fromOptions;
		if (!root) {
			const ancestor = range.commonAncestorContainer;
			root =
				ancestor.nodeType === Node.ELEMENT_NODE
					? (ancestor as Element)
					: ancestor.parentElement;
		}
		if (!root) return;

		// Calculate the offset of the range start within the root element
		const beforeRange = document.createRange();
		beforeRange.selectNodeContents(root);
		beforeRange.setEnd(range.startContainer, range.startOffset);
		const textBeforeRange = beforeRange.toString();
		const offset = normalizeTextForSpeech(textBeforeRange).length;

		console.log("[TTSService] speakRange offset calculation:", {
			selectedText: text,
			textBeforeRange: textBeforeRange.substring(0, 100),
			offset,
			rootTag: root.tagName,
		});

		// Speak the text with the root element as context
		await this.speak(text, {
			contentElement: root,
			wordBoundaryOffset: offset,
		});
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

	private async seekBy(units: number): Promise<void> {
		if (!this.provider || !this.currentText) return;
		if (this.state !== PlaybackState.PLAYING && this.state !== PlaybackState.PAUSED) {
			return;
		}
		if (this.hasExplicitBreakSemantics(this.currentText)) return;
		if (this.seekSegments.length === 0) return;

		const delta = Number.isFinite(units) ? Math.trunc(units) : 0;
		if (delta === 0) return;

		const currentIndex = this.getCurrentSeekSegmentIndex();
		const targetIndex = Math.max(
			0,
			Math.min(this.seekSegments.length - 1, currentIndex + delta),
		);
		if (targetIndex === currentIndex) return;

		this.speakRunId += 1;
		this.provider.stop();
		this.currentSeekSegmentIndex = targetIndex;
		const runId = ++this.speakRunId;
		const restartSegments = this.seekSegments.slice(targetIndex);

		this.setState(PlaybackState.PLAYING);
		try {
			await this.speakWithPlan(restartSegments, runId, {
				highlightMode: this.activeHighlightMode,
			});
			if (runId !== this.speakRunId) return;
			this.setState(PlaybackState.IDLE);
			this.clearHighlightsAndTracking();
		} catch (error) {
			if (runId !== this.speakRunId) return;
			this.lastError = error instanceof Error ? error.message : String(error);
			this.setState(PlaybackState.ERROR);
			this.clearHighlightsAndTracking();
			throw error;
		}
	}

	async seekForward(units = 1): Promise<void> {
		const step = Number.isFinite(units) ? Math.max(1, Math.trunc(units)) : 1;
		await this.seekBy(step);
	}

	async seekBackward(units = 1): Promise<void> {
		const step = Number.isFinite(units) ? Math.max(1, Math.trunc(units)) : 1;
		await this.seekBy(-step);
	}

	/**
	 * Stop playback
	 */
	stop(): void {
		if (!this.provider) return;
		this.speakRunId += 1;
		this.provider.stop();
		this.setState(PlaybackState.IDLE);
		this.currentText = null;

		// Clear highlights
		if (this.highlightCoordinator) {
			this.highlightCoordinator.clearTTS();
		}

		// Clear tracking
		this.currentContentElement = null;
		this.normalizedToDOM.clear();
		this.currentBoundaryOffset = 0;
		this.seekSegments = [];
		this.currentSeekSegmentIndex = 0;
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
	 * Get the last error message
	 * Returns null if no error has occurred
	 */
	getLastError(): string | null {
		return this.lastError;
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
