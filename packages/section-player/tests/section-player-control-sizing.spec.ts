import { expect, test } from "@playwright/test";
import { expectUsableTarget } from "../../../test-support/control-sizing";
import { withBrowserZoom } from "../../../test-support/browser-zoom";

// A host panel can be much narrower than the OS window without browser zoom.
// Keep those two dimensions independent; a headless viewport alone makes them
// equal and missed the original double-scaled, 3.66px read-aloud trigger.
for (const route of ["three-questions", "quiz-engine-nds-icon"]) {
	for (const factor of [2, 4]) {
		test(`keeps ${route} calculator controls usable at ${factor * 100}% browser zoom`, async ({ baseURL }, testInfo) => {
			await withBrowserZoom(baseURL!, testInfo, async (page, setZoom, capture) => {
				await page.goto(`/${route}?mode=candidate&layout=splitpane`, { waitUntil: "networkidle" });
				await setZoom(factor);
				const player = page.locator("pie-section-player-splitpane");
				const questions = player.getByRole("tab", { name: "Questions", exact: true });
				if (await questions.count()) await questions.press("Enter");
				const calculator = player.getByRole("button", { name: "Calculator", exact: true }).first();
				await calculator.focus();
				await expectUsableTarget(calculator);
				await calculator.press("Enter");
				const shell = page.locator('[data-pie-tool-shell="calculator"]:visible');
				await expect(shell).toBeVisible();
				for (const control of await shell.locator(".pie-tool-shell__header").getByRole("button").all()) {
					await expectUsableTarget(control);
				}
				await capture("calculator-controls.png");
				await shell.getByRole("button", { name: "Close tool", exact: true }).press("Escape");
				await expect(shell).toBeHidden();
				await expect(calculator).toBeFocused();
				await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			});
		});
	}

	for (const width of [320, 375, 1280]) {
		test(`keeps ${route} controls usable in a ${width}px host`, async ({ page }, testInfo) => {
			await page.addInitScript(() => {
				Object.defineProperty(window, "outerWidth", { get: () => 1768 });
			});
			await page.setViewportSize({ width, height: 800 });
			await page.goto(`/${route}?mode=candidate&layout=splitpane`, { waitUntil: "networkidle" });
			const player = page.locator("pie-section-player-splitpane");
			await expect(player).toBeVisible();
			const tabs = player.getByRole("tab");
			for (const tab of await tabs.all()) await expectUsableTarget(tab);
			await expectUsableTarget(player.getByRole("button", { name: "Play reading", exact: true }).first());
			const questions = player.getByRole("tab", { name: "Questions", exact: true });
			if (await questions.count()) {
				await questions.press("Enter");
				await expect(questions).toHaveAttribute("aria-selected", "true");
			}
			await expectUsableTarget(player.getByRole("button", { name: "Play reading", exact: true }).first());
			await expectUsableTarget(player.getByRole("button", { name: "Calculator", exact: true }).first());
			if (width === 320) {
				const calculator = player.getByRole("button", { name: "Calculator", exact: true }).first();
				await calculator.press("Enter");
				const shell = page.locator('[data-pie-tool-shell="calculator"]:visible');
				await expect(shell).toBeVisible();
				const close = shell.getByRole("button", { name: "Close tool", exact: true });
				await expectUsableTarget(close);
				for (const control of await shell.locator(".pie-tool-shell__header").getByRole("button").all()) {
					await expectUsableTarget(control);
				}
				const bounds = await shell.boundingBox();
				expect(bounds!.x).toBeGreaterThanOrEqual(0);
				expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
				await page.screenshot({ path: testInfo.outputPath("calculator-controls.png") });
				await close.press("Escape");
				await expect(shell).toBeHidden();
				await expect(calculator).toBeFocused();
			}
			await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		});
	}
}
