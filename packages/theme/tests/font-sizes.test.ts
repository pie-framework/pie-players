import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

const FONT_SIZES_CSS_PATH = resolve(import.meta.dir, "../src/font-sizes.css");

const source = readFileSync(FONT_SIZES_CSS_PATH, "utf8");
const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
const collapsed = withoutComments.replace(/\s+/g, "");

/**
 * The scale a host's accommodation profile is written against. These are
 * Learnosity's four steps, which K-12 programs already specify, so they are a
 * published contract rather than a tuning choice — moving one silently changes
 * what "large" means for every learner already assigned it.
 */
const PRESETS: ReadonlyArray<readonly [string, string]> = [
	["normal", "1"],
	["large", "1.25"],
	["xlarge", "1.5"],
	["xxlarge", "1.75"],
];

/**
 * Both delivery paths. `pie-item-shell` / `pie-passage-shell` /
 * `pie-item-player` render PIE elements directly into their own shadow trees;
 * `pie-player` is the externally loaded wrapper other hosts render items
 * through. Targeting only the wrapper — which this file did — scaled nothing
 * this repo renders itself, and the miss was invisible because the token still
 * resolved and no rule consumed it.
 */
const CONTENT_HOSTS = [
	"pie-item-shell",
	"pie-passage-shell",
	"pie-item-player",
	"pie-player",
];

describe("the font size presets", () => {
	test("resolve the token to the documented scale", () => {
		for (const [preset, scale] of PRESETS) {
			expect(collapsed).toContain(
				`[data-font-size="${preset}"]{--pie-font-scale:${scale};}`,
			);
		}
	});

	test("leave the token resolvable when no host has opted in", () => {
		expect(collapsed).toContain(":root{--pie-font-scale:1;}");
	});
});

describe("the scaling rules", () => {
	test("reach both delivery paths", () => {
		for (const host of CONTENT_HOSTS) {
			// Once as a descendant of the opted-in ancestor, once carrying the
			// attribute itself, so a host can scope the accommodation either way.
			expect(collapsed).toContain(`[data-font-size]${host},`);
			expect(collapsed).toContain(`${host}[data-font-size]`);
		}
	});

	test("scale from the root, not from the parent", () => {
		// The hosts nest, so an `em` factor would compound: 1.25 at the themed
		// region times 1.25 at the item shell renders 1.56.
		expect(collapsed).toContain("font-size:calc(1rem*var(--pie-font-scale,1))");
		// `(?<!r)em` so `rem` is not mistaken for a bare `em` factor.
		expect(withoutComments).not.toMatch(/font-size:\s*calc\([^)]*(?<!r)em\b/);
	});

	test("do not force every descendant to one size", () => {
		// The previous rule set `font-size: inherit !important` on `*`, which
		// collapsed every heading, `<small>` and superscript in an item to body
		// size — a regression at 100% scale, before any accommodation was applied.
		expect(withoutComments).not.toMatch(/\*\s*,|\*\s*\{/);
		expect(withoutComments).not.toContain("font-size: inherit");
	});

	test("win by scope rather than by force", () => {
		// A host has to be able to override player styling through the normal
		// cascade; `pie-theme`'s own base-theme adapter keeps its specificity low
		// for the same reason.
		expect(source).not.toContain("!important");
	});
});
