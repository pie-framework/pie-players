import { expect, test, type Locator, type Page } from "@playwright/test";

const DEMO_PATH =
	"/three-questions?mode=candidate&layout=splitpane&attempt=pnp-tools-debugger";

async function gotoDemo(page: Page) {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expect(page.getByRole("link", { name: "Student" })).toBeVisible();
}

async function openPnpToolsEditor(page: Page): Promise<Locator> {
	await page.getByRole("button", { name: "Toggle PNP profile panel" }).click();
	const panel = page.locator("pie-section-player-tools-pnp-debugger");
	await expect(panel.getByTestId("pnp-tools-editor")).toBeVisible();
	return panel;
}

function graphButton(page: Page): Locator {
	return page.getByRole("button", { name: "Graph - Graphing calculator" });
}

function firstItem(page: Page): Locator {
	return page.locator("pie-item-shell").first();
}

test.describe("PNP tools debugger", () => {
	test("edits placement independently from PNP enforcement", async ({ page }) => {
		await gotoDemo(page);
		const panel = await openPnpToolsEditor(page);

		await expect(graphButton(page)).toBeVisible();
		await panel.getByTestId("pnp-tool-toggle-graph-section").click();
		await expect(graphButton(page)).toHaveCount(0);
		await panel.getByTestId("pnp-tool-toggle-graph-section").click();
		await expect(graphButton(page)).toBeVisible();

		const calculatorButton = firstItem(page).getByRole("button", {
			name: /open .* calculator/i,
		});
		await expect(calculatorButton).toBeVisible();
		await panel.getByTestId("pnp-tool-toggle-calculator-item").click();
		await expect(calculatorButton).toHaveCount(0);
		await panel.getByTestId("pnp-tool-toggle-calculator-item").click();
		await expect(calculatorButton).toBeVisible();
	});

	test("applies PNP prohibitions only when enforcement is active", async ({ page }) => {
		await gotoDemo(page);
		const panel = await openPnpToolsEditor(page);

		await expect(graphButton(page)).toBeVisible();
		await panel.getByTestId("pnp-enforcement-select").selectOption("off");
		await panel.getByTestId("pnp-prohibit-toggle-graph").click();
		await expect(graphButton(page)).toBeVisible();

		await panel.getByTestId("pnp-enforcement-select").selectOption("on");
		await expect(graphButton(page)).toHaveCount(0);
	});
});
