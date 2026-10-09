import { describe, expect, it } from "vitest";

import { GoogleCloudTTSProvider } from "../src/GoogleCloudTTSProvider.js";

// Answers a synthesis request with a timepoint for every mark it carries, and
// records the SSML it was sent.
const synthesize = async (text: string) => {
	const provider = new GoogleCloudTTSProvider();
	await provider.initialize({ projectId: "test", credentials: { apiKey: "test" } });
	const sent: string[] = [];
	// Stands in for the Google client, so no request leaves the test.
	(provider as unknown as { client: unknown }).client = {
		synthesizeSpeech: async (request: { input: { ssml?: string } }) => {
			const ssml = request.input.ssml ?? "";
			sent.push(ssml);
			const timepoints = [...ssml.matchAll(/<mark name="(w\d+)"\/>/g)].map(
				(match, index) => ({ markName: match[1], timeSeconds: index * 0.3 }),
			);
			return [{ audioContent: new Uint8Array([1]), timepoints }];
		},
	};
	const response = await provider.synthesize({
		text,
		voice: "es-US-Wavenet-A",
	});
	return { ...response, ssml: sent[0] };
};

const spans = (marks: { start: number; end: number }[], text: string) =>
	marks.map((mark) => text.slice(mark.start, mark.end));

describe("Google speech marks", () => {
	it("keep accented words whole", async () => {
		const text = "La canción está aquí, señor.";
		const { speechMarks } = await synthesize(text);
		expect(speechMarks.map((mark) => mark.value)).toEqual([
			"La",
			"canción",
			"está",
			"aquí",
			"señor",
		]);
		expect(spans(speechMarks, text)).toEqual(
			speechMarks.map((mark) => mark.value),
		);
	});

	it("keep authored SSML and index it", async () => {
		const text =
			'<speak>Visit <sub alias="World Wide Web">WWW</sub> now.<break time="500ms"/> AT&amp;T está aquí.</speak>';
		const { speechMarks, ssml } = await synthesize(text);
		expect(ssml).toContain('<sub alias="World Wide Web">WWW</sub>');
		expect(ssml).toContain('<break time="500ms"/>');
		expect(ssml.replace(/<mark name="w\d+"\/>/g, "")).toBe(text);
		expect(speechMarks.map((mark) => mark.value)).toEqual([
			"Visit",
			"WWW",
			"now",
			"AT",
			"T",
			"está",
			"aquí",
		]);
		expect(spans(speechMarks, text)).toEqual([
			"Visit",
			"WWW",
			"now",
			"AT",
			"T",
			"está",
			"aquí",
		]);
	});

	it("place no mark inside an element the engine replaces", async () => {
		const { ssml } = await synthesize(
			'<speak><say-as interpret-as="characters">abc</say-as> done</speak>',
		);
		expect(ssml).toContain('<mark name="w0"/><say-as interpret-as="characters">abc</say-as>');
	});
});
