/**
 * TTS Synthesis API Route
 *
 * Synthesizes text to speech using AWS Polly with speech marks support.
 * Speech marks provide millisecond-precise word timing for synchronization.
 */

import { PollyServerProvider } from "@pie-players/tts-server-polly";
import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

// Singleton provider instance (reused across requests)
let pollyProvider: PollyServerProvider | null = null;

/**
 * Get or initialize the Polly provider
 */
async function getPollyProvider(): Promise<PollyServerProvider> {
	if (!pollyProvider) {
		// Debug logging
		console.log("[TTS API] Checking environment variables...");
		console.log(
			"[TTS API] AWS_REGION:",
			process.env.AWS_REGION ? "✓ Set" : "✗ Missing",
		);
		console.log(
			"[TTS API] AWS_ACCESS_KEY_ID:",
			process.env.AWS_ACCESS_KEY_ID
				? `✓ Set (${process.env.AWS_ACCESS_KEY_ID.substring(0, 8)}...)`
				: "✗ Missing",
		);
		console.log(
			"[TTS API] AWS_SECRET_ACCESS_KEY:",
			process.env.AWS_SECRET_ACCESS_KEY ? "✓ Set (hidden)" : "✗ Missing",
		);

		// Check for required environment variables
		if (
			!process.env.AWS_REGION ||
			!process.env.AWS_ACCESS_KEY_ID ||
			!process.env.AWS_SECRET_ACCESS_KEY
		) {
			throw new Error(
				"AWS credentials not configured. Please set AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY in .env file. See docs/aws-polly-setup-guide.md",
			);
		}

		pollyProvider = new PollyServerProvider();

		// Build credentials object, including session token if present (for temporary credentials)
		const credentials: any = {
			accessKeyId: process.env.AWS_ACCESS_KEY_ID,
			secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
		};

		// Add session token if using temporary credentials (AWS SSO, assumed role, etc.)
		if (process.env.AWS_SESSION_TOKEN) {
			credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
			console.log(
				"[TTS API] Using temporary credentials (session token present)",
			);
		}

		await pollyProvider.initialize({
			region: process.env.AWS_REGION || "us-east-1",
			credentials,
			engine: "neural",
			defaultVoice: "Joanna",
		});

		console.log("[TTS API] Polly provider initialized successfully");
	}
	return pollyProvider;
}

/**
 * POST /api/tts/synthesize
 *
 * Request body:
 * {
 *   text: string;
 *   voice?: string;
 *   language?: string;
 *   rate?: number;
 *   includeSpeechMarks?: boolean;
 * }
 *
 * Response:
 * {
 *   audio: string;              // Base64 encoded audio
 *   contentType: string;         // 'audio/mpeg'
 *   speechMarks: SpeechMark[];   // Word timing metadata
 *   metadata: {
 *     providerId: string;
 *     voice: string;
 *     duration: number;
 *     charCount: number;
 *     cached: boolean;
 *   }
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { text, voice, language, rate, includeSpeechMarks = true } = body;

		// Validate request
		if (!text || typeof text !== "string") {
			throw error(400, { message: "Text is required and must be a string" });
		}

		if (text.length > 3000) {
			throw error(400, { message: "Text too long (max 3000 characters)" });
		}

		// Get Polly provider (may throw if credentials not configured)
		let polly;
		try {
			polly = await getPollyProvider();
		} catch (err) {
			// Handle credential configuration errors with user-friendly message
			if (
				err instanceof Error &&
				err.message.includes("AWS credentials not configured")
			) {
				throw error(503, {
					message:
						"Text-to-speech service is not configured. AWS Polly credentials are required but not available.",
				});
			}
			throw err;
		}

		// Synthesize speech
		const result = await polly.synthesize({
			text,
			voice: voice || "Joanna",
			language: language || "en-US",
			rate,
			includeSpeechMarks,
		});

		// Convert Buffer to base64 for JSON response
		const response = {
			audio:
				result.audio instanceof Buffer
					? result.audio.toString("base64")
					: result.audio,
			contentType: result.contentType,
			speechMarks: result.speechMarks,
			metadata: result.metadata,
		};

		console.log(
			`[TTS API] Synthesis complete: ${result.metadata.charCount} chars, ${result.speechMarks?.length || 0} speech marks, ${result.metadata.duration}ms`,
		);

		return json(response);
	} catch (err) {
		console.error("[TTS API] Synthesis error:", err);

		// If it's already a SvelteKit error, re-throw it
		if (typeof err === "object" && err !== null && "status" in err) {
			throw err;
		}

		if (err instanceof Error) {
			// Check for specific AWS/Polly errors and provide user-friendly messages
			if (
				err.message.includes("credentials") ||
				err.message.includes("not configured")
			) {
				throw error(503, {
					message:
						"Text-to-speech service is not configured. AWS Polly credentials are required but not available.",
				});
			}

			if (
				err.message.includes("InvalidSignatureException") ||
				err.message.includes("SignatureDoesNotMatch")
			) {
				throw error(503, {
					message:
						"Text-to-speech service authentication failed. AWS credentials may be incorrect.",
				});
			}

			if (
				err.message.includes("ThrottlingException") ||
				err.message.includes("TooManyRequestsException")
			) {
				throw error(429, {
					message:
						"Text-to-speech service is temporarily busy. Please try again in a moment.",
				});
			}

			if (
				err.message.includes("NetworkingError") ||
				err.message.includes("ENOTFOUND") ||
				err.message.includes("ETIMEDOUT")
			) {
				throw error(503, {
					message:
						"Text-to-speech service is temporarily unavailable. Please check your network connection.",
				});
			}

			// Generic AWS error
			if (err.message.includes("AWS") || err.message.includes("Polly")) {
				throw error(503, {
					message:
						"Text-to-speech service encountered an error. Please try again later.",
				});
			}

			// Unknown error
			throw error(500, { message: `Text-to-speech error: ${err.message}` });
		}

		throw error(500, {
			message: "Text-to-speech service encountered an unexpected error.",
		});
	}
};
