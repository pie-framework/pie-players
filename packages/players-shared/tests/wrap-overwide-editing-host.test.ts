/**
 * The overwide wrap leaves editing-host content alone.
 *
 * An editor owns the DOM under its host: ProseMirror redraws a wrapped image
 * without the wrapper, and the observer-driven pass in `PieItemPlayer.svelte`
 * re-wraps it, for as long as the editor holds the image. The shapes below are
 * the ones ProseMirror renders: a `contenteditable="true"` root whose leaf nodes,
 * images included, carry `contenteditable="false"`.
 *
 * `packages/item-player/tests/item-player-editor-images.spec.ts` pins the
 * same rule against live configure and delivery editors in Chromium.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
	wrapOverwideImages,
	wrapOverwideImagesInElement,
	wrapOverwideTablesInElement,
} from "../src/security/index.js";

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

const TABLE = "<table><tbody><tr><td>a</td></tr></tbody></table>";

describe("overwide wrap and editing hosts", () => {
	test("leaves an editor's images and tables alone and wraps the content beside it", () => {
		const root = mountRoot(
			`<div class="ProseMirror" contenteditable="true"><p>typed</p><img id="leaf" contenteditable="false" src="/a.png" alt="a">${TABLE}</div>` +
				`<p><img id="prompt" src="/b.png" alt="b"></p>`,
		);
		expect(wrapOverwideImagesInElement(root)).toBe(1);
		expect(wrapOverwideTablesInElement(root)).toBe(0);
		expect(root.querySelector("#prompt")?.parentElement?.className).toBe(
			"pie-image-scroll",
		);
		expect(root.querySelector("#leaf")?.parentElement?.className).toBe(
			"ProseMirror",
		);
	});

	test("counts every editable state as a host, through non-editable islands", () => {
		const root = mountRoot(
			'<div contenteditable=""><img src="/a.png" alt="a"></div>' +
				'<div contenteditable="plaintext-only"><img src="/b.png" alt="b"></div>' +
				'<div contenteditable="true"><span contenteditable="false"><img src="/c.png" alt="c"></span></div>',
		);
		expect(wrapOverwideImagesInElement(root)).toBe(0);
		expect(root.querySelector(".pie-image-scroll")).toBeNull();
	});

	test("wraps under a read-only editor root", () => {
		const root = mountRoot(
			`<div class="ProseMirror" contenteditable="false"><img src="/a.png" alt="a">${TABLE}</div>`,
		);
		expect(wrapOverwideImagesInElement(root)).toBe(1);
		expect(wrapOverwideTablesInElement(root)).toBe(1);
	});

	test("the markup pass leaves an editing host alone as well", () => {
		const markup = '<div contenteditable="true"><img src="/a.png" alt="a"></div>';
		expect(wrapOverwideImages(markup)).toBe(markup);
	});
});
