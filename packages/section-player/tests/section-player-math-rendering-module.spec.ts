import { expect, type Page, test } from "@playwright/test";

/**
 * The section player renders items through `@pie-players/pie-item-player` as
 * the host resolves it, so a page holding both players loads one item player
 * and at most one MathJax module, from the item player's own build. ESM
 * elements bring their own renderer, so an ESM section fetches none (PIE-1096).
 */
const WORKSPACE_MATHJAX_CHUNK =
	/\/packages\/[^/]+\/dist\/chunks\/module-[^/]+\.js$/;
const ITEM_SHELLS = 'pie-item-shell[data-pie-shell-root="item"]';

function collectMathJaxChunkRequests(page: Page): string[] {
	const pathnames: string[] = [];
	page.on("request", (request) => {
		const { pathname } = new URL(request.url());
		if (WORKSPACE_MATHJAX_CHUNK.test(pathname)) pathnames.push(pathname);
	});
	return pathnames;
}

test.describe("section player math rendering module", () => {
	test("an IIFE section fetches the item player's MathJax module once", async ({
		page,
	}) => {
		const requests = collectMathJaxChunkRequests(page);
		await page.goto("/tts-ssml?mode=candidate&layout=splitpane&player=iife", {
			waitUntil: "networkidle",
		});
		await expect(page.locator(ITEM_SHELLS)).toHaveCount(2, {
			timeout: 30_000,
		});

		expect(requests).toHaveLength(1);
		expect(requests[0]).toContain("/packages/item-player/dist/chunks/");
	});

	test("an ESM section fetches no MathJax module", async ({ page }) => {
		const requests = collectMathJaxChunkRequests(page);
		// The demo's elements publish no browser ESM, so the load fails after the
		// preload has skipped the renderer; items rendering settles it as well.
		let esmLoadFailed = false;
		page.on("console", (message) => {
			if (message.text().includes("Error loading elements (esm-load)")) {
				esmLoadFailed = true;
			}
		});
		await page.goto("/tts-ssml?mode=candidate&layout=splitpane&player=esm", {
			waitUntil: "networkidle",
		});
		await expect
			.poll(
				async () =>
					esmLoadFailed || (await page.locator(ITEM_SHELLS).count()) === 2,
				{ timeout: 30_000 },
			)
			.toBe(true);

		expect(requests).toEqual([]);
	});
});
