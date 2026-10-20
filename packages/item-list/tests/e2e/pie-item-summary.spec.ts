import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import * as esbuild from "esbuild";

/**
 * `<pie-item-summary>` from the built bundle in a real browser: what the sanitizer strips from
 * summary HTML, and math arriving as MathML. DOMPurify does not sanitize under happy-dom, so these
 * assertions cannot live in the bun tests. The bundle's lazy `texToMathml` chunk is inlined here,
 * so the page needs no server. Requires `bun run build:e2e:item-list`.
 */

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ENTRY = path.join(PACKAGE_ROOT, "dist/pie-item-list.js");

let bundledCode: string;

test.beforeAll(async () => {
	if (!existsSync(ENTRY)) {
		throw new Error(
			`[pie-item-summary.spec] ${ENTRY} does not exist. Run "bun run build:e2e:item-list" first.`,
		);
	}
	const result = await esbuild.build({
		entryPoints: [ENTRY],
		bundle: true,
		platform: "browser",
		format: "iife",
		target: "es2020",
		write: false,
	});
	bundledCode = result.outputFiles[0].text;
});

/** Mounts a summary row whose one element summarizes to `summary`, and returns its HTML. */
async function renderInPage(page: Page, summary: object, markup = ""): Promise<string> {
	await page.setContent("<!doctype html><html><body></body></html>");
	await page.addScriptTag({ content: bundledCode });
	return page.evaluate(
		async ({ summary, markup }) => {
			const element = document.createElement("pie-item-summary") as HTMLElement &
				Record<string, unknown>;
			element.config = {
				id: "item",
				elements: { "multiple-choice": "@pie-element/multiple-choice@11.0.0" },
				models: [{ id: "1", element: "multiple-choice" }],
				markup: `${markup}<multiple-choice id="1"></multiple-choice>`,
			};
			element.resolve = async () => () => summary;
			const loaded = new Promise((resolve) =>
				element.addEventListener("load-complete", resolve, { once: true }),
			);
			document.body.append(element);
			await loaded;
			return element.innerHTML;
		},
		{ summary, markup },
	);
}

test.describe("<pie-item-summary> (real browser)", () => {
	test("strips scripts, handlers and script URLs from summary HTML", async ({ page }) => {
		const html = await renderInPage(page, {
			prompt:
				'<p>Pick one<script>window.hacked = true</script><img src="x.png" onerror="window.hacked = true"><a href="javascript:alert(1)">link</a></p>',
			options: [{ id: "a", label: '<b onclick="alert(1)">Four</b>', correct: true }],
			answer: "<p>Four<iframe src=\"https://example.com\"></iframe></p>",
			figure: { src: "javascript:alert(1)", alt: "chart" },
		});
		expect(html).toContain("Pick one");
		expect(html).toContain("<b>Four</b>");
		expect(html).not.toContain("<script");
		expect(html).not.toContain("onerror");
		expect(html).not.toContain("onclick");
		expect(html).not.toContain("javascript:");
		expect(html).not.toContain("<iframe");
		expect(await page.evaluate(() => "hacked" in window)).toBe(false);
	});

	test("renders the stem's and the summary's TeX as MathML", async ({ page }) => {
		const html = await renderInPage(
			page,
			{ prompt: "<p>Simplify \\(\\frac{1}{2} + \\frac{1}{2}\\).</p>" },
			"<p>Given \\(x^2 = 4\\)</p>",
		);
		expect(html.match(/<math/g)?.length).toBe(2);
		expect(html).toContain("<mfrac>");
		expect(html).not.toContain("\\(");
	});

	test("keeps the bundled summarizers' blank markers through the sanitizer", async ({ page }) => {
		await page.setContent("<!doctype html><html><body></body></html>");
		await page.addScriptTag({ content: bundledCode });
		const blank = await page.evaluate(async () => {
			const element = document.createElement("pie-item-summary") as HTMLElement &
				Record<string, unknown>;
			element.config = {
				id: "item",
				elements: { ecr: "@pie-element/explicit-constructed-response@5.0.0" },
				models: [
					{ id: "1", element: "ecr", markup: "<p>A {{0}}</p>", choices: { 0: [{ label: "cat" }] } },
				],
				markup: '<ecr id="1"></ecr>',
			};
			const loaded = new Promise((resolve) =>
				element.addEventListener("load-complete", resolve, { once: true }),
			);
			document.body.append(element);
			await loaded;
			const marker = element.querySelector(".pie-item-summary__blank");
			return marker && { text: marker.textContent, display: getComputedStyle(marker).display };
		});
		expect(blank).toEqual({ text: "[1]", display: "inline-block" });
	});
});
