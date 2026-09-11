import { expect, test } from "@playwright/test";
import { expectUsableTarget } from "../../../test-support/control-sizing";
import { withBrowserZoom } from "../../../test-support/browser-zoom";

for (const factor of [2, 4]) {
	test(`keeps nested section controls usable at ${factor * 100}% browser zoom`, async ({ baseURL }, testInfo) => {
		await withBrowserZoom(baseURL!, testInfo, async (page, setZoom) => {
			await page.goto("/three-section-assessment", { waitUntil: "networkidle" });
			const assessment = page.locator("pie-assessment-player-default");
			await expect(assessment.locator(".pie-assessment-player-current-position")).toHaveText("Section 1 of 3");
			await setZoom(factor);
			const next = assessment.getByRole("button", { name: "Next", exact: true });
			await next.focus();
			await expectUsableTarget(next);
			for (const tab of await assessment.getByRole("tab").all()) {
				await tab.focus();
				await expectUsableTarget(tab);
			}
			const reading = assessment.getByRole("button", { name: "Play reading", exact: true }).first();
			await reading.focus();
			await expectUsableTarget(reading);
			await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		});
	});
}

for (const width of [320, 375, 1280]) {
	test(`keeps nested section controls usable in a ${width}px assessment host`, async ({ page }) => {
		await page.addInitScript(() => {
			Object.defineProperty(window, "outerWidth", { get: () => 1768 });
		});
		await page.setViewportSize({ width, height: 800 });
		await page.goto("/three-section-assessment", { waitUntil: "networkidle" });
		const assessment = page.locator("pie-assessment-player-default");
		await expect(assessment.locator(".pie-assessment-player-current-position")).toHaveText("Section 1 of 3");
		await expectUsableTarget(assessment.getByRole("button", { name: "Next", exact: true }));
		for (const tab of await assessment.getByRole("tab").all()) await expectUsableTarget(tab);
		await expectUsableTarget(assessment.getByRole("button", { name: "Play reading", exact: true }).first());
		await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	});
}
