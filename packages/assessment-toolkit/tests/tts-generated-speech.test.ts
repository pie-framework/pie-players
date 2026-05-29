import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	assembleGeneratedSpeech,
	buildGeneratedSpeechFromRoot,
	createMemoizedMathSpeechResolver,
	planToCompositionChunkInputs,
	type MathSpeechResolver,
} from "../src/services/tts/generated-speech/index";
import type { MathAwareSpeechChunk } from "../src/services/tts/math-aware-text-processing";

const stubMathSpeech =
	(spoken: string): MathSpeechResolver =>
	async () => ({
		speechText: spoken,
		usedMathSpeech: true,
		usedFallback: false,
	});

beforeAll(() => {
	if (typeof (globalThis as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

describe("assembleGeneratedSpeech (pure core)", () => {
	test("assembles prose + math segments with visible spans and aggregate plain text", async () => {
		const chunks: MathAwareSpeechChunk[] = [
			{ type: "text", text: "Solve" },
			{ type: "math", mathml: "<math><mi>x</mi></math>", fallbackText: "x squared" },
			{ type: "text", text: "now" },
		];
		const assembled = await assembleGeneratedSpeech({
			chunks,
			visibleText: "Solve x squared now",
			language: "en-US",
			resolveMathSpeech: stubMathSpeech("x squared"),
		});

		expect(assembled.locale).toBe("en");
		expect(assembled.plainSpeechText).toBe("Solve x squared now");
		expect(assembled.segments).toHaveLength(3);

		const [prose, math, trailing] = assembled.segments;
		expect(prose.segment).toMatchObject({
			kind: "prose",
			spokenText: "Solve",
			visibleSpan: { start: 0, end: 5 },
		});
		expect(math.segment).toMatchObject({
			kind: "math",
			spokenText: "x squared",
			fallbackText: "x squared",
			usedFallback: false,
			visibleSpan: { start: 6, end: 15 },
		});
		expect(trailing.segment).toMatchObject({
			kind: "prose",
			spokenText: "now",
			visibleSpan: { start: 16, end: 19 },
		});
	});

	test("marks usedFallback and speaks the visible fallback when SRE yields nothing", async () => {
		const chunks: MathAwareSpeechChunk[] = [
			{ type: "math", mathml: "<math><mi>y</mi></math>", fallbackText: "y" },
		];
		const assembled = await assembleGeneratedSpeech({
			chunks,
			visibleText: "y",
			resolveMathSpeech: async () => ({
				speechText: "",
				usedMathSpeech: false,
				usedFallback: true,
			}),
		});
		expect(assembled.segments[0].segment).toMatchObject({
			kind: "math",
			spokenText: "y",
			usedFallback: true,
		});
		expect(assembled.plainSpeechText).toBe("y");
	});
});

describe("buildGeneratedSpeechFromRoot + planToCompositionChunkInputs (DOM adapter)", () => {
	test("binds prose to the content root and math to its element with matching chunk contract", async () => {
		const content = document.createElement("div");
		content.innerHTML =
			"<p>Solve <math><msup><mi>x</mi><mn>2</mn></msup></math> now</p>";

		const { plan, containsMathMarkup } = await buildGeneratedSpeechFromRoot({
			contentRoot: content,
			language: "en-US",
			resolveMathSpeech: stubMathSpeech("x squared"),
		});

		expect(containsMathMarkup).toBe(true);
		const chunks = planToCompositionChunkInputs(plan);
		const mathElement = content.querySelector("math");
		expect(mathElement).not.toBeNull();

		const proseChunk = chunks.find((chunk) => chunk.alignment);
		expect(proseChunk).toBeDefined();
		expect(proseChunk?.sourceElement).toBe(content);
		expect(proseChunk?.regionElement).toBe(content);
		expect(proseChunk?.speechMatchesVisibleText).toBe(true);
		expect(proseChunk?.playbackMode).toBeDefined();
		expect(proseChunk?.visibleMap).toBeInstanceOf(Map);

		const mathChunk = chunks.find((chunk) => chunk.mathAlignment);
		expect(mathChunk).toBeDefined();
		expect(mathChunk?.speechText).toBe("x squared");
		expect(mathChunk?.sourceElement).toBe(mathElement);
		expect(mathChunk?.regionElement).toBe(mathElement);
		// Math chunks never carry a catalog alignment or visible map; they
		// highlight via mathAlignment instead.
		expect(mathChunk?.alignment).toBeUndefined();
		expect(mathChunk?.visibleMap).toBeUndefined();
	});

	test("emits SRE SSML for math and attaches a plain fallback in ssml format", async () => {
		const ssml =
			'<?xml version="1.0"?><speak version="1.1"><say-as interpret-as="character">x</say-as> squared</speak>';
		const resolver: MathSpeechResolver = async (_chunk, opts) => ({
			speechText: "x squared",
			usedMathSpeech: true,
			usedFallback: false,
			ssml: opts.produceSsml ? ssml : undefined,
		});
		const content = document.createElement("div");
		content.innerHTML =
			"<p>Solve <math><msup><mi>x</mi><mn>2</mn></msup></math> now</p>";

		const { plan } = await buildGeneratedSpeechFromRoot({
			contentRoot: content,
			language: "en-US",
			produceSsml: true,
			resolveMathSpeech: resolver,
		});

		const ssmlChunks = planToCompositionChunkInputs(plan, { format: "ssml" });
		const mathChunk = ssmlChunks.find((chunk) =>
			chunk.speechText.includes("<speak"),
		);
		expect(mathChunk?.speechText).toBe(ssml);
		// Single source of truth: alignment is built from the same SSML string.
		expect(mathChunk?.mathAlignment).toBeDefined();
		expect(mathChunk?.plainFallback?.speechText).toBe("x squared");
		expect(mathChunk?.plainFallback?.plainFallback).toBeUndefined();
		// Prose stays plain even in ssml format.
		const proseChunk = ssmlChunks.find((chunk) => chunk.alignment);
		expect(proseChunk?.speechText).toBe("Solve");

		// Plain format ignores the SSML entirely (byte-identical Phase A).
		const plainChunks = planToCompositionChunkInputs(plan, { format: "plain" });
		const plainMath = plainChunks.find((chunk) => chunk.mathAlignment);
		expect(plainMath?.speechText).toBe("x squared");
		expect(plainMath?.plainFallback).toBeUndefined();
	});

	test("returns no math markup (no chunks) for plain prose", async () => {
		const content = document.createElement("div");
		content.innerHTML = "<p>No math here.</p>";
		const { containsMathMarkup, visibleText } =
			await buildGeneratedSpeechFromRoot({ contentRoot: content });
		// `containsMathMarkup === false` is the signal the runtime uses to fall
		// back to plain single-content playback; the plan itself is ignored.
		expect(containsMathMarkup).toBe(false);
		expect(visibleText.toLowerCase()).toContain("no math here");
	});
});

describe("createMemoizedMathSpeechResolver", () => {
	test("keys the cache on the produceSsml flag", async () => {
		let calls = 0;
		const resolver = createMemoizedMathSpeechResolver({
			resolve: async (_chunk, opts) => {
				calls++;
				return {
					speechText: "s",
					usedMathSpeech: true,
					usedFallback: false,
					ssml: opts.produceSsml ? "<speak>s</speak>" : undefined,
				};
			},
		});
		const chunk = {
			type: "math" as const,
			mathml: "<math><mi>x</mi></math>",
			fallbackText: "x",
		};

		await resolver(chunk, { language: "en-US" });
		await resolver(chunk, { language: "en-US" });
		expect(calls).toBe(1);

		// produceSsml is part of the key: the SSML variant resolves separately.
		const ssmlResult = await resolver(chunk, {
			language: "en-US",
			produceSsml: true,
		});
		expect(calls).toBe(2);
		expect(ssmlResult.ssml).toBe("<speak>s</speak>");
		await resolver(chunk, { language: "en-US", produceSsml: true });
		expect(calls).toBe(2);
	});

	test("caches by canonical MathML and locale, re-resolving on change", async () => {
		let calls = 0;
		const resolver = createMemoizedMathSpeechResolver({
			resolve: async () => {
				calls += 1;
				return { speechText: `s${calls}`, usedMathSpeech: true, usedFallback: false };
			},
		});
		const chunk = {
			type: "math" as const,
			mathml: "<math><mi>x</mi></math>",
			fallbackText: "x",
		};

		const first = await resolver(chunk, { language: "en-US" });
		const second = await resolver(chunk, { language: "en-GB" });
		expect(calls).toBe(1);
		expect(second.speechText).toBe(first.speechText);

		await resolver(chunk, { language: "fr-FR" });
		expect(calls).toBe(2);

		await resolver(
			{ ...chunk, mathml: "<math><mi>y</mi></math>" },
			{ language: "en-US" },
		);
		expect(calls).toBe(3);
	});
});
