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
}

export interface ResolvedMathSpeech {
	speechText: string;
	usedMathSpeech: boolean;
	usedFallback: boolean;
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
	language?: string,
): Promise<void> => {
	const locale = normalizeLocale(language);
	await sre.setupEngine?.({
		locale,
		domain: domainForLocale(locale),
		modality: "speech",
		markup: "none",
	});
	await sre.engineReady?.();
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
				await setupSre(sre, options.language);
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

	return {
		speechText: normalizeTextForSpeech(speechParts.join(" ")),
		usedMathSpeech,
		usedFallback,
	};
};
