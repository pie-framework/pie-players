import { expect, test, type Locator, type Page } from "@playwright/test";

const DEMO_PATH = "/tool-visibility?mode=candidate&layout=splitpane";

async function gotoDemo(page: Page) {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expect(page.getByRole("link", { name: "Student" })).toBeVisible();
}

function calculatorSurface(calculator: Locator): Locator {
	return calculator
		.locator(
			[
				".pie-tool-calculator__container .dcg-container",
				".pie-tool-calculator__container .dcg-calculator-api-container",
				".pie-tool-calculator__container iframe",
				".pie-tool-calculator__container canvas",
			].join(","),
		)
		.first();
}

test.describe("section demo tool visibility from item data", () => {
	test("shows basic and scientific calculators only for items that request them", async ({
		page,
	}) => {
		test.setTimeout(60_000);
		await gotoDemo(page);

		const itemCards = page.locator("pie-section-player-item-card");
		await expect(itemCards).toHaveCount(3);

		const basicButton = itemCards.nth(0).getByRole("button", {
			name: "Open basic calculator",
		});
		const scientificButton = itemCards.nth(1).getByRole("button", {
			name: "Open scientific calculator",
		});
		const untaggedItemCalculatorButton = itemCards.nth(2).getByRole("button", {
			name: /open .* calculator/i,
		});

		await expect(basicButton).toBeVisible();
		await expect(scientificButton).toBeVisible();
		await expect(untaggedItemCalculatorButton).toHaveCount(0);

		const firstDesmosAuthResponse = page.waitForResponse(
			(response) =>
				response.url().includes("/api/tools/desmos/auth") &&
				response.request().method() === "GET",
		);
		await basicButton.click();
		await firstDesmosAuthResponse;
		const basicCalculator = page.locator(
			'pie-tool-calculator[tool-id="calculator:item:q1-basic-calculator-cost"]',
		);
		await expect(basicCalculator).toHaveAttribute("calculator-type", "basic");
		await expect(calculatorSurface(basicCalculator)).toBeVisible({
			timeout: 20_000,
		});

		await scientificButton.click();
		const scientificCalculator = page.locator(
			'pie-tool-calculator[tool-id="calculator:item:q2-scientific-calculator-growth"]',
		);
		await expect(scientificCalculator).toHaveAttribute(
			"calculator-type",
			"scientific",
		);
		await expect(calculatorSurface(scientificCalculator)).toBeVisible({
			timeout: 20_000,
		});
	});
});
