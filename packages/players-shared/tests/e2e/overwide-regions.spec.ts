import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { type Page, expect, test } from "@playwright/test";

/**
 * Pins, in a real layout engine, what the table wrapper does to the table it
 * holds: it lays the table out where it stood unwrapped, and it is a keyboard
 * stop only while it scrolls. Both rest on measured layout and on
 * `ResizeObserver` delivery, which a DOM emulator does not provide.
 *
 * Bundles the compiled `dist/security/*.js`, as `wrap-overwide-mutations.spec.ts`
 * does, and styles the wrapper with the theme's own `components.css`.
 */

const PACKAGE_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const TABLES_ENTRY = path.join(
	PACKAGE_ROOT,
	"dist/security/wrap-overwide-tables.js",
);
const REGIONS_ENTRY = path.join(
	PACKAGE_ROOT,
	"dist/security/overwide-regions.js",
);
const THEME_CSS = path.resolve(PACKAGE_ROOT, "../theme/src/components.css");

let bundledCode: string;

test.beforeAll(async () => {
	for (const entry of [TABLES_ENTRY, REGIONS_ENTRY]) {
		if (!existsSync(entry)) {
			throw new Error(
				`[overwide-regions.spec] ${entry} does not exist. Run "bun run build:e2e:players-shared" (or "bun run build") before this suite.`,
			);
		}
	}

	const result = await esbuild.build({
		stdin: {
			contents: `
				export { wrapOverwideTablesInElement } from ${JSON.stringify(TABLES_ENTRY)};
				export { createOverwideRegionTracker } from ${JSON.stringify(REGIONS_ENTRY)};
			`,
			resolveDir: PACKAGE_ROOT,
			sourcefile: "overwide-regions-under-test.js",
		},
		bundle: true,
		platform: "browser",
		format: "iife",
		globalName: "PieOverwideRegionsUnderTest",
		target: "es2020",
		write: false,
	});

	bundledCode = result.outputFiles[0].text;
});

interface OverwideRegionsUnderTest {
	wrapOverwideTablesInElement: (root: Element) => number;
	createOverwideRegionTracker: (root: Element) => {
		track(): void;
		disconnect(): void;
	};
}

declare global {
	interface Window {
		PieOverwideRegionsUnderTest: OverwideRegionsUnderTest;
	}
}

/** Renders `markup` in a `[data-pie-content]` column, wraps it and tracks it. */
async function renderWrapped(page: Page, markup: string, width: number) {
	await page.setContent(
		`<!doctype html><html><body><div id="column" data-pie-content style="width:${width}px">${markup}</div></body></html>`,
	);
	await page.addStyleTag({ path: THEME_CSS });
	await page.addScriptTag({ content: bundledCode });
	await page.evaluate(() => {
		const column = document.getElementById("column") as HTMLElement;
		const api = window.PieOverwideRegionsUnderTest;
		api.wrapOverwideTablesInElement(column);
		api.createOverwideRegionTracker(column).track();
	});
}

function regionState(page: Page) {
	return page.evaluate(() => {
		const wrapper = document.querySelector(".pie-table-scroll") as HTMLElement;
		return {
			tabindex: wrapper.getAttribute("tabindex"),
			role: wrapper.getAttribute("role"),
			label: wrapper.getAttribute("aria-label"),
		};
	});
}

const NARROW_TABLE =
	'<table style="width:200px"><caption>Scores</caption><tr><td>a</td></tr></table>';

test.describe("table wrapper layout and regions", () => {
	test("lays a table with a negative top margin out where it stood unwrapped", async ({
		page,
	}) => {
		const markup =
			'<p style="margin:0">before</p><table style="margin-top:-12px"><tr><td style="height:40px;border-top:2px dashed">x</td></tr></table>';
		await page.setContent(
			`<!doctype html><html><body><div id="column" data-pie-content style="width:400px">${markup}</div></body></html>`,
		);
		await page.addStyleTag({ path: THEME_CSS });
		const tableTop = () =>
			page.evaluate(() => {
				const column = document.getElementById("column") as HTMLElement;
				const table = column.querySelector("table") as HTMLElement;
				return (
					table.getBoundingClientRect().top - column.getBoundingClientRect().top
				);
			});
		const unwrapped = await tableTop();

		await page.addScriptTag({ content: bundledCode });
		await page.evaluate(() =>
			window.PieOverwideRegionsUnderTest.wrapOverwideTablesInElement(
				document.getElementById("column") as HTMLElement,
			),
		);

		expect(await tableTop()).toBeCloseTo(unwrapped, 1);
		const clipped = await page.evaluate(() => {
			const wrapper = document.querySelector(
				".pie-table-scroll",
			) as HTMLElement;
			const table = wrapper.querySelector("table") as HTMLElement;
			return (
				table.getBoundingClientRect().top < wrapper.getBoundingClientRect().top
			);
		});
		expect(clipped).toBe(false);
	});

	test("a table that fits adds no tab stop", async ({ page }) => {
		await renderWrapped(page, NARROW_TABLE, 400);
		await expect
			.poll(() => regionState(page))
			.toEqual({ tabindex: null, role: null, label: null });
	});

	test("a table wider than its column is a named region", async ({ page }) => {
		await renderWrapped(page, NARROW_TABLE, 120);
		await expect
			.poll(() => regionState(page))
			.toEqual({
				tabindex: "0",
				role: "region",
				label: "Scrollable table: Scores",
			});
	});

	test("follows the column as it narrows and widens", async ({ page }) => {
		await renderWrapped(page, NARROW_TABLE, 400);
		await expect.poll(async () => (await regionState(page)).role).toBeNull();

		const setWidth = (width: number) =>
			page.evaluate((value) => {
				(document.getElementById("column") as HTMLElement).style.width =
					`${value}px`;
			}, width);

		await setWidth(120);
		await expect
			.poll(async () => (await regionState(page)).role)
			.toBe("region");

		await setWidth(400);
		await expect.poll(async () => (await regionState(page)).role).toBeNull();
	});
});
