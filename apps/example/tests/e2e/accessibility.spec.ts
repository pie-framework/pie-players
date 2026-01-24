import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("PIE Players demo app a11y", () => {
	test("Home page should not have WCAG 2.2 Level AA violations", async ({
		page,
	}) => {
		await page.goto("/");
		await page.waitForLoadState("networkidle");

		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag22aa"])
			.analyze();

		expect(results.violations).toEqual([]);
	});

	test("Samples page shell should not have WCAG 2.2 Level AA violations", async ({
		page,
	}) => {
		await page.goto("/samples");
		await page.waitForLoadState("networkidle");

		const results = await new AxeBuilder({ page })
			// The player itself may render async content; this scan focuses on the shell UI.
			.exclude("pie-iife-player")
			.exclude("pie-inline-player")
			.exclude("pie-fixed-player")
			.exclude("pie-esm-player")
			.withTags(["wcag2a", "wcag2aa", "wcag22aa"])
			.analyze();

		expect(results.violations).toEqual([]);
	});

	test("Playground page shell should not have WCAG 2.2 Level AA violations", async ({
		page,
	}) => {
		await page.goto("/playground");
		await page.waitForLoadState("networkidle");

		const results = await new AxeBuilder({ page })
			.exclude("pie-iife-player")
			.exclude("pie-inline-player")
			.exclude("pie-fixed-player")
			.exclude("pie-esm-player")
			.withTags(["wcag2a", "wcag2aa", "wcag22aa"])
			.analyze();

		expect(results.violations).toEqual([]);
	});
	test("Assessment page shell should not have WCAG 2.2 Level AA violations", async ({
		page,
	}) => {
		await page.goto("/assessment");
		await page.waitForLoadState("networkidle");

		await expect(
			page.getByRole("heading", { name: /Assessment Demo/i }),
		).toBeVisible();

		const results = await new AxeBuilder({ page })
			// Exclude the dynamic player + tools; this scan focuses on the shell UI.
			.exclude("pie-assessment-player")
			.exclude("pie-tool-toolbar")
			.withTags(["wcag2a", "wcag2aa", "wcag22aa"])
			.analyze();

		expect(results.violations).toEqual([]);
	});
});
