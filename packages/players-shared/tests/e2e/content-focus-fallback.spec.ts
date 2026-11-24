import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Page, expect, test } from "@playwright/test";

/**
 * Verifies the content stylesheet's fallback keyboard focus ring by computed
 * style in a real engine: happy-dom does not decide `:focus-visible` from the
 * input modality.
 */

const THEME_SRC = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../../../theme/src",
);
const read = (file: string) => readFileSync(path.join(THEME_SRC, file), "utf8");
const TOKENS_CSS = read("tokens.css");
const SCHEMES_CSS = read("color-schemes.css");
const COMPONENTS_CSS = read("components.css");

const SCHEMES = [
	...SCHEMES_CSS.matchAll(/^\[data-color-scheme="([\w-]+)"\]/gm),
].map(([, id]) => id);

// Focus styles an element sets for itself: its own outline, and an indicator
// drawn with a box-shadow beside an outline removal.
const ELEMENT_CSS = `
.own-outline:focus-visible { outline: 3px dashed rgb(200, 0, 0); outline-offset: 0px; }
.own-shadow:focus-visible { outline: none; box-shadow: 0 0 0 3px rgb(200, 0, 0); }`;

// `#probe` paints the token the ring should resolve to, in the same scope.
const CONTENT = `
<div data-pie-content>
	<span id="probe" style="color: var(--pie-focus-keyboard-outline)">probe</span>
	<button id="plain">Plain</button>
	<a id="link" href="#anchor">Link</a>
	<div id="focusable" tabindex="0">Focusable</div>
	<button id="own-outline" class="own-outline">Own outline</button>
	<button id="own-shadow" class="own-shadow">Own shadow</button>
	<span id="image-scroll" class="pie-image-scroll" tabindex="0"><img alt="wide"></span>
</div>
<button id="outside">Outside</button>`;

async function load(
	page: Page,
	{ htmlAttributes = "", tokens = true, rootStyle = "" } = {},
) {
	await page.setContent(
		`<!doctype html><html ${htmlAttributes} style="${rootStyle}"><head></head><body>${CONTENT}</body></html>`,
	);
	if (tokens) {
		await page.addStyleTag({ content: TOKENS_CSS });
		await page.addStyleTag({ content: SCHEMES_CSS });
	}
	await page.addStyleTag({ content: ELEMENT_CSS });
	await page.addStyleTag({ content: COMPONENTS_CSS });
}

type Ring = {
	id: string;
	style: string;
	width: string;
	offset: string;
	color: string;
};

/** Tabs from the top of the page until `id` has focus, then reads its outline. */
async function tabTo(page: Page, id: string): Promise<Ring> {
	await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
	for (let step = 0; step < 12; step += 1) {
		await page.keyboard.press("Tab");
		if (await page.evaluate((id) => document.activeElement?.id === id, id)) {
			break;
		}
	}
	return page.evaluate(() => {
		const element = document.activeElement as HTMLElement;
		const style = getComputedStyle(element);
		return {
			id: element.id,
			style: style.outlineStyle,
			width: style.outlineWidth,
			offset: style.outlineOffset,
			color: style.outlineColor,
		};
	});
}

const probeColor = (page: Page) =>
	page.evaluate(
		() => getComputedStyle(document.getElementById("probe") as HTMLElement).color,
	);

const ring = (id: string, color: string): Ring => ({
	id,
	style: "solid",
	width: "2px",
	offset: "2px",
	color,
});

test.describe("item content focus fallback ring (real browser)", () => {
	test("rings each control with no focus style of its own on keyboard focus", async ({
		page,
	}) => {
		await load(page);
		const token = await probeColor(page);
		for (const id of ["plain", "link", "focusable"]) {
			expect(await tabTo(page, id)).toEqual(ring(id, token));
		}
	});

	for (const [label, htmlAttributes] of [
		["the dark Base Theme", 'data-theme="dark"'],
		...SCHEMES.map((scheme) => [scheme, `data-color-scheme="${scheme}"`]),
	] as const) {
		test(`takes the keyboard focus outline under ${label}`, async ({
			page,
		}) => {
			await load(page, { htmlAttributes });
			const token = await probeColor(page);
			expect(await tabTo(page, "plain")).toEqual(ring("plain", token));
		});
	}

	test("falls through the keyboard focus chain in order", async ({ page }) => {
		const chain = [
			["--pie-focus-keyboard-outline", "rgb(1, 1, 1)"],
			["--pie-focus-outline", "rgb(2, 2, 2)"],
			["--pie-button-focus-outline", "rgb(3, 3, 3)"],
			["--pie-focus-checked-border", "rgb(4, 4, 4)"],
		];
		for (let start = 0; start <= chain.length; start += 1) {
			const set = chain.slice(start);
			await load(page, {
				tokens: false,
				rootStyle: set.map(([name, value]) => `${name}: ${value}`).join("; "),
			});
			expect(await tabTo(page, "plain")).toEqual(
				ring("plain", set[0]?.[1] ?? "rgb(21, 101, 192)"),
			);
		}
	});

	test("leaves a control's own focus indicator alone", async ({ page }) => {
		await load(page);
		expect(await tabTo(page, "own-outline")).toEqual({
			id: "own-outline",
			style: "dashed",
			width: "3px",
			offset: "0px",
			color: "rgb(200, 0, 0)",
		});
		expect((await tabTo(page, "own-shadow")).style).toBe("none");
	});

	test("keeps the image scroll wrapper on its registered chain", async ({
		page,
	}) => {
		await load(page, { rootStyle: "--pie-focus-ring-color: rgb(9, 9, 9)" });
		expect(await tabTo(page, "image-scroll")).toEqual(
			ring("image-scroll", "rgb(9, 9, 9)"),
		);
	});

	test("rings nothing on pointer focus or outside the content root", async ({
		page,
	}) => {
		await load(page);
		await page.click("#plain");
		expect(
			await page.evaluate(() => {
				const element = document.activeElement as HTMLElement;
				return [element.id, getComputedStyle(element).outlineStyle];
			}),
		).toEqual(["plain", "none"]);
		const outside = await tabTo(page, "outside");
		expect(outside.id).toBe("outside");
		expect(outside.style).toBe("auto");
	});
});
