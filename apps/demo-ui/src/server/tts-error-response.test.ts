import { describe, expect, test } from "bun:test";
import { TTSError, TTSErrorCode } from "@pie-players/tts-server-core";
import { GoogleCloudTTSProvider } from "@pie-players/tts-server-google";
import { PollyServerProvider } from "@pie-players/tts-server-polly";
import { mapTtsFailure, TtsNotConfiguredError } from "./tts-error-response";

/** A provider whose requests go to `client`, so none leaves the test. */
const pollyWithClient = (client: unknown) =>
	new (class extends PollyServerProvider {
		protected override createClient() {
			return client as never;
		}
	})();

const googleWithClient = (client: unknown) =>
	new (class extends GoogleCloudTTSProvider {
		protected override createClient() {
			return client as never;
		}
	})();

/** An AWS SDK service exception as the Polly client rejects with it. */
const awsException = (name: string, httpStatusCode: number, message: string) =>
	Object.assign(new Error(message), { name, $metadata: { httpStatusCode } });

/** A gRPC failure as the Google client rejects with it. */
const grpcFailure = (code: number, message: string) =>
	Object.assign(new Error(`${code} ${message}`), { code });

async function pollyFailure(exception: Error) {
	const polly = pollyWithClient({
		send: async () => {
			throw exception;
		},
	});
	await polly.initialize({ region: "us-east-1" });
	return polly
		.synthesize({ text: "Hello", voice: "Joanna", includeSpeechMarks: false })
		.catch((err: unknown) => err);
}

async function googleFailure(failure: Error) {
	const google = googleWithClient({
		synthesizeSpeech: async () => {
			throw failure;
		},
	});
	await google.initialize({ projectId: "test-project" });
	return google
		.synthesize({
			text: "Hello",
			voice: "en-US-Wavenet-A",
			includeSpeechMarks: false,
		})
		.catch((err: unknown) => err);
}

describe("mapTtsFailure", () => {
	test.each([
		[TTSErrorCode.INVALID_REQUEST, 400],
		[TTSErrorCode.INVALID_VOICE, 400],
		[TTSErrorCode.TEXT_TOO_LONG, 400],
		[TTSErrorCode.RATE_LIMIT_EXCEEDED, 429],
		[TTSErrorCode.AUTHENTICATION_ERROR, 503],
		[TTSErrorCode.INITIALIZATION_ERROR, 503],
		[TTSErrorCode.NETWORK_ERROR, 503],
		[TTSErrorCode.PROVIDER_ERROR, 503],
		[TTSErrorCode.INVALID_PROVIDER, 500],
	])("answers %s with %d and keeps the vendor detail out", (code, status) => {
		const detail = "arn:aws:iam::123456789012:role/tts in us-west-2";
		const failure = mapTtsFailure(new TTSError(code, detail));

		expect(failure.status).toBe(status);
		expect(failure.logAsFault).toBe(true);
		expect(failure.message).toStartWith("Text-to-speech service ");
		expect(failure.message).not.toContain("arn:aws");
	});

	test("returns a missing-credentials message as written, without logging it", () => {
		const message = "AWS credentials not configured. Set AWS_REGION.";

		expect(mapTtsFailure(new TtsNotConfiguredError(message))).toEqual({
			status: 503,
			message,
			logAsFault: false,
		});
	});

	test("answers anything but a TTSError with 500, whatever it names", () => {
		for (const err of [
			new Error("ThrottlingException: Rate exceeded"),
			new Error("Resolved credential object is not valid for arn:aws:iam::1"),
			new SyntaxError("JSON Parse error: Unexpected EOF"),
			"AWS Polly error",
			undefined,
		]) {
			expect(mapTtsFailure(err)).toEqual({
				status: 500,
				message: "Text-to-speech service encountered an unexpected error.",
				logAsFault: true,
			});
		}
	});
});

describe("mapTtsFailure over the Polly provider", () => {
	test("answers throttling with 429", async () => {
		const err = await pollyFailure(
			awsException("ThrottlingException", 400, "Rate exceeded"),
		);
		expect(mapTtsFailure(err).status).toBe(429);
	});

	test("answers a rejected credential as an authentication failure", async () => {
		const err = await pollyFailure(
			awsException("AccessDeniedException", 403, "User is not authorized"),
		);
		expect(mapTtsFailure(err)).toMatchObject({
			status: 503,
			message: "Text-to-speech service authentication failed.",
		});
	});

	test("answers a request Polly rejects with 400", async () => {
		const err = await pollyFailure(
			awsException("InvalidSsmlException", 400, "Invalid SSML request"),
		);
		expect(mapTtsFailure(err).status).toBe(400);
	});

	test("answers an unclassified AWS failure with 503", async () => {
		const err = await pollyFailure(
			awsException("ServiceFailureException", 500, "Internal failure"),
		);
		expect(mapTtsFailure(err)).toMatchObject({
			status: 503,
			message:
				"Text-to-speech service encountered an error. Please try again later.",
		});
	});

	test("answers a provider initialized without a region as not configured", async () => {
		const err = await pollyWithClient({})
			.initialize({ region: "" })
			.catch((e: unknown) => e);
		expect(mapTtsFailure(err)).toMatchObject({
			status: 503,
			message: "Text-to-speech service is not configured.",
		});
	});
});

describe("mapTtsFailure over the Google provider", () => {
	test("answers RESOURCE_EXHAUSTED with 429", async () => {
		const err = await googleFailure(grpcFailure(8, "RESOURCE_EXHAUSTED: Quota"));
		expect(mapTtsFailure(err).status).toBe(429);
	});

	test("answers PERMISSION_DENIED as an authentication failure", async () => {
		const err = await googleFailure(grpcFailure(7, "PERMISSION_DENIED: Denied"));
		expect(mapTtsFailure(err)).toMatchObject({
			status: 503,
			message: "Text-to-speech service authentication failed.",
		});
	});

	test("answers INVALID_ARGUMENT with 400", async () => {
		const err = await googleFailure(grpcFailure(3, "INVALID_ARGUMENT: Bad"));
		expect(mapTtsFailure(err).status).toBe(400);
	});
});
