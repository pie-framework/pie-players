/**
 * PIE-94 regression — section-player-level assertion that authored `<img>`
 * markup flowing through the shared sanitize pipeline (which is what
 * `pie-item-player` consumes when rendering passages and items in the
 * section player) is wrapped in a horizontal-scroll container so overwide
 * images surface a scrollbar instead of being clipped by the section
 * layout's `overflow-x: hidden` ancestors.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import {
	resetPurifierForTesting,
	sanitizeItemMarkup,
} from "@pie-players/pie-players-shared";

beforeAll(() => {
	if (typeof (globalThis as unknown as { window?: unknown }).window === "undefined") {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
});

beforeEach(() => {
	resetPurifierForTesting();
});

const PASSAGE_MARKUP = `
	<div class="passage-body">
		<p>The diagram below shows a labelled cell:</p>
		<img src="/fixtures/cell-diagram.png" alt="Labelled animal cell" width="1800" height="900">
		<p>Use it to answer the question.</p>
	</div>
`;

const ITEM_STEM_MARKUP = `
	<div class="item-stem">
		<p>Identify the organelle:</p>
		<img src="/fixtures/organelle.png" alt="organelle">
	</div>
`;

describe("section player authored image wrapping", () => {
	test("passage markup: wraps overwide <img> in a .pie-image-scroll container", () => {
		const out = sanitizeItemMarkup(PASSAGE_MARKUP);
		expect(out).toContain('class="pie-image-scroll"');
		expect(out).toContain('aria-label="Scrollable image: Labelled animal cell"');
		expect(out).toContain('src="/fixtures/cell-diagram.png"');
		// Image stays a child of the wrapper, not a sibling.
		expect(out).toMatch(
			/<span class="pie-image-scroll"[^>]*>\s*<img[^>]*src="\/fixtures\/cell-diagram.png"[^>]*>\s*<\/span>/,
		);
	});

	test("item stem markup: wraps <img> the same way passages do", () => {
		const out = sanitizeItemMarkup(ITEM_STEM_MARKUP);
		expect(out).toContain('class="pie-image-scroll"');
		expect(out).toContain('aria-label="Scrollable image: organelle"');
	});

	test("wrapper is keyboard-scrollable (tabindex=0) and announces itself as a region", () => {
		const out = sanitizeItemMarkup(PASSAGE_MARKUP);
		expect(out).toMatch(/<span class="pie-image-scroll"[^>]*tabindex="0"/);
		expect(out).toMatch(/<span class="pie-image-scroll"[^>]*role="region"/);
	});

	test("does not wrap images inside pie-* custom elements in authored markup", () => {
		const html = `
			<p>Answer by tapping:</p>
			<pie-multiple-choice id="q1">
				<img src="/fixtures/internal-icon.png" alt="option icon">
			</pie-multiple-choice>
			<img src="/fixtures/outside.png" alt="outside">
		`;
		const out = sanitizeItemMarkup(html);
		// The image inside the pie-* element must not be restructured.
		expect(out).toMatch(
			/<pie-multiple-choice[^>]*>\s*<img[^>]*src="\/fixtures\/internal-icon.png"[^>]*>\s*<\/pie-multiple-choice>/,
		);
		// The image outside pie-* is wrapped.
		expect(out).toMatch(
			/<span class="pie-image-scroll"[^>]*>\s*<img[^>]*src="\/fixtures\/outside.png"/,
		);
	});

	test("image-less passage markup flows through unchanged shape", () => {
		const html = "<p>No images here.</p>";
		const out = sanitizeItemMarkup(html);
		expect(out).not.toContain("pie-image-scroll");
		expect(out).toContain("<p>No images here.</p>");
	});

	test("figure + figcaption passage markup (demo shape) keeps width/height and is wrapped", () => {
		// Mirrors the shape used by the `question-passage` section demo
		// (`apps/section-demos/.../demo2-question-passage.ts`) so that demo
		// regresses immediately if DOMPurify / wrapOverwideImages ever starts
		// dropping these pieces.
		const html = `
			<figure class="passage-figure">
				<img
					src="/demo-assets/overwide-images/renaissance-timeline.jpg"
					alt="Renaissance timeline"
					width="1792"
					height="592"
				/>
				<figcaption>Renaissance timeline caption.</figcaption>
			</figure>
		`;
		const out = sanitizeItemMarkup(html);
		expect(out).toContain("<figure");
		expect(out).toContain("<figcaption>");
		expect(out).toContain('width="1792"');
		expect(out).toContain('height="592"');
		// The <img> inside the <figure> is wrapped by the helper; the wrapper
		// becomes a child of the <figure>, not a replacement for it.
		expect(out).toMatch(
			/<figure[^>]*>[\s\S]*<span class="pie-image-scroll"[^>]*>\s*<img[^>]*>\s*<\/span>[\s\S]*<figcaption>/,
		);
	});
});
