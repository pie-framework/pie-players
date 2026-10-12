import type { TTSConfig, TTSProviderOptions } from "@pie-players/pie-tts";
import type { SREMathSpeechOptions } from "./math-speech.js";
import type { BoundarySpacingMode } from "./text-processing.js";

/**
 * The provider options the toolkit reads, on top of the ones every provider
 * receives. Hosts configure them as free-form options, so readers still check
 * each value at runtime.
 */
export interface ToolkitTTSProviderOptions extends TTSProviderOptions {
	/**
	 * Highlight words or sentences while reading. Defaults by provider
	 * capability. A playback that sends no word boundaries highlights its
	 * sentence in either mode.
	 */
	highlightMode?: "word" | "sentence";
	/** Locale for text processing; the toolkit sets it per speak. */
	locale?: string;
	/** Speech-rule-engine options for math speech. */
	mathSpeech?: SREMathSpeechOptions;
	/** Sentence and word segmentation of the browser provider. */
	segmenter?: {
		/** `regexOnly` segments without `Intl.Segmenter`. */
		mode?: "regexOnly";
		locale?: string;
	};
	/** Pauses at structural boundaries: `baseMs` scaled by a strength unit, clamped. */
	structuralPauses?: {
		baseMs?: number | string;
		units?: {
			minor?: number | string;
			section?: number | string;
			major?: number | string;
		};
		minMs?: number | string;
		maxMs?: number | string;
	};
	textNormalization?: {
		boundarySpacingMode?: BoundarySpacingMode;
		locale?: string;
	};
}

/** A provider configuration as the toolkit reads it. */
export interface ToolkitTTSConfig extends TTSConfig {
	providerOptions?: ToolkitTTSProviderOptions;
	/**
	 * Highlight math token by token; `false` highlights each formula as one
	 * block. The highlight pipeline reads it, and providers ignore it.
	 *
	 * @default true
	 */
	mathTokenHighlighting?: boolean;
}
