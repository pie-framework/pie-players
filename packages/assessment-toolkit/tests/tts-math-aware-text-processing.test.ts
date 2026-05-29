import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { collectMathAwareTextAndMap } from "../src/services/tts/math-aware-text-processing";
import { canonicalizeMathML } from "../src/services/tts/mathml-sanitization";

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

const render = (markup: string): Element => {
	const host = document.createElement("div");
	host.innerHTML = markup;
	return host;
};

const mathChunksFrom = (element: Element) =>
	collectMathAwareTextAndMap(element).chunks.filter(
		(chunk) => chunk.type === "math",
	);

describe("math-aware TTS text processing", () => {
	test("keeps visible text extraction unchanged when no math is present", () => {
		const root = render("<p>  A\n\nsimple\t prompt. </p>");

		const result = collectMathAwareTextAndMap(root);

		expect(result.visibleText).toBe("A simple prompt.");
		expect(result.containsMathMarkup).toBe(false);
		expect(result.chunks).toEqual([{ type: "text", text: "A simple prompt." }]);
	});

	test("extracts authored MathML as one atomic speech chunk", () => {
		const root = render(`
			<p>
				Solve
				<math>
					<mfrac><mn>1</mn><mn>2</mn></mfrac>
				</math>
				now.
			</p>
		`);

		const result = collectMathAwareTextAndMap(root);
		const mathChunks = mathChunksFrom(root);

		expect(result.visibleText).toBe("Solve 1 2 now.");
		expect(result.containsMathMarkup).toBe(true);
		expect(mathChunks).toHaveLength(1);
		expect(mathChunks[0]).toMatchObject({
			type: "math",
			fallbackText: "1 2",
		});
		expect(mathChunks[0]?.sourceElement.localName).toBe("math");
		expect(mathChunks[0]?.mathml).toContain("<math");
		expect(mathChunks[0]?.mathml).toContain("<mfrac>");
	});

	test("uses MathJax assistive MathML once while visible text stays based on rendered notation", () => {
		const root = render(`
			<p>
				Find
				<mjx-container>
					<mjx-math>√x</mjx-math>
					<mjx-assistive-mml style="position: absolute; width: 1px; height: 1px; overflow: hidden;">
						<math><msqrt><mi>x</mi></msqrt></math>
					</mjx-assistive-mml>
				</mjx-container>
				first.
			</p>
		`);

		const result = collectMathAwareTextAndMap(root);
		const mathChunks = result.chunks.filter((chunk) => chunk.type === "math");

		expect(result.visibleText).toBe("Find √x first.");
		expect(mathChunks).toHaveLength(1);
		expect(mathChunks[0]).toMatchObject({
			type: "math",
			fallbackText: "√x",
		});
		expect(mathChunks[0]?.mathml).toContain("<msqrt>");
		expect(result.visibleText).not.toContain("x x");
	});

	test("uses MathML token fallback when MathJax marks rendered glyphs aria-hidden", () => {
		const root = render(`
			<p>
				Find
				<mjx-container>
					<mjx-math aria-hidden="true">√x</mjx-math>
					<mjx-assistive-mml>
						<math><msqrt><mi>x</mi></msqrt></math>
					</mjx-assistive-mml>
				</mjx-container>
				first.
			</p>
		`);

		const result = collectMathAwareTextAndMap(root);
		const mathChunks = result.chunks.filter((chunk) => chunk.type === "math");

		expect(result.visibleText).toBe("Find x first.");
		expect(mathChunks).toHaveLength(1);
		expect(mathChunks[0]).toMatchObject({
			type: "math",
			fallbackText: "x",
		});
	});

	test("uses data-mathml when rendered math exposes it", () => {
		const root = render(`
			<p>
				Choose
				<span class="MathJax" data-mathml="<math><msup><mi>x</mi><mn>2</mn></msup></math>">x²</span>
				.
			</p>
		`);

		const result = collectMathAwareTextAndMap(root);
		const mathChunks = result.chunks.filter((chunk) => chunk.type === "math");

		expect(result.visibleText).toBe("Choose x².");
		expect(mathChunks).toHaveLength(1);
		expect(mathChunks[0]?.mathml).toContain("<msup>");
	});

	test("excludes hidden descendants from visible text and maps", () => {
		const root = render(`
			<p>
				Visible
				<span aria-hidden="true"><span>hidden</span></span>
				text
			</p>
		`);

		const result = collectMathAwareTextAndMap(root);

		expect(result.visibleText).toBe("Visible text");
		expect(
			Array.from(result.map.values()).map(({ node }) => node.textContent),
		).not.toContain("hidden");
	});

	test("preserves boundaries around adjacent text and math nodes", () => {
		const root = render("<p>Solve<math><mi>x</mi></math>now.</p>");

		const result = collectMathAwareTextAndMap(root);

		expect(result.visibleText).toBe("Solve x now.");
		expect(result.chunks).toEqual([
			{ type: "text", text: "Solve" },
			expect.objectContaining({ type: "math", fallbackText: "x" }),
			{ type: "text", text: "now." },
		]);
	});

	test("does not include MathML annotations in visible fallback text", () => {
		const root = render(`
			<p>
				<math>
					<semantics>
						<msup><mi>x</mi><mn>2</mn></msup>
						<annotation encoding="application/x-tex">x^2</annotation>
					</semantics>
				</math>
			</p>
		`);

		const result = collectMathAwareTextAndMap(root);

		expect(result.visibleText).toBe("x 2");
		expect(result.chunks[0]).toMatchObject({
			type: "math",
			fallbackText: "x 2",
		});
	});
});

describe("MathML canonicalization for TTS", () => {
	test("keeps common MathML structure and removes unsafe attributes", () => {
		const canonical = canonicalizeMathML(
			'<math onclick="evil()"><mfrac><mn>1</mn><mn>2</mn></mfrac></math>',
		);

		expect(canonical).toContain("<math");
		expect(canonical).toContain("<mfrac>");
		expect(canonical).not.toContain("onclick");
	});

	test("rejects non-MathML and foreign content", () => {
		expect(canonicalizeMathML("<span>not math</span>")).toBeNull();
		expect(
			canonicalizeMathML(
				"<math><mtext>ok</mtext><script>alert(1)</script></math>",
			),
		).toBeNull();
	});
});
