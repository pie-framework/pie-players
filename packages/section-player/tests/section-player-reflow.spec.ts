import { expect, test } from "@playwright/test";

const REFLOW_ROUTES = [
	"/question-passage?mode=candidate&layout=splitpane",
	"/tts-ssml?mode=candidate&layout=splitpane",
];

test.describe("section player splitpane reflow", () => {
	for (const route of REFLOW_ROUTES) {
		test(`avoids horizontal overflow at 320px for ${route}`, async ({ page }) => {
			await page.setViewportSize({ width: 320, height: 900 });
			await page.goto(route, { waitUntil: "networkidle" });

			const host = page.locator("pie-section-player-splitpane").first();
			await expect(host).toBeVisible();

			const splitContent = page.locator(".pie-section-player-split-content").first();
			await expect(splitContent).toBeVisible();

			await expect
				.poll(async () => {
					return await splitContent.evaluate((element) => {
						const el = element as HTMLElement;
						return el.scrollWidth <= el.clientWidth + 1;
					});
				})
				.toBe(true);

			const itemPane = page.locator(".pie-section-player-items-pane").first();
			await expect(itemPane).toBeVisible();
			await expect
				.poll(async () => {
					return await itemPane.evaluate((element) => {
						const el = element as HTMLElement;
						return el.scrollWidth <= el.clientWidth + 1;
					});
				})
				.toBe(true);
		});
	}
});
