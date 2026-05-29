import type { MathAwareSpeechChunk } from "./math-aware-text-processing.js";
import { normalizeTextForSpeech } from "./text-processing.js";

interface SpeechRuleEngineApi {
	setupEngine?: (options: Record<string, unknown>) => Promise<void> | void;
	engineReady?: () => Promise<void>;
	toSpeech: (mathml: string) => string;
}

export interface ResolveMathSpeechOptions {
	language?: string;
	loadSre?: () => Promise<SpeechRuleEngineApi>;
	/**
	 * Also produce SRE's SSML rendering (markup: "ssml") for the equation, for
	 * the runtime generated-SSML path (PIE-623). Only populated when the input
	 * is a single math chunk and SRE succeeds. The plain `speechText` is always
	 * computed with markup: "none" so the plain path is unaffected.
	 */
	produceSsml?: boolean;
}

export interface ResolvedMathSpeech {
	speechText: string;
	usedMathSpeech: boolean;
	usedFallback: boolean;
	/**
	 * SRE SSML rendering of the equation (a self-contained `<speak>` document),
	 * present only when `produceSsml` was requested for a single math chunk and
	 * SRE produced trackable SSML.
	 */
	ssml?: string;
}

let sreLoadPromise: Promise<SpeechRuleEngineApi> | null = null;

const normalizeLocale = (language?: string): string =>
	(language || "en").split("-")[0].toLowerCase() || "en";

const defaultLoadSre = async (): Promise<SpeechRuleEngineApi> => {
	if (!sreLoadPromise) {
		sreLoadPromise = import("speech-rule-engine").then((module) => {
			const candidate =
				(module as { default?: SpeechRuleEngineApi }).default ||
				(module as unknown as SpeechRuleEngineApi);
			if (!candidate || typeof candidate.toSpeech !== "function") {
				throw new Error("speech-rule-engine did not expose toSpeech");
			}
			return candidate;
		});
	}
	return sreLoadPromise;
};

// SRE's ClearSpeak rule set is English-only; MathSpeak is localized to many more
// locales. Use ClearSpeak for English (highest-quality math prose) and MathSpeak
// elsewhere, so non-English content gets locale-appropriate voicing instead of
// silently falling back to English ClearSpeak rules.
const domainForLocale = (locale: string): string =>
	locale === "en" ? "clearspeak" : "mathspeak";

const setupSre = async (
	sre: SpeechRuleEngineApi,
	language: string | undefined,
	markup: "none" | "ssml",
): Promise<void> => {
	const locale = normalizeLocale(language);
	await sre.setupEngine?.({
		locale,
		domain: domainForLocale(locale),
		modality: "speech",
		markup,
	});
	await sre.engineReady?.();
};

// SRE's SSML rendering wraps the spoken words in highlight-safe structural tags
// (`speak`, `prosody`, `say-as interpret-as="character"`, `break`), all handled
// by `extractSpokenText`, so word-boundary offsets into the raw SSML still map
// back to spoken tokens. SRE also prepends an XML prolog (`<?xml …?>`); AWS
// Polly and Google Cloud TTS reject SSML that does not begin with `<speak>`, so
// we strip the prolog here. The stripped string is the single source of truth:
// it is both what the provider receives and what the alignment tokenizes, so
// offsets stay consistent. We only accept output that contains a `<speak>`
// element, so a bad/empty render degrades to plain text.
const stripXmlProlog = (ssml: string): string =>
	ssml.replace(/^\s*<\?xml[^>]*\?>\s*/i, "");

const generateMathSsml = async (
	sre: SpeechRuleEngineApi,
	mathml: string,
	language?: string,
): Promise<string | null> => {
	try {
		await setupSre(sre, language, "ssml");
		const ssml = stripXmlProlog(sre.toSpeech(mathml));
		return ssml.includes("<speak") ? ssml : null;
	} catch (error) {
		console.debug("[TTSService] Math SSML generation failed; using plain", {
			message: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
};

// English-only normalization: SRE may render a lone italic variable as a single
// lowercase letter ("a"), which an English TTS engine can voice as the article
// "a" rather than the letter name. Upper-casing forces the letter reading. Other
// locales do not share this ambiguity (and may use non-Latin variables), so the
// rewrite is skipped for them.
const normalizeMathVariablePronunciation = (
	speech: string,
	locale: string,
): string =>
	locale === "en"
		? speech.replace(/\b([a-z])\b/g, (match) => match.toUpperCase())
		: speech;

export const resolveMathSpeechFromChunks = async (
	chunks: MathAwareSpeechChunk[],
	options: ResolveMathSpeechOptions = {},
): Promise<ResolvedMathSpeech> => {
	if (!chunks.some((chunk) => chunk.type === "math")) {
		return {
			speechText: normalizeTextForSpeech(
				chunks
					.map((chunk) =>
						chunk.type === "text" ? chunk.text : chunk.fallbackText,
					)
					.join(" "),
			),
			usedMathSpeech: false,
			usedFallback: false,
		};
	}

	let sre: SpeechRuleEngineApi | null = null;
	let setupComplete = false;
	let usedMathSpeech = false;
	let usedFallback = false;
	const loadSre = options.loadSre || defaultLoadSre;
	const locale = normalizeLocale(options.language);
	const speechParts: string[] = [];

	for (const chunk of chunks) {
		if (chunk.type === "text") {
			speechParts.push(chunk.text);
			continue;
		}
		try {
			if (!sre) {
				sre = await loadSre();
			}
			if (!setupComplete) {
				await setupSre(sre, options.language, "none");
				setupComplete = true;
			}
			const speech = normalizeTextForSpeech(
				normalizeMathVariablePronunciation(sre.toSpeech(chunk.mathml), locale),
			);
			if (speech) {
				speechParts.push(speech);
				usedMathSpeech = true;
				continue;
			}
			usedFallback = true;
			speechParts.push(chunk.fallbackText);
		} catch (error) {
			usedFallback = true;
			console.debug(
				"[TTSService] Math speech generation failed; using visible fallback",
				{
					message: error instanceof Error ? error.message : String(error),
				},
			);
			speechParts.push(chunk.fallbackText);
		}
	}

	// Generated-SSML path: only meaningful for a single math chunk (the runtime
	// composes one chunk per equation). Computed after the plain pass so the
	// markup: "none" `speechText` above is unchanged. The "none" → "ssml"
	// engine reconfiguration happens sequentially within this call.
	let ssml: string | undefined;
	if (
		options.produceSsml &&
		sre &&
		usedMathSpeech &&
		chunks.length === 1 &&
		chunks[0].type === "math"
	) {
		const generated = await generateMathSsml(
			sre,
			chunks[0].mathml,
			options.language,
		);
		ssml = generated ?? undefined;
	}

	return {
		speechText: normalizeTextForSpeech(speechParts.join(" ")),
		usedMathSpeech,
		usedFallback,
		ssml,
	};
};
