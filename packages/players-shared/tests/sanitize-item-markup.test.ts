import { describe, expect, test } from "bun:test";

import {
	buildAuthoringAllowList,
	sanitizeItemMarkup,
} from "../src/security/sanitize-item-markup.js";

/**
 * This file deliberately does NOT cover DOMPurify's actual sanitization
 * behavior (script/handler stripping, custom-element allow/deny, the
 * wrap-overwide wrappers, or the sanitizer-factory wiring that threads
 * through to any of that). DOMPurify >=3.4.8 fails to sanitize under
 * happy-dom — confirmed 2026-08-06, bisected against this exact module and
 * verified correct in real Chromium in the same investigation — so a
 * happy-dom assertion about sanitization passing is not evidence the
 * sanitizer works, only that happy-dom didn't crash. Those assertions live in
 * `tests/e2e/sanitize-item-markup.spec.ts` (Playwright, real Chromium)
 * instead. What stays here never reaches the purifier: the empty-markup
 * short-circuit returns before `resolvePurifier()` is called, and
 * `buildAuthoringAllowList` is pure string logic with no DOM involved.
 */

describe("sanitizeItemMarkup", () => {
	test("empty markup returns empty string", () => {
		expect(sanitizeItemMarkup("")).toBe("");
		expect(sanitizeItemMarkup(undefined as unknown as string)).toBe("");
		expect(sanitizeItemMarkup(null as unknown as string)).toBe("");
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
