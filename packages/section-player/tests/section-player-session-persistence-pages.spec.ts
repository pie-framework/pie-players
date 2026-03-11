import { expect, test } from "@playwright/test";

const DEMO_PATH =
	"/demo/session-persistence?mode=candidate&layout=splitpane&page=algebra-basics";

async function openSessionPanel(page: import("@playwright/test").Page) {
	const toggleButton = page.getByRole("button", {
		name: "Toggle session panel",
	});
	await expect(toggleButton).toBeVisible();
	await toggleButton.click();
	const panel = page.locator("pie-section-player-tools-session-debugger");
	await expect(panel.locator(".pie-section-player-tools-session-debugger")).toBeVisible();
	return panel;
}

async function readSessionPanelSnapshot(panel: import("@playwright/test").Locator): Promise<{
	itemSessions?: Record<string, unknown>;
}> {
	const snapshotPre = panel.locator("pre").first();
	await expect(snapshotPre).toBeVisible();
	let parsed: { itemSessions?: Record<string, unknown> } | null = null;
	await expect
		.poll(async () => {
			const text = (await snapshotPre.textContent()) || "";
			try {
				parsed = JSON.parse(text) as { itemSessions?: Record<string, unknown> };
				return true;
			} catch {
				parsed = null;
				return false;
			}
		})
		.toBe(true);
	return parsed || {};
}

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
		const sessionPanel = await openSessionPanel(page);
		const snapshotAfterThirdChoice = await readSessionPanelSnapshot(sessionPanel);
		expect(
			Object.keys(snapshotAfterThirdChoice.itemSessions || {}).length,
		).toBeGreaterThan(0);
		const snapshotTextBeforeChange =
			(await sessionPanel.locator("pre").first().textContent()) || "";
		expect(snapshotTextBeforeChange).toContain("itemSessions");

		const firstChoice = algebraItem.getByRole("radio").nth(0);
		await firstChoice.evaluate((node) => {
			(node as HTMLInputElement).click();
		});
		await expect(firstChoice).toBeChecked();
		await expect
			.poll(async () => {
				const snapshotTextAfterChange =
					(await sessionPanel.locator("pre").first().textContent()) || "";
				return snapshotTextAfterChange !== snapshotTextBeforeChange;
			})
			.toBe(true);

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
			.nth(0);
		await expect
			.poll(async () => {
				return await restoredAlgebraChoice.isChecked();
			})
			.toBe(true);
	});
});
