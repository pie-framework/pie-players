import { expect, test } from "@playwright/test";

const DEMO_PATH =
	"/demo/session-persistence?mode=candidate&layout=splitpane&page=session-page-one";

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

async function applyHostChoice(
	panel: import("@playwright/test").Locator,
	itemId: string,
	choiceValue: string,
): Promise<void> {
	await panel.getByRole("combobox", { name: "Item" }).selectOption(itemId);
	await panel
		.getByRole("combobox", { name: "Choice value" })
		.selectOption(choiceValue);
	await panel.getByRole("button", { name: "Update item session from host" }).click();
}

async function readHostSessionControlsSnapshot(
	panel: import("@playwright/test").Locator,
): Promise<{ itemSessions?: Record<string, unknown> }> {
	const textbox = panel.getByRole("textbox", { name: "Session snapshot JSON" });
	await expect(textbox).toBeVisible();
	let parsed: { itemSessions?: Record<string, unknown> } | null = null;
	await expect
		.poll(async () => {
			try {
				const text = await textbox.inputValue();
				parsed = JSON.parse(text) as { itemSessions?: Record<string, unknown> };
				return true;
			} catch {
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

		const pageOneLink = page.getByRole("link", {
			name: "Session Page One",
		});
		const pageTwoLink = page.getByRole("link", {
			name: "Session Page Two",
		});
		await expect(pageOneLink).toBeVisible();
		await expect(pageTwoLink).toBeVisible();
		const sessionControlsPanel = page.getByRole("complementary", {
			name: "Session controls panel",
		});
		await expect(sessionControlsPanel).toBeVisible();
		await expect(
			sessionControlsPanel.getByText("Host-owned session controls", {
				exact: false,
			}),
		).toBeVisible();

		await applyHostChoice(sessionControlsPanel, "sp1-q1", "b");
		await applyHostChoice(sessionControlsPanel, "sp1-q2", "b");
		await sessionControlsPanel.getByRole("button", { name: "Refresh" }).click();
		const pageOneSnapshot = await readHostSessionControlsSnapshot(sessionControlsPanel);
		const pageOneSessions = pageOneSnapshot.itemSessions || {};
		expect(Object.keys(pageOneSessions)).toEqual(
			expect.arrayContaining(["sp1-q1", "sp1-q2"]),
		);
		await expect
			.poll(async () => {
				return await page.evaluate(() => {
					const key = Object.keys(window.localStorage).find((entry) =>
						entry.includes(
							"pie:section-controller:v1:section-demos-assessment:session-persistence-page-one:",
						),
					);
					if (!key) return false;
					const raw = window.localStorage.getItem(key) || "";
					return raw.includes('"sp1-q1"') && raw.includes('"sp1-q2"');
				});
			})
			.toBe(true);

		await pageTwoLink.click();
		await expect(page).toHaveURL(/page=session-page-two/);
		await applyHostChoice(sessionControlsPanel, "sp2-q1", "b");
		await sessionControlsPanel.getByRole("button", { name: "Refresh" }).click();
		const pageTwoSnapshot = await readHostSessionControlsSnapshot(sessionControlsPanel);
		expect(Object.keys(pageTwoSnapshot.itemSessions || {})).toEqual(
			expect.arrayContaining(["sp2-q1"]),
		);
		await expect
			.poll(async () => {
				return await page.evaluate(() => {
					const key = Object.keys(window.localStorage).find((entry) =>
						entry.includes(
							"pie:section-controller:v1:section-demos-assessment:session-persistence-page-two:",
						),
					);
					if (!key) return false;
					const raw = window.localStorage.getItem(key) || "";
					return raw.includes('"sp2-q1"');
				});
			})
			.toBe(true);

		await pageOneLink.click();
		await expect(page).toHaveURL(/page=session-page-one/);
		await sessionControlsPanel.getByRole("button", { name: "Hydrate" }).click();
		await sessionControlsPanel.getByRole("button", { name: "Refresh" }).click();
		const restoredPageOneSnapshot =
			await readHostSessionControlsSnapshot(sessionControlsPanel);
		expect(Object.keys(restoredPageOneSnapshot.itemSessions || {})).toEqual(
			expect.arrayContaining(["sp1-q1", "sp1-q2"]),
		);

		await pageTwoLink.click();
		await expect(page).toHaveURL(/page=session-page-two/);
		await sessionControlsPanel.getByRole("button", { name: "Hydrate" }).click();
		await sessionControlsPanel.getByRole("button", { name: "Refresh" }).click();
		const restoredPageTwoSnapshot =
			await readHostSessionControlsSnapshot(sessionControlsPanel);
		expect(Object.keys(restoredPageTwoSnapshot.itemSessions || {})).toEqual(
			expect.arrayContaining(["sp2-q1"]),
		);

		const sessionPanel = await openSessionPanel(page);
		await sessionControlsPanel.getByRole("button", { name: "Refresh" }).click();
		const snapshotAfterRoundTrip = await readSessionPanelSnapshot(sessionPanel);
		expect(Object.keys(snapshotAfterRoundTrip.itemSessions || {}).length).toBeGreaterThan(
			0,
		);
	});
});
