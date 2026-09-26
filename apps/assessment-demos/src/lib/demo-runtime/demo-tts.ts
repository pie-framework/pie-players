/**
 * Text-to-speech for the assessment demos: Polly through the demo server when its
 * credentials are configured, browser speech otherwise.
 */

export type AssessmentDemoTtsBackend = "polly" | "browser";

/** The route the Polly server provider validates when it initializes. */
const POLLY_VOICES_ROUTE = "/api/tts/polly/voices";

/**
 * Settles the backend before the coordinator initializes text-to-speech, so a
 * demo server without Polly credentials gets browser speech and no failed Polly
 * initialization.
 */
export async function resolveAssessmentDemoTtsBackend(
	fetchFn: typeof fetch,
): Promise<AssessmentDemoTtsBackend> {
	try {
		const response = await fetchFn(POLLY_VOICES_ROUTE, {
			cache: "no-store",
			signal: AbortSignal.timeout(5000),
		});
		return response.ok ? "polly" : "browser";
	} catch {
		return "browser";
	}
}

export function assessmentDemoTextToSpeechConfig(
	backend: AssessmentDemoTtsBackend,
) {
	if (backend === "browser") {
		return { enabled: true, backend: "browser" as const };
	}
	return {
		enabled: true,
		backend: "polly" as const,
		serverProvider: "polly" as const,
		apiEndpoint: "/api/tts",
		transportMode: "pie" as const,
		endpointMode: "synthesizePath" as const,
		endpointValidationMode: "voices" as const,
		defaultVoice: "Joanna",
		language: "en-US",
		rate: 1,
		engine: "neural" as const,
		sampleRate: 24000,
		format: "mp3" as const,
		speechMarksMode: "word" as const,
	};
}
