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
import type {
	AccessibilityCatalogResolver,
	CatalogLookupContext,
	ResolvedCatalog,
} from "./AccessibilityCatalogResolver.js";
import { HighlightColor, HighlightType } from "./HighlightCoordinator.js";
import type { HighlightCoordinatorApi } from "./interfaces.js";
import { BrowserTTSProvider } from "./tts/browser-provider.js";
import {
	type BoundarySpacingMode,
	collectVisibleTextAndMap,
	isElementHiddenForTTS,
	isNodeHiddenForTTS,
	type NormalizedTextMap,
	normalizeTextForSpeech,
} from "./tts/text-processing.js";
import {
	createCatalogSpanAlignment,
	type CatalogChunkPlaybackMode,
	type CatalogSpanAlignment,
} from "./tts/catalog-span-alignment.js";
import {
	createMathAwareAlignment,
	type MathAwareAlignment,
} from "./tts/math-alignment/index.js";
import { collectMathAwareTextAndMap } from "./tts/math-aware-text-processing.js";
import {
	buildGeneratedSpeechFromRoot,
	createMemoizedMathSpeechResolver,
	planToCompositionChunkInputs,
	type MathSpeechResolver,
} from "./tts/generated-speech/index.js";
import {
	normalizeSREMathSpeechOptions,
	type SREMathSpeechOptions,
} from "./tts/math-speech.js";
import {
	segmentSentences as segmentTextToSentences,
	type SentenceSegment as SharedSentenceSegment,
} from "./tts/text-segmentation.js";
import {
	createTTSHighlightPlan,
	normalizeSpeechChunks,
	resolveReadableRegion,
	type ChunkOffsetSpace,
	type HighlightDecision,
	type RenderableHighlightTarget,
} from "./tts/highlight-pipeline/index.js";
import {
	PIE_TTS_CONTROL_HANDOFF_EVENT,
	type TTSControlHandoffDetail,
} from "./tts-control-events.js";

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
	catalogContext?: CatalogLookupContext;
	ignoreCatalogs?: boolean;
	language?: string;
	contentElement?: Element;
	wordBoundaryOffset?: number;
	highlightModeOverride?: HighlightMode;
}

interface SpeechCompositionChunk {
	speechText: string;
	visibleText: string;
	sourceElement: Element | null;
	regionElement?: Element | null;
	regionRange?: Range;
	speechMatchesVisibleText: boolean;
	playbackMode?: CatalogChunkPlaybackMode;
	alignment?: CatalogSpanAlignment;
	mathAlignment?: MathAwareAlignment;
	mathAlignments?: Array<{ element: Element; alignment: MathAwareAlignment }>;
	visibleMap?: NormalizedTextMap;
	// Plain-text variant for speak-time fallback (generated SSML math chunks).
	// If the provider rejects the SSML `speechText`, playback retries this.
	plainFallback?: SpeechCompositionChunk;
}

interface ResolvedSpeechContent {
	contentToSpeak: string;
	speechText: string;
	visibleText: string;
	highlightText: string;
	usedCatalogSpoken: boolean;
	speechSource: "catalog-spoken" | "dom-or-input";
	normalizedText: string;
	containsMathMarkup: boolean;
	speechMatchesVisibleText: boolean;
	speechChunks?: SpeechCompositionChunk[];
}

const sameRange = (left: Range, right: Range): boolean =>
	left === right ||
	(left.startContainer === right.startContainer &&
		left.startOffset === right.startOffset &&
		left.endContainer === right.endContainer &&
		left.endOffset === right.endOffset);

const sameRenderableHighlightTarget = (
	left: RenderableHighlightTarget | null,
	right: RenderableHighlightTarget | null,
): boolean => {
	if (left === right) return true;
	if (
		!left ||
		!right ||
		left.type !== right.type ||
		left.quality !== right.quality
	) {
		return false;
	}
	if (left.type === "range" && right.type === "range") {
		return sameRange(left.range, right.range);
	}
	if (left.type === "element" && right.type === "element") {
		return left.element === right.element;
	}
	if (left.type === "text-range" && right.type === "text-range") {
		return (
			left.node === right.node &&
			left.startOffset === right.startOffset &&
			left.endOffset === right.endOffset
		);
	}
	return false;
};

/**
 * TTSService
 *
 * Instantiable service for text-to-speech functionality.
 * Each instance manages its own playback state.
 */
export class TTSService {
	private currentProvider: ITTSProvider | null = null;
	private provider: ITTSProviderImplementation | null = null;
	private highlightCoordinator: HighlightCoordinatorApi | null = null;
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
	private sentenceHighlightSegments: TTSSpeechSegment[] = [];
	private currentSeekSegmentIndex = 0;
	private activeSentenceStartOffset: number | null = null;
	private activeHighlightMode: HighlightMode = "word";
	private lastRenderedRegionTarget: RenderableHighlightTarget | null = null;
	private telemetryReporter:
		| ((
				eventName: string,
				payload?: Record<string, unknown>,
		  ) => void | Promise<void>)
		| null = null;

	// Memoized SRE resolver for the runtime generated-speech path (PIE-623).
	// Caches DOM-free spoken text keyed by SRE settings and MathML source across
	// utterances within this service instance.
	private readonly generatedMathSpeechResolver: MathSpeechResolver =
		createMemoizedMathSpeechResolver();

