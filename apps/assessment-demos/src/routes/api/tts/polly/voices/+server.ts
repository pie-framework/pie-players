import { PollyServerProvider } from "@pie-players/tts-server-polly";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
	mapTtsFailure,
	TtsNotConfiguredError,
} from "@pie-players/demo-ui/server";

type PollyEngine = "neural" | "standard";
const SUPPORTED_ENGINES: PollyEngine[] = ["neural", "standard"];
const pollyProviders = new Map<PollyEngine, PollyServerProvider>();

async function getPollyProvider(
	engine: PollyEngine,
): Promise<PollyServerProvider> {
	const existing = pollyProviders.get(engine);
	if (existing) return existing;
	if (
		!process.env.AWS_REGION ||
		!process.env.AWS_ACCESS_KEY_ID ||
		!process.env.AWS_SECRET_ACCESS_KEY
	) {
		throw new TtsNotConfiguredError(
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
		const engineParam = url.searchParams.get("engine");
		const engine = (engineParam || quality || "neural") as PollyEngine;
		if (!SUPPORTED_ENGINES.includes(engine)) {
			return json(
				{
					error: `Unsupported Polly engine "${engine}". Use "neural" or "standard".`,
				},
				{ status: 400 },
			);
		}
		const polly = await getPollyProvider(engine);
		const voices = await polly.getVoices({
			language,
			gender,
			quality: engine,
		});
		return json({ voices });
	} catch (err) {
		const { status, message, logAsFault } = mapTtsFailure(err);
		if (logAsFault) console.error("[Polly API] Error:", err);

		return json({ error: message }, { status });
	}
};
