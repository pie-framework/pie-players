import { expect, test } from "@playwright/test";

// npm `latest` of `@pie-element/*` is the legacy line, which ships no browser
// ESM, so `?player=esm` loads the demos' pinned pie-elements-ng builds.
const BROWSER_BUILD = /\/@pie-element\/[^/]+@[^/]+\/dist\/browser\/delivery\//;

for (const path of ["/tts-ssml", "/two-passages"]) {
	test(`${path} renders pie-elements-ng builds under the esm player`, async ({
		page,
	}) => {
		const browserBuilds: string[] = [];
		page.on("response", (response) => {
			if (response.ok() && BROWSER_BUILD.test(response.url())) {
				browserBuilds.push(response.url());
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
		).toBeVisible({ timeout: 30_000 });
		await expect(page.getByText("Player Error")).toHaveCount(0);
		expect(browserBuilds.length).toBeGreaterThan(0);
	});
}
