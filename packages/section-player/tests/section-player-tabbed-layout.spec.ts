import { expect, test } from "@playwright/test";

test.describe("section player tabbed layout", () => {
	test("renders tabbed layout element with passage/items tab semantics", async ({
		page,
	}) => {
		const pageErrors: string[] = [];
		page.on("pageerror", (error) => {
			pageErrors.push(error.message);
		});
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto("/tabbed-layout/tabbed", { waitUntil: "networkidle" });

		const host = page.locator("pie-section-player-tabbed").first();
		await expect(host).toBeVisible();

		const tablist = page.getByRole("tablist", { name: "Section content tabs" });
		await expect(tablist).toBeVisible();

		const passageTab = page.getByRole("tab", { name: "Passage" });
		const itemsTab = page.getByRole("tab", { name: "Items" });
		await expect(passageTab).toBeVisible();
		await expect(itemsTab).toBeVisible();
		await expect(passageTab).toHaveAttribute("data-pie-purpose", "passage-label");
		await expect(itemsTab).toHaveAttribute("data-pie-purpose", "item-label");
		await expect(passageTab).toHaveClass(/passage-label/);
		await expect(itemsTab).toHaveClass(/item-label/);
		await expect(passageTab).toHaveClass(/pie-section-player-tab--active/);
		await expect(passageTab).toHaveAttribute("aria-selected", "true");

		const passagePanelId = await passageTab.getAttribute("aria-controls");
		expect(passagePanelId).toBeTruthy();
		await expect(page.locator(`#${passagePanelId}`)).toBeVisible();

		await itemsTab.click();
		await expect(itemsTab).toHaveClass(/pie-section-player-tab--active/);
		await expect(itemsTab).toHaveAttribute("aria-selected", "true");
		const itemsPanelId = await itemsTab.getAttribute("aria-controls");
		expect(itemsPanelId).toBeTruthy();
		await expect(page.locator(`#${itemsPanelId}`)).toBeVisible();

		await passageTab.focus();
		await page.keyboard.press("ArrowRight");
		await expect(itemsTab).toHaveAttribute("aria-selected", "true");
		await expect(passageTab).toHaveAttribute("aria-selected", "false");
		await expect(passageTab).not.toHaveClass(/pie-section-player-tab--active/);
		await expect(page.locator(`#${passagePanelId}`)).toBeHidden();
		await expect(page.locator(`#${itemsPanelId}`)).toBeVisible();

		for (let index = 0; index < 6; index += 1) {
			await passageTab.click();
			await expect(passageTab).toHaveAttribute("aria-selected", "true");
			await expect(page.locator(`#${passagePanelId}`)).toBeVisible();
			await itemsTab.click();
			await expect(itemsTab).toHaveAttribute("aria-selected", "true");
			await expect(page.locator(`#${itemsPanelId}`)).toBeVisible();
		}

		expect(pageErrors).toEqual([]);
	});

	test("switches splitpane stacked collapse between tabbed and vertical strategies", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 900, height: 900 });
		await page.goto("/question-passage?mode=candidate&layout=splitpane", {
			waitUntil: "networkidle",
		});

		const splitHost = page.locator("pie-section-player-splitpane").first();
		await expect(splitHost).toBeVisible();
		await expect(page.getByRole("tablist", { name: "Section content tabs" })).toBeVisible();

		await splitHost.evaluate((element) => {
			(element as HTMLElement).setAttribute("split-pane-collapse-strategy", "vertical");
		});
		await expect(page.getByRole("tablist", { name: "Section content tabs" })).toHaveCount(0);
		await expect(page.locator(".pie-section-player-vertical-content").first()).toBeVisible();
		await expect(
			page.getByRole("separator", { name: "Resize passages and items panels" }),
		).toHaveCount(0);

		await splitHost.evaluate((element) => {
			(element as HTMLElement).setAttribute("split-pane-collapse-strategy", "tabbed");
		});
		await expect(page.getByRole("tablist", { name: "Section content tabs" })).toBeVisible();
	});

	test("uses tabbed collapse strategy in dedicated splitpane tabbed demo mode", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto("/tabbed-layout/splitpane-tabbed-collapse", {
			waitUntil: "networkidle",
		});

		const splitHost = page.locator("pie-section-player-splitpane").first();
		await expect(splitHost).toBeVisible();
		await expect(page.getByRole("tablist", { name: "Section content tabs" })).toBeVisible();
		await expect(
			page.getByRole("separator", { name: "Resize passages and items panels" }),
		).toHaveCount(0);
	});

	test("keeps passage content visible after route switch from tabbed to splitpane collapse", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto("/tabbed-layout/tabbed", { waitUntil: "networkidle" });
		await expect(page.locator("pie-section-player-tabbed").first()).toBeVisible();
		await expect(page.getByRole("tab", { name: "Passage" })).toBeVisible();

		await page.goto("/tabbed-layout/splitpane-tabbed-collapse", {
			waitUntil: "networkidle",
		});
		await expect(page.locator("pie-section-player-splitpane").first()).toBeVisible();
		await expect(page.getByRole("tab", { name: "Passage" })).toBeVisible();
		await expect(page.getByRole("tab", { name: "Items" })).toBeVisible();
		await expect(page.getByText("Urban Trees and Heat")).toBeVisible();
	});
});
