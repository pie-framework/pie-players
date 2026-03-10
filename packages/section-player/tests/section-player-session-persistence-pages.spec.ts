import { expect, test } from "@playwright/test";

const DEMO_PATH =
	"/demo/session-persistence?mode=candidate&layout=splitpane&page=algebra-basics";

test.describe("section player session persistence across section pages", () => {
	test("remembers each section page responses with persistence strategy", async ({
		page,
	}) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const algebraLink = page.getByRole("link", { name: "Algebra Basics" });
		const readingLink = page.getByRole("link", { name: "Reading with Passage" });
		await expect(algebraLink).toBeVisible();
		await expect(readingLink).toBeVisible();
		const sessionControlsPanel = page.getByRole("complementary", {
			name: "Session controls panel",
		});
		await expect(sessionControlsPanel).toBeVisible();
		await expect(
			sessionControlsPanel.getByText("Host-owned session controls", {
				exact: false,
			}),
		).toBeVisible();

		const algebraItem = page.locator(
			'pie-item-shell[data-item-id="climate-q1"]',
		);
		const algebraChoice = algebraItem.getByRole("radio").nth(2);
		await expect(algebraChoice).toBeVisible();
		await algebraChoice.click();
		await expect(algebraChoice).toBeChecked();
		await expect
			.poll(async () => {
				return await page.evaluate(() => {
					const key = Object.keys(window.localStorage).find((entry) =>
						entry.includes("pie:section-controller:v1:section-demos-assessment:demo1-single-question:"),
					);
					if (!key) return false;
					const raw = window.localStorage.getItem(key) || "";
					return raw.includes("itemSessions");
				});
			})
			.toBe(true);
		await sessionControlsPanel.getByRole("button", { name: "Refresh" }).click();
		await sessionControlsPanel
			.getByRole("button", { name: "Update item session from host" })
			.click();
		await expect(algebraItem.getByRole("radio").nth(0)).toBeChecked();
		await algebraChoice.click();
		await expect(algebraChoice).toBeChecked();

		await readingLink.click();
		await expect(page).toHaveURL(/page=reading-with-passage/);
		const readingItem = page.locator(
			'pie-item-shell[data-item-id="renaissance-q1"]',
		);
		const readingChoice = readingItem.getByRole("radio").nth(1);
		await expect(readingChoice).toBeVisible();
		await readingChoice.click();
		await expect(readingChoice).toBeChecked();

		await algebraLink.click();
		await expect(page).toHaveURL(/page=algebra-basics/);
		const restoredAlgebraChoice = page
			.locator('pie-item-shell[data-item-id="climate-q1"]')
			.getByRole("radio")
			.nth(2);
		await expect
			.poll(async () => {
				return await restoredAlgebraChoice.isChecked();
			})
			.toBe(true);
	});
});
