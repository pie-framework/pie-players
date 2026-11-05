import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectDemoChromeReady } from "../../../test-support/demo-menu";

const DEMO_PATH =
	"/three-questions?mode=candidate&layout=splitpane&attempt=pnp-tools-debugger";

async function gotoDemo(page: Page) {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expectDemoChromeReady(page);
}

async function openPnpToolsEditor(page: Page): Promise<Locator> {
	await page.getByRole("button", { name: "Toggle PNP profile panel" }).click();
	const panel = page.locator("pie-section-player-tools-pnp-debugger");
	await expect(panel.getByTestId("pnp-tools-editor")).toBeVisible();
	return panel;
}

function graphButton(page: Page): Locator {
	return page.getByRole("button", { name: "Graph, coordinate plane" });
}

function firstItem(page: Page): Locator {
	return page.locator("pie-item-scope").first();
}

test.describe("PNP tools debugger", () => {
	test("edits placement independently from PNP enforcement", async ({
		page,
	}) => {
		await gotoDemo(page);
		const panel = await openPnpToolsEditor(page);

		await expect(graphButton(page)).toBeVisible();
		await panel.getByTestId("pnp-tool-toggle-graph-section").click();
		await expect(graphButton(page)).toHaveCount(0);
		await panel.getByTestId("pnp-tool-toggle-graph-section").click();
		await expect(graphButton(page)).toBeVisible();

		const calculatorButton = firstItem(page).getByRole("button", {
			name: /^(basic |scientific )?calculator$/i,
		});
		await expect(calculatorButton).toBeVisible();
		await panel.getByTestId("pnp-tool-toggle-calculator-item").click();
		await expect(calculatorButton).toHaveCount(0);
		await panel.getByTestId("pnp-tool-toggle-calculator-item").click();
		await expect(calculatorButton).toBeVisible();
	});

	test("toggles report their state and style themselves, from the keyboard too", async ({
		page,
	}) => {
		await gotoDemo(page);
		// A host rule for the generic names the panel used to carry.
		await page.addStyleTag({
			content: ".active, .danger { outline: 7px solid rgb(255, 0, 0) !important; }",
		});
		const panel = await openPnpToolsEditor(page);
		const toggle = panel.getByTestId("pnp-tool-toggle-graph-section");

		await expect(toggle).toHaveAttribute("aria-pressed", "true");
		const pressedWeight = await toggle.evaluate(
			(el) => getComputedStyle(el).fontWeight,
		);
		expect(pressedWeight).toBe("600");
		expect(await toggle.evaluate((el) => getComputedStyle(el).outlineWidth)).not.toBe(
			"7px",
		);

		await toggle.focus();
		await page.keyboard.press("Space");
		await expect(toggle).toHaveAttribute("aria-pressed", "false");
		await expect(graphButton(page)).toHaveCount(0);
		expect(await toggle.evaluate((el) => getComputedStyle(el).fontWeight)).not.toBe(
			pressedWeight,
		);
		await page.keyboard.press("Enter");
		await expect(toggle).toHaveAttribute("aria-pressed", "true");
		await expect(graphButton(page)).toBeVisible();
	});

	test("applies PNP prohibitions only when enforcement is active", async ({
		page,
	}) => {
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
