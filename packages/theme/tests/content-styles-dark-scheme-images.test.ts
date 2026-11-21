import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "bun:test";

import { renderPieThemeCss } from "../src/theme-css.js";

const collapsed = readFileSync(
	resolve(import.meta.dir, "../src/components.css"),
	"utf8",
)
	.replace(/\/\*[\s\S]*?\*\//g, "")
	.replace(/\s+/g, "");

const backingRules = [...collapsed.matchAll(/([^{}]+)\{([^}]*)\}/g)]
	.map(([, selector, body]) => ({ selector, body }))
	.filter(({ body }) => body.includes("--pie-content-image-backing"));

const BACKING =
	"background-color:light-dark(transparent,var(--pie-content-image-backing,#fff))";

/** The built-ins painted on a dark page, written out so a palette edit that flips one shows up here. */
const DARK_BUILT_INS = [
	"light-gray-on-dark-gray",
	"white-on-black",
	"yellow-on-blue",
	"yellow-on-navy",
];

const stampedPolarity = (css: string): Record<string, string> =>
	Object.fromEntries(
		[
			...css.matchAll(
				/^\[data-color-scheme="([^"]+)"\] \{\n\tcolor-scheme: (light|dark);$/gm,
			),
		].map(([, id, polarity]) => [id, polarity]),
	);

describe("image backing on a dark page", () => {
	test("backs every content image with white when the used color-scheme is dark", () => {
		expect(backingRules).toContainEqual({
			selector: ":where([data-pie-content])img",
			body: `${BACKING};color:light-dark(currentcolor,Canvas);`,
		});
	});

	test("keeps an authored light fill on an image as the backing", () => {
		expect(backingRules).toContainEqual({
			selector: '[data-color-scheme]img[data-pie-authored-fill="light"]',
			body: `${BACKING}!important;color:light-dark(var(--pie-text),Canvas)!important;`,
		});
	});

	// Polarity comes from `color-scheme`, so a host-registered scheme and a host
	// dark theme take the same path as a built-in.
	test("names no scheme", () => {
		expect(backingRules.length).toBeGreaterThan(0);
		for (const { selector } of backingRules) {
			expect(selector).not.toMatch(/data-color-scheme=/);
		}
	});

	test("the static scheme CSS stamps each built-in's polarity", () => {
		const stamped = stampedPolarity(renderPieThemeCss().colorSchemesCss);
		expect(Object.keys(stamped)).toHaveLength(10);
		expect(
			Object.entries(stamped)
				.filter(([, polarity]) => polarity === "dark")
				.map(([id]) => id)
				.sort(),
		).toEqual(DARK_BUILT_INS);
	});

	test("the dark Base Theme rule states dark and the light one states nothing", () => {
		const css = renderPieThemeCss().tokensCss;
		expect(css).toContain(
			'[data-theme="dark"],\n:where(pie-theme[theme="dark"]:not([scope="document"])) {\n\tcolor-scheme: dark;',
		);
		expect(css.match(/color-scheme:/g)).toHaveLength(1);
	});

	test("the eliminator's image casing flips with the page", () => {
		expect(collapsed).toContain(
			"stroke:var(--pie-answer-eliminator-image-strike-casing-color,light-dark(rgba(255,255,255,0.85),rgba(0,0,0,0.85)));",
		);
	});
});
