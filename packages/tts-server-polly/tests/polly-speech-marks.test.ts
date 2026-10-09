import { describe, expect, it } from "vitest";

import { PollyServerProvider } from "../src/PollyServerProvider.js";

const SPANISH = "La canción está aquí, señor. Él comió más pan después.";
const encoder = new TextEncoder();
const bytes = (text: string) => encoder.encode(text).length;

// Answers a marks request the way Polly does: word offsets in UTF-8 bytes of
// the text it was sent.
const fakePollyClient = () => ({
	send: async (command: { input: { Text: string; OutputFormat: string } }) => {
		const { Text, OutputFormat } = command.input;
		if (OutputFormat !== "json") {
			return { AudioStream: new Uint8Array([1]), ContentType: "audio/mpeg" };
		}
		// Words outside tags; a tag is replaced by spaces of its own length.
		const spoken = Text.replace(/<[^>]*>/g, (tag) => " ".repeat(tag.length));
		const lines = [...spoken.matchAll(/[\p{L}]+/gu)].map((match, index) => {
			const start = bytes(Text.slice(0, match.index));
			return JSON.stringify({
				time: index * 300,
				type: "word",
				start,
				end: start + bytes(match[0]),
				value: match[0],
			});
		});
		return { AudioStream: encoder.encode(lines.join("\n")) };
	},
});

const synthesize = async (rate?: number) => {
	const provider = new PollyServerProvider();
	await provider.initialize({
		region: "us-east-1",
		credentials: { accessKeyId: "test", secretAccessKey: "test" },
	});
	// Stands in for the AWS client, so no request leaves the test.
	(provider as unknown as { client: unknown }).client = fakePollyClient();
	return await provider.synthesize({ text: SPANISH, voice: "Lupe", rate });
};

describe("Polly speech marks", () => {
	it("index the request text for accented words", async () => {
		const { speechMarks } = await synthesize();
		expect(speechMarks.map((mark) => SPANISH.slice(mark.start, mark.end))).toEqual(
			speechMarks.map((mark) => mark.value),
		);
		expect(speechMarks.map((mark) => mark.value)).toContain("después");
	});

	it("index the request text when rate wraps it in prosody", async () => {
		const { speechMarks } = await synthesize(0.8);
		expect(speechMarks[0]).toMatchObject({ start: 0, end: 2, value: "La" });
		expect(speechMarks.map((mark) => SPANISH.slice(mark.start, mark.end))).toEqual(
			speechMarks.map((mark) => mark.value),
		);
	});
});
