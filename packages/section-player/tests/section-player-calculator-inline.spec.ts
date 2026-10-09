import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { expectDemoChromeReady } from "../../../test-support/demo-menu";

const repoRoot = resolve(import.meta.dirname, "../../..");
const inlineModule = `/@fs${repoRoot}/packages/tool-calculator-inline-desmos/dist/tool-calculator-inline.js`;

// The inline calculator button is placed by the host inside an item shell. It
// resolves the item's calculator from the shell context and toggles that tool,
// so it stays visible and opens the calculator the item toolbar opens.
test("inline calculator button inside an item shell opens the item's calculator", async ({
	page,
}) => {
	test.setTimeout(120_000);
	await page.goto(
		"/calculator-cortex?mode=candidate&layout=splitpane&player=iife",
		{ waitUntil: "networkidle" },
	);
	await expectDemoChromeReady(page);

	const card = page.locator("pie-section-player-item-card").first();
	const toolbarButton = card.locator("pie-item-toolbar").getByRole("button", {
		name: /^(basic |scientific )?calculator$/i,
	});
	await expect(toolbarButton).toBeVisible({ timeout: 60_000 });

	await page.evaluate(async (moduleUrl) => {
		await import(/* @vite-ignore */ moduleUrl);
	}, inlineModule);
	await card
		.locator('[data-region="header"]')
		.first()
		.evaluate((header) => {
			header.appendChild(
				document.createElement("pie-tool-calculator-inline"),
			);
		});

	const inlineButton = card.locator("pie-tool-calculator-inline button");
	await expect(inlineButton).toBeVisible();
	await expect(inlineButton).toBeEnabled();
	await expect(inlineButton).toHaveAttribute("aria-pressed", "false");

	await inlineButton.click();
	await expect(
		page.locator('[data-pie-tool-shell="calculator"]:visible'),
	).toHaveCount(1);
	await expect(inlineButton).toBeVisible();
	await expect(inlineButton).toHaveAttribute("aria-pressed", "true");
	await expect(toolbarButton).toHaveAttribute("aria-pressed", "true");

	await inlineButton.click();
	await expect(
		page.locator('[data-pie-tool-shell="calculator"]:visible'),
	).toHaveCount(0);
	await expect(toolbarButton).toHaveAttribute("aria-pressed", "false");
});