	// Verbose alignment/highlight tracing is opt-in: it is expensive (large
	// objects, a full text diff per utterance) and noisy in production. Enable
	// with `PIE_TTS_DEBUG=1` or `globalThis.__PIE_TTS_DEBUG__ = true`.
	private static readonly debugEnabled = ((): boolean => {
		try {
			if (
				typeof process !== "undefined" &&
				process.env?.PIE_TTS_DEBUG === "1"
			) {
				return true;
			}
		} catch {
			// `process` is not defined in the browser; fall through to the global.
		}
		return (
			(globalThis as { __PIE_TTS_DEBUG__?: unknown }).__PIE_TTS_DEBUG__ === true
		);
	})();

	constructor() {}

	private debugLog(message: string, detail?: unknown): void {
		if (!TTSService.debugEnabled) return;
		if (detail === undefined) {
			console.debug(message);
		} else {
			console.debug(message, detail);
		}
	}

	private async emitTelemetry(
		eventName: string,
		payload?: Record<string, unknown>,
	): Promise<void> {
		try {
			await this.telemetryReporter?.(eventName, payload);
		} catch (error) {
			console.warn("[TTSService] telemetry callback failed:", error);
		}
	}

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
		const providerOptions =
			config.providerOptions && typeof config.providerOptions === "object"
				? (config.providerOptions as Record<string, unknown>)
				: {};
		this.telemetryReporter =
			typeof providerOptions.__pieTelemetry === "function"
				? (providerOptions.__pieTelemetry as (
						eventName: string,
						payload?: Record<string, unknown>,
					) => void | Promise<void>)
				: null;

