import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { type Page, expect, test } from "@playwright/test";

/**
 * Verifies content-stylesheet ownership in a real engine: `@scope` parsing,
 * the `CSSScopeRule` walk, and the stylesheet's actual bleed onto host markup
 * are not things happy-dom models faithfully.
 *
 * Bundles the compiled `dist/ui/content-styles.js`; requires
 * `bun run build:e2e:players-shared` first.
 */

const PACKAGE_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const ENTRY = path.join(PACKAGE_ROOT, "dist/ui/content-styles.js");
const COMPONENTS_CSS = readFileSync(
	path.join(PACKAGE_ROOT, "../theme/src/components.css"),
	"utf8",
);

let bundledCode: string;

test.beforeAll(async () => {
	if (!existsSync(ENTRY)) {
		throw new Error(
			`[content-styles.spec] ${ENTRY} does not exist. Run "bun run build:e2e:players-shared" (or "bun run build") before this suite.`,
		);
	}
	const result = await esbuild.build({
		entryPoints: [ENTRY],
		bundle: true,
		platform: "browser",
		format: "iife",
		globalName: "PieContentStylesUnderTest",
		target: "es2020",
		write: false,
	});
	bundledCode = result.outputFiles[0].text;
});

const PAGE = `<!doctype html><html><head></head><body>
<table id="host-table"><tr><td>Host</td></tr></table>
<h5 id="host-h5">Host heading</h5>
<div class="item-content"><h5 id="item-h5">Item heading</h5></div>
</body></html>`;

async function load(page: Page, { optOut = false } = {}) {
	await page.setContent(
		optOut ? PAGE.replace("<html>", '<html data-pie-content-styles="host">') : PAGE,
	);
	await page.addScriptTag({ content: bundledCode });
}

const install = (page: Page) =>
	page.evaluate(
		(css) =>
			(
				window as unknown as {
					PieContentStylesUnderTest: {
						installContentStyles: (css: string, source: string) => string;
					};
				}
			).PieContentStylesUnderTest.installContentStyles(css, "pie-item-player"),
		COMPONENTS_CSS,
	);

// The injection a host performs when it confines its copy to the player island.
const injectScopedHostCopy = (page: Page) =>
	page.evaluate((css) => {
		const style = document.createElement("style");
		style.id = "host-copy";
		style.textContent = `@scope (.item-content) {\n${css}\n}`;
		document.head.appendChild(style);
	}, COMPONENTS_CSS);

const state = (page: Page) =>
	page.evaluate(() => ({
		installed: document.querySelectorAll("style[data-pie-content-styles]")
			.length,
		hostTableCollapse: getComputedStyle(
			document.getElementById("host-table") as HTMLElement,
		).borderCollapse,
		itemH5Size: getComputedStyle(
			document.getElementById("item-h5") as HTMLElement,
		).fontSize,
		hostH5Size: getComputedStyle(
			document.getElementById("host-h5") as HTMLElement,
		).fontSize,
	}));

test.describe("content stylesheet ownership (real browser)", () => {
	test("installs a global copy when the host supplies none", async ({
		page,
	}) => {
		await load(page);
		expect(await install(page)).toBe("installed");

		const result = await state(page);
		expect(result.installed).toBe(1);
		expect(result.hostTableCollapse).toBe("collapse");
	});

	test("stands down when the host's scoped copy is already present", async ({
		page,
	}) => {
		await load(page);
		await injectScopedHostCopy(page);
		expect(await install(page)).toBe("host-supplied");

		const result = await state(page);
		expect(result.installed).toBe(0);
		expect(result.hostTableCollapse).toBe("separate");
		expect(result.itemH5Size).not.toBe(result.hostH5Size);
	});

	test("removes its copy when the host's scoped copy lands afterwards", async ({
		page,
	}) => {
		await load(page);
		expect(await install(page)).toBe("installed");
		expect((await state(page)).hostTableCollapse).toBe("collapse");

		await injectScopedHostCopy(page);
		await expect.poll(async () => (await state(page)).installed).toBe(0);

		const result = await state(page);
		expect(result.hostTableCollapse).toBe("separate");
		expect(result.itemH5Size).not.toBe(result.hostH5Size);
	});

	test("removes its copy when a host <link> copy finishes loading", async ({
		page,
	}) => {
		await load(page);
		expect(await install(page)).toBe("installed");

		await page.evaluate((css) => {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = URL.createObjectURL(new Blob([css], { type: "text/css" }));
			document.head.appendChild(link);
		}, COMPONENTS_CSS);

		await expect.poll(async () => (await state(page)).installed).toBe(0);
	});

	test("installs nothing when the host sets the opt-out attribute", async ({
		page,
	}) => {
		await load(page, { optOut: true });
		expect(await install(page)).toBe("opted-out");
		expect((await state(page)).installed).toBe(0);
	});
});
