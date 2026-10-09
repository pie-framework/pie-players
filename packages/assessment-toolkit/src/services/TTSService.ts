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
	TTSSpeechSegment,
} from "@pie-players/pie-tts";
import {
	applyMediaFragment,
	enforceMediaFragment,
} from "@pie-players/pie-players-shared/media";
import {
	createPieLogger,
	isTtsDebugEnabled,
} from "@pie-players/pie-players-shared/pie";
import type {
	AccessibilityCatalogResolver,
	CatalogLookupContext,
} from "./AccessibilityCatalogResolver.js";
import {
	resolveSpokenAudioMedia,
	type SpokenAudioMedia,
} from "./spoken-audio-cards.js";
import type { HighlightCoordinatorApi, SpeakOptions } from "./interfaces.js";
import {
	DEFAULT_CONTENT_LANGUAGE,
	findContentLanguage,
	findLangAttribute,
} from "../runtime/content-language.js";
import { isSsmlDocument } from "./tts/ssml/spoken-text.js";
import {
	composedContains,
	composedParentElement,
	flatQuerySelectorAll,
	flatTextContent,
	flatTreeChildNodes,
	flatTreeParentElement,
	flatTreeTextNodes,
	rangeHoldsTextPosition,
	rangeIntersectsComposedNode,
} from "./tts/flat-tree.js";
import type {
	TTSHighlightContext,
	TTSHighlightTargetResolver,
	TTSHighlightTargetResolverProvider,
	TTSHighlightTargetResolverRuntime,
} from "./tts/highlight-target-resolver.js";
import {
	type BoundarySpacingMode,
	collectRangeTextForSpeech,
	collectVisibleTextAndMap,
	isElementHiddenForTTS,
	isNodeExcludedFromSpeech,
	isNodeSuppressedForTTS,
	type NormalizedTextMap,
	normalizeTextForSpeech,
	rangeHoldsSpeakableElement,
	textInRange,
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
import type {
	ToolkitTTSConfig,
	ToolkitTTSProviderOptions,
} from "./tts/provider-options.js";
import { toTTSStartFailure } from "./tts/start-failure.js";
import {
	segmentSentences as segmentTextToSentences,
	type SentenceSegment as SharedSentenceSegment,
	splitTextToLength,
} from "./tts/text-segmentation.js";
import {
	createTTSHighlightPlan,
	normalizeSpeechChunks,
	resolveReadableRegion,
	type ChunkOffsetSpace,
	type HighlightDecision,
	type RenderableHighlightTarget,
} from "./tts/highlight-pipeline/index.js";
import { createRangesFromVisibleMap } from "./tts/highlight-pipeline/visible-map-range.js";

// Debug lines need `PIE_TTS_DEBUG=1` or `globalThis.__PIE_TTS_DEBUG__ = true`.
const logger = createPieLogger("tts-service", isTtsDebugEnabled);

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

/** What a speak reads, once {@link TTSService.speak} has resolved its target. */
interface SpeakContentOptions {
	catalogId?: string;
	catalogContext?: CatalogLookupContext;
	/** The read's locale: text processing, catalog lookups and math speech read it. */
	language: string;
	/** The content language, when markup, the host or a pinned `lang_id` names one. */
	contentLanguage?: string;
	/** The content read, and the frame the highlight offsets index. */
	contentElement: Element;
	/** The selection inside `contentElement` that is read; the text spoken is its text. */
	contentRange?: Range;
	wordBoundaryOffset?: number;
}

interface HostLocales {
	locale?: string;
	textNormalization?: string;
	segmenter?: string;
}

const optionalString = (value: unknown): string | undefined =>
	typeof value === "string" && value.trim() ? value.trim() : undefined;

const hostLocalesOf = (
	options: ToolkitTTSProviderOptions | undefined,
	previous: HostLocales = {},
): HostLocales => {
	if (!options) return previous;
	return {
		locale: "locale" in options ? optionalString(options.locale) : previous.locale,
		textNormalization:
			options.textNormalization && "locale" in options.textNormalization
				? optionalString(options.textNormalization.locale)
				: previous.textNormalization,
		segmenter:
			options.segmenter && "locale" in options.segmenter
				? optionalString(options.segmenter.locale)
				: previous.segmenter,
	};
};

const isRange = (target: Range | Element): target is Range =>
	"commonAncestorContainer" in target;

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
	/**
	 * Recorded speech for this node, in place of synthesis. Present only for a
	 * `spoken` card whose payload resolved to playable audio; `speechText` still
	 * carries the reading script (or the visible text) so seek and offset
	 * bookkeeping is unaffected.
	 */
	audio?: SpokenAudioMedia;
	// Variant for speak-time fallback, retried once if speaking this chunk throws.
	// Two producers: a generated SSML math chunk falls back to its precomputed
	// plain text, and a recorded-audio chunk falls back to the reading script —
	// which is exactly why QTI's guidance keeps the script alongside the audio.
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
	private highlightTargetResolverProvider: TTSHighlightTargetResolverProvider | null =
		null;
	private catalogResolver: AccessibilityCatalogResolver | null = null;
	private state: PlaybackState = PlaybackState.IDLE;
	// The state a resume returns to: loading when the pause came before the
	// audio started sounding.
	private resumeState: PlaybackState.LOADING | PlaybackState.PLAYING =
		PlaybackState.PLAYING;
	private ttsConfig: Partial<ToolkitTTSConfig> = {};
	// The locales the host configured. A read naming a language sets all three
	// to it; a read naming none restores these.
	private hostLocales: HostLocales = {};
	// The locale of the read in progress, which segmentation reads.
	private readLocale: string = DEFAULT_CONTENT_LANGUAGE;
	private disposed = false;
	private readinessGate: (() => Promise<void>) | null = null;
	private mathSpeechSource: (() => unknown) | null = null;
	private currentText: string | null = null;
	private currentContentElement: Element | null = null;
	private normalizedToDOM: Map<number, { node: Text; offset: number }> =
		new Map();
	private listeners = new Set<(state: PlaybackState) => void>();
	private lastError: string | null = null;
	private speakRunId = 0;
	private runOwner: string | null = null;
	private currentBoundaryOffset = 0;
	private activeWordBoundaryOffset = 0;
	private seekSegments: TTSSpeechSegment[] = [];
	private playbackChunks: SpeechCompositionChunk[] = [];
	// The recording currently playing, if any. `cancel` settles the pending play
	// promise as well as stopping the element, so stop/seek cannot wedge the
	// chunk loop on a run that has already been superseded. `play` starts it, or
	// starts it again after a pause.
	private activeRecordedAudio: {
		element: HTMLAudioElement;
		cancel: () => void;
		play: () => void;
	} | null = null;
	private sentenceHighlightSegments: TTSSpeechSegment[] = [];
	private activeSentenceStartOffset: number | null = null;
	private playbackStartDeferredRunId: number | null = null;
	private pendingPlaybackStartHighlights: Array<() => void> = [];
	private playbackStartBarrierCleanup: (() => void) | null = null;
	// A pause between two parts of a run, in a structural gap or while the next
	// part loads, holds the run here until resume.
	private pauseHold: { promise: Promise<void>; release: () => void } | null =
		null;
	private structuralPause: {
		timer: ReturnType<typeof setTimeout>;
		finish: () => void;
	} | null = null;
	private playbackRateWriteQueue: Promise<void> = Promise.resolve();
	private playbackRateRequestId = 0;
	private pendingPlaybackRateRequest: {
		rate: number;
		promise: Promise<void>;
	} | null = null;
	private activePlaybackRate: number | null = null;
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

	constructor() {}

	private clearPlaybackStartBarrier(
		cleanup = this.playbackStartBarrierCleanup,
	): void {
		cleanup?.();
		if (this.playbackStartBarrierCleanup === cleanup) {
			this.playbackStartBarrierCleanup = null;
		}
	}

	private notifyPlaybackStarted(runId: number): void {
		if (
			this.playbackStartDeferredRunId !== runId ||
			runId !== this.speakRunId
		) {
			return;
		}
		if (this.state === PlaybackState.PAUSED) {
			// The learner paused before this part began: it holds where it started.
			this.activeRecordedAudio?.element.pause();
			this.provider?.pause();
		}
		this.markPlaying();
		const pendingHighlights = this.pendingPlaybackStartHighlights.splice(0);
		for (const applyHighlight of pendingHighlights) {
			applyHighlight();
		}
	}

	private installPlaybackStartBarrier(
		runId: number,
		hasMediaStartSignal = false,
	): (() => void) | null {
		this.clearPlaybackStartBarrier();
		const provider = this.provider;
		const startAwareProvider =
			provider && "onPlaybackStart" in provider ? provider : null;
		if (!startAwareProvider && !hasMediaStartSignal) return null;

		const previousOnPlaybackStart = startAwareProvider?.onPlaybackStart;
		const onPlaybackStart = () => {
			try {
				this.notifyPlaybackStarted(runId);
			} finally {
				previousOnPlaybackStart?.();
			}
		};
		if (startAwareProvider) {
			startAwareProvider.onPlaybackStart = onPlaybackStart;
		}
		this.playbackStartDeferredRunId = runId;

		const cleanup = () => {
			if (startAwareProvider?.onPlaybackStart === onPlaybackStart) {
				startAwareProvider.onPlaybackStart = previousOnPlaybackStart;
			}
			if (this.playbackStartDeferredRunId === runId) {
				this.playbackStartDeferredRunId = null;
				this.pendingPlaybackStartHighlights = [];
			}
		};
		this.playbackStartBarrierCleanup = cleanup;
		return cleanup;
	}

	private runWhenPlaybackStarts(runId: number, callback: () => void): void {
		if (this.playbackStartDeferredRunId === runId) {
			this.pendingPlaybackStartHighlights.push(callback);
			return;
		}
		callback();
	}

	/** Resolves when run `runId` may start its next part: at once unless paused. */
	private async waitWhilePaused(runId: number): Promise<void> {
		while (this.state === PlaybackState.PAUSED && runId === this.speakRunId) {
			if (!this.pauseHold) {
				let release: () => void = () => {};
				const promise = new Promise<void>((resolve) => {
					release = resolve;
				});
				this.pauseHold = { promise, release };
			}
			await this.pauseHold.promise;
		}
	}

	private releasePauseHold(): void {
		const hold = this.pauseHold;
		this.pauseHold = null;
		hold?.release();
	}

	private waitStructuralPause(pauseMs: number): Promise<void> {
		this.cancelStructuralPause();
		return new Promise<void>((resolve) => {
			const finish = () => {
				if (this.structuralPause?.finish === finish) {
					clearTimeout(this.structuralPause.timer);
					this.structuralPause = null;
				}
				resolve();
			};
			this.structuralPause = { timer: setTimeout(finish, pauseMs), finish };
		});
	}

	private cancelStructuralPause(): void {
		this.structuralPause?.finish();
	}

	/**
	 * Release what a superseded run still holds: its start barrier, a recorded
	 * clip still playing, a structural gap and a pause hold. Its loops then see
	 * the new run id and return.
	 */
	private abandonRun(): void {
		this.clearPlaybackStartBarrier();
		this.cancelRecordedAudio();
		this.cancelStructuralPause();
		this.releasePauseHold();
	}

	/**
	 * Start a run and enter loading. From here a pause or stop applies to the
	 * run, whatever it is still waiting for: the provider, its content or the
	 * provider's audio.
	 */
	private beginRun(owner: string | null): number {
		// A recorded clip that starts the new run would otherwise play over the
		// previous run's synthesis, which only the provider's next speak stops.
		const supersedesPlayback =
			this.state === PlaybackState.LOADING ||
			this.state === PlaybackState.PLAYING ||
			this.state === PlaybackState.PAUSED;
		const runId = ++this.speakRunId;
		this.runOwner = owner;
		this.abandonRun();
		if (supersedesPlayback) this.provider?.stop();
		// Announced even from loading, so a listener sees the owner change.
		this.setState(PlaybackState.LOADING, true);
		return runId;
	}

	/** The run's audio is sounding; under a pause, it sounds again on resume. */
	private markPlaying(): void {
		if (this.state === PlaybackState.PAUSED) {
			this.resumeState = PlaybackState.PLAYING;
			return;
		}
		this.setState(PlaybackState.PLAYING);
	}

	private assertNotDisposed(): void {
		if (this.disposed) {
			throw toTTSStartFailure(new Error("TTS service disposed"));
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
		config: Partial<ToolkitTTSConfig> = {},
	): Promise<void> {
		if (this.disposed) throw new Error("TTS service disposed");
		this.currentProvider = provider;
		this.ttsConfig = { ...config };
		this.hostLocales = hostLocalesOf(
			config.providerOptions as ToolkitTTSProviderOptions | undefined,
		);
		const telemetry = this.providerOptions().__pieTelemetry;
		this.telemetryReporter = typeof telemetry === "function" ? telemetry : null;

		// A provider that fails to start throws to the caller, which owns any
		// fallback. Playback and synthesis errors surface the same way.
		this.provider = await provider.initialize(config as TTSConfig);
	}

	/**
	 * Update rate, pitch, voice or provider options without reinitializing.
	 * `providerOptions` merge over the ones already configured.
	 */
	async updateSettings(settings: Partial<TTSConfig>): Promise<void> {
		if (!this.provider) {
			throw new Error("TTSService not initialized. Call initialize() first.");
		}
		const mergedSettings: Partial<TTSConfig> = {
			...settings,
			...(settings.providerOptions
				? {
						providerOptions: {
							...this.providerOptions(),
							...settings.providerOptions,
						},
					}
				: {}),
		};
		await this.provider.updateSettings(mergedSettings);
		this.ttsConfig = { ...this.ttsConfig, ...mergedSettings };
		this.hostLocales = hostLocalesOf(
			settings.providerOptions as ToolkitTTSProviderOptions | undefined,
			this.hostLocales,
		);
	}

	/**
	 * Set highlight coordinator for word highlighting
	 */
	setHighlightCoordinator(coordinator: HighlightCoordinatorApi): void {
		this.highlightCoordinator = coordinator;
	}

	/**
	 * Starts the service when a caller speaks before it is initialized; a gate
	 * that rejects fails the speak with its error. The coordinator installs one
	 * that runs its own text-to-speech start.
	 */
	setReadinessGate(gate: (() => Promise<void>) | null): void {
		this.readinessGate = gate;
	}

	/**
	 * Where the configured math speech options come from before, and apart from,
	 * initialization, so math names do not depend on when speech started.
	 */
	setMathSpeechSource(source: (() => unknown) | null): void {
		this.mathSpeechSource = source;
	}

	/** The start a speak must wait for, or null when it can speak now without yielding. */
	private pendingReadiness(): Promise<void> | null {
		if (this.provider || !this.readinessGate) return null;
		return this.readinessGate().catch((error: unknown) => {
			throw toTTSStartFailure(error);
		});
	}

	/**
	 * Set a late-bound provider for optional host TTS highlight target remapping.
	 *
	 * The returned disposer is the only thing that clears the registration: the
	 * caller owns the lifetime, and a provider installed once keeps remapping
	 * across stops, seek-restarts and later playbacks. Playback termination used to
	 * clear it in `stop()` and on both exits of `restartFromSeekIndex`, which left a
	 * host that installs before mount — the case a late-bound provider exists for —
	 * remapping exactly one playback and then silently falling back to identity.
	 *
	 * Installing again replaces the previous provider, so a caller that reinstalls
	 * per playback needs no disposal between them. A stale provider cannot paint
	 * outside its scope in any case: targets are validated by containment in
	 * `context.scopeElement` and a failing one falls back to its native range.
	 */
	setHighlightTargetResolverProvider(
		provider: TTSHighlightTargetResolverProvider | null,
	): () => void {
		this.highlightTargetResolverProvider = provider;
		return () => {
			if (this.highlightTargetResolverProvider === provider) {
				this.highlightTargetResolverProvider = null;
			}
		};
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

	private getHighlightResolverRuntime(): {
		context: TTSHighlightContext;
		resolver: TTSHighlightTargetResolver | null;
	} {
		let provided: TTSHighlightTargetResolverRuntime | null | undefined = null;
		try {
			provided = this.highlightTargetResolverProvider?.() ?? null;
		} catch {
			provided = null;
		}
		const providedContext = provided?.context ?? {};
		const fallbackScope =
			typeof HTMLElement !== "undefined" &&
			this.currentContentElement instanceof HTMLElement
				? this.currentContentElement
				: null;
		return {
			context: {
				...providedContext,
				scopeElement: providedContext.scopeElement ?? fallbackScope,
			},
			resolver: provided?.resolver ?? null,
		};
	}

	private getNodeElement(node: Node | null): Element | null {
		if (!node) return null;
		return node.nodeType === Node.ELEMENT_NODE
			? (node as Element)
			: composedParentElement(node);
	}

	private isElementWithinScope(
		element: Element,
		scope: Element | null | undefined,
	): boolean {
		if (!scope) return true;
		return composedContains(scope, element);
	}

	private isRangeWithinScope(
		range: Range,
		scope: Element | null | undefined,
	): boolean {
		const startElement = this.getNodeElement(range.startContainer);
		const endElement = this.getNodeElement(range.endContainer);
		if (!startElement || !endElement) return false;
		return (
			this.isElementWithinScope(startElement, scope) &&
			this.isElementWithinScope(endElement, scope)
		);
	}

	private resolveWordHighlightRange(nativeRange: Range): {
		range: Range;
		remapped: boolean;
	} {
		const { context, resolver } = this.getHighlightResolverRuntime();
		const scope = context.scopeElement ?? this.currentContentElement;
		try {
			const resolved = resolver?.resolveWordRange?.(nativeRange, context);
			if (resolved && this.isRangeWithinScope(resolved, scope)) {
				return { range: resolved, remapped: !sameRange(nativeRange, resolved) };
			}
		} catch {
			// Fail open: custom resolver failures must not interrupt TTS playback.
		}
		return { range: nativeRange, remapped: false };
	}

	private resolveSentenceHighlightTargets(nativeRanges: Range[]): {
		ranges: Range[];
		elements: Element[];
	} {
		const { context, resolver } = this.getHighlightResolverRuntime();
		const scope = context.scopeElement ?? this.currentContentElement;
		try {
			const resolved = resolver?.resolveSentenceRanges?.(nativeRanges, context);
			if (!resolved) return { ranges: nativeRanges, elements: [] };
			const ranges: Range[] = [];
			const elements: Element[] = [];
			for (const target of resolved) {
				if (typeof Range !== "undefined" && target instanceof Range) {
					if (!this.isRangeWithinScope(target, scope)) {
						return { ranges: nativeRanges, elements: [] };
					}
					ranges.push(target);
					continue;
				}
				if (typeof Element !== "undefined" && target instanceof Element) {
					if (!this.isElementWithinScope(target, scope)) {
						return { ranges: nativeRanges, elements: [] };
					}
					elements.push(target);
					continue;
				}
				return { ranges: nativeRanges, elements: [] };
			}
			return { ranges, elements };
		} catch {
			// Fail open: custom resolver failures must not interrupt TTS playback.
			return { ranges: nativeRanges, elements: [] };
		}
	}

	private createTextRange(
		node: Text,
		startOffset: number,
		endOffset: number,
	): Range | null {
		if (typeof document === "undefined") return null;
		if (typeof document.createRange !== "function") return null;
		try {
			const range = document.createRange();
			range.setStart(node, startOffset);
			range.setEnd(node, endOffset);
			if (range.startContainer !== node || range.endContainer !== node) {
				return null;
			}
			return range;
		} catch {
			return null;
		}
	}

	/**
	 * Paint the spoken word, each range offered to the host's resolver. A word
	 * split across inline elements is one range over its text nodes; across
	 * shadow trees, one range per tree.
	 */
	private paintTTSWord(nativeRanges: Range[]): void {
		if (!this.highlightCoordinator || nativeRanges.length === 0) return;
		this.highlightCoordinator.highlightTTSWord(
			nativeRanges.map((range) => this.resolveWordHighlightRange(range).range),
		);
	}

	private paintTTSSentenceRanges(nativeRanges: Range[]): void {
		if (!this.highlightCoordinator) return;
		const { ranges, elements } =
			this.resolveSentenceHighlightTargets(nativeRanges);
		if (elements.length > 0 && ranges.length === 0) {
			this.highlightCoordinator.highlightTTSSentenceElements(elements);
			return;
		}
		const paintedRanges = [...ranges];
		for (const element of elements) {
			const elementRange = document.createRange();
			elementRange.selectNodeContents(element);
			paintedRanges.push(elementRange);
		}
		this.highlightCoordinator.highlightTTSSentence(paintedRanges);
	}

	private providerOptions(): ToolkitTTSProviderOptions {
		const options = this.ttsConfig.providerOptions;
		return options && typeof options === "object" ? options : {};
	}

	/** The longest text the provider accepts in one speak, when it declares one. */
	private maxTextLength(): number | undefined {
		const limit = this.currentProvider?.getCapabilities?.().maxTextLength;
		return typeof limit === "number" && limit > 0 ? limit : undefined;
	}

	/**
	 * Speak `text`, in pieces when it exceeds the provider's `maxTextLength`. Word
	 * boundaries keep indexing the whole text. An SSML document cannot be cut, so
	 * one over the limit fails and the chunk's plain fallback reads instead.
	 */
	private async speakWithinLimit(text: string, runId: number): Promise<void> {
		const provider = this.provider;
		if (!provider) return;
		const limit = this.maxTextLength();
		if (!limit || text.length <= limit) {
			await this.waitWhilePaused(runId);
			if (runId !== this.speakRunId || this.provider !== provider) return;
			await provider.speak(text);
			return;
		}
		if (isSsmlDocument(text)) {
			throw new Error(
				`[tts] SSML of ${text.length} characters exceeds the provider's limit of ${limit}`,
			);
		}
		const onWordBoundary = provider.onWordBoundary;
		try {
			for (const piece of splitTextToLength(text, limit, {
				locale: this.readLocale,
			})) {
				await this.waitWhilePaused(runId);
				if (runId !== this.speakRunId || this.provider !== provider) return;
				provider.onWordBoundary = onWordBoundary
					? (word, position, length) =>
							onWordBoundary(word, position + piece.offset, length)
					: undefined;
				await provider.speak(piece.text);
			}
		} finally {
			if (this.provider === provider && runId === this.speakRunId) {
				provider.onWordBoundary = onWordBoundary;
			}
		}
	}

	/** Segments no longer than the provider's `maxTextLength`, offsets kept. */
	private segmentsWithinLimit(
		segments: TTSSpeechSegment[],
	): TTSSpeechSegment[] {
		const limit = this.maxTextLength();
		if (!limit) return segments;
		return segments.flatMap((segment) => {
			if (segment.text.length <= limit) return [segment];
			const pieces = splitTextToLength(segment.text, limit, {
				locale: this.readLocale,
			});
			return pieces.map((piece, index) => ({
				text: piece.text,
				startOffset: segment.startOffset + piece.offset,
				pauseMsAfter:
					index === pieces.length - 1 ? segment.pauseMsAfter : undefined,
			}));
		});
	}

	/**
	 * Build a character-by-character map from normalized text positions to DOM positions
	 * This handles the complexity of whitespace normalization
	 */
	private getTextProcessingOptions(locale: string): {
		locale: string;
		boundarySpacingMode?: BoundarySpacingMode;
	} {
		const mode = this.providerOptions().textNormalization?.boundarySpacingMode;
		const boundarySpacingMode: BoundarySpacingMode | undefined =
			mode === "none" || mode === "alnum" || mode === "segmenterPreferred"
				? mode
				: undefined;
		return { locale, boundarySpacingMode };
	}

	/**
	 * The language a read of `node` is in. Its content language is the nearest
	 * `lang` between it and its shell, else the language the speak names, else a
	 * pinned `lang_id`. Its locale is that content language, else the host's
	 * configured locale, else en-US.
	 */
	private resolveReadLanguage(
		node: Node,
		named: string | undefined,
	): { contentLanguage?: string; locale: string } {
		const contentLanguage =
			findContentLanguage(node, { contentLanguage: named }) ??
			optionalString(this.providerOptions().lang_id);
		return {
			contentLanguage,
			locale:
				contentLanguage ??
				this.hostLocales.locale ??
				this.hostLocales.textNormalization ??
				DEFAULT_CONTENT_LANGUAGE,
		};
	}

	/**
	 * The host's SRE options for math speech: from the installed source, else as
	 * this service was initialized with.
	 */
	getMathSpeechOptions(): SREMathSpeechOptions | undefined {
		if (this.mathSpeechSource) {
			return normalizeSREMathSpeechOptions(this.mathSpeechSource());
		}
		return normalizeSREMathSpeechOptions(this.providerOptions().mathSpeech);
	}

	private buildPositionMap(
		element: Element,
		spokenText: string,
		language: string,
	): void {
		this.normalizedToDOM.clear();
		const { text: normalizedDomText, map } = collectVisibleTextAndMap(
			element,
			this.getTextProcessingOptions(language),
		);
		this.normalizedToDOM = map;

		// The comparison below diffs the whole text, so it runs only when traced.
		if (!isTtsDebugEnabled()) return;

		logger.debug("Text comparison:", {
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

		logger.debug("Position map built:", {
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
		const custom = this.providerOptions().structuralPauses || {};
		const customUnits = custom.units || {};
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
		const configuredMode = this.providerOptions().highlightMode;
		if (configuredMode === "word" || configuredMode === "sentence") {
			return configuredMode;
		}
		const capabilities = this.currentProvider?.getCapabilities();
		if (capabilities?.defaultHighlightMode) {
			return capabilities.defaultHighlightMode;
		}
		return capabilities?.supportsWordBoundary ? "word" : "sentence";
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
		let current = flatTreeParentElement(textNode);
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
			current = flatTreeParentElement(current);
		}
		if (!best) return null;
		const strength = this.getBoundaryStrength(best);
		return {
			anchor: best,
			units: this.getStructuralPauseProfile().units[strength],
		};
	}

	/**
	 * `textOffset` is where `normalizedText` starts in the element's visible text:
	 * boundaries are collected over the whole element, and a selection speaks only
	 * part of it.
	 */
	private createSpeechPlan(
		contentElement: Element,
		normalizedText: string,
		textOffset: number,
		language: string,
	): TTSSpeechSegment[] {
		const boundaries = this.collectSpeechPlanBoundaries(
			contentElement,
			normalizedText,
			language,
		);
		if (textOffset === 0) {
			return this.createSpeechPlanSegments(normalizedText, boundaries);
		}
		const shifted = new Map<number, number>();
		for (const [point, units] of boundaries) {
			shifted.set(point - textOffset, units);
		}
		return this.createSpeechPlanSegments(normalizedText, shifted);
	}

	private collectSpeechPlanBoundaries(
		contentElement: Element,
		normalizedText: string,
		language: string,
	): Map<number, number> {
		const boundaries = new Map<number, number>();
		// The same locale the position map used, so the boundary offsets index the
		// text the map built.
		const { map } = collectVisibleTextAndMap(
			contentElement,
			this.getTextProcessingOptions(language),
		);
		const nodeStartOffsets = this.createNodeStartOffsets(map);

		let previousBoundaryAnchor: Element | null = null;
		for (const textNode of flatTreeTextNodes(contentElement)) {
			const parent = flatTreeParentElement(textNode);
			if (
				parent &&
				!this.isElementHidden(parent) &&
				!isNodeSuppressedForTTS(textNode)
			) {
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
		return segmentTextToSentences(text, { locale: this.readLocale });
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

	private createSeekSegmentsFromSpeechChunks(
		chunks: SpeechCompositionChunk[],
	): TTSSpeechSegment[] {
		let offset = 0;
		return chunks.map((chunk) => {
			const speechText =
				chunk.plainFallback?.speechText ||
				(this.hasExplicitBreakSemantics(chunk.speechText)
					? chunk.visibleText
					: chunk.speechText) ||
				chunk.visibleText;
			const text =
				normalizeTextForSpeech(speechText) || chunk.visibleText || "";
			const segment = {
				text,
				startOffset: offset,
				pauseMsAfter: 0,
			};
			offset += Math.max(1, text.length + 1);
			return segment;
		});
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
		const providerWithPlan = this.provider;
		if (
			!shouldTrackSentenceProgress &&
			typeof providerWithPlan.speakSegments === "function"
		) {
			await this.waitWhilePaused(runId);
			if (runId !== this.speakRunId || this.provider !== providerWithPlan) {
				return;
			}
			this.currentBoundaryOffset = 0;
			const originalOnWordBoundary = this.provider.onWordBoundary;
			this.provider.onWordBoundary = (
				word: string,
				position: number,
				length?: number,
			) => {
				originalOnWordBoundary?.(word, position, length);
				if (Number.isFinite(position)) {
					this.currentBoundaryOffset = position;
				}
			};
			try {
				await providerWithPlan.speakSegments(
					this.segmentsWithinLimit(segments),
				);
			} finally {
				if (runId === this.speakRunId && this.provider === providerWithPlan) {
					this.provider.onWordBoundary = originalOnWordBoundary;
				}
			}
			return;
		}
		this.configureWordBoundaryHighlighting({
			highlightMode: options?.highlightMode || "word",
			wordBoundaryOffset: this.activeWordBoundaryOffset,
		});
		for (const segment of segments) {
			await this.waitWhilePaused(runId);
			if (runId !== this.speakRunId) return;
			this.currentBoundaryOffset = segment.startOffset;
			if (shouldTrackSentenceProgress) {
				this.runWhenPlaybackStarts(runId, () => {
					this.highlightSentenceSegment(segment.startOffset, segment.text);
				});
			}
			await this.speakWithinLimit(segment.text, runId);
			const pauseMs = segment.pauseMsAfter ?? 0;
			if (pauseMs > 0 && runId === this.speakRunId) {
				await this.waitStructuralPause(pauseMs);
			}
		}
	}

	/**
	 * `startOffset` indexes the spoken text; the position map indexes the whole
	 * content element, which for a selection starts `activeWordBoundaryOffset`
	 * characters earlier.
	 */
	private highlightSentenceSegment(startOffset: number, text: string): void {
		if (!this.highlightCoordinator || typeof document === "undefined") return;
		const length = text.trimEnd().length;
		if (length <= 0) return;
		const mapStart = startOffset + this.activeWordBoundaryOffset;
		const start = this.normalizedToDOM.get(mapStart);
		const end = this.normalizedToDOM.get(mapStart + length - 1);
		if (!start || !end) return;
		// One range per tree: a sentence running into a shadow root paints in both.
		const ranges = createRangesFromVisibleMap(
			this.normalizedToDOM,
			mapStart,
			mapStart + length,
		);
		if (ranges.length === 0) return;
		this.paintTTSSentenceRanges(ranges);
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
	 * Read `target` aloud: a range reads the text it selects, an element its
	 * content. A node with a spoken card that the target holds whole reads its
	 * card, `catalogId` names the card of the content root, and math reads as
	 * math speech.
	 *
	 * Content marked not-to-be-spoken is never read, a named card included. When
	 * the target holds nothing speakable, nothing is spoken and playback already
	 * running continues.
	 */
	async speak(
		target: Range | Element,
		options: SpeakOptions = {},
	): Promise<void> {
		this.assertNotDisposed();
		const pendingReadiness = this.pendingReadiness();
		// A speak waiting on its provider is already the current run, so a pause
		// or stop issued meanwhile applies to it.
		const owner = options.ownerId ?? null;
		const waitingRunId = pendingReadiness ? this.beginRun(owner) : null;
		if (pendingReadiness) {
			try {
				await pendingReadiness;
			} catch (error) {
				if (waitingRunId === this.speakRunId) this.setState(PlaybackState.IDLE);
				throw error;
			}
			this.assertNotDisposed();
			if (waitingRunId !== this.speakRunId) return;
		}
		if (!this.provider) {
			if (waitingRunId !== null) this.setState(PlaybackState.IDLE);
			throw toTTSStartFailure(new Error("TTS service not initialized"));
		}
		const language = this.resolveReadLanguage(
			isRange(target) ? target.startContainer : target,
			options.language,
		);
		const content = isRange(target)
			? this.resolveRangeTarget(target, options, language)
			: this.resolveElementTarget(target, options, language);
		if (!content) {
			if (waitingRunId !== null) this.setState(PlaybackState.IDLE);
			return;
		}
		const runId = waitingRunId ?? this.beginRun(owner);
		if (options.rate !== undefined) {
			await this.applyRunRate(options.rate);
			if (runId !== this.speakRunId) return;
		}
		await this.speakContent(content.text, content.options, runId);
	}

	/**
	 * Sets the rate a run starts at, after any rate write in flight. The run has
	 * no playback yet, so nothing restarts.
	 */
	private async applyRunRate(rate: number): Promise<void> {
		await this.playbackRateWriteQueue;
		const nextRate = this.normalizePlaybackRate(rate);
		const currentRate = this.normalizePlaybackRate(
			Number(this.ttsConfig.rate ?? 1),
		);
		if (nextRate === currentRate) return;
		await this.updateSettings({ rate: nextRate });
	}

	/**
	 * Suppression is read from the live ancestors of what is read, because the
	 * element carrying it may sit above the content root.
	 */
	private isSuppressedTarget(node: Node): boolean {
		if (!isNodeSuppressedForTTS(node)) return false;
		console.warn(
			"[tts] the content to read lies inside content marked not-to-be-spoken; nothing was spoken.",
		);
		return true;
	}

	private resolveElementTarget(
		root: Element,
		options: SpeakOptions,
		language: { contentLanguage?: string; locale: string },
	): { text: string; options: SpeakContentOptions } | null {
		if (this.isSuppressedTarget(root)) return null;
		const contentOptions: SpeakContentOptions = {
			catalogId: options.catalogId,
			catalogContext: options.catalogContext,
			language: language.locale,
			contentLanguage: language.contentLanguage,
			contentElement: root,
		};
		// Math-aware, so an element holding only an equation still reads; a spoken
		// card reads for content with no text, an image among them.
		const text = collectMathAwareTextAndMap(
			root,
			this.getTextProcessingOptions(language.locale),
		).visibleText.trim();
		if (!text && !this.holdsSpokenCard(root, contentOptions)) {
			console.warn(
				"[tts] the content to read holds no speakable text; nothing was spoken.",
			);
			return null;
		}
		return { text, options: contentOptions };
	}

	/** Whether the root's card, or a card of a node inside it, would be read. */
	private holdsSpokenCard(root: Element, options: SpeakContentOptions): boolean {
		if (!this.catalogResolver) return false;
		if (options.catalogId) {
			const card = this.catalogResolver.getAlternative(options.catalogId, {
				type: "spoken",
				language: options.language,
				useFallback: true,
				context: options.catalogContext,
				form: "content",
			});
			if (card?.content !== undefined) return true;
		}
		return this.collectCatalogSpeechChunks(root, options).some(
			(chunk) => chunk.sourceElement,
		);
	}

	private resolveRangeTarget(
		range: Range,
		options: SpeakOptions,
		language: { contentLanguage?: string; locale: string },
	): { text: string; options: SpeakContentOptions } | null {
		if (this.isSuppressedTarget(range.commonAncestorContainer)) return null;
		// Highlighting stays scoped to the content root when one is named, else to
		// the selection's nearest element.
		const ancestor = range.commonAncestorContainer;
		const root =
			options.contentRoot ||
			(ancestor.nodeType === Node.ELEMENT_NODE
				? (ancestor as Element)
				: composedParentElement(ancestor));
		if (!root) return null;

		const selected = collectRangeTextForSpeech(range, root);
		const selectedText = selected.text.trim();
		if (!selectedText) {
			if (selected.filtered) {
				console.warn(
					"[tts] every part of the selection is either hidden or marked not-to-be-spoken; nothing was spoken.",
				);
			}
			return null;
		}

		// The spoken text and its offset come from the root's visible-text map, which
		// the highlight position map and the structural speech plan index too. Joined
		// from raw text nodes instead, a selection loses the space the map inserts
		// between blocks, and every offset after that boundary drifts.
		const mapped = this.selectMappedRangeText(range, root, language.locale);
		let text = selectedText;
		let offset = mapped?.offset ?? 0;
		if (mapped) {
			text = mapped.text;
		} else {
			// Filtered the same way as the speech itself: the offset indexes into the
			// highlight text, which comes from the exclusion-aware collectors.
			const beforeRange = document.createRange();
			beforeRange.selectNodeContents(root);
			beforeRange.setEnd(range.startContainer, range.startOffset);
			const textBeforeRange = collectRangeTextForSpeech(beforeRange, root).text;
			const normalizedTextBeforeRange = normalizeTextForSpeech(textBeforeRange);
			offset =
				normalizedTextBeforeRange.length +
				(/\s$/.test(textBeforeRange) && normalizedTextBeforeRange ? 1 : 0);
		}

		logger.debug("selection offset calculation:", {
			selectedText: text,
			mapped: !!mapped,
			offset,
			rootTag: root.tagName,
		});

		return {
			text,
			options: {
				// The root's card reads only when the selection holds all of the root.
				catalogId:
					options.catalogId && rangeHoldsSpeakableElement(range, root, root)
						? options.catalogId
						: undefined,
				catalogContext: options.catalogContext,
				language: language.locale,
				contentLanguage: language.contentLanguage,
				contentElement: root,
				contentRange: range,
				wordBoundaryOffset: offset,
			},
		};
	}

	private async speakContent(
		text: string,
		options: SpeakContentOptions,
		runId: number,
	): Promise<void> {
		let playbackStartBarrier: (() => void) | null = null;
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
			const highlightMode = speechMatchesVisibleText
				? this.resolveHighlightMode()
				: "sentence";
			this.activeHighlightMode = highlightMode;
			this.activeWordBoundaryOffset = options?.wordBoundaryOffset || 0;
			const hasExplicitBreaks = this.hasExplicitBreakSemantics(contentToSpeak);
			const shouldUsePlan =
				!!this.currentContentElement &&
				!usedCatalogSpoken &&
				!hasExplicitBreaks &&
				speechMatchesVisibleText;
			this.playbackChunks = speechChunks?.length ? speechChunks : [];
			this.seekSegments = this.playbackChunks.length
				? this.createSeekSegmentsFromSpeechChunks(this.playbackChunks)
				: hasExplicitBreaks || !speechMatchesVisibleText
					? []
					: shouldUsePlan && this.currentContentElement
						? this.createSpeechPlan(
								this.currentContentElement,
								normalizedText,
								options?.wordBoundaryOffset || 0,
								options?.language,
							)
						: this.createSeekSegmentsFromText(highlightText);
			this.sentenceHighlightSegments = hasExplicitBreaks
				? []
				: this.createSentenceHighlightSegments({
						contentToSpeak: highlightText,
						shouldUsePlan,
						playbackSegments: this.seekSegments,
					});
			playbackStartBarrier = this.installPlaybackStartBarrier(
				runId,
				!!this.playbackChunks[0]?.audio,
			);
			this.prepareHighlightsForSpeak({
				contentToSpeak: highlightText,
				options,
				highlightMode,
				shouldUsePlan,
				runId,
			});

			if (speechMatchesVisibleText) {
				this.configureWordBoundaryHighlighting({
					highlightMode,
					wordBoundaryOffset: options?.wordBoundaryOffset || 0,
				});
			} else {
				this.clearWordBoundaryHighlighting();
			}
			if (!playbackStartBarrier) this.markPlaying();
			this.activePlaybackRate = this.normalizePlaybackRate(
				Number(this.ttsConfig.rate ?? 1),
			);
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
			// A superseded run's failure is the abort that superseded it.
			if (runId !== this.speakRunId) return;
			console.error("TTS error:", error);
			this.lastError = error instanceof Error ? error.message : String(error);
			this.setState(PlaybackState.ERROR);
			this.clearHighlightsAndTracking();
			throw error;
		} finally {
			this.clearPlaybackStartBarrier(playbackStartBarrier);
		}
	}

	/**
	 * Hand the read's language to the provider. A read in a named content language
	 * sets the provider's locales and `contentLanguage` to it, so a browser voice
	 * follows it; a read naming none restores the host's locales and clears
	 * `contentLanguage`, so the browser voice follows the browser's language.
	 */
	private async applyLanguageSettings(
		options: SpeakContentOptions,
	): Promise<void> {
		if (!this.provider) return;
		this.readLocale = options.language;
		const named = options.contentLanguage;
		const providerOptions = this.providerOptions();
		const next = {
			locale: named ?? this.hostLocales.locale,
			textNormalization: named ?? this.hostLocales.textNormalization,
			segmenter: named ?? this.hostLocales.segmenter,
		};
		if (
			providerOptions.contentLanguage === named &&
			optionalString(providerOptions.locale) === next.locale &&
			optionalString(providerOptions.textNormalization?.locale) ===
				next.textNormalization &&
			optionalString(providerOptions.segmenter?.locale) === next.segmenter
		) {
			return;
		}
		// Every key is set, undefined included: providers merge options shallowly.
		const mergedProviderOptions: ToolkitTTSProviderOptions = {
			...providerOptions,
			locale: next.locale,
			textNormalization: {
				...providerOptions.textNormalization,
				locale: next.textNormalization,
			},
			segmenter: { ...providerOptions.segmenter, locale: next.segmenter },
			contentLanguage: named,
		};
		this.ttsConfig = {
			...this.ttsConfig,
			providerOptions: mergedProviderOptions,
		};
		await this.provider.updateSettings({
			providerOptions: mergedProviderOptions,
		});
	}

	private async resolveSpeechContent(
		text: string,
		options: SpeakContentOptions,
	): Promise<ResolvedSpeechContent> {
		const normalizedInputText = normalizeTextForSpeech(text);
		if (options.catalogId && this.catalogResolver) {
			const catalogContent = this.catalogResolver.getAlternative(
				options.catalogId,
				{
					type: "spoken",
					language: options.language,
					useFallback: true,
					context: options.catalogContext,
					form: "content",
				},
			);
			// A card with no string form has nothing to speak — a signing card, for
			// instance. Fall through to generated TTS rather than speaking "".
			const spokenText = catalogContent?.content;
			if (catalogContent && spokenText !== undefined) {
				const visibleText =
					collectMathAwareTextAndMap(
						options.contentElement,
						this.getTextProcessingOptions(options.language),
					).visibleText || normalizedInputText;
				const normalizedCatalogText = normalizeTextForSpeech(spokenText);
				logger.debug(
					`Using catalog content for "${options.catalogId}" (${catalogContent.language})`,
				);
				return {
					contentToSpeak: spokenText,
					speechText: spokenText,
					visibleText,
					highlightText: visibleText,
					usedCatalogSpoken: true,
					speechSource: "catalog-spoken",
					normalizedText: visibleText,
					containsMathMarkup: false,
					speechMatchesVisibleText: normalizedCatalogText === visibleText,
				};
			}
			logger.debug(
				`No catalog found for "${options.catalogId}", falling back to generated TTS`,
			);
		}

		const composed = this.resolveCatalogComposedSpeechContent(
			options.contentElement,
			normalizedInputText,
			options,
		);
		if (composed) return composed;
		const generated = await this.resolveGeneratedSpeechContent(
			options.contentElement,
			normalizedInputText,
			options.language,
			options.contentRange,
		);
		return {
			...generated,
			usedCatalogSpoken: false,
			speechSource: "dom-or-input",
		};
	}

	private resolveCatalogComposedSpeechContent(
		contentElement: Element,
		normalizedInputText: string,
		options: SpeakContentOptions,
	): ResolvedSpeechContent | null {
		if (!this.catalogResolver) return null;
		const chunks = this.collectCatalogSpeechChunks(contentElement, options);
		if (!chunks.some((chunk) => chunk.sourceElement)) return null;
		const speechText = normalizeTextForSpeech(
			chunks.map((chunk) => chunk.speechText).join(" "),
		);
		// A selection's visible text is the text it holds, which the caller passes:
		// the highlight offsets index it from `wordBoundaryOffset`.
		const visibleText = options.contentRange
			? normalizedInputText
			: collectMathAwareTextAndMap(
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
		options: SpeakContentOptions,
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
		// A docked node's spoken alternate can be a reading script, a recording, or
		// both — the last being APIP's pattern, which QTI's migration guidance
		// keeps because the script is the recording's fallback.
		type SpokenAlternate = { script?: string; audio?: SpokenAudioMedia };
		const range = options.contentRange;
		const resolveCatalog = (element: Element): SpokenAlternate | null => {
			const catalogIdRef = element.getAttribute("data-catalog-idref");
			if (!catalogIdRef) return null;
			// A card reads its whole node, so it stands in for a selection's part of
			// the node only when the selection holds all of it. A part reads as the
			// visible text selected.
			if (range && !rangeHoldsSpeakableElement(range, element, root)) {
				return null;
			}
			const lookup = {
				type: "spoken",
				// The node's own language first: a `lang` inside the read content
				// names the language of the part it marks.
				language: findLangAttribute(element, root) || options.language,
				useFallback: true,
				context: options.catalogContext,
			} as const;
			// Two lookups rather than one, because `form` is a preference: asking for
			// the payload form happily returns a script card when no recording
			// exists, so the answer has to be checked rather than assumed.
			const audioCard = this.catalogResolver!.getAlternative(catalogIdRef, {
				...lookup,
				form: "payload",
			});
			const audio = audioCard?.payload
				? (resolveSpokenAudioMedia({ payload: audioCard.payload }) ?? undefined)
				: undefined;
			const scriptCard = this.catalogResolver!.getAlternative(catalogIdRef, {
				...lookup,
				form: "content",
			});
			// Only a card with a string form can contribute synthesized speech. The
			// same docking node may also carry a signing card; that one is not ours.
			const script = scriptCard?.content;
			if (audio === undefined && script === undefined) return null;
			return { script, audio };
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
			const mathElements = flatQuerySelectorAll(element, "math");
			if (element.localName?.toLowerCase() === "math") {
				return [element, ...mathElements];
			}
			return mathElements;
		};
		const visit = (node: Node) => {
			// Before `resolveCatalog`, so suppression beats an authored `spoken`
			// card on the same node: the card says how to speak this content, the
			// suppression says it must not be spoken at all.
			if (isNodeExcludedFromSpeech(node, root)) return;
			if (node.nodeType === Node.TEXT_NODE) {
				if (!range) {
					textBuffer += ` ${node.textContent || ""}`;
				} else if (rangeIntersectsComposedNode(range, node)) {
					textBuffer += ` ${textInRange(node as Text, range)}`;
				}
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
					normalizeTextForSpeech(flatTextContent(element));
				const regionElement = resolveReadableRegion(element, root);
				// The script chunk, when there is a script. Built exactly as before,
				// and it doubles as the recording's fallback: word-level alignment is
				// only meaningful for the synthesized path, which is the one that runs
				// if the audio cannot play.
				const scriptChunk =
					catalog.script !== undefined
						? (() => {
								const script = catalog.script as string;
								const alignment = createCatalogSpanAlignment({
									speechText: script,
									visibleText,
								});
								const mathElement = getSingleMathElementForAlignment(
									element,
									visibleText,
								);
								const mathAlignment = mathElement
									? createMathAwareAlignment({
											mathElement,
											speechText: script,
										})
									: undefined;
								const mathAlignments = mathAlignment
									? undefined
									: getMathElementsForAlignment(element).map((candidate) => ({
											element: candidate,
											alignment: createMathAwareAlignment({
												mathElement: candidate,
												speechText: script,
											}),
										}));
								return {
									speechText: script,
									visibleText,
									sourceElement: element,
									regionElement,
									speechMatchesVisibleText:
										normalizeTextForSpeech(script) === visibleText,
									playbackMode: alignment.playbackMode,
									alignment,
									mathAlignment,
									mathAlignments,
									visibleMap: collectedVisible.map,
								} satisfies SpeechCompositionChunk;
							})()
						: null;
				if (catalog.audio) {
					chunks.push(
						scriptChunk
							? {
									...scriptChunk,
									audio: catalog.audio,
									plainFallback: scriptChunk,
								}
							: {
									// No script to fall back to, and nothing synthesizes the
									// recording's words, so `speechText` exists only to keep seek
									// and offset bookkeeping consistent with the visible text.
									speechText: visibleText,
									visibleText,
									sourceElement: element,
									regionElement,
									speechMatchesVisibleText: false,
									visibleMap: collectedVisible.map,
									audio: catalog.audio,
								},
					);
					return;
				}
				if (scriptChunk) chunks.push(scriptChunk);
				return;
			}
			for (const child of flatTreeChildNodes(element)) {
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
		return provider.getCapabilities?.().supportsSSML ? "ssml" : "plain";
	}

	/**
	 * With `range`, the selection only: an equation it holds whole reads as math
	 * speech, and a selection without one reads the selected text, `normalizedInputText`.
	 */
	private async resolveGeneratedSpeechContent(
		contentElement: Element,
		normalizedInputText: string,
		language: string,
		range?: Range,
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
			range,
			language,
			mathSpeech: this.getMathSpeechOptions(),
			textProcessingOptions: this.getTextProcessingOptions(language),
			produceSsml: playbackFormat === "ssml",
			resolveMathSpeech: this.generatedMathSpeechResolver,
		});
		if (!containsMathMarkup) {
			// The input text is the selection's text in the root's visible-text map,
			// which its highlight offsets index.
			const visibleText = range
				? normalizedInputText
				: collectedVisibleText || normalizedInputText;
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
		const visibleText = collectedVisibleText || normalizedInputText;
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
		logger.debug("Speak resolved content", {
			source: args.speechSource,
			catalogId: args.catalogId || null,
			length: args.contentToSpeak.length,
			preview,
		});
	}

	private initializeSpeakTracking(
		contentToSpeak: string,
		options: SpeakContentOptions,
	): void {
		this.currentText = contentToSpeak;
		this.currentContentElement = options.contentElement;
		this.lastError = null;
		this.currentBoundaryOffset = 0;
		this.playbackChunks = [];
		this.activeSentenceStartOffset = null;
	}

	private prepareHighlightsForSpeak(args: {
		contentToSpeak: string;
		options: SpeakContentOptions;
		highlightMode: HighlightMode;
		shouldUsePlan: boolean;
		runId: number;
	}): void {
		if (!this.currentContentElement || !this.highlightCoordinator) return;
		this.buildPositionMap(
			this.currentContentElement,
			args.contentToSpeak,
			args.options.language,
		);
		if (args.highlightMode === "sentence" && args.shouldUsePlan) {
			return;
		}
		const initialSegment =
			this.sentenceHighlightSegments[0] || this.seekSegments[0];
		this.runWhenPlaybackStarts(args.runId, () => {
			if (initialSegment) {
				this.highlightSentenceSegment(
					initialSegment.startOffset,
					initialSegment.text,
				);
				logger.debug("Applied initial sentence highlighting");
			} else {
				try {
					const range = document.createRange();
					range.selectNodeContents(this.currentContentElement!);
					this.paintTTSSentenceRanges([range]);
				} catch {
					// No-op fallback when DOM range creation fails.
				}
			}
		});
	}

	private configureWordBoundaryHighlighting(args: {
		highlightMode: HighlightMode;
		wordBoundaryOffset: number;
	}): void {
		if (!this.provider) return;
		// A sentence-mode read paints no words, so it takes no word boundaries.
		if (args.highlightMode === "sentence") {
			this.provider.onWordBoundary = undefined;
			return;
		}
		if (!this.highlightCoordinator || !this.currentContentElement) return;
		// Browser boundaries and the server provider's time-scaled boundaries index
		// the same spoken text.
		this.provider.onWordBoundary = (
			word: string,
			charIndex: number,
			length?: number,
		) => {
			const wordLength = length || word.length;
			const spokenIndex = charIndex + this.currentBoundaryOffset;
			const globalIndex = spokenIndex + args.wordBoundaryOffset;
			this.highlightSentenceForOffset(spokenIndex);
			const ranges = createRangesFromVisibleMap(
				this.normalizedToDOM,
				globalIndex,
				globalIndex + wordLength,
			);
			if (ranges.length === 0) {
				logger.debug(
					`no text at position ${globalIndex}, length ${wordLength}, to highlight`,
				);
				return;
			}
			logger.debug(
				`Highlighting "${ranges.join("")}" (word: "${word}") at position ${globalIndex}`,
			);
			this.paintTTSWord(ranges);
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
				const ranges = createRangesFromVisibleMap(
					chunk.visibleMap,
					0,
					chunk.visibleText.length,
				);
				this.highlightCoordinator.clearTTSWord();
				this.paintTTSSentenceRanges(
					ranges.length > 1 ? ranges : [chunk.regionRange],
				);
				return;
			}
			if (!element) return;
			const range = document.createRange();
			range.selectNodeContents(element);
			this.highlightCoordinator.clearTTSWord();
			this.paintTTSSentenceRanges([range]);
		} catch {
			// Continue playback even when a detached node cannot be highlighted.
		}
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
		if (
			!this.highlightTargetResolverProvider &&
			sameRenderableHighlightTarget(this.lastRenderedRegionTarget, target)
		) {
			return;
		}
		try {
			const range = document.createRange();
			if (target.type === "element") {
				range.selectNodeContents(target.element);
			} else if (target.type === "range") {
				this.paintTTSSentenceRanges(target.ranges ?? [target.range]);
				this.lastRenderedRegionTarget = target;
				return;
			} else {
				range.setStart(target.node, target.startOffset);
				range.setEnd(target.node, target.endOffset);
			}
			this.paintTTSSentenceRanges([range]);
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
			this.highlightCoordinator.clearTTSWord();
			return;
		}
		if (target.type === "text-range") {
			const nativeRange = this.createTextRange(
				target.node,
				target.startOffset,
				target.endOffset,
			);
			if (nativeRange) this.paintTTSWord([nativeRange]);
			return;
		}
		if (target.type === "range") {
			this.paintTTSWord(target.ranges ?? [target.range]);
			return;
		}
		const elementNativeRange = document.createRange();
		elementNativeRange.selectNodeContents(target.element);
		const resolvedElementRange =
			this.resolveWordHighlightRange(elementNativeRange);
		if (resolvedElementRange.remapped) {
			this.highlightCoordinator.highlightTTSWord([resolvedElementRange.range]);
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
			const tokenRange = document.createRange();
			tokenRange.selectNodeContents(onlyChild);
			this.highlightCoordinator.highlightTTSWord([tokenRange]);
			return;
		}
		this.highlightCoordinator.highlightTTSWordElement(target.element);
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
				logger.debug("SSML chunk speak failed; retrying plain text", {
					message: error instanceof Error ? error.message : String(error),
				});
				// A recorded-first run can own the start barrier even when its fallback
				// provider has no formal start signal. Drop the failed recording's queued
				// highlight and resume that non-start-aware provider's immediate-start lifecycle.
				if (
					this.playbackStartDeferredRunId === runId &&
					this.provider &&
					!("onPlaybackStart" in this.provider)
				) {
					this.pendingPlaybackStartHighlights = [];
					this.clearPlaybackStartBarrier();
					this.markPlaying();
				}
				await this.speakCatalogChunkOnce(chunk.plainFallback, runId);
				return;
			}
			throw error;
		}
	}

	/**
	 * Play a recorded spoken alternate, resolving when it finishes.
	 *
	 * Rejects if the clip cannot play, which is what routes playback to the
	 * chunk's `plainFallback` — the reading script — in `speakCatalogChunk`.
	 * Highlighting is the docked node as a block for the clip's duration: a
	 * recording emits no word boundaries, and inventing them from its duration
	 * would highlight the wrong words confidently rather than the right region
	 * vaguely.
	 */
	private async playRecordedAudio(
		media: SpokenAudioMedia,
		onPlaybackStart?: () => void,
	): Promise<void> {
		if (typeof document === "undefined") {
			throw new Error("[tts] no document available to play recorded audio");
		}
		const source = media.sources[0];
		const element = document.createElement("audio");
		element.preload = "auto";
		element.src = applyMediaFragment(source.src, media.fragment);
		element.playbackRate = this.normalizePlaybackRate(
			Number(this.ttsConfig.rate || 1),
		);
		await new Promise<void>((resolve, reject) => {
			let disposeFragment: (() => void) | undefined;
			let didStart = false;
			let settled = false;
			const markStarted = () => {
				if (settled || didStart) return;
				didStart = true;
				onPlaybackStart?.();
			};
			const cleanup = () => {
				element.removeEventListener("ended", onEnded);
				element.removeEventListener("error", onError);
				element.removeEventListener("playing", markStarted);
				disposeFragment?.();
				if (this.activeRecordedAudio?.element === element) {
					this.activeRecordedAudio = null;
				}
			};
			const onEnded = () => {
				if (settled) return;
				settled = true;
				cleanup();
				resolve();
			};
			const onError = () => {
				if (settled) return;
				settled = true;
				cleanup();
				reject(new Error(`[tts] recorded audio failed to play: ${source.src}`));
			};
			// A pause before the clip starts rejects its play with an AbortError;
			// resume plays it, so that rejection is no failure of the clip.
			const play = () => {
				Promise.resolve(element.play())
					.then(markStarted)
					.catch((error: unknown) => {
						const aborted =
							(error as { name?: unknown } | null)?.name === "AbortError";
						if (aborted && this.state === PlaybackState.PAUSED) return;
						onError();
					});
			};
			// Cancellation has to settle this promise, not just stop the element:
			// `stop()` bumps the run id, and a pending play that never resolves would
			// wedge the chunk loop on a run nobody is listening to any more.
			this.activeRecordedAudio = {
				element,
				cancel: () => {
					if (settled) return;
					settled = true;
					cleanup();
					element.pause();
					resolve();
				},
				play,
			};
			element.addEventListener("ended", onEnded);
			element.addEventListener("error", onError);
			element.addEventListener("playing", markStarted);
			// Reaching the slice's end is this clip finishing, so the chunk sequence
			// advances rather than the element merely pausing.
			disposeFragment = enforceMediaFragment(element, media.fragment, onEnded);
			play();
		}).finally(() => {
			if (this.activeRecordedAudio?.element === element) {
				this.activeRecordedAudio = null;
			}
			element.pause();
			element.removeAttribute("src");
		});
	}

	private cancelRecordedAudio(): void {
		const active = this.activeRecordedAudio;
		if (!active) return;
		this.activeRecordedAudio = null;
		active.cancel();
	}

	private async speakCatalogChunkOnce(
		chunk: SpeechCompositionChunk,
		runId: number,
	): Promise<void> {
		if (!this.provider) return;
		this.lastRenderedRegionTarget = null;
		if (chunk.audio) {
			this.runWhenPlaybackStarts(runId, () => {
				this.highlightCatalogRegion(chunk);
			});
			await this.playRecordedAudio(chunk.audio, () => {
				this.notifyPlaybackStarted(runId);
			});
			return;
		}
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
		this.runWhenPlaybackStarts(runId, () => {
			if (highlightPlan && pipelineChunk && chunk.mathAlignment) {
				this.renderHighlightDecision(
					highlightPlan.resolveInitial(pipelineChunk.id),
				);
			} else {
				this.highlightCatalogRegion(chunk);
			}
		});
		// A sentence-mode read takes no word boundaries, aligned chunk or not.
		const canUseChunkBoundaries =
			this.resolveHighlightMode() === "word" &&
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
				await this.speakWithinLimit(chunk.speechText, runId);
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
			await this.speakWithinLimit(chunk.speechText, runId);
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
			for (let index = 0; index < args.speechChunks.length; index++) {
				await this.waitWhilePaused(args.runId);
				if (args.runId !== this.speakRunId) return;
				const segment = this.seekSegments[index];
				if (segment) {
					this.currentBoundaryOffset = segment.startOffset;
				}
				const chunk = args.speechChunks[index];
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
			} else {
				await this.speakWithinLimit(args.contentToSpeak, args.runId);
			}
			return;
		}
		await this.speakWithinLimit(args.contentToSpeak, args.runId);
	}

	private clearHighlightsAndTracking(): void {
		// A finished run leaves no handler for the next read to inherit.
		this.clearWordBoundaryHighlighting();
		this.pendingPlaybackStartHighlights = [];
		this.activePlaybackRate = null;
		if (this.highlightCoordinator) {
			this.highlightCoordinator.clearTTS();
		}
		this.lastRenderedRegionTarget = null;
		this.currentContentElement = null;
		this.normalizedToDOM.clear();
		this.currentBoundaryOffset = 0;
		this.activeWordBoundaryOffset = 0;
		this.seekSegments = [];
		this.playbackChunks = [];
		this.sentenceHighlightSegments = [];
		this.activeSentenceStartOffset = null;
	}

	/**
	 * The selected part of `root`'s normalized visible text and where it starts, or
	 * null when the map is unavailable or holds no selected character.
	 */
	private selectMappedRangeText(
		range: Range,
		root: Element,
		language: string,
	): { text: string; offset: number } | null {
		if (typeof range.comparePoint !== "function") return null;
		const { text: rootText, map } = collectVisibleTextAndMap(
			root,
			this.getTextProcessingOptions(language),
		);
		let start = -1;
		let end = -1;
		for (const [index, { node, offset }] of map) {
			if (index >= rootText.length) continue;
			if (!rangeHoldsTextPosition(range, node, offset)) continue;
			if (start === -1 || index < start) start = index;
			if (index > end) end = index;
		}
		if (start === -1) return null;
		const raw = rootText.slice(start, end + 1);
		const leading = raw.length - raw.trimStart().length;
		const text = raw.trim();
		return text ? { text, offset: start + leading } : null;
	}

	/**
	 * Pause playback. A pause while the read is loading holds it: its audio does
	 * not start until {@link resume}.
	 */
	pause(): void {
		if (
			this.state !== PlaybackState.PLAYING &&
			this.state !== PlaybackState.LOADING
		) {
			return;
		}
		this.resumeState = this.state;
		this.activeRecordedAudio?.element.pause();
		this.provider?.pause();
		// Between two parts, nothing is playing to pause: the run holds before
		// its next part instead.
		this.setState(PlaybackState.PAUSED);
	}

	/**
	 * Resume playback, back to loading when the pause came before the audio
	 * started.
	 */
	resume(): void {
		if (this.state !== PlaybackState.PAUSED) return;
		// State first: audio that starts during resume reports into it.
		this.setState(this.resumeState);
		this.activeRecordedAudio?.play();
		this.provider?.resume();
		this.releasePauseHold();
	}

	private normalizePlaybackRate(rate: number): number {
		if (!Number.isFinite(rate)) return 1;
		return Math.max(0.25, Math.min(4, rate));
	}

	private async restartFromSeekIndex(targetIndex: number): Promise<void> {
		if (!this.provider || this.seekSegments.length === 0) return;
		const safeTargetIndex = Math.max(
			0,
			Math.min(this.seekSegments.length - 1, targetIndex),
		);
		const restartChunks = this.playbackChunks.length
			? this.playbackChunks.slice(safeTargetIndex)
			: null;

		// A seek under a pause moves the cursor and stays paused: the restarted
		// run holds before its first part until resume.
		const holdPaused = this.state === PlaybackState.PAUSED;
		this.speakRunId += 1;
		this.abandonRun();
		this.provider.onWordBoundary = undefined;
		this.provider.stop();
		const runId = ++this.speakRunId;
		const restartSegments = this.seekSegments.slice(safeTargetIndex);
		this.highlightCoordinator?.clearTTS();
		this.activeSentenceStartOffset = null;
		this.currentBoundaryOffset = this.seekSegments[safeTargetIndex].startOffset;

		if (!holdPaused) this.setState(PlaybackState.LOADING);
		const playbackStartBarrier = this.installPlaybackStartBarrier(
			runId,
			!!restartChunks?.[0]?.audio,
		);
		if (holdPaused) {
			this.resumeState = playbackStartBarrier
				? PlaybackState.LOADING
				: PlaybackState.PLAYING;
		} else if (!playbackStartBarrier) {
			this.setState(PlaybackState.PLAYING);
		}
		this.activePlaybackRate = this.normalizePlaybackRate(
			Number(this.ttsConfig.rate ?? 1),
		);
		try {
			this.configureWordBoundaryHighlighting({
				highlightMode: this.activeHighlightMode,
				wordBoundaryOffset: this.activeWordBoundaryOffset,
			});
			if (restartChunks) {
				for (let index = 0; index < restartChunks.length; index++) {
					await this.waitWhilePaused(runId);
					if (runId !== this.speakRunId) return;
					const absoluteIndex = safeTargetIndex + index;
					const segment = this.seekSegments[absoluteIndex];
					if (segment) {
						this.currentBoundaryOffset = segment.startOffset;
					}
					await this.speakCatalogChunk(restartChunks[index], runId);
				}
			} else {
				await this.speakWithPlan(restartSegments, runId, {
					highlightMode: this.activeHighlightMode,
				});
			}
			if (runId !== this.speakRunId) return;
			this.setState(PlaybackState.IDLE);
			this.clearHighlightsAndTracking();
		} catch (error) {
			// A superseded run's failure is the abort that superseded it.
			if (runId !== this.speakRunId) {
				logger.debug("Superseded seek restart failed:", error);
				return;
			}
			this.lastError = error instanceof Error ? error.message : String(error);
			this.setState(PlaybackState.ERROR);
			this.clearHighlightsAndTracking();
			throw error;
		} finally {
			this.clearPlaybackStartBarrier(playbackStartBarrier);
		}
	}

	async setPlaybackRate(rate: number): Promise<void> {
		if (!this.provider) {
			throw new Error("TTSService not initialized. Call initialize() first.");
		}
		const nextRate = this.normalizePlaybackRate(rate);
		const pendingRequest = this.pendingPlaybackRateRequest;
		if (pendingRequest?.rate === nextRate) {
			await pendingRequest.promise;
			return;
		}

		const requestId = ++this.playbackRateRequestId;
		const settingsWrite = this.playbackRateWriteQueue.then(async () => {
			const playbackRunId = this.speakRunId;
			// A newer distinct target supersedes queued work before it mutates either
			// provider settings or playback. An already-running write cannot be
			// cancelled, so its post-write generation check still suppresses restart.
			if (requestId !== this.playbackRateRequestId) {
				return { didUpdate: false, playbackRunId };
			}
			// An omitted rate is the provider-default 1× rate. Re-check inside the
			// serialized operation so overlapping callers observe the preceding write.
			const currentRate = this.normalizePlaybackRate(
				Number(this.ttsConfig.rate ?? 1),
			);
			if (nextRate === currentRate) {
				return { didUpdate: false, playbackRunId };
			}
			await this.updateSettings({ rate: nextRate });
			return { didUpdate: true, playbackRunId };
		});
		this.playbackRateWriteQueue = settingsWrite.then(
			() => undefined,
			() => undefined,
		);

		const operation = settingsWrite.then(async (result) => {
			if (
				requestId !== this.playbackRateRequestId ||
				result.playbackRunId !== this.speakRunId
			) {
				return;
			}
			const activePlaybackNeedsRate =
				this.activePlaybackRate !== null &&
				this.activePlaybackRate !== nextRate;
			if (!result.didUpdate && !activePlaybackNeedsRate) return;
			if (
				(this.state !== PlaybackState.PLAYING &&
					this.state !== PlaybackState.LOADING) ||
				!this.currentText ||
				this.seekSegments.length === 0 ||
				this.hasExplicitBreakSemantics(this.currentText)
			) {
				return;
			}
			await this.restartFromSeekIndex(this.getCurrentSeekSegmentIndex());
		});
		let trackedOperation: Promise<void>;
		trackedOperation = operation.finally(() => {
			if (this.pendingPlaybackRateRequest?.promise === trackedOperation) {
				this.pendingPlaybackRateRequest = null;
			}
		});
		this.pendingPlaybackRateRequest = {
			rate: nextRate,
			promise: trackedOperation,
		};
		await trackedOperation;
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

		await this.restartFromSeekIndex(targetIndex);
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
	 * Stop playback and release the run owner. A run that ends on its own keeps
	 * its owner, so the owning control can replay it.
	 */
	stop(): void {
		this.speakRunId += 1;
		this.abandonRun();
		this.provider?.stop();
		this.clearHighlightsAndTracking();
		this.currentText = null;
		// Announced even from idle, so a listener sees the owner released.
		const releasedOwner = this.runOwner !== null;
		this.runOwner = null;
		this.setState(PlaybackState.IDLE, releasedOwner);
	}

	/**
	 * Stop playback and drop the provider, whose owner destroys it. A later speak
	 * waits on the readiness gate, as before the first {@link initialize}.
	 */
	releaseProvider(): void {
		this.stop();
		this.provider = null;
		this.currentProvider = null;
	}

	/**
	 * Stop, release the provider and drop every listener, hook and pending timer.
	 * A disposed service cannot speak or be initialized again.
	 */
	dispose(): void {
		if (this.disposed) return;
		this.releaseProvider();
		this.disposed = true;
		this.speakRunId += 1;
		this.abandonRun();
		this.playbackRateRequestId += 1;
		this.pendingPlaybackRateRequest = null;
		this.listeners.clear();
		this.readinessGate = null;
		this.mathSpeechSource = null;
		this.highlightTargetResolverProvider = null;
		this.highlightCoordinator = null;
		this.catalogResolver = null;
		this.telemetryReporter = null;
	}

	/**
	 * Get current state
	 */
	getState(): PlaybackState {
		return this.state;
	}

	getRunOwner(): string | null {
		return this.runOwner;
	}

	/**
	 * Subscribe to playback state changes. The returned function unsubscribes;
	 * each subscription is its own, so the same callback can be subscribed twice.
	 */
	onStateChange(callback: (state: PlaybackState) => void): () => void {
		const listener = (state: PlaybackState) => callback(state);
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Set state and notify listeners
	 */
	private setState(newState: PlaybackState, announceUnchanged = false): void {
		const previousState = this.state;
		if (previousState === newState && !announceUnchanged) return;
		this.state = newState;

		// Notify all listeners
		for (const listener of [...this.listeners]) {
			listener(newState);
		}
		if (previousState === newState) return;

		void this.emitTelemetry("pie-tool-playback-state-changed", {
			toolId: "textToSpeech",
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
				previousState,
				state: newState,
			});
			return;
		}

		if (newState === PlaybackState.PAUSED) {
			void this.emitTelemetry("pie-tool-playback-pause", {
				toolId: "textToSpeech",
				previousState,
				state: newState,
			});
			return;
		}

		if (newState === PlaybackState.ERROR) {
			void this.emitTelemetry("pie-tool-playback-error", {
				toolId: "textToSpeech",
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
				previousState,
				state: newState,
			});
		}
	}
}
