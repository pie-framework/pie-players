import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Page, expect, test } from "@playwright/test";

/**
 * Verifies the content stylesheet's overrides of authored colours under a
 * color scheme, by computed style in a real engine: the overrides turn on
 * custom properties captured on the scheme's root and swapped inside a fill,
 * which happy-dom does not resolve.
 */

const THEME_SRC = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../../../theme/src",
);
const COMPONENTS_CSS = readFileSync(
	path.join(THEME_SRC, "components.css"),
	"utf8",
);
const SCHEMES_CSS = readFileSync(
	path.join(THEME_SRC, "color-schemes.css"),
	"utf8",
);
const SCHEMES = [
	...SCHEMES_CSS.matchAll(/^\[data-color-scheme="([\w-]+)"\]/gm),
].map(([, id]) => id);

// Markers as a sanitizer leaves them, over the authored inline colours.
const CONTENT = `
<p id="ink" data-pie-authored-ink style="color: rgb(200, 0, 0)">Red text</p>
<p id="border" data-pie-authored-border style="border: 2px solid rgb(0, 0, 200)">Boxed</p>
<p id="light" data-pie-authored-fill="light" style="background-color: rgb(250, 250, 250)">Pasted</p>
<span id="highlight" data-pie-authored-fill="shade" data-pie-authored-ink style="background-color: yellow; color: rgb(0, 0, 200)">Highlight</span>
<table>
	<tr id="row" data-pie-authored-fill="shade" style="background-color: rgb(221, 221, 221)">
		<th id="row-th">Header</th>
		<td id="row-shade" data-pie-authored-fill="shade" style="background-color: rgb(200, 200, 200)">Cell</td>
		<td>
			<span id="row-ink" data-pie-authored-ink style="color: rgb(0, 0, 0)">Ink</span>
			<span id="row-light" data-pie-authored-fill="light" style="background-color: rgb(255, 255, 255)">Light</span>
			<span id="row-border" data-pie-authored-border style="border: 1px solid rgb(0, 0, 0)">Box</span>
		</td>
	</tr>
</table>`;

// `#probe` reads the scheme's tokens where no fill swaps them.
const PROBE =
	'<div id="probe" style="color: var(--pie-text); background-color: var(--pie-background); border: 1px solid var(--pie-border)"></div>';

async function load(page: Page, body: string, htmlAttributes = "") {
	await page.setContent(
		`<!doctype html><html ${htmlAttributes}><head></head><body>${body}</body></html>`,
	);
	await page.addStyleTag({ content: SCHEMES_CSS });
	await page.addStyleTag({ content: COMPONENTS_CSS });
}

type Paint = { color: string; background: string; border: string };

const paints = (page: Page, root = "body") =>
	page.evaluate((rootSelector) => {
		const root = document.querySelector(rootSelector) as HTMLElement;
		const out: Record<string, Paint> = {};
		for (const element of root.querySelectorAll<HTMLElement>("[id]")) {
			const style = getComputedStyle(element);
			out[element.id] = {
				color: style.color,
				background: style.backgroundColor,
				border: style.borderTopColor,
			};
		}
		return out;
	}, root);

const TRANSPARENT = "rgba(0, 0, 0, 0)";

test.describe("authored colours under a color scheme (real browser)", () => {
	test("keeps authored colours under the default theme", async ({ page }) => {
		await load(page, `<div data-pie-content>${CONTENT}</div>`);
		const p = await paints(page);
		expect(p.ink.color).toBe("rgb(200, 0, 0)");
		expect(p.border.border).toBe("rgb(0, 0, 200)");
		expect(p.light.background).toBe("rgb(250, 250, 250)");
		expect(p.row.background).toBe("rgb(221, 221, 221)");
		expect(p["row-shade"].background).toBe("rgb(200, 200, 200)");
	});

	for (const scheme of SCHEMES) {
		test(`gives authored colours to ${scheme}`, async ({ page }) => {
			await load(
				page,
				`<div data-pie-content>${CONTENT}</div>${PROBE}`,
				`data-color-scheme="${scheme}"`,
			);
			const p = await paints(page);
			const { color: ink, background: paper } = p.probe;
			expect(ink).not.toBe(paper);

			expect(p.ink.color).toBe(ink);
			expect(p.border.border).toBe(p.probe.border);
			expect(p.light).toMatchObject({ color: ink, background: TRANSPARENT });

			// A shade fill inverts, and a fill nested in it inverts once.
			for (const id of ["highlight", "row", "row-shade"]) {
				expect(p[id], id).toMatchObject({ color: paper, background: ink });
			}
			expect(p["row-th"].color).toBe(paper);
			expect(p["row-ink"].color).toBe(paper);
			expect(p["row-light"]).toMatchObject({
				color: paper,
				background: TRANSPARENT,
			});
			expect(p["row-border"].border).toBe(paper);
		});
	}

	test("overrides authored markup an element portals outside the player", async ({
		page,
	}) => {
		await load(
			page,
			`<div data-pie-content></div><div id="portal">${CONTENT}</div>${PROBE}`,
			'data-color-scheme="white-on-black"',
		);
		const p = await paints(page);
		expect(p.ink.color).toBe(p.probe.color);
		expect(p.row.background).toBe(p.probe.color);
	});

	test("takes the ink and page of the nearest scheme root", async ({
		page,
	}) => {
		// A scoped <pie-theme> writes its tokens inline on itself, below a
		// document that may carry another scheme or none.
		const island = (id: string, tokens: string) =>
			`<div id="${id}" data-color-scheme="custom" style="${tokens}"><div data-pie-content>${CONTENT.replaceAll('id="', `id="${id}-`)}</div></div>`;
		await load(
			page,
			island(
				"inner",
				"--pie-text: rgb(255, 255, 0); --pie-black: rgb(255, 255, 0); --pie-border: rgb(255, 255, 0); --pie-background: rgb(0, 0, 51); --pie-white: rgb(0, 0, 51)",
			) + `<div id="outside">${CONTENT}</div>`,
			'data-color-scheme="white-on-black"',
		);
		const inner = await paints(page, "#inner");
		expect(inner["inner-ink"].color).toBe("rgb(255, 255, 0)");
		expect(inner["inner-row"]).toMatchObject({
			color: "rgb(0, 0, 51)",
			background: "rgb(255, 255, 0)",
		});
		expect(inner["inner-row-ink"].color).toBe("rgb(0, 0, 51)");

		const outside = await paints(page, "#outside");
		expect(outside.row).toMatchObject({
			color: "rgb(0, 0, 0)",
			background: "rgb(255, 255, 255)",
		});
	});

	test("leaves authored colours outside a scoped scheme", async ({ page }) => {
		await load(
			page,
			`<div data-color-scheme="yellow-on-blue"><div data-pie-content></div></div><div id="outside">${CONTENT}</div>`,
		);
		const p = await paints(page, "#outside");
		expect(p.ink.color).toBe("rgb(200, 0, 0)");
		expect(p.row.background).toBe("rgb(221, 221, 221)");
	});
});
