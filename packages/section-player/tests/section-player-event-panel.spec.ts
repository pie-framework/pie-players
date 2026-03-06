import { expect, test } from "@playwright/test";

const DEMO_PATH = "/demo/tts-ssml?mode=candidate&layout=splitpane";

async function openEventPanel(page: import("@playwright/test").Page) {
	await page
		.getByRole("button", { name: "Toggle event broadcast panel" })
		.click({ force: true });
	const panel = page.locator("pie-section-player-tools-event-debugger");
	await expect(panel.locator(".pie-section-player-tools-event-debugger")).toBeVisible();
	return panel;
}

test.describe("section player controller event panel", () => {
	test("captures controller events and renders them", async ({ page }) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		const panel = await openEventPanel(page);

		const firstSelectable = page.locator('input[type="radio"], input[type="checkbox"]').first();
		await firstSelectable.click({ force: true });

		const panelRows = panel.locator(".pie-section-player-tools-event-debugger__row");
		await expect(
			panelRows.filter({ hasText: "item-session-data-changed" }).first(),
		).toBeVisible({ timeout: 30_000 });
		await expect(panelRows.first()).toBeVisible();
	});

	test("replays critical lifecycle state when opened late", async ({ page }) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const firstSelectable = page.locator('input[type="radio"], input[type="checkbox"]').first();
		await firstSelectable.click({ force: true });

		const panel = await openEventPanel(page);
		await panel.getByRole("button", { name: "section" }).click();
		const panelRows = panel.locator(".pie-section-player-tools-event-debugger__row");
		await expect(
			panelRows.filter({ hasText: "section-loading-complete" }).first(),
		).toBeVisible({ timeout: 30_000 });
		await expect(
			panelRows.filter({ hasText: "replayed" }).first(),
		).toBeVisible({ timeout: 30_000 });
	});
});
