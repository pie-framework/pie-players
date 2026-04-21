import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import {
	buildAuthoringAllowList,
	createDefaultItemMarkupSanitizer,
	resetPurifierForTesting,
	sanitizeItemMarkup,
} from "../src/security/sanitize-item-markup.js";

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

describe("sanitizeItemMarkup", () => {
	test("strips <script> tags entirely", () => {
		const html =
			"<p>Hello</p><script>alert('xss')</script><p>World</p>";
		const out = sanitizeItemMarkup(html);
		expect(out).not.toContain("<script");
		expect(out).not.toContain("alert");
		expect(out).toContain("<p>Hello</p>");
		expect(out).toContain("<p>World</p>");
	});

	test("drops event-handler attributes (onerror, onclick, onload)", () => {
		const html =
			'<img src="x" onerror="alert(1)"><button onclick="evil()">Go</button><svg onload="boom()"></svg>';
		const out = sanitizeItemMarkup(html);
		expect(out.toLowerCase()).not.toContain("onerror");
		expect(out.toLowerCase()).not.toContain("onclick");
		expect(out.toLowerCase()).not.toContain("onload");
	});

	test("rejects javascript: URLs", () => {
		const html = '<a href="javascript:alert(1)">click</a>';
		const out = sanitizeItemMarkup(html);
		expect(out.toLowerCase()).not.toContain("javascript:");
	});

	test("preserves pie-* custom elements and their attributes", () => {
		const html =
			'<pie-multiple-choice id="q1" class="my" model-id="m1" session-id="s1"><span slot="label">pick</span></pie-multiple-choice>';
		const out = sanitizeItemMarkup(html);
		expect(out).toContain("<pie-multiple-choice");
		// pie-item contract compatibility: model lookup (updateSinglePieElement)
		// matches `pieElement.id` to `config.models[].id` by strict equality,
		// so the sanitizer must leave `id` untouched and not apply DOMPurify's
		// `user-content-` prefix via SANITIZE_NAMED_PROPS.
		expect(out).toContain('id="q1"');
		expect(out).not.toContain("user-content-");
		expect(out).toContain('model-id="m1"');
		expect(out).toContain('session-id="s1"');
	});

	test("strips unknown (non pie-*) custom elements by default", () => {
		const html =
			'<p>before</p><evil-widget onclick="x">hi</evil-widget><p>after</p>';
		const out = sanitizeItemMarkup(html);
		expect(out).not.toContain("<evil-widget");
		expect(out).toContain("<p>before</p>");
		expect(out).toContain("<p>after</p>");
	});

	test("respects an explicit allowedCustomElements list", () => {
		const html = "<my-widget>hello</my-widget>";
		const out = sanitizeItemMarkup(html, {
			allowedCustomElements: ["my-widget"],
		});
		expect(out).toContain("<my-widget");
		expect(out).toContain("hello");
	});

	test("allows the authoring-mode -config variants when included in allow-list", () => {
		const html =
			'<pie-multiple-choice-config id="q1"></pie-multiple-choice-config>';
		const allowList = buildAuthoringAllowList([
			"pie-multiple-choice",
		]);
		const out = sanitizeItemMarkup(html, {
			allowedCustomElements: allowList,
		});
		expect(out).toContain("<pie-multiple-choice-config");
	});

	test("empty markup returns empty string", () => {
		expect(sanitizeItemMarkup("")).toBe("");
		expect(sanitizeItemMarkup(undefined as unknown as string)).toBe("");
		expect(sanitizeItemMarkup(null as unknown as string)).toBe("");
	});

	test("createDefaultItemMarkupSanitizer returns a callable sanitizer", () => {
		const sanitize = createDefaultItemMarkupSanitizer({
			allowedCustomElements: ["my-widget"],
		});
		const out = sanitize("<my-widget><script>bad()</script></my-widget>");
		expect(out).toContain("<my-widget");
		expect(out).not.toContain("<script");
	});
});

describe("buildAuthoringAllowList", () => {
	test("emits both the raw tag and the -config variant", () => {
		const list = buildAuthoringAllowList(["pie-mc", "pie-inline-choice"]);
		expect(list).toEqual(
			expect.arrayContaining([
				"pie-mc",
				"pie-mc-config",
				"pie-inline-choice",
				"pie-inline-choice-config",
			]),
		);
	});

	test("ignores empty tag names", () => {
		const list = buildAuthoringAllowList(["", "pie-x"]);
		expect(list).toEqual(["pie-x", "pie-x-config"]);
	});
});
