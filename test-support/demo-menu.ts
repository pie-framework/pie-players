import { expect, type Page } from "@playwright/test";

export async function openDemoMenuIfCollapsed(page: Page): Promise<void> {
	const demoControls = page.getByRole("navigation", { name: "Demo controls" });
	await expect(demoControls).toBeVisible();
	const menuButton = demoControls.getByRole("button", {
		name: "Menu",
		exact: true,
	});
	if (!(await menuButton.isVisible())) return;

	await menuButton.click();
	const closeButton = demoControls.getByRole("button", {
		name: "Close",
		exact: true,
	});
	await expect(closeButton).toBeVisible();
	await expect(closeButton).toHaveAttribute("aria-expanded", "true");
}

export async function expectDemoChromeReady(page: Page): Promise<void> {
	await expect(
		page.getByRole("navigation", { name: "Demo controls" }),
	).toBeVisible();
	await openDemoMenuIfCollapsed(page);
}
