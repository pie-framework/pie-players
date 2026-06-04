import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import type { GoogleCloudTTSProvider as GoogleCloudTTSProviderType } from "@pie-players/tts-server-google";

// Load the Google provider lazily via a variable specifier + `@vite-ignore`
// so its native `google-gax` dependency (which uses top-level `__dirname`)
// stays external instead of being bundled into the ESM server build, where
// `__dirname` is undefined. Mirrors apps/section-demos.
const GOOGLE_TTS_PROVIDER_PACKAGE = "@pie-players/tts-server-google";

let googleProvider: GoogleCloudTTSProviderType | null = null;

async function getGoogleProvider(): Promise<GoogleCloudTTSProviderType> {
	if (googleProvider) return googleProvider;
	const hasApiKey = !!process.env.GOOGLE_API_KEY;
	const hasServiceAccount = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
	if (!hasApiKey && !hasServiceAccount) {
		throw new Error(
			"Google Cloud credentials not configured. Set GOOGLE_API_KEY or GOOGLE_APPLICATION_CREDENTIALS.",
		);
	}
	const { GoogleCloudTTSProvider } = await import(
		/* @vite-ignore */ GOOGLE_TTS_PROVIDER_PACKAGE
	);
	const provider: GoogleCloudTTSProviderType = new GoogleCloudTTSProvider();
	const credentials = hasApiKey
		? { apiKey: process.env.GOOGLE_API_KEY! }
		: process.env.GOOGLE_APPLICATION_CREDENTIALS;
	await provider.initialize({
		projectId: process.env.GOOGLE_CLOUD_PROJECT || "pie-tts-project",
		credentials,
		defaultVoice: "en-US-Wavenet-A",
		voiceType: "wavenet",
	});
	googleProvider = provider;
	return provider;
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const language = url.searchParams.get("language") || undefined;
		const gender = url.searchParams.get("gender") as
			| "male"
			| "female"
			| "neutral"
			| undefined;
		const voiceType = url.searchParams.get("voiceType") as
			| "wavenet"
			| "studio"
			| "standard"
			| undefined;
		let quality: "standard" | "neural" | "premium" | undefined;
		if (voiceType === "wavenet") quality = "neural";
		if (voiceType === "studio") quality = "premium";
		if (voiceType === "standard") quality = "standard";
		const google = await getGoogleProvider();
		const voices = await google.getVoices({
			language,
			gender,
			quality,
		});
		return json({ voices });
	} catch (err) {
		return json(
			{ error: err instanceof Error ? err.message : "Internal server error" },
			{ status: 500 },
		);
	}
};