		// Initialize provider and get implementation. Browser fallback is only
		// allowed here, before the configured provider has successfully become
		// the active runtime. Per-call playback/synthesis errors must surface
		// instead of silently replacing a user-selected provider and voice.
		try {
			this.provider = await provider.initialize(config as TTSConfig);
		} catch (error) {
			if (provider.providerId.toLowerCase() === "browser") {
				throw error;
			}
			if (!this.isBrowserSpeechFallbackAvailable()) {
				throw error;
			}
			const switched = await this.switchProviderToBrowser(error, {
				operation: "tts-initialize",
			});
			if (!switched) {
				throw error;
			}
		}
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
		const provider = this.provider as {
			updateSettings?: (settings: Partial<TTSConfig>) => Promise<void> | void;
		};
		if (typeof provider.updateSettings === "function") {
			const mergedSettings: Partial<TTSConfig> = {
				...settings,
				...(settings.providerOptions
					? {
							providerOptions: {
								...((this.ttsConfig.providerOptions || {}) as Record<
									string,
									unknown
								>),
								...(settings.providerOptions as Record<string, unknown>),
							},
						}
					: {}),
			};
			await provider.updateSettings(mergedSettings);
			this.ttsConfig = { ...this.ttsConfig, ...mergedSettings };
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
	setHighlightCoordinator(coordinator: HighlightCoordinatorApi): void {
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
		const textNormalization = (providerOptions.textNormalization ||
			{}) as Record<string, unknown>;
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

	private getMathSpeechOptions(): SREMathSpeechOptions | undefined {
		const providerOptions = (this.ttsConfig.providerOptions || {}) as Record<
			string,
			unknown
		>;
		const mathSpeech = providerOptions.mathSpeech;
		return normalizeSREMathSpeechOptions(mathSpeech);
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

		if (!TTSService.debugEnabled) return;

		this.debugLog("[TTSService] Text comparison:", {
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

		this.debugLog("[TTSService] Position map built:", {
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
			if (
				tagName.match(/^H[1-6]$/) ||
				role === "heading" ||
				role === "listitem" ||
				tagName === "LI"
			) {
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

		const walker = document.createTreeWalker(
			contentElement,
			NodeFilter.SHOW_TEXT,
		);
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
					pauseMsAfter: this.resolvePauseMsFromUnits(
						boundaries.get(point) || 0,
					),
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

	private splitSegmentsAtBoundaries(
		segments: TTSSpeechSegment[],
		boundaryOffsets: number[],
		sourceText: string,
	): TTSSpeechSegment[] {
		if (segments.length === 0 || boundaryOffsets.length === 0) return segments;
		const normalizedBoundaries = Array.from(new Set(boundaryOffsets))
			.filter((offset) => Number.isFinite(offset) && offset > 0)
			.sort((left, right) => left - right);
		if (normalizedBoundaries.length === 0) return segments;
		const result: TTSSpeechSegment[] = [];
		for (const segment of segments) {
			const segmentStart = segment.startOffset;
			const segmentEnd = segment.startOffset + segment.text.length;
			const splitPoints = normalizedBoundaries.filter(
				(offset) => offset > segmentStart && offset < segmentEnd,
			);
			if (splitPoints.length === 0) {
				result.push(segment);
				continue;
			}
			let cursor = segmentStart;
			for (const point of [...splitPoints, segmentEnd]) {
				const raw = sourceText.substring(cursor, point);
				const leadingWhitespace = raw.match(/^\s*/)?.[0].length || 0;
				const trailingWhitespace = raw.match(/\s*$/)?.[0].length || 0;
				const startOffset = cursor + leadingWhitespace;
				const endOffset = point - trailingWhitespace;
				if (endOffset > startOffset) {
					result.push({
						text: sourceText.substring(startOffset, endOffset),
						startOffset,
						pauseMsAfter: 0,
					});
				}
				cursor = point;
			}
		}
		return result;
	}

	private createSentenceHighlightSegments(args: {
		contentToSpeak: string;
		shouldUsePlan: boolean;
		playbackSegments: TTSSpeechSegment[];
	}): TTSSpeechSegment[] {
		const grammaticalSegments = this.createSeekSegmentsFromText(
			args.contentToSpeak,
		);
		if (!args.shouldUsePlan || args.playbackSegments.length === 0) {
			return grammaticalSegments;
		}
		const structuralBoundaries = args.playbackSegments
			.map((segment) => segment.startOffset)
			.filter((offset) => offset > 0);
		return this.splitSegmentsAtBoundaries(
			grammaticalSegments,
			structuralBoundaries,
			args.contentToSpeak,
		);
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
				if (runId === this.speakRunId && this.provider === providerWithPlan) {
					this.provider.onWordBoundary = originalOnWordBoundary;
				}
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
		this.activeSentenceStartOffset = startOffset;
	}

	private getSegmentIndexForOffset(
		segments: TTSSpeechSegment[],
		offset: number,
	): number {
		if (segments.length === 0) return -1;
		let index = -1;
		for (let i = 0; i < segments.length; i++) {
			if (segments[i].startOffset <= offset) {
				index = i;
			} else {
				break;
			}
		}
		return index;
	}

	private highlightSentenceForOffset(offset: number): void {
		const segments = this.sentenceHighlightSegments;
		if (!this.highlightCoordinator || segments.length === 0) return;
		const segmentIndex = this.getSegmentIndexForOffset(segments, offset);
		if (segmentIndex < 0) return;
		const segment = segments[segmentIndex];
		if (!segment) return;
		if (this.activeSentenceStartOffset === segment.startOffset) return;
		this.highlightSentenceSegment(segment.startOffset, segment.text);
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
		try {
			await this.applyLanguageSettings(options);
			if (runId !== this.speakRunId) return;
			const resolvedContent = await this.resolveSpeechContent(text, options);
			if (runId !== this.speakRunId) return;
			const {
				contentToSpeak,
				speechText,
				highlightText,
				normalizedText,
				usedCatalogSpoken,
				speechSource,
				speechMatchesVisibleText,
				speechChunks,
			} = resolvedContent;
			this.logResolvedSpeechContent({
				contentToSpeak,
				speechSource,
				catalogId: options?.catalogId,
			});
			this.initializeSpeakTracking(highlightText, options);
			const highlightMode =
				options?.highlightModeOverride ||
				(speechMatchesVisibleText ? this.resolveHighlightMode() : "sentence");
			this.activeHighlightMode = highlightMode;
			const hasExplicitBreaks = this.hasExplicitBreakSemantics(contentToSpeak);
			const shouldUsePlan =
				!!this.currentContentElement &&
				!usedCatalogSpoken &&
				!hasExplicitBreaks &&
				speechMatchesVisibleText;
			this.seekSegments =
				hasExplicitBreaks || !speechMatchesVisibleText
					? []
					: shouldUsePlan && this.currentContentElement
						? this.createSpeechPlan(this.currentContentElement, normalizedText)
						: this.createSeekSegmentsFromText(highlightText);
			this.sentenceHighlightSegments = hasExplicitBreaks
				? []
				: this.createSentenceHighlightSegments({
						contentToSpeak: highlightText,
						shouldUsePlan,
						playbackSegments: this.seekSegments,
					});
			this.setState(PlaybackState.LOADING);
			this.prepareHighlightsForSpeak({
				contentToSpeak: highlightText,
				options,
				highlightMode,
				shouldUsePlan,
			});

			if (speechMatchesVisibleText) {
				this.configureWordBoundaryHighlighting({
					highlightMode,
					wordBoundaryOffset: options?.wordBoundaryOffset || 0,
				});
			} else {
				this.clearWordBoundaryHighlighting();
			}
			this.setState(PlaybackState.PLAYING);
			await this.executeSpeakPlayback({
				shouldUsePlan,
				runId,
				highlightMode,
				contentToSpeak: speechText,
				speechChunks,
			});
			if (runId !== this.speakRunId) return;
			this.setState(PlaybackState.IDLE);
			this.clearHighlightsAndTracking();
		} catch (error) {
			let finalError = error;
			console.error("TTS error:", finalError);
			this.lastError =
				finalError instanceof Error ? finalError.message : String(finalError);
			if (runId !== this.speakRunId) return;
			this.setState(PlaybackState.ERROR);
			this.clearHighlightsAndTracking();
			throw finalError;
		}
	}

	private async switchProviderToBrowser(
		reason: unknown,
		context?: { operation?: string; contentToSpeak?: string },
	): Promise<boolean> {
		if (!this.currentProvider) return false;
		const fallbackProvider = new BrowserTTSProvider();
		const previousProviderId = this.currentProvider.providerId;
		const browserConfig: Partial<TTSConfig> = { ...this.ttsConfig };
		const operation = context?.operation || "tts-initialize";
		const offendingText = context?.contentToSpeak ?? "";
		const offendingPreview = offendingText
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 120);
		const offendingDiagnostic =
			offendingText.length > 0
				? {
						textLength: offendingText.length,
						textPreview:
							offendingPreview.length < offendingText.length
								? `${offendingPreview}…`
								: offendingPreview,
					}
				: {};
		try {
			this.provider?.stop();
			this.currentProvider.destroy();
			this.currentProvider = fallbackProvider;
			this.provider = await fallbackProvider.initialize(
				browserConfig as TTSConfig,
			);
			this.ttsConfig = browserConfig;
			await this.emitTelemetry("pie-tool-runtime-fallback", {
				toolId: "textToSpeech",
				operation,
				fromProvider: previousProviderId,
				toProvider: fallbackProvider.providerId,
				reason: reason instanceof Error ? reason.message : String(reason),
				...offendingDiagnostic,
			});
			console.warn(
				"[TTSService] TTS provider initialization failed; switched to browser fallback",
				{
					fromProvider: previousProviderId,
					reason,
					...offendingDiagnostic,
				},
			);
			return true;
		} catch (fallbackError) {
			await this.emitTelemetry("pie-tool-runtime-fallback-error", {
				toolId: "textToSpeech",
				operation,
				fromProvider: previousProviderId,
				toProvider: "browser",
				errorType: "TTSRuntimeFallbackError",
				message:
					fallbackError instanceof Error
						? fallbackError.message
						: String(fallbackError),
			});
			console.error(
				"[TTSService] Failed to switch to browser fallback provider",
				fallbackError,
			);
			return false;
		}
	}

	private isBrowserSpeechFallbackAvailable(): boolean {
		if (typeof window === "undefined") return false;
		if (!("speechSynthesis" in window)) return false;
		return (
			typeof (globalThis as Record<string, unknown>)
				.SpeechSynthesisUtterance === "function"
		);
	}

	private async applyLanguageSettings(options?: SpeakOptions): Promise<void> {
		if (!options?.language || !this.provider) return;
		const providerOptions = (this.ttsConfig.providerOptions || {}) as Record<
			string,
			unknown
		>;
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
					updateSettings: (
						settings: Partial<TTSConfig>,
					) => Promise<void> | void;
				}
			).updateSettings({ providerOptions: mergedProviderOptions });
		}
	}

	private async resolveSpeechContent(
		text: string,
		options?: SpeakOptions,
	): Promise<ResolvedSpeechContent> {
		const normalizedInputText = normalizeTextForSpeech(text);
		if (options?.ignoreCatalogs) {
			return {
				contentToSpeak: normalizedInputText,
				speechText: normalizedInputText,
				visibleText: normalizedInputText,
				highlightText: normalizedInputText,
				usedCatalogSpoken: false,
				speechSource: "dom-or-input",
				normalizedText: normalizedInputText,
				containsMathMarkup: false,
				speechMatchesVisibleText: true,
			};
		}
		if (options?.catalogId && this.catalogResolver) {
			const catalogContent = this.catalogResolver.getAlternative(
				options.catalogId,
				{
					type: "spoken",
					language: options.language || "en-US",
					useFallback: true,
					context: options.catalogContext,
				},
			);
			if (catalogContent) {
				const visibleText = options?.contentElement
					? collectMathAwareTextAndMap(
							options.contentElement,
							this.getTextProcessingOptions(options.language),
						).visibleText || normalizedInputText
					: normalizedInputText;
				const normalizedCatalogText = normalizeTextForSpeech(
					catalogContent.content,
				);
				this.debugLog(
					`[TTSService] Using catalog content for "${options.catalogId}" (${catalogContent.language})`,
				);
				return {
					contentToSpeak: catalogContent.content,
					speechText: catalogContent.content,
					visibleText,
					highlightText: visibleText,
					usedCatalogSpoken: true,
					speechSource: "catalog-spoken",
					normalizedText: visibleText,
					containsMathMarkup: false,
					speechMatchesVisibleText: normalizedCatalogText === visibleText,
				};
			}
			this.debugLog(
				`[TTSService] No catalog found for "${options.catalogId}", falling back to generated TTS`,
			);
		}

		const composed = options?.contentElement
			? this.resolveCatalogComposedSpeechContent(
					options.contentElement,
					normalizedInputText,
					options,
				)
			: null;
		if (composed) return composed;

		const generated = options?.contentElement
			? await this.resolveGeneratedSpeechContent(
					options.contentElement,
					normalizedInputText,
					options.language,
				)
			: {
					contentToSpeak: normalizedInputText,
					speechText: normalizedInputText,
					visibleText: normalizedInputText,
					highlightText: normalizedInputText,
					normalizedText: normalizedInputText,
					containsMathMarkup: false,
					speechMatchesVisibleText: true,
				};
		return {
			...generated,
			usedCatalogSpoken: false,
			speechSource: "dom-or-input",
		};
	}

	private resolveCatalogComposedSpeechContent(
		contentElement: Element,
		normalizedInputText: string,
		options: SpeakOptions,
	): ResolvedSpeechContent | null {
		if (!this.catalogResolver) return null;
		const chunks = this.collectCatalogSpeechChunks(contentElement, options);
		if (!chunks.some((chunk) => chunk.sourceElement)) return null;
		const speechText = normalizeTextForSpeech(
			chunks.map((chunk) => chunk.speechText).join(" "),
		);
		const visibleText =
			collectMathAwareTextAndMap(
				contentElement,
				this.getTextProcessingOptions(options.language),
			).visibleText || normalizedInputText;
		return {
			contentToSpeak: speechText,
			speechText,
			visibleText,
			highlightText: visibleText,
			usedCatalogSpoken: true,
			speechSource: "catalog-spoken",
			normalizedText: visibleText,
			containsMathMarkup: false,
			speechMatchesVisibleText: chunks.every(
				(chunk) => chunk.speechMatchesVisibleText,
			),
			speechChunks: chunks,
		};
	}

	private collectCatalogSpeechChunks(
		root: Element,
		options: SpeakOptions,
	): SpeechCompositionChunk[] {
		const chunks: SpeechCompositionChunk[] = [];
		let textBuffer = "";
		const flushTextBuffer = () => {
			const visibleText = normalizeTextForSpeech(textBuffer);
			textBuffer = "";
			if (!visibleText) return;
			chunks.push({
				speechText: visibleText,
				visibleText,
				sourceElement: null,
				speechMatchesVisibleText: true,
			});
		};
		const resolveCatalog = (element: Element): ResolvedCatalog | null => {
			const catalogIdRef = element.getAttribute("data-catalog-idref");
			if (!catalogIdRef) return null;
			return this.catalogResolver!.getAlternative(catalogIdRef, {
				type: "spoken",
				language: options.language || "en-US",
				useFallback: true,
				context: options.catalogContext,
			});
		};
		const getSingleMathElementForAlignment = (
			element: Element,
			visibleText: string,
		): Element | null => {
			const mathElements = getMathElementsForAlignment(element);
			if (mathElements.length !== 1) return null;
			const mathElement = mathElements[0];
			const mathVisibleText =
				collectMathAwareTextAndMap(
					mathElement,
					this.getTextProcessingOptions(options.language),
				).visibleText || normalizeTextForSpeech(mathElement.textContent || "");
			const compact = (value: string) =>
				normalizeTextForSpeech(value).replace(/\s+/g, "");
			return compact(mathVisibleText) === compact(visibleText)
				? mathElement
				: null;
		};
		const getMathElementsForAlignment = (element: Element): Element[] => {
			const mathElements = Array.from(element.querySelectorAll("math"));
			if (element.localName?.toLowerCase() === "math") {
				return [element, ...mathElements];
			}
			return mathElements;
		};
		const visit = (node: Node) => {
			if (isNodeHiddenForTTS(node, root)) return;
			if (node.nodeType === Node.TEXT_NODE) {
				textBuffer += ` ${node.textContent || ""}`;
				return;
			}
			if (node.nodeType !== Node.ELEMENT_NODE) return;
			const element = node as Element;
			const catalog = resolveCatalog(element);
			if (catalog) {
				flushTextBuffer();
				const collectedVisible = collectMathAwareTextAndMap(
					element,
					this.getTextProcessingOptions(options.language),
				);
				const visibleText =
					collectedVisible.visibleText ||
					normalizeTextForSpeech(element.textContent || "");
				const alignment = createCatalogSpanAlignment({
					speechText: catalog.content,
					visibleText,
				});
				const mathElement = getSingleMathElementForAlignment(
					element,
					visibleText,
				);
				const mathAlignment = mathElement
					? createMathAwareAlignment({
							mathElement,
							speechText: catalog.content,
						})
					: undefined;
				const mathAlignments = mathAlignment
					? undefined
					: getMathElementsForAlignment(element).map((candidate) => ({
							element: candidate,
							alignment: createMathAwareAlignment({
								mathElement: candidate,
								speechText: catalog.content,
							}),
						}));
				const speechText = normalizeTextForSpeech(catalog.content);
				chunks.push({
					speechText: catalog.content,
					visibleText,
					sourceElement: element,
					regionElement: resolveReadableRegion(element, root),
					speechMatchesVisibleText: speechText === visibleText,
					playbackMode: alignment.playbackMode,
					alignment,
					mathAlignment,
					mathAlignments,
					visibleMap: collectedVisible.map,
				});
				return;
			}
			for (const child of Array.from(element.childNodes)) {
				visit(child);
			}
		};
		visit(root);
		flushTextBuffer();
		return chunks;
	}

	/**
	 * Decide the playback format for the generated (no authored catalog) math
	 * path. SSML is only emitted to providers that report `supportsSSML`: the
	 * browser Web Speech API speaks tags literally (capability `false`), and the
	 * server bridge reports `true` only for SSML-reliable backends (Polly,
	 * Google) — the `custom`/SchoolCity transport stays plain.
	 *
	 * A speak-time plain fallback (`SpeechCompositionChunk.plainFallback`) is the
	 * defensive net if a capable provider still rejects a given SSML payload.
	 */
	private resolveGeneratedPlaybackFormat(): "plain" | "ssml" {
		const provider = this.currentProvider;
		if (!provider) return "plain";
		// Belt-and-suspenders: the browser provider can never voice SSML.
		if (provider.providerId?.toLowerCase() === "browser") return "plain";
		return provider.getCapabilities?.().supportsSSML ? "ssml" : "plain";
	}

	private async resolveGeneratedSpeechContent(
		contentElement: Element,
		normalizedInputText: string,
		language?: string,
	): Promise<
		Pick<
			ResolvedSpeechContent,
			| "contentToSpeak"
			| "speechText"
			| "visibleText"
			| "highlightText"
			| "normalizedText"
			| "containsMathMarkup"
			| "speechMatchesVisibleText"
			| "speechChunks"
		>
	> {
		// Delegate to the generated-speech module: a pure plan assembly + SRE
		// memoization core, plus a DOM adapter that binds live-DOM anchors and
		// emits playback chunks. The aggregate `contentToSpeak` stays plain text
		// (`plan.plainSpeechText`) so seek/structural-pause planning is unaffected.
		const playbackFormat = this.resolveGeneratedPlaybackFormat();
		const {
			plan,
			containsMathMarkup,
			visibleText: collectedVisibleText,
		} = await buildGeneratedSpeechFromRoot({
			contentRoot: contentElement,
			language,
			mathSpeech: this.getMathSpeechOptions(),
			textProcessingOptions: this.getTextProcessingOptions(language),
			produceSsml: playbackFormat === "ssml",
			resolveMathSpeech: this.generatedMathSpeechResolver,
		});
		const visibleText = collectedVisibleText || normalizedInputText;
		if (!containsMathMarkup) {
			return {
				contentToSpeak: visibleText,
				speechText: visibleText,
				visibleText,
				highlightText: visibleText,
				normalizedText: visibleText,
				containsMathMarkup: false,
				speechMatchesVisibleText: true,
			};
		}
		const speechChunks = planToCompositionChunkInputs(plan, {
			format: playbackFormat,
		});
		const speechText = plan.plainSpeechText;
		return {
			contentToSpeak: speechText,
			speechText,
			visibleText,
			highlightText: visibleText,
			normalizedText: visibleText,
			containsMathMarkup: true,
			speechMatchesVisibleText: speechText === visibleText,
			speechChunks,
		};
	}

	private logResolvedSpeechContent(args: {
		contentToSpeak: string;
		speechSource: "catalog-spoken" | "dom-or-input";
		catalogId?: string;
	}): void {
		const preview = args.contentToSpeak
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 200);
		this.debugLog("[TTSService] Speak resolved content", {
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
		this.activeSentenceStartOffset = null;
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
		if (args.highlightMode === "sentence" && args.shouldUsePlan) {
			return;
		}
		const initialSegment =
			this.sentenceHighlightSegments[0] || this.seekSegments[0];
		if (initialSegment) {
			this.highlightSentenceSegment(
				initialSegment.startOffset,
				initialSegment.text,
			);
			this.debugLog("[TTSService] Applied initial sentence highlighting");
		} else {
			try {
				const range = document.createRange();
				range.selectNodeContents(this.currentContentElement);
				this.highlightCoordinator.highlightTTSSentence([range]);
			} catch {
				// No-op fallback when DOM range creation fails.
			}
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
		// Word index uses the same globalIndex as highlightTTSWord (browser boundaries
		// or ServerTTSProvider time-scaled onWordBoundary).
		this.provider.onWordBoundary = (
			word: string,
			charIndex: number,
			length?: number,
		) => {
			const wordLength = length || word.length;
			const globalIndex =
				charIndex + this.currentBoundaryOffset + args.wordBoundaryOffset;
			this.highlightSentenceForOffset(globalIndex);
			const highlightRange = this.findHighlightRange(globalIndex, wordLength);
			if (highlightRange && this.highlightCoordinator) {
				const highlightText =
					highlightRange.node.textContent?.substring(
						highlightRange.start,
						highlightRange.end,
					) || "";
				this.debugLog(
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

	private clearWordBoundaryHighlighting(): void {
		if (this.provider) {
			this.provider.onWordBoundary = undefined;
		}
	}

	private highlightCatalogRegion(chunk: SpeechCompositionChunk): void {
		const element = chunk.regionElement || chunk.sourceElement;
		if ((!element && !chunk.regionRange) || !this.highlightCoordinator) return;
		try {
			this.lastRenderedRegionTarget = null;
			if (chunk.regionRange) {
				this.highlightCoordinator.clearHighlights?.(HighlightType.TTS_WORD);
				this.highlightCoordinator.highlightTTSSentence([chunk.regionRange]);
				return;
			}
			if (!element) return;
			const range = document.createRange();
			range.selectNodeContents(element);
			this.highlightCoordinator.clearHighlights?.(HighlightType.TTS_WORD);
			this.highlightCoordinator.highlightTTSSentence([range]);
		} catch {
			// Continue playback even when a detached node cannot be highlighted.
		}
	}

	private highlightCatalogActiveRange(range: Range): void {
		if (!this.highlightCoordinator) return;
		if (
			range.startContainer === range.endContainer &&
			range.startContainer.nodeType === Node.TEXT_NODE
		) {
			this.highlightCoordinator.highlightTTSWord(
				range.startContainer as Text,
				range.startOffset,
				range.endOffset,
			);
			return;
		}
		this.highlightCoordinator.highlightRange(
			range,
			HighlightType.TTS_WORD,
			HighlightColor.YELLOW,
		);
	}

	private highlightRenderableRegionTarget(
		target: RenderableHighlightTarget | null,
	): void {
		if (
			!this.highlightCoordinator ||
			!target ||
			typeof document === "undefined"
		) {
			return;
		}
		if (sameRenderableHighlightTarget(this.lastRenderedRegionTarget, target)) {
			return;
		}
		try {
			const range = document.createRange();
			if (target.type === "element") {
				range.selectNodeContents(target.element);
			} else if (target.type === "range") {
				this.highlightCoordinator.highlightTTSSentence([target.range]);
				this.lastRenderedRegionTarget = target;
				return;
			} else {
				range.setStart(target.node, target.startOffset);
				range.setEnd(target.node, target.endOffset);
			}
			this.highlightCoordinator.highlightTTSSentence([range]);
			this.lastRenderedRegionTarget = target;
		} catch {
			// Continue playback even when a detached node cannot be highlighted.
		}
	}

	private highlightRenderableActiveTarget(
		target: RenderableHighlightTarget | null,
	): void {
		if (!this.highlightCoordinator || typeof document === "undefined") {
			return;
		}
		if (!target) {
			// No active word for this boundary — an unresolved prose word, an SSML
			// break/pause, or a token-mode equation still awaiting its first token.
			// Clear the word layer so the previously spoken word does not stay
			// highlighted. (The "hold last token" behavior returns a non-null
			// target, so it does not reach here.)
			this.highlightCoordinator.clearHighlights(HighlightType.TTS_WORD);
			return;
		}
		if (target.type === "text-range") {
			this.highlightCoordinator.highlightTTSWord(
				target.node,
				target.startOffset,
				target.endOffset,
			);
			return;
		}
		if (target.type === "range") {
			this.highlightCatalogActiveRange(target.range);
			return;
		}
		// Element targets are atomic: a resolved math token, a whole-expression
		// fallback, or a replaced element (image/svg). Paint exactly the resolved
		// element. Native MathML / HTML tokens that expose a single text node keep
		// the CSS-range underline (it reads more precisely than an element box);
		// everything else — notably MathJax CHTML tokens (`<mjx-mi><mjx-c/>`),
		// which have no text node, and expression fallbacks — is marked on the
		// element itself. Crucially we no longer escalate to the enclosing
		// `<math>` / `<mjx-container>`: that escalation is why MathJax math only
		// ever highlighted as a full block while native MathML tracked per-token.
		const onlyChild =
			target.element.childNodes.length === 1 ? target.element.firstChild : null;
		if (
			target.quality === "semantic-token" &&
			onlyChild?.nodeType === Node.TEXT_NODE
		) {
			this.highlightCoordinator.highlightTTSWord(
				onlyChild as Text,
				0,
				onlyChild.textContent?.length || 0,
			);
			return;
		}
		this.highlightCoordinator.highlightTTSWordElement?.(target.element);
	}

	private renderHighlightDecision(decision: HighlightDecision): void {
		this.highlightRenderableRegionTarget(decision.regionTarget);
		this.highlightRenderableActiveTarget(decision.activeTarget);
	}

	private async speakCatalogChunk(
		chunk: SpeechCompositionChunk,
		runId: number,
	): Promise<void> {
		try {
			await this.speakCatalogChunkOnce(chunk, runId);
		} catch (error) {
			// Speak-time fallback: if an SSML math chunk is rejected by the
			// provider, retry once with its precomputed plain-text variant (same
			// anchors, plain alignment). The fallback chunk carries no further
			// fallback, so this cannot recurse.
			if (chunk.plainFallback && runId === this.speakRunId) {
				this.debugLog(
					"[TTSService] SSML chunk speak failed; retrying plain text",
					{ message: error instanceof Error ? error.message : String(error) },
				);
				await this.speakCatalogChunkOnce(chunk.plainFallback, runId);
				return;
			}
			throw error;
		}
	}

	private async speakCatalogChunkOnce(
		chunk: SpeechCompositionChunk,
		runId: number,
	): Promise<void> {
		if (!this.provider) return;
		this.lastRenderedRegionTarget = null;
		const contentRoot =
			chunk.regionElement || chunk.sourceElement || this.currentContentElement;
		const pipelineChunk = contentRoot
			? normalizeSpeechChunks({
					contentRoot,
					chunks: [chunk],
				})[0]
			: null;
		// Carried through the config channel (see buildRuntimeTTSConfig); defaults
		// to per-token math highlighting unless a host explicitly disables it.
		const mathTokenHighlighting =
			this.ttsConfig.mathTokenHighlighting !== false;
		const highlightPlan = pipelineChunk
			? createTTSHighlightPlan({
					chunks: [pipelineChunk],
					mathTokenHighlighting,
				})
			: null;
		if (highlightPlan && pipelineChunk && chunk.mathAlignment) {
			this.renderHighlightDecision(
				highlightPlan.resolveInitial(pipelineChunk.id),
			);
		} else {
			this.highlightCatalogRegion(chunk);
		}
		const canUseChunkBoundaries =
			chunk.sourceElement &&
			((chunk.mathAlignment && chunk.mathAlignment.speech.tokens.length > 0) ||
				(chunk.mathAlignments && chunk.mathAlignments.length > 0) ||
				(chunk.alignment &&
					chunk.visibleMap &&
					(chunk.playbackMode === "exact-word" ||
						chunk.playbackMode === "anchor-span")));
		if (!canUseChunkBoundaries) {
			const provider = this.provider;
			const previousOnWordBoundary = provider.onWordBoundary;
			provider.onWordBoundary = undefined;
			try {
				await provider.speak(chunk.speechText);
			} finally {
				if (
					this.provider === provider &&
					runId === this.speakRunId &&
					provider.onWordBoundary === undefined
				) {
					provider.onWordBoundary = previousOnWordBoundary;
				}
			}
			return;
		}

		const provider = this.provider;
		const previousOnWordBoundary = provider.onWordBoundary;
		const installedHandler: NonNullable<
			ITTSProviderImplementation["onWordBoundary"]
		> = (word, position, length) => {
			if (runId !== this.speakRunId) return;
			if (highlightPlan && pipelineChunk) {
				const providerOffsetSpace =
					pipelineChunk.offsetSpace === "unsupported"
						? "unknown"
						: (pipelineChunk.offsetSpace as Exclude<
								ChunkOffsetSpace,
								"unsupported"
							>);
				this.renderHighlightDecision(
					highlightPlan.resolveBoundary({
						chunkId: pipelineChunk.id,
						word,
						position,
						length,
						providerOffsetSpace,
					}),
				);
				return;
			}
		};
		provider.onWordBoundary = installedHandler;
		try {
			await provider.speak(chunk.speechText);
		} finally {
			if (
				this.provider === provider &&
				runId === this.speakRunId &&
				provider.onWordBoundary === installedHandler
			) {
				provider.onWordBoundary = previousOnWordBoundary;
			}
		}
	}

	private async executeSpeakPlayback(args: {
		shouldUsePlan: boolean;
		runId: number;
		highlightMode: HighlightMode;
		contentToSpeak: string;
		speechChunks?: SpeechCompositionChunk[];
	}): Promise<void> {
		if (args.speechChunks?.length && this.provider) {
			for (const chunk of args.speechChunks) {
				if (args.runId !== this.speakRunId) return;
				await this.speakCatalogChunk(chunk, args.runId);
			}
			return;
		}
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
		this.lastRenderedRegionTarget = null;
		this.currentContentElement = null;
		this.normalizedToDOM.clear();
		this.currentBoundaryOffset = 0;
		this.seekSegments = [];
		this.sentenceHighlightSegments = [];
		this.currentSeekSegmentIndex = 0;
		this.activeSentenceStartOffset = null;
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
		const normalizedTextBeforeRange = normalizeTextForSpeech(textBeforeRange);
		const offset =
			normalizedTextBeforeRange.length +
			(/\s$/.test(textBeforeRange) && normalizedTextBeforeRange ? 1 : 0);

		this.debugLog("[TTSService] speakRange offset calculation:", {
			selectedText: text,
			textBeforeRange: textBeforeRange.substring(0, 100),
			offset,
			rootTag: root.tagName,
		});

		// Speak the text with the root element as context
		await this.speak(text, {
			contentElement: root,
			ignoreCatalogs: true,
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
		if (
			this.state !== PlaybackState.PLAYING &&
			this.state !== PlaybackState.PAUSED
		) {
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
		this.provider.onWordBoundary = undefined;
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
		this.provider.onWordBoundary = undefined;
		this.provider.stop();
		this.setState(PlaybackState.IDLE);
		this.currentText = null;

		// Clear highlights
		if (this.highlightCoordinator) {
			this.highlightCoordinator.clearTTS();
		}

		// Clear tracking
		this.lastRenderedRegionTarget = null;
		this.currentContentElement = null;
		this.normalizedToDOM.clear();
		this.currentBoundaryOffset = 0;
		this.seekSegments = [];
		this.sentenceHighlightSegments = [];
		this.currentSeekSegmentIndex = 0;
		this.activeSentenceStartOffset = null;
	}

	/**
	 * Request UI-level TTS controls to hand off/deactivate.
	 *
	 * This is intentionally separate from playback controls so hosts can orchestrate
	 * control handoff explicitly (for example: stop playback, then dismiss controls).
	 */
	requestControlHandoff(): void {
		if (typeof window === "undefined") return;
		const detail: TTSControlHandoffDetail = { source: "host" };
		window.dispatchEvent(
			new CustomEvent(PIE_TTS_CONTROL_HANDOFF_EVENT, {
				detail,
			}),
		);
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

		const previousState = this.state;
		this.state = newState;

		// Notify all listeners
		for (const callbacks of this.listeners.values()) {
			for (const callback of callbacks) {
				callback(newState);
			}
		}

		void this.emitTelemetry("pie-tool-playback-state-changed", {
			toolId: "textToSpeech",
			providerId: "tts",
			previousState,
			state: newState,
		});

		if (newState === PlaybackState.PLAYING) {
			const eventName =
				previousState === PlaybackState.PAUSED
					? "pie-tool-playback-resume"
					: "pie-tool-playback-start";
			void this.emitTelemetry(eventName, {
				toolId: "textToSpeech",
				providerId: "tts",
				previousState,
				state: newState,
			});
			return;
		}

		if (newState === PlaybackState.PAUSED) {
			void this.emitTelemetry("pie-tool-playback-pause", {
				toolId: "textToSpeech",
				providerId: "tts",
				previousState,
				state: newState,
			});
			return;
		}

		if (newState === PlaybackState.ERROR) {
			void this.emitTelemetry("pie-tool-playback-error", {
				toolId: "textToSpeech",
				providerId: "tts",
				previousState,
				state: newState,
				message: this.lastError || undefined,
			});
			return;
		}

		if (
			newState === PlaybackState.IDLE &&
			(previousState === PlaybackState.PLAYING ||
				previousState === PlaybackState.PAUSED ||
				previousState === PlaybackState.LOADING)
		) {
			void this.emitTelemetry("pie-tool-playback-stop", {
				toolId: "textToSpeech",
				providerId: "tts",
				previousState,
				state: newState,
			});
		}
	}
}
