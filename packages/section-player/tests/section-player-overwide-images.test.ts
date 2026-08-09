/**
 * PIE-94 regression — authored `<img>` markup rendered by `pie-item-player`
 * inside the section player is wrapped in a horizontal-scroll container, so
 * overwide images surface a scrollbar instead of being clipped by the section
 * layout's `overflow-x: hidden` ancestors.
 *
 * Exercises `wrapOverwideImages` directly rather than through
 * `sanitizeItemMarkup`, even though the sanitizer is what calls it in
 * production. DOMPurify >=3.4.8 does not sanitize under happy-dom — see the
 * header of `players-shared/tests/sanitize-item-markup.test.ts` — and its
 * failure mode here was to remove the markup's first element and abort the
 * walk, which made `sanitizeItemMarkup("<p>x</p>")` return `x` and left the
 * rest of the tree unexamined. Assertions downstream of a sanitize pass under
 * happy-dom therefore prove nothing about the sanitizer. The wrapper is a
 * separate post-sanitization step with no DOMPurify involvement, so calling it
 * directly is what makes these assertions mean what they say. The sanitizer
 * contract — including that it applies these wrappers by default — is verified
 * in real Chromium by `players-shared/tests/e2e/sanitize-item-markup.spec.ts`.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { wrapOverwideImages } from "@pie-players/pie-players-shared";

beforeAll(() => {
	if (
		typeof (globalThis as unknown as { window?: unknown }).window ===
		"undefined"
	) {
		GlobalRegistrator.register();
	}
});

afterAll(() => {
	if (GlobalRegistrator.isRegistered) {
		GlobalRegistrator.unregister();
	}
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
		const out = wrapOverwideImages(PASSAGE_MARKUP);
		expect(out).toContain('class="pie-image-scroll"');
		expect(out).toContain(
			'aria-label="Scrollable image: Labelled animal cell"',
		);
		expect(out).toContain('src="/fixtures/cell-diagram.png"');
		// Image stays a child of the wrapper, not a sibling.
		expect(out).toMatch(
			/<span class="pie-image-scroll"[^>]*>\s*<img[^>]*src="\/fixtures\/cell-diagram.png"[^>]*>\s*<\/span>/,
		);
	});

	test("item stem markup: wraps <img> the same way passages do", () => {
		const out = wrapOverwideImages(ITEM_STEM_MARKUP);
		expect(out).toContain('class="pie-image-scroll"');
		expect(out).toContain('aria-label="Scrollable image: organelle"');
	});

	test("wrapper is keyboard-scrollable (tabindex=0) and announces itself as a region", () => {
		const out = wrapOverwideImages(PASSAGE_MARKUP);
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
		const out = wrapOverwideImages(html);
		// The image inside the pie-* element must not be restructured.
		expect(out).toMatch(
			/<pie-multiple-choice[^>]*>\s*<img[^>]*src="\/fixtures\/internal-icon.png"[^>]*>\s*<\/pie-multiple-choice>/,
		);
		// The image outside pie-* is wrapped.
		expect(out).toMatch(
			/<span class="pie-image-scroll"[^>]*>\s*<img[^>]*src="\/fixtures\/outside.png"/,
		);
	});

	test("image-less passage markup flows through unchanged", () => {
		const html = "<p>No images here.</p>";
		const out = wrapOverwideImages(html);
		expect(out).not.toContain("pie-image-scroll");
		expect(out).toBe(html);
	});

	test("figure + figcaption passage markup (demo shape) keeps width/height and is wrapped", () => {
		// Mirrors the shape used by the `question-passage` section demo
		// (`apps/section-demos/.../demo2-question-passage.ts`) so that demo
		// regresses immediately if `wrapOverwideImages` starts dropping these
		// pieces as it re-serializes. That DOMPurify keeps `width` / `height`
		// through the allow-list is a separate claim, asserted in the real-browser
		// spec named in this file's header.
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
		const out = wrapOverwideImages(html);
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
