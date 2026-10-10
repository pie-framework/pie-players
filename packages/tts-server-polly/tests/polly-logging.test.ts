import { afterEach, describe, expect, it, vi } from "vitest";

import { pollyWithClient } from "./fake-polly-client.js";

const synthesizeSsml = async (enableLogging?: boolean): Promise<void> => {
	const provider = pollyWithClient({
		send: async () => ({
			AudioStream: new Uint8Array([1]),
			ContentType: "audio/mpeg",
		}),
	});
	await provider.initialize({
		region: "us-east-1",
		credentials: { accessKeyId: "test", secretAccessKey: "test" },
		enableLogging,
	});
	await provider.synthesize({
		text: "<speak>Hello</speak>",
		includeSpeechMarks: false,
	});
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe("Polly logging", () => {
	it("logs nothing per request unless enableLogging is set", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		await synthesizeSsml();
		expect(log).not.toHaveBeenCalled();

		await synthesizeSsml(true);
		expect(log).toHaveBeenCalledTimes(1);
	});
});
