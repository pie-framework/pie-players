import { expect, test } from "@playwright/test";

const DEMO_PATH = "/three-section-assessment";

test.describe("assessment demos chrome accessibility", () => {
	test("uses the shared compact menu without horizontal overflow", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 320, height: 900 });
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const demoControls = page.getByRole("navigation", {
			name: "Demo controls",
		});
		const menuButton = demoControls.getByRole("button", {
			name: "Menu",
			exact: true,
		});
		const splitpaneButton = demoControls.getByRole("button", {
			name: "Use splitpane section player layout",
		});

		await expect(menuButton).toBeVisible();
		await expect(splitpaneButton).toBeHidden();
		const siteHeaderRegions = await page.evaluate(() => {
			const title = document
				.querySelector(".pie-demo-site-header__title")
				?.getBoundingClientRect();
			// The right-hand cluster holds every header control — the locale select
			// and the theme select — so the title has to clear all of it, not just
			// the one that used to be there.
			const controls = document
				.querySelector(".pie-demo-site-header__controls")
				?.getBoundingClientRect();
			return {
				titleRight: title?.right ?? Number.POSITIVE_INFINITY,
				controlsLeft: controls?.left ?? Number.NEGATIVE_INFINITY,
			};
		});
		expect(siteHeaderRegions.titleRight).toBeLessThanOrEqual(
			siteHeaderRegions.controlsLeft,
		);
		await menuButton.click();
		await expect(splitpaneButton).toBeVisible();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true);

		await demoControls
			.getByRole("button", { name: "Close", exact: true })
			.press("Escape");
		await expect(menuButton).toBeFocused();
	});
});
