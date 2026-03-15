import { GoogleCloudTTSProvider } from "@pie-players/tts-server-google";
import { PollyServerProvider } from "@pie-players/tts-server-polly";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

type PollyEngine = "neural" | "standard";
type PollyOutputFormat = "mp3" | "ogg" | "pcm";
type PollySpeechMarkType = "word" | "sentence" | "ssml";

const pollyProviders = new Map<PollyEngine, PollyServerProvider>();
let googleProvider: GoogleCloudTTSProvider | null = null;

async function getPollyProvider(engine: PollyEngine): Promise<PollyServerProvider> {
	const existing = pollyProviders.get(engine);
	if (existing) return existing;
	if (
		!process.env.AWS_REGION ||
		!process.env.AWS_ACCESS_KEY_ID ||
		!process.env.AWS_SECRET_ACCESS_KEY
	) {
		throw new Error(
			"AWS credentials not configured. Please set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY in .env file.",
		);
	}
	const provider = new PollyServerProvider();
	const credentials: any = {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	};
	if (process.env.AWS_SESSION_TOKEN) {
		credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
	}
	await provider.initialize({
		region: process.env.AWS_REGION || "us-east-1",
		credentials,
		engine,
		defaultVoice: "Joanna",
	});
	pollyProviders.set(engine, provider);
	return provider;
}

async function getGoogleProvider(): Promise<GoogleCloudTTSProvider> {
	if (googleProvider) return googleProvider;
	const hasApiKey = Boolean(process.env.GOOGLE_API_KEY);
	const hasServiceAccount = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
	if (!hasApiKey && !hasServiceAccount) {
		throw new Error(
			"Google Cloud credentials not configured. Set GOOGLE_API_KEY or GOOGLE_APPLICATION_CREDENTIALS.",
		);
	}
	googleProvider = new GoogleCloudTTSProvider();
	const credentials = hasApiKey
		? { apiKey: process.env.GOOGLE_API_KEY! }
		: process.env.GOOGLE_APPLICATION_CREDENTIALS;
	await googleProvider.initialize({
		projectId: process.env.GOOGLE_CLOUD_PROJECT || "pie-tts-project",
		credentials,
		defaultVoice: "en-US-Wavenet-A",
		voiceType: "wavenet",
	});
	return googleProvider;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const {
			text,
			voice,
			language,
			rate,
			includeSpeechMarks = true,
			provider = "polly",
			engine,
			sampleRate,
			format,
			speechMarkTypes,
		} = body;

		if (!text || typeof text !== "string") {
			throw error(400, { message: "Text is required and must be a string" });
		}
		if (text.length > 3000) {
			throw error(400, { message: "Text too long (max 3000 characters)" });
		}
		if (provider !== "polly" && provider !== "google") {
			throw error(400, {
				message: "Invalid provider. Must be 'polly' or 'google'",
			});
		}

		let result;
		if (provider === "google") {
			const google = await getGoogleProvider();
			result = await google.synthesize({
				text,
				voice: voice || "en-US-Wavenet-A",
				language: language || "en-US",
				rate,
				includeSpeechMarks,
			});
		} else {
			const requestedEngine =
				engine === "standard" || engine === "neural" ? engine : "neural";
			const requestedFormat =
				format === "ogg" || format === "pcm" || format === "mp3"
					? (format as PollyOutputFormat)
					: undefined;
			const requestedSpeechMarkTypes = Array.isArray(speechMarkTypes)
				? speechMarkTypes.filter((entry): entry is PollySpeechMarkType =>
						entry === "word" || entry === "sentence" || entry === "ssml",
					)
				: undefined;
			const polly = await getPollyProvider(requestedEngine);
			result = await polly.synthesize({
				text,
				voice: voice || "Joanna",
				language: language || "en-US",
				rate,
				sampleRate:
					typeof sampleRate === "number" && Number.isFinite(sampleRate)
						? sampleRate
						: undefined,
				format: requestedFormat,
				providerOptions:
					requestedSpeechMarkTypes && requestedSpeechMarkTypes.length > 0
						? { speechMarkTypes: requestedSpeechMarkTypes }
						: undefined,
				includeSpeechMarks,
			});
		}

		return json({
			audio:
				result.audio instanceof Buffer ? result.audio.toString("base64") : result.audio,
			contentType: result.contentType,
			speechMarks: result.speechMarks,
			metadata: result.metadata,
		});
	} catch (err) {
		if (typeof err === "object" && err !== null && "status" in err) {
			throw err;
		}
		if (err instanceof Error) {
			throw error(500, { message: `Text-to-speech error: ${err.message}` });
		}
		throw error(500, {
			message: "Text-to-speech service encountered an unexpected error.",
		});
	}
};
