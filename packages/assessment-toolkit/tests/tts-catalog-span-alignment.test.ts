import { describe, expect, test } from "bun:test";

import {
	createCatalogSpanAlignment,
	resolveSpokenBoundaryOffset,
	resolveVisibleSpanForBoundary,
} from "../src/services/tts/catalog-span-alignment";

describe("catalog span alignment", () => {
	test("maps raw SSML word offsets to plain spoken text offsets", () => {
		const speechText =
			'<speak><break time="250ms"/>Hello <emphasis>world</emphasis></speak>';

		const alignment = createCatalogSpanAlignment({
			speechText,
			visibleText: "Hello world",
		});

		expect(alignment.playbackMode).toBe("exact-word");
		expect(alignment.spokenText).toBe("Hello world");
		expect(
			resolveSpokenBoundaryOffset(
				alignment,
				speechText.indexOf("Hello"),
				"Hello".length,
			),
		).toEqual({ start: 0, length: 5 });
		expect(
			resolveSpokenBoundaryOffset(
				alignment,
				speechText.indexOf("world"),
				"world".length,
			),
		).toEqual({ start: 6, length: 5 });
	});

	test("prefers raw SSML offsets over ambiguous plain offsets", () => {
		const speechText = "<p>Hello</p>";
		const alignment = createCatalogSpanAlignment({
			speechText,
			visibleText: "Hello",
		});

		expect(
			resolveSpokenBoundaryOffset(
				alignment,
				speechText.indexOf("Hello"),
				"Hello".length,
			),
		).toEqual({ start: 0, length: 5 });
	});

	test("decodes XML entities in SSML text while keeping raw offsets trackable", () => {
		const speechText = "<speak>X &lt; 2 &amp; Y &gt; 1</speak>";
		const alignment = createCatalogSpanAlignment({
			speechText,
			visibleText: "X < 2 & Y > 1",
		});

		expect(alignment.spokenText).toBe("X < 2 & Y > 1");
		expect(alignment.playbackMode).toBe("exact-word");
		expect(
			resolveSpokenBoundaryOffset(
				alignment,
				speechText.indexOf("Y"),
				"Y".length,
				"Y",
			),
		).toEqual({ start: alignment.spokenText.indexOf("Y"), length: 1 });
	});

	test("uses boundary word to accept plain offsets for raw SSML chunks", () => {
		const speechText = `<speak xml:lang="en-US">
			Based on the passage, which method should you use to solve
			<prosody rate="slow">X squared, minus 5 X, plus 6,
			equals zero</prosody>?
		</speak>`;
		const alignment = createCatalogSpanAlignment({
			speechText,
			visibleText:
				"Based on the passage, which method should you use to solve x2-5\u2062x+6=0?",
		});
		const plainOffset = alignment.spokenText.indexOf("X");

		expect(
			resolveSpokenBoundaryOffset(alignment, plainOffset, 1, "X"),
		).toEqual({ start: plainOffset, length: 1 });
	});

	test("falls back to region highlighting for unsupported semantic SSML", () => {
		const alignment = createCatalogSpanAlignment({
			speechText: '<speak>Listen <audio src="tone.mp3"/> now.</speak>',
			visibleText: "Listen now.",
		});

		expect(alignment.playbackMode).toBe("region-fallback");
		expect(alignment.boundaryOffsetMode).toBe("unsupported");
		expect(alignment.anchors).toEqual([]);
	});

	test("keeps say-as catalog chunks trackable and ignores control-tag marks", () => {
		const speechText = `<speak>
			The deadline is <say-as interpret-as="date" format="mdy">04/22/2026</say-as>.
			<break time="600ms"/>
			The request comes from the <say-as interpret-as="characters">PTA</say-as>.
		</speak>`;
		const alignment = createCatalogSpanAlignment({
			speechText,
			visibleText:
				"The deadline is 04/22/2026. The request comes from the PTA.",
		});

		expect(alignment.playbackMode).toBe("exact-word");
		expect(
			resolveSpokenBoundaryOffset(
				alignment,
				speechText.indexOf('<break time="600ms"/>'),
				'<break time="600ms"/>'.length,
				'<break time="600ms"/>',
			),
		).toBeNull();
	});

	test("builds operator anchors for divergent quadratic formula speech", () => {
		const visibleText = "x = (-b ± √(b² - 4ac)) / 2a";
		const spokenText =
			"x equals negative b plus or minus square root of b squared minus four a c all over two a";

		const alignment = createCatalogSpanAlignment({
			speechText: spokenText,
			visibleText,
		});

		expect(alignment.playbackMode).toBe("anchor-span");
		const anchoredVisibleText = alignment.anchors
			.map((anchor) => visibleText.slice(anchor.visibleStart, anchor.visibleEnd))
			.join(" ");
		expect(anchoredVisibleText).toContain("=");
		expect(anchoredVisibleText).toContain("±");
		expect(anchoredVisibleText).toContain("√");
		expect(anchoredVisibleText).toContain("²");
		expect(anchoredVisibleText).toContain("/");

		const plusSpan = resolveVisibleSpanForBoundary(
			alignment,
			spokenText.indexOf("plus"),
		);
		expect(plusSpan).not.toBeNull();
		expect(visibleText.slice(plusSpan!.start, plusSpan!.end)).toContain("±");
	});

	test("anchors compact MathML text fallback exponents and invisible multiplication", () => {
		const visibleText = "x2-5\u2062x+6=0?";
		const spokenText = "X squared, minus 5 X, plus 6, equals zero?";

		const alignment = createCatalogSpanAlignment({
			speechText: spokenText,
			visibleText,
		});

		const squaredSpan = resolveVisibleSpanForBoundary(
			alignment,
			spokenText.indexOf("squared"),
		);
		expect(squaredSpan).not.toBeNull();
		expect(visibleText.slice(squaredSpan!.start, squaredSpan!.end)).toBe("2");

		const choiceAlignment = createCatalogSpanAlignment({
			speechText:
				"Factoring, because this equation factors easily into X minus 2, times X minus 3",
			visibleText:
				"Factoring, because this equation factors easily into (x-2)\u2062(x-3)",
		});
		const timesSpan = resolveVisibleSpanForBoundary(
			choiceAlignment,
			choiceAlignment.spokenText.indexOf("times"),
		);
		expect(timesSpan).not.toBeNull();
		expect(
			choiceAlignment.visibleText.slice(timesSpan!.start, timesSpan!.end),
		).toBe("\u2062");
	});

	test("anchors accented-Latin words instead of dropping their accents", () => {
		// Regression: the old [A-Za-z] tokenizer dropped accents, so "café"
		// tokenized as "caf" and these words could not anchor. The shared \p{L}
		// tokenizer keeps them whole, so exact-word matching aligns visible→spoken.
		const visibleText = "el café está cerrado";
		const alignment = createCatalogSpanAlignment({
			speechText: visibleText,
			visibleText,
		});

		expect(alignment.playbackMode).toBe("exact-word");
		const cafeSpan = resolveVisibleSpanForBoundary(
			alignment,
			alignment.spokenText.indexOf("café"),
		);
		expect(cafeSpan).not.toBeNull();
		expect(visibleText.slice(cafeSpan!.start, cafeSpan!.end)).toBe("café");
	});

	test("keeps duplicate anchors monotonic instead of jumping backward", () => {
		const visibleText = "b + b + b";
		const spokenText = "b plus b plus b";

		const alignment = createCatalogSpanAlignment({
			speechText: spokenText,
			visibleText,
		});

		for (let i = 1; i < alignment.anchors.length; i++) {
			expect(alignment.anchors[i].visibleStart).toBeGreaterThan(
				alignment.anchors[i - 1].visibleStart,
			);
			expect(alignment.anchors[i].spokenStart).toBeGreaterThan(
				alignment.anchors[i - 1].spokenStart,
			);
		}
	});
});
