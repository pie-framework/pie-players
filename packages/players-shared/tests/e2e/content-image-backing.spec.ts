import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Page, expect, test } from "@playwright/test";

/**
 * Verifies the content stylesheet's white backing behind images on a dark page,
 * by computed style in a real engine: the rule resolves `light-dark()` against
 * the inherited `color-scheme`, which happy-dom does not evaluate.
 */

const THEME_SRC = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../../../theme/src",
);
const read = (file: string) => readFileSync(path.join(THEME_SRC, file), "utf8");
const TOKENS_CSS = read("tokens.css");
const SCHEMES_CSS = read("color-schemes.css");
const COMPONENTS_CSS = read("components.css");

const DARK_SCHEMES = [
	"white-on-black",
	"yellow-on-blue",
	"light-gray-on-dark-gray",
	"yellow-on-navy",
];
const LIGHT_SCHEMES = [
	...SCHEMES_CSS.matchAll(/^\[data-color-scheme="([\w-]+)"\]/gm),
]
	.map(([, id]) => id)
	.filter((id) => !DARK_SCHEMES.includes(id));

const CONTENT = `
<div data-pie-content>
	<span class="pie-image-scroll"><img id="wrapped" alt="wrapped"></span>
	<p>Inline <img id="inline" alt="inline"> image</p>
	<img id="authored" alt="authored" data-pie-authored-fill="light" style="background-color: rgb(255, 255, 255)">
	<svg><line id="casing" class="pie-answer-eliminator-image-strike-casing" x1="0" y1="0" x2="10" y2="10"></line></svg>
</div>
<img id="outside" alt="outside">`;

async function load(page: Page, htmlAttributes = "") {
	await page.setContent(
		`<!doctype html><html ${htmlAttributes}><head></head><body>${CONTENT}</body></html>`,
	);
	await page.addStyleTag({ content: TOKENS_CSS });
	await page.addStyleTag({ content: SCHEMES_CSS });
	await page.addStyleTag({ content: COMPONENTS_CSS });
}

type Paint = { background: string; color: string; stroke: string };

const paints = (page: Page) =>
	page.evaluate(() => {
		const out: Record<string, Paint> = {};
		for (const element of document.querySelectorAll<Element>("[id]")) {
			const style = getComputedStyle(element);
			out[element.id] = {
				background: style.backgroundColor,
				color: style.color,
				stroke: style.stroke,
			};
		}
		return out;
	});

const TRANSPARENT = "rgba(0, 0, 0, 0)";
const WHITE = "rgb(255, 255, 255)";
const LIGHT_CASING = "rgba(255, 255, 255, 0.85)";
const DARK_CASING = "rgba(0, 0, 0, 0.85)";

const isDark = (rgb: string) =>
	(rgb.match(/\d+/g) ?? []).slice(0, 3).every((channel) => Number(channel) < 64);

function expectBacked(p: Record<string, Paint>) {
	for (const id of ["wrapped", "inline", "authored"]) {
		expect(p[id].background, id).toBe(WHITE);
		// A broken image's alt text stays legible on the backing.
		expect(isDark(p[id].color), `${id} alt text ${p[id].color}`).toBe(true);
	}
	expect(p.casing.stroke).toBe(DARK_CASING);
	expect(p.outside.background).toBe(TRANSPARENT);
}

test.describe("image backing on a dark page (real browser)", () => {
	test("leaves images as authored under the default theme", async ({ page }) => {
		await load(page);
		const p = await paints(page);
		expect(p.wrapped.background).toBe(TRANSPARENT);
		expect(p.inline.background).toBe(TRANSPARENT);
		expect(p.authored.background).toBe(WHITE);
		expect(p.casing.stroke).toBe(LIGHT_CASING);
	});

	for (const scheme of DARK_SCHEMES) {
		test(`backs images under ${scheme}`, async ({ page }) => {
			await load(page, `data-color-scheme="${scheme}"`);
			expectBacked(await paints(page));
		});
	}

	for (const scheme of LIGHT_SCHEMES) {
		test(`leaves images transparent under ${scheme}`, async ({ page }) => {
			await load(page, `data-color-scheme="${scheme}"`);
			const p = await paints(page);
			for (const id of ["wrapped", "inline", "authored"]) {
				expect(p[id].background, id).toBe(TRANSPARENT);
			}
			expect(p.casing.stroke).toBe(LIGHT_CASING);
		});
	}

	test("backs images under the dark Base Theme", async ({ page }) => {
		await load(page, 'data-theme="dark"');
		const p = await paints(page);
		expect(p.wrapped.background).toBe(WHITE);
		expect(p.inline.background).toBe(WHITE);
		expect(p.casing.stroke).toBe(DARK_CASING);
	});

	test("backs images when the host declares a dark color-scheme itself", async ({
		page,
	}) => {
		// The path `<pie-theme>` takes too: it writes the keyword inline on its
		// target for a resolved scheme, built-in or host-registered.
		await load(page, 'style="color-scheme: dark"');
		const p = await paints(page);
		expect(p.wrapped.background).toBe(WHITE);
		expect(p.casing.stroke).toBe(DARK_CASING);
	});
});
