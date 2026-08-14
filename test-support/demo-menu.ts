import { expect, type Page } from "@playwright/test";

export async function openDemoMenuIfCollapsed(page: Page): Promise<void> {
	const menuButton = page.getByRole("button", { name: "Menu", exact: true });
	if (!(await menuButton.isVisible())) return;

	await menuButton.click();
	await expect(
		page.getByRole("button", { name: "Close", exact: true }),
	).toHaveAttribute("aria-expanded", "true");
}

export async function expectDemoChromeReady(page: Page): Promise<void> {
	await expect(
		page.getByRole("navigation", { name: "Demo controls" }),
	).toBeVisible();
	await openDemoMenuIfCollapsed(page);
}
