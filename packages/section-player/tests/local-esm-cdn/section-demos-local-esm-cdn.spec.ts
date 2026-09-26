import { expect, test } from "@playwright/test";

// Under `dev:section:cdn` the demos point the ESM loader at their own origin,
// where the dev server serves pie-elements-ng from the checkout on disk.
const NG_REQUEST = /\/@pie-(?:element|lib|elements-ng)\//;
// The config resolves the checkout path.
const CHECKOUT = `${process.env.PIE_ELEMENTS_NG_PATH}/`;

for (const path of ["/tts-ssml", "/two-passages"]) {
	test(`${path} loads pie-elements-ng from the dev server under esm`, async ({
		page,
		baseURL,
	}) => {
		const manifestsFromCheckout: string[] = [];
		const browserBuilds: string[] = [];
		const loadedElsewhere: string[] = [];
		page.on("response", (response) => {
			const url = response.url();
			if (!NG_REQUEST.test(url)) return;
			if (!url.startsWith(`${baseURL}/`)) {
				loadedElsewhere.push(url);
				return;
			}
			if (!response.ok()) return;
			// A manifest response names the file it served. Modules go through
			// Vite's transform, which sets no such header.
			if (response.headers()["x-local-esm-cdn-file"]?.startsWith(CHECKOUT)) {
				manifestsFromCheckout.push(url);
			}
			if (url.includes("/dist/browser/delivery/")) {
				browserBuilds.push(url);
			}
		});

		await page.goto(`${path}?mode=candidate&layout=splitpane&player=esm`, {
			waitUntil: "networkidle",
		});
		await expect(
			page
				.locator(
					'pie-section-player-splitpane pie-item-player input[type="radio"]',
				)
				.first(),
		).toBeVisible({ timeout: 60_000 });
		await expect(page.getByText("Player Error")).toHaveCount(0);

		expect(manifestsFromCheckout.length).toBeGreaterThan(0);
		expect(browserBuilds.length).toBeGreaterThan(0);
		expect(loadedElsewhere).toEqual([]);
	});
}
