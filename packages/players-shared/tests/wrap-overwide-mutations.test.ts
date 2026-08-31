/**
 * `isOverwide{Image,Table}WrapMutation` — the test that lets the observer-driven
 * pass in `PieItemPlayer.svelte` re-run only on content it did not itself
 * produce.
 *
 * The pass observes its own root with `{ childList: true, subtree: true }` and
 * the wrap inserts elements, so without this test every wrap retriggers the
 * observer that scheduled it. It converged only because the wrap is idempotent;
 * a PIE element that re-renders over its own subtree and drops the wrapper turns
 * that into a sustained wrap → mutation → wrap loop.
 *
 * Records are taken from a real `MutationObserver` via `takeRecords()` rather
 * than hand-built, so the assertions are about the record shapes the wrap
 * actually queues. happy-dom is not authority on those shapes —
 * `tests/e2e/wrap-overwide-mutations.spec.ts` pins the same facts in Chromium.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { wrapOverwideImagesInElement } from "../src/security/wrap-overwide-images.js";
import { wrapOverwideTablesInElement } from "../src/security/wrap-overwide-tables.js";
import {
	isOverwideImageWrapMutation,
	isOverwideTableWrapMutation,
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

/** The records `mutate` queues, taken synchronously so nothing races. */
function recordsFor(
	root: Element,
	mutate: () => void,
	init: MutationObserverInit = { childList: true, subtree: true },
): MutationRecord[] {
	const observer = new MutationObserver(() => {});
	observer.observe(root, init);
	mutate();
	const records = observer.takeRecords();
	observer.disconnect();
	return records;
}

const isSelfInflicted = (record: MutationRecord) =>
	isOverwideImageWrapMutation(record) || isOverwideTableWrapMutation(record);

describe("isOverwideWrapMutation", () => {
	test("every record the image wrap queues is recognized as its own output", () => {
		const root = mountRoot('<p>See:</p><img src="/x.png" alt="cell">');
		const records = recordsFor(root, () => {
			expect(wrapOverwideImagesInElement(root)).toBe(1);
		});
		expect(records.length).toBeGreaterThan(0);
		expect(records.every(isOverwideImageWrapMutation)).toBe(true);
	});

	test("every record the table wrap queues is recognized as its own output", () => {
		const root = mountRoot("<table><tbody><tr><td>a</td></tr></tbody></table>");
		const records = recordsFor(root, () => {
			expect(wrapOverwideTablesInElement(root)).toBe(1);
		});
		expect(records.length).toBeGreaterThan(0);
		expect(records.every(isOverwideTableWrapMutation)).toBe(true);
	});

	test("the image predicate does not claim the table wrap's records", () => {
		const root = mountRoot("<table><tbody><tr><td>a</td></tr></tbody></table>");
		const records = recordsFor(root, () => {
			wrapOverwideTablesInElement(root);
		});
		expect(records.every(isOverwideImageWrapMutation)).toBe(false);
	});

	test("an element painting an unwrapped <img> reads as foreign", () => {
		const root = mountRoot('<div class="pie-painted"></div>');
		const host = root.querySelector(".pie-painted") as Element;
		const records = recordsFor(root, () => {
			host.innerHTML = '<img src="/late.png" alt="late">';
		});
		expect(records.length).toBeGreaterThan(0);
		expect(records.every(isSelfInflicted)).toBe(false);
	});

	test("an element dropping a wrapper and repainting the node reads as foreign", () => {
		const root = mountRoot(
			'<div class="pie-painted"><img src="/x.png" alt="a"></div>',
		);
		const host = root.querySelector(".pie-painted") as Element;
		wrapOverwideImagesInElement(root);
		const records = recordsFor(root, () => {
			host.innerHTML = '<img src="/x.png" alt="a">';
		});
		expect(records.every(isSelfInflicted)).toBe(false);
	});

	test("a <table> painted inside an image wrapper reads as foreign", () => {
		const root = mountRoot('<img src="/x.png" alt="a">');
		wrapOverwideImagesInElement(root);
		const wrapper = root.querySelector(".pie-image-scroll") as Element;
		const records = recordsFor(root, () => {
			wrapper.appendChild(document.createElement("table"));
		});
		expect(records.every(isSelfInflicted)).toBe(false);
	});

	test("a wrapper holding something other than the node it wraps reads as foreign", () => {
		const root = mountRoot("");
		const records = recordsFor(root, () => {
			root.innerHTML =
				'<span class="pie-image-scroll"><table><tbody><tr><td>a</td></tr></tbody></table></span>';
		});
		expect(records.every(isSelfInflicted)).toBe(false);
	});

	test("an added text node reads as foreign", () => {
		const root = mountRoot("<p></p>");
		const paragraph = root.querySelector("p") as Element;
		const records = recordsFor(root, () => {
			paragraph.appendChild(document.createTextNode("typed"));
		});
		expect(records.length).toBeGreaterThan(0);
		expect(records.every(isSelfInflicted)).toBe(false);
	});

	test("an attribute record reads as foreign", () => {
		const root = mountRoot('<img src="/x.png" alt="a">');
		const image = root.querySelector("img") as Element;
		const records = recordsFor(
			root,
			() => {
				image.setAttribute("alt", "b");
			},
			{ attributes: true, subtree: true },
		);
		expect(records.length).toBeGreaterThan(0);
		expect(records.every(isSelfInflicted)).toBe(false);
	});

	test("a second wrap pass over already-wrapped content queues nothing", () => {
		const root = mountRoot(
			'<img src="/x.png" alt="a"><table><tbody><tr><td>a</td></tr></tbody></table>',
		);
		wrapOverwideImagesInElement(root);
		wrapOverwideTablesInElement(root);
		const records = recordsFor(root, () => {
			expect(wrapOverwideImagesInElement(root)).toBe(0);
			expect(wrapOverwideTablesInElement(root)).toBe(0);
		});
		expect(records).toEqual([]);
	});
});
