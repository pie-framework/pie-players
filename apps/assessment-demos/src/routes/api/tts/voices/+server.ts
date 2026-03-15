import { PollyServerProvider } from "@pie-players/tts-server-polly";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

let pollyProvider: PollyServerProvider | null = null;

async function getPollyProvider(): Promise<PollyServerProvider> {
	if (pollyProvider) return pollyProvider;
	if (
		!process.env.AWS_REGION ||
		!process.env.AWS_ACCESS_KEY_ID ||
		!process.env.AWS_SECRET_ACCESS_KEY
	) {
		throw new Error(
			"AWS credentials not configured. Please set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY in .env file.",
		);
	}
	pollyProvider = new PollyServerProvider();
	const credentials: any = {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
	};
	if (process.env.AWS_SESSION_TOKEN) {
		credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
	}
	await pollyProvider.initialize({
		region: process.env.AWS_REGION || "us-east-1",
		credentials,
		engine: "neural",
		defaultVoice: "Joanna",
	});
	return pollyProvider;
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const language = url.searchParams.get("language") || undefined;
		const gender = url.searchParams.get("gender") as
			| "male"
			| "female"
			| "neutral"
			| undefined;
		const quality = url.searchParams.get("quality") as
			| "standard"
			| "neural"
			| "premium"
			| undefined;
		const polly = await getPollyProvider();
		const voices = await polly.getVoices({
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
