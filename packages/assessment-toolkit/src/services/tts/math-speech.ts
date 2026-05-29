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

const setupSre = async (
	sre: SpeechRuleEngineApi,
	language?: string,
): Promise<void> => {
	await sre.setupEngine?.({
		locale: normalizeLocale(language),
		domain: "clearspeak",
		modality: "speech",
		markup: "none",
	});
	await sre.engineReady?.();
};

const normalizeMathVariablePronunciation = (speech: string): string =>
	speech.replace(/\b([a-z])\b/g, (match) => match.toUpperCase());

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
				normalizeMathVariablePronunciation(sre.toSpeech(chunk.mathml)),
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
