/**
 * An image laid out as a block gets a block wrapper (`pie-image-scroll-block`),
 * so wrapping it adds no line box below it; an inline image keeps the
 * inline-block wrapper and its place in the line.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
	wrapOverwideImages,
	wrapOverwideImagesInElement,
} from "../src/security/wrap-overwide-images.js";

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

function mountRoot(html: string): Element {
	const root = document.createElement("div");
	root.innerHTML = html;
	document.body.appendChild(root);
	return root;
}

const wrapperClass = (root: Element, id: string) =>
	root.querySelector(`#${id}`)?.parentElement?.className;

describe("image wrapper layout", () => {
	test("the live pass gives an element-styled block image a block wrapper", () => {
		const root = mountRoot(
			"<style>.painted { display: block; }</style>" +
				'<div><img id="block" class="painted" src="/a.png" alt="a"></div>' +
				'<p>text <img id="inline" src="/b.png" alt="b"> text</p>' +
				'<img id="hidden" style="display: none" src="/c.png" alt="c">',
		);
		expect(wrapOverwideImagesInElement(root)).toBe(3);
		expect(wrapperClass(root, "block")).toBe(
			"pie-image-scroll pie-image-scroll-block",
		);
		expect(wrapperClass(root, "inline")).toBe("pie-image-scroll");
		expect(wrapperClass(root, "hidden")).toBe("pie-image-scroll");
	});

	test("the markup pass reads an authored inline display", () => {
		const out = wrapOverwideImages(
			'<img src="/a.png" alt="a" style="display: block"><img src="/b.png" alt="b">',
		);
		expect(out).toContain(
			'<span class="pie-image-scroll pie-image-scroll-block"',
		);
		expect(out.match(/class="pie-image-scroll"/g)?.length).toBe(1);
	});
});

describe("image wrapper layout after the markup pass", () => {
	// The theme makes every wrapped image a block, so the live read has to look
	// past the wrapper to see the host's own layout.
	const styles =
		"<style>img { display: block; } " +
		".inline-images img { display: inline; } " +
		".pie-image-scroll > img { display: block; }</style>";

	test("a host-reset block image wrapped off-document gets a block wrapper once attached", () => {
		const markup = wrapOverwideImages(
			'<p><img id="reset" src="/a.png" alt="a"></p>' +
				'<p class="inline-images">text <img id="inline" src="/b.png" alt="b"> text</p>',
		);
		expect(markup.match(/class="pie-image-scroll"/g)?.length).toBe(2);

		const root = mountRoot(styles + markup);
		expect(wrapOverwideImagesInElement(root)).toBe(0);
		expect(wrapperClass(root, "reset")).toBe(
			"pie-image-scroll pie-image-scroll-block",
		);
		expect(wrapperClass(root, "inline")).toBe("pie-image-scroll");
	});

	test("reads a wrapper's layout once", () => {
		const root = mountRoot(
			`${styles}${wrapOverwideImages('<p><img id="once" src="/a.png" alt="a"></p>')}`,
		);
		wrapOverwideImagesInElement(root);
		const wrapper = root.querySelector("#once")?.parentElement as HTMLElement;
		wrapper.classList.remove("pie-image-scroll-block");
		wrapOverwideImagesInElement(root);
		expect(wrapper.className).toBe("pie-image-scroll");
	});
});
