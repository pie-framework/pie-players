import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { createCatalogSpanAlignment } from "../src/services/tts/catalog-span-alignment";
import {
	createTTSHighlightPlan,
	createHighlightDecision,
	normalizeBoundaryEvent,
	normalizeSpeechChunks,
	resolveReadableRegion,
	resolveRenderedMathTarget,
} from "../src/services/tts/highlight-pipeline";
import { createMathAwareAlignment } from "../src/services/tts/math-alignment";
import { collectMathAwareTextAndMap } from "../src/services/tts/math-aware-text-processing";
import type { TTSHighlightChunk } from "../src/services/tts/highlight-pipeline";

beforeAll(() => {
	if (!GlobalRegistrator.isRegistered) {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

const makeChunk = (
	overrides: Partial<TTSHighlightChunk>,
): TTSHighlightChunk => {
	const root = document.createElement("div");
	return {
		id: "chunk-1",
		speechText: "Hello world",
		visibleText: "Hello world",
		sourceElement: root,
		contentRoot: root,
		regionElement: root,
		mathAlignments: [],
		offsetSpace: "plain-spoken-text",
		...overrides,
	};
};

describe("TTS highlight pipeline", () => {
	test("normalizes raw SSML provider boundaries into chunk-local speech offsets", () => {
		const speechText = '<speak><break time="250ms"/>Hello world</speak>';
		const chunk = makeChunk({
			speechText,
			catalogAlignment: createCatalogSpanAlignment({
				speechText,
				visibleText: "Hello world",
			}),
			offsetSpace: "raw-ssml",
		});

		const normalized = normalizeBoundaryEvent(chunk, {
			chunkId: chunk.id,
			word: "Hello",
			position: speechText.indexOf("Hello"),
			length: "Hello".length,
			providerOffsetSpace: "raw-ssml",
		});

		expect(normalized).toMatchObject({
			chunkId: "chunk-1",
			normalizedWord: "hello",
			chunkSpokenStart: 0,
			chunkSpokenEnd: 5,
			confidence: 1,
		});
	});

	test("normalizes raw SSML boundaries for a math chunk that has no catalog alignment", () => {
		// The generated-SSML math path (PIE-623) sends a raw <speak> document as
		// the chunk speechText and carries only a mathAlignment — no catalog span
		// alignment. The provider's word offset is an index into that raw SSML, so
		// the normalizer must map it back into the extracted spoken text rather
		// than treating it as a spoken-text offset (which rejected every boundary).
		const speechText =
			'<speak version="1.1"><prosody rate="100%">x squared plus 1</prosody></speak>';
		const chunk = makeChunk({
			speechText,
			visibleText: "x²+1",
			offsetSpace: "raw-ssml",
		});

		const normalized = normalizeBoundaryEvent(chunk, {
			chunkId: chunk.id,
			word: "squared",
			position: speechText.indexOf("squared"),
			length: "squared".length,
			providerOffsetSpace: "raw-ssml",
		});

		expect(normalized.normalizedWord).toBe("squared");
		expect(normalized.chunkSpokenStart).not.toBeNull();
		expect(normalized.confidence).toBe(1);
		// The resolved offset is in spoken-text space ("x squared plus 1"), where
		// "squared" starts at index 2 — not the raw-SSML index above.
		expect(normalized.chunkSpokenStart).toBe("x ".length);
	});

	test("resolves a per-token math target from a raw-SSML chunk with no catalog alignment", () => {
		const math = document.createElementNS(
			"http://www.w3.org/1998/Math/MathML",
			"math",
		);
		math.innerHTML = "<mi>x</mi><mo>+</mo><mn>1</mn>";
		const speechText = '<speak><prosody rate="100%">x plus 1</prosody></speak>';
		const alignment = createMathAwareAlignment({
			mathElement: math,
			speechText,
		});
		const chunk = makeChunk({
			speechText,
			visibleText: "x+1",
			sourceElement: math,
			regionElement: math,
			offsetSpace: "raw-ssml",
			mathAlignments: [{ element: math, alignment }],
		});

		const decision = createTTSHighlightPlan({
			chunks: [chunk],
		}).resolveBoundary({
			chunkId: chunk.id,
			word: "plus",
			position: speechText.indexOf("plus"),
			length: "plus".length,
			providerOffsetSpace: "raw-ssml",
		});

		expect(decision.activeTarget).toMatchObject({
			type: "element",
			quality: "semantic-token",
		});
		expect(
			(decision.activeTarget as { element: Element }).element.localName,
		).toBe("mo");
	});

	test("rejects contradictory provider boundary words", () => {
		const chunk = makeChunk({
			catalogAlignment: createCatalogSpanAlignment({
				speechText: "Hello world",
				visibleText: "Hello world",
			}),
		});

		const normalized = normalizeBoundaryEvent(chunk, {
			chunkId: chunk.id,
			word: "world",
			position: 0,
			length: "world".length,
			providerOffsetSpace: "plain-spoken-text",
		});

		expect(normalized.chunkSpokenStart).toBeNull();
		expect(normalized.confidence).toBe(0);
		expect(normalized.reason).toContain("could not resolve");
	});

	test("resolves readable regions without content surface special cases", () => {
		const root = document.createElement("div");
		root.innerHTML = `
			<section data-kind="rubric">
				<p><span id="source">Score <strong>carefully</strong>.</span></p>
			</section>
		`;
		const source = root.querySelector("#source")!;

		expect(resolveReadableRegion(source, root).localName).toBe("p");
	});

	test("maps hidden MathJax assistive MathML to the visible equation fallback", () => {
		const root = document.createElement("div");
		root.innerHTML = `
			<mjx-container>
				<mjx-math><mjx-mi>x</mjx-mi></mjx-math>
				<mjx-assistive-mml>
					<math xmlns="http://www.w3.org/1998/Math/MathML">
						<mi>x</mi>
					</math>
				</mjx-assistive-mml>
			</mjx-container>
		`;
		const math = root.querySelector("math")!;
		const rendered = resolveRenderedMathTarget({
			type: "element-range",
			quality: "element-range",
			element: math,
		});

		expect(rendered).toMatchObject({
			type: "element",
			quality: "expression",
		});
		expect((rendered as { element: Element }).element.localName).toBe(
			"mjx-container",
		);
	});

	test("uses expression before region in the shared fallback policy", () => {
		const root = document.createElement("div");
		root.innerHTML = `<p><math><mi>x</mi></math></p>`;
		const math = root.querySelector("math")!;
		const region = root.querySelector("p")!;

		const decision = createHighlightDecision({
			semanticTarget: null,
			expressionTarget: {
				type: "element",
				quality: "expression",
				element: math,
			},
			regionTarget: {
				type: "element",
				quality: "region",
				element: region,
			},
			confidence: 0.2,
			reason: "low confidence token mapping",
		});

		expect(decision.activeTarget).toMatchObject({
			type: "element",
			quality: "expression",
		});
		expect(decision.regionTarget).toMatchObject({
			type: "element",
			quality: "region",
		});
		expect(decision.quality).toBe("expression");
	});

	test("keeps a token-capable equation on the region layer initially (no whole-expression flash)", () => {
		const root = document.createElement("div");
		root.innerHTML = `<math><mi>x</mi></math>`;
		const math = root.querySelector("math")!;
		const alignment = createMathAwareAlignment({
			mathElement: math,
			speechText: "x",
		});
		const chunk = makeChunk({
			sourceElement: math,
			regionElement: root,
			contentRoot: root,
			mathAlignments: [{ element: math, alignment }],
		});

		const decision = createTTSHighlightPlan({
			chunks: [chunk],
		}).resolveInitial(chunk.id);

		// Native MathML is token-capable, so the equation must not be painted as
		// a whole-expression block up front; it stays on the region layer until
		// its first token resolves.
		expect(decision.activeTarget).toBeNull();
		expect(decision.quality).toBe("region");
		expect(decision.regionTarget).toMatchObject({
			type: "element",
			quality: "region",
		});
	});

	test("paints the whole expression initially only for an expression-mode equation", () => {
		const root = document.createElement("div");
		// A MathJax 2D layout (fraction) cannot be tracked per token, so it is
		// classified expression-mode and is painted as one stable block.
		root.innerHTML = `
			<mjx-container>
				<mjx-math aria-hidden="true"><mjx-mfrac></mjx-mfrac></mjx-math>
				<mjx-assistive-mml>
					<math xmlns="http://www.w3.org/1998/Math/MathML">
						<mfrac><mn>1</mn><mn>2</mn></mfrac>
					</math>
				</mjx-assistive-mml>
			</mjx-container>
		`;
		const math = root.querySelector("math")!;
		const alignment = createMathAwareAlignment({
			mathElement: math,
			speechText: "one half",
		});
		const chunk = makeChunk({
			sourceElement: math,
			regionElement: root,
			contentRoot: root,
			mathAlignments: [{ element: math, alignment }],
		});

		const decision = createTTSHighlightPlan({
			chunks: [chunk],
		}).resolveInitial(chunk.id);

		expect(decision.activeTarget).toMatchObject({
			type: "element",
			quality: "expression",
		});
		expect(
			(decision.activeTarget as { element: Element }).element.localName,
		).toBe("mjx-container");
	});

	test("resolves prose boundaries through the shared plan", () => {
		const root = document.createElement("p");
		root.textContent = "Hello world";
		const text = root.firstChild as Text;
		const visibleMap = new Map([
			[0, { node: text, offset: 0 }],
			[1, { node: text, offset: 1 }],
			[2, { node: text, offset: 2 }],
			[3, { node: text, offset: 3 }],
			[4, { node: text, offset: 4 }],
		]);
		const chunk = makeChunk({
			contentRoot: root,
			sourceElement: root,
			regionElement: root,
			visibleMap,
			catalogAlignment: createCatalogSpanAlignment({
				speechText: "Hello world",
				visibleText: "Hello world",
			}),
		});

		const decision = createTTSHighlightPlan({
			chunks: [chunk],
		}).resolveBoundary({
			chunkId: chunk.id,
			word: "Hello",
			position: 0,
			length: "Hello".length,
			providerOffsetSpace: "plain-spoken-text",
		});

		expect(decision.activeTarget).toMatchObject({
			type: "range",
			quality: "exact-word",
		});
		expect((decision.activeTarget as { range: Range }).range.toString()).toBe(
			"Hello",
		);
		expect(decision.regionTarget).toMatchObject({
			type: "element",
			quality: "region",
		});
	});

	test("normalizes speech composition chunks into stable pipeline chunks", () => {
		const root = document.createElement("div");
		const span = document.createElement("span");
		span.textContent = "visible";
		root.append(span);
		const alignment = createCatalogSpanAlignment({
			speechText: "<speak>visible</speak>",
			visibleText: "visible",
		});

		const chunks = normalizeSpeechChunks({
			contentRoot: root,
			chunks: [
				{
					speechText: "<speak>visible</speak>",
					visibleText: "visible",
					sourceElement: span,
					regionElement: span,
					alignment,
					mathAlignment: undefined,
					mathAlignments: [],
				},
			],
		});

		expect(chunks).toHaveLength(1);
		expect(chunks[0]).toMatchObject({
			id: "tts-chunk-0",
			speechText: "<speak>visible</speak>",
			visibleText: "visible",
			sourceElement: span,
			contentRoot: root,
			regionElement: span,
			offsetSpace: "raw-ssml",
		});
	});

	test("resolves pure MathML boundaries through the shared plan", () => {
		const math = document.createElementNS(
			"http://www.w3.org/1998/Math/MathML",
			"math",
		);
		math.innerHTML = "<mi>x</mi><mo>+</mo><mn>1</mn>";
		const alignment = createMathAwareAlignment({
			mathElement: math,
			speechText: "x plus 1",
		});
		const chunk = makeChunk({
			speechText: "x plus 1",
			visibleText: "x+1",
			sourceElement: math,
			regionElement: math,
			mathAlignments: [{ element: math, alignment }],
		});

		const decision = createTTSHighlightPlan({
			chunks: [chunk],
		}).resolveBoundary({
			chunkId: chunk.id,
			word: "plus",
			position: "x ".length,
			length: "plus".length,
			providerOffsetSpace: "plain-spoken-text",
		});

		expect(decision.activeTarget).toMatchObject({
			type: "element",
			quality: "semantic-token",
		});
		expect(
			(decision.activeTarget as { element: Element }).element.localName,
		).toBe("mo");
	});

	test("falls back to the visible MathJax equation when token rendering is hidden", () => {
		const root = document.createElement("div");
		root.innerHTML = `
			<mjx-container>
				<mjx-math><mjx-mi>x</mjx-mi><mjx-mo>+</mjx-mo><mjx-mi>x</mjx-mi></mjx-math>
				<mjx-assistive-mml>
					<math xmlns="http://www.w3.org/1998/Math/MathML">
						<mi>x</mi><mo>+</mo><mi>x</mi>
					</math>
				</mjx-assistive-mml>
			</mjx-container>
		`;
		const math = root.querySelector("math")!;
		const alignment = createMathAwareAlignment({
			mathElement: math,
			speechText: "x plus x",
		});
		const chunk = makeChunk({
			contentRoot: root,
			speechText: "x plus x",
			visibleText: "x+x",
			sourceElement: math,
			regionElement: root,
			mathAlignments: [{ element: math, alignment }],
		});

		const decision = createTTSHighlightPlan({
			chunks: [chunk],
		}).resolveBoundary({
			chunkId: chunk.id,
			word: "x",
			position: 0,
			length: "x".length,
			providerOffsetSpace: "plain-spoken-text",
		});

		expect(decision.activeTarget).toMatchObject({
			type: "element",
			quality: "expression",
		});
		expect(
			(decision.activeTarget as { element: Element }).element.localName,
		).toBe("mjx-container");
	});

	test("prefers a precise prose range over a coarse MathJax expression fallback", () => {
		const root = document.createElement("div");
		root.innerHTML = `
			<mjx-container>
				<mjx-math><mjx-mi>x</mjx-mi><mjx-mo>+</mjx-mo><mjx-mi>x</mjx-mi></mjx-math>
				<mjx-assistive-mml>
					<math xmlns="http://www.w3.org/1998/Math/MathML">
						<mi>x</mi><mo>+</mo><mi>x</mi>
					</math>
				</mjx-assistive-mml>
			</mjx-container>
		`;
		const math = root.querySelector("math")!;
		const visibleX = math.querySelector("mi")!.firstChild as Text;
		const visibleMap = new Map([[0, { node: visibleX, offset: 0 }]]);
		const alignment = createMathAwareAlignment({
			mathElement: math,
			speechText: "x plus x",
		});
		const chunk = makeChunk({
			contentRoot: root,
			speechText: "x plus x",
			visibleText: "x+x",
			sourceElement: math,
			regionElement: root,
			visibleMap,
			catalogAlignment: createCatalogSpanAlignment({
				speechText: "x plus x",
				visibleText: "x+x",
			}),
			mathAlignments: [{ element: math, alignment }],
		});

		const decision = createTTSHighlightPlan({
			chunks: [chunk],
		}).resolveBoundary({
			chunkId: chunk.id,
			word: "x",
			position: 0,
			length: "x".length,
			providerOffsetSpace: "plain-spoken-text",
		});

		expect(decision.activeTarget).toMatchObject({ type: "range" });
		expect((decision.activeTarget as { range: Range }).range.toString()).toBe(
			"x",
		);
	});

	test("maps simple MathJax CHTML tokens by structural position", () => {
		const root = document.createElement("div");
		// MathJax marks the visual CHTML aria-hidden; the resolver must still
		// highlight it (the glyph is on screen even though it is hidden from AT).
		root.innerHTML = `
			<mjx-container>
				<mjx-math aria-hidden="true"><mjx-mi>x</mjx-mi><mjx-mo>+</mjx-mo><mjx-mn>1</mjx-mn></mjx-math>
				<mjx-assistive-mml>
					<math xmlns="http://www.w3.org/1998/Math/MathML">
						<mi>x</mi><mo>+</mo><mn>1</mn>
					</math>
				</mjx-assistive-mml>
			</mjx-container>
		`;
		for (const element of root.querySelectorAll("mjx-mi,mjx-mo,mjx-mn")) {
			(element as HTMLElement).getBoundingClientRect = () =>
				({
					x: 0,
					y: 0,
					width: 10,
					height: 10,
					top: 0,
					right: 10,
					bottom: 10,
					left: 0,
					toJSON: () => ({}),
				}) as DOMRect;
		}
		// The resolver maps source tokens to rendered glyphs by document-order
		// position on mjx-math, not by querying the container per token type.
		const mjxMath = root.querySelector("mjx-math")!;
		const originalQuerySelectorAll = mjxMath.querySelectorAll.bind(mjxMath);
		let leafQueryCount = 0;
		mjxMath.querySelectorAll = ((selector: string) => {
			if (selector === "mjx-mi,mjx-mn,mjx-mo,mjx-mtext") leafQueryCount += 1;
			return originalQuerySelectorAll(selector);
		}) as typeof mjxMath.querySelectorAll;
		const math = root.querySelector("math")!;
		const alignment = createMathAwareAlignment({
			mathElement: math,
			speechText: "x plus 1",
		});
		const chunk = makeChunk({
			contentRoot: root,
			speechText: "x plus 1",
			visibleText: "x+1",
			sourceElement: math,
			regionElement: root,
			mathAlignments: [{ element: math, alignment }],
		});

		const plan = createTTSHighlightPlan({
			chunks: [chunk],
		});
		// The per-equation capability probe queries the rendered leaves once at
		// plan creation; the resolver itself must add no more than one query and
		// then cache.
		const queriesAfterCreate = leafQueryCount;
		const boundary = {
			chunkId: chunk.id,
			word: "plus",
			position: "x ".length,
			length: "plus".length,
			providerOffsetSpace: "plain-spoken-text",
		} as const;
		const decision = plan.resolveBoundary(boundary);
		const queriesAfterFirstResolve = leafQueryCount;
		plan.resolveBoundary(boundary);

		expect(decision.activeTarget).toMatchObject({
			type: "element",
			quality: "semantic-token",
		});
		const token = (decision.activeTarget as { element: Element }).element;
		expect(token.localName).toBe("mjx-mo");
		// "plus" is the second source leaf, so it maps to the second CHTML token.
		expect(token).toBe(mjxMath.querySelectorAll("mjx-mo")[0]);
		// The first resolution queried the rendered leaves exactly once...
		expect(queriesAfterFirstResolve - queriesAfterCreate).toBe(1);
		// ...and repeated resolution of the same token is cached (no new query).
		expect(leafQueryCount).toBe(queriesAfterFirstResolve);
	});

	test("disambiguates repeated MathJax tokens by position", () => {
		const root = document.createElement("div");
		root.innerHTML = `
			<mjx-container>
				<mjx-math aria-hidden="true"><mjx-mi>x</mjx-mi><mjx-mo>+</mjx-mo><mjx-mi>x</mjx-mi></mjx-math>
				<mjx-assistive-mml>
					<math xmlns="http://www.w3.org/1998/Math/MathML">
						<mi>x</mi><mo>+</mo><mi>x</mi>
					</math>
				</mjx-assistive-mml>
			</mjx-container>
		`;
		for (const element of root.querySelectorAll("mjx-mi,mjx-mo")) {
			(element as HTMLElement).getBoundingClientRect = () =>
				({
					x: 0,
					y: 0,
					width: 10,
					height: 10,
					top: 0,
					right: 10,
					bottom: 10,
					left: 0,
					toJSON: () => ({}),
				}) as DOMRect;
		}
		const mjxMath = root.querySelector("mjx-math")!;
		const renderedX = mjxMath.querySelectorAll("mjx-mi");
		const math = root.querySelector("math")!;
		const alignment = createMathAwareAlignment({
			mathElement: math,
			speechText: "x plus x",
		});
		const chunk = makeChunk({
			contentRoot: root,
			speechText: "x plus x",
			visibleText: "x+x",
			sourceElement: math,
			regionElement: root,
			mathAlignments: [{ element: math, alignment }],
		});
		const plan = createTTSHighlightPlan({ chunks: [chunk] });

		const first = plan.resolveBoundary({
			chunkId: chunk.id,
			word: "x",
			position: 0,
			length: "x".length,
			providerOffsetSpace: "plain-spoken-text",
		});
		const second = plan.resolveBoundary({
			chunkId: chunk.id,
			word: "x",
			position: "x plus ".length,
			length: "x".length,
			providerOffsetSpace: "plain-spoken-text",
		});

		expect(first.activeTarget).toMatchObject({
			type: "element",
			quality: "semantic-token",
		});
		expect((first.activeTarget as { element: Element }).element).toBe(
			renderedX[0],
		);
		expect((second.activeTarget as { element: Element }).element).toBe(
			renderedX[1],
		);
	});

	test("uses only the MathML expression intersecting a mixed visible boundary", () => {
		const root = document.createElement("div");
		root.innerHTML = `
			<math xmlns="http://www.w3.org/1998/Math/MathML">
				<mn>2</mn><mo>×</mo><mn>7</mn>
			</math>
			then
			<math xmlns="http://www.w3.org/1998/Math/MathML">
				<mn>3</mn><mo>×</mo><mn>8</mn>
			</math>
		`;
		const mathElements = Array.from(root.querySelectorAll("math"));
		const collected = collectMathAwareTextAndMap(root);
		const speechText = "2 times 7 then 3 times 8";
		const alignment = createCatalogSpanAlignment({
			speechText,
			visibleText: collected.visibleText,
		});
		const chunk = makeChunk({
			speechText,
			visibleText: collected.visibleText,
			sourceElement: root,
			contentRoot: root,
			regionElement: root,
			visibleMap: collected.map,
			catalogAlignment: alignment,
			mathAlignments: mathElements.map((element) => ({
				element,
				alignment: createMathAwareAlignment({
					mathElement: element,
					speechText,
				}),
			})),
		});

		const decision = createTTSHighlightPlan({
			chunks: [chunk],
		}).resolveBoundary({
			chunkId: chunk.id,
			word: "times",
			position: speechText.lastIndexOf("times"),
			length: "times".length,
			providerOffsetSpace: "plain-spoken-text",
		});

		expect(decision.activeTarget).toMatchObject({
			type: "element",
			quality: "semantic-token",
		});
		expect((decision.activeTarget as { element: Element }).element).toBe(
			mathElements[1].querySelector("mo"),
		);
	});

	test("holds the last token through a gap in a token-mode equation", () => {
		const math = document.createElementNS(
			"http://www.w3.org/1998/Math/MathML",
			"math",
		);
		math.innerHTML = "<mi>x</mi><mo>+</mo><mn>1</mn>";
		const alignment = createMathAwareAlignment({
			mathElement: math,
			speechText: "x plus 1",
		});
		const chunk = makeChunk({
			speechText: "x plus 1",
			visibleText: "x+1",
			sourceElement: math,
			regionElement: math,
			mathAlignments: [{ element: math, alignment }],
		});
		const plan = createTTSHighlightPlan({ chunks: [chunk] });

		// First, a real token boundary resolves the operator.
		const onToken = plan.resolveBoundary({
			chunkId: chunk.id,
			word: "plus",
			position: "x ".length,
			length: "plus".length,
			providerOffsetSpace: "plain-spoken-text",
		});
		expect(onToken.activeTarget).toMatchObject({
			type: "element",
			quality: "semantic-token",
		});
		expect(
			(onToken.activeTarget as { element: Element }).element.localName,
		).toBe("mo");

		// Then a gap (a break / contradictory boundary that maps to no token).
		const onGap = plan.resolveBoundary({
			chunkId: chunk.id,
			word: "qqq",
			position: 0,
			length: 3,
			providerOffsetSpace: "plain-spoken-text",
		});
		// The previous token is held — the whole equation is NOT painted.
		expect(onGap.activeTarget).toBe(onToken.activeTarget);
		expect(onGap.quality).toBe("semantic-token");
		expect(onGap.reason).toContain("hold last token");
	});

	test("keeps an expression-mode equation as a stable block across a non-token boundary", () => {
		const root = document.createElement("div");
		// A MathJax fraction is a 2D layout we cannot track per token.
		root.innerHTML = `
			<mjx-container>
				<mjx-math aria-hidden="true"><mjx-mfrac></mjx-mfrac></mjx-math>
				<mjx-assistive-mml>
					<math xmlns="http://www.w3.org/1998/Math/MathML">
						<mfrac><mn>1</mn><mn>2</mn></mfrac>
					</math>
				</mjx-assistive-mml>
			</mjx-container>
		`;
		const math = root.querySelector("math")!;
		const alignment = createMathAwareAlignment({
			mathElement: math,
			speechText: "one half",
		});
		const chunk = makeChunk({
			contentRoot: root,
			speechText: "one half",
			visibleText: "1/2",
			sourceElement: math,
			regionElement: root,
			mathAlignments: [{ element: math, alignment }],
		});

		const decision = createTTSHighlightPlan({
			chunks: [chunk],
		}).resolveBoundary({
			chunkId: chunk.id,
			word: "half",
			position: 0,
			length: "half".length,
			providerOffsetSpace: "plain-spoken-text",
		});

		expect(decision.activeTarget).toMatchObject({
			type: "element",
			quality: "expression",
		});
		expect(
			(decision.activeTarget as { element: Element }).element.localName,
		).toBe("mjx-container");
	});

	test("rejects a multi-node prose range inside a token-mode equation", () => {
		const math = document.createElementNS(
			"http://www.w3.org/1998/Math/MathML",
			"math",
		);
		math.innerHTML = "<mi>a</mi><mi>b</mi>";
		const root = document.createElement("p");
		root.append(math);
		const nodeA = math.querySelector("mi:nth-child(1)")!.firstChild as Text;
		const nodeB = math.querySelector("mi:nth-child(2)")!.firstChild as Text;
		// A spoken word ("ab") whose visible span crosses two glyph text nodes
		// produces a multi-node range. The highlight coordinator escalates such a
		// range to the whole <math>, so it must never be used for a token-mode
		// equation. The math aligner speaks "p q", so this boundary matches no math
		// leaf and the math resolver returns null — the prose range is all that is
		// left to (wrongly) paint.
		const visibleMap = new Map([
			[0, { node: nodeA, offset: 0 }],
			[1, { node: nodeB, offset: 0 }],
			[2, { node: nodeB, offset: 1 }],
		]);
		const sharedFields = {
			speechText: "ab",
			visibleText: "ab",
			sourceElement: math,
			contentRoot: root,
			regionElement: root,
			visibleMap,
			catalogAlignment: createCatalogSpanAlignment({
				speechText: "ab",
				visibleText: "ab",
			}),
		};
		const boundary = {
			chunkId: "chunk-1",
			word: "ab",
			position: 0,
			length: 2,
			providerOffsetSpace: "plain-spoken-text" as const,
		};

		// Control: with no equation owning the range, the multi-node prose range is
		// painted as a range — this is exactly the target the coordinator escalates
		// to the whole <math>.
		const control = makeChunk({ ...sharedFields, mathAlignments: [] });
		const controlDecision = createTTSHighlightPlan({
			chunks: [control],
		}).resolveBoundary(boundary);
		expect(controlDecision.activeTarget?.type).toBe("range");

		// Guarded: the same range now lands inside a token-mode native equation, so
		// it is rejected and the equation holds the region instead of flashing the
		// whole expression.
		const guarded = makeChunk({
			...sharedFields,
			mathAlignments: [
				{
					element: math,
					alignment: createMathAwareAlignment({
						mathElement: math,
						speechText: "p q",
					}),
				},
			],
		});
		const guardedDecision = createTTSHighlightPlan({
			chunks: [guarded],
		}).resolveBoundary(boundary);
		expect(guardedDecision.activeTarget).toBeNull();
		expect(guardedDecision.reason).toContain("awaiting first token");
		expect(guardedDecision.regionTarget).toMatchObject({
			type: "element",
			quality: "region",
		});
	});

	test("highlights the whole formula as a block when math token highlighting is disabled", () => {
		const math = document.createElementNS(
			"http://www.w3.org/1998/Math/MathML",
			"math",
		);
		math.innerHTML = "<mi>x</mi><mo>+</mo><mn>1</mn>";
		const alignment = createMathAwareAlignment({
			mathElement: math,
			speechText: "x plus 1",
		});
		const chunk = makeChunk({
			speechText: "x plus 1",
			visibleText: "x+1",
			sourceElement: math,
			regionElement: math,
			mathAlignments: [{ element: math, alignment }],
		});

		const plan = createTTSHighlightPlan({
			chunks: [chunk],
			mathTokenHighlighting: false,
		});

		// Up front the formula is painted as one block (forced expression mode),
		// not held on the region layer awaiting a first token.
		const initial = plan.resolveInitial(chunk.id);
		expect(initial.activeTarget).toMatchObject({
			type: "element",
			quality: "expression",
		});

		// A boundary that would normally resolve the "+" token (see "resolves pure
		// MathML boundaries") now keeps the whole formula highlighted instead of
		// breaking it into glyphs.
		const decision = plan.resolveBoundary({
			chunkId: chunk.id,
			word: "plus",
			position: "x ".length,
			length: "plus".length,
			providerOffsetSpace: "plain-spoken-text",
		});
		expect(decision.activeTarget).toMatchObject({
			type: "element",
			quality: "expression",
		});
		expect(
			(decision.activeTarget as { element: Element }).element.localName,
		).toBe("math");
	});
});
