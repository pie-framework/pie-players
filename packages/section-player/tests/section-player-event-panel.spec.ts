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

	test("keeps items pane scroll position when selecting a choice", async ({ page }) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const itemsPane = page.locator("main.pie-section-player-items-pane");
		await expect(itemsPane).toBeVisible();

		const scrollMetrics = await itemsPane.evaluate((pane) => ({
			maxScrollTop: Math.max(0, pane.scrollHeight - pane.clientHeight),
			clientHeight: pane.clientHeight,
			scrollHeight: pane.scrollHeight,
		}));
		expect(
			scrollMetrics.maxScrollTop,
			`Expected items pane to be scrollable (client=${scrollMetrics.clientHeight}, scroll=${scrollMetrics.scrollHeight})`,
		).toBeGreaterThan(80);

		const beforeSelectionScrollTop = await itemsPane.evaluate((pane) => {
			const targetScrollTop = Math.max(
				24,
				Math.floor((pane.scrollHeight - pane.clientHeight) * 0.65),
			);
			pane.scrollTop = targetScrollTop;
			return pane.scrollTop;
		});
		await page.waitForTimeout(150);

		await itemsPane.evaluate((pane) => {
			const paneRect = pane.getBoundingClientRect();
			const inputs = Array.from(
				pane.querySelectorAll<HTMLInputElement>('input[type="radio"], input[type="checkbox"]'),
			);
			const visibleInput = inputs.find((input) => {
				const rect = input.getBoundingClientRect();
				return rect.top >= paneRect.top && rect.bottom <= paneRect.bottom;
			});
			if (!visibleInput) {
				throw new Error("No visible selectable input found in items pane.");
			}
			visibleInput.click();
		});

		await page.waitForTimeout(500);
		const afterSelectionScrollTop = await itemsPane.evaluate((pane) => pane.scrollTop);
		expect(
			Math.abs(afterSelectionScrollTop - beforeSelectionScrollTop),
			`Items pane scroll should remain stable after selection (before=${beforeSelectionScrollTop}, after=${afterSelectionScrollTop}).`,
		).toBeLessThanOrEqual(24);
	});
});
