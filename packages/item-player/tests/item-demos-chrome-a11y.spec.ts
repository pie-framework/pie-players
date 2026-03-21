import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const DELIVERY_PATH = "/demo/multiple-choice-radio-simple/delivery?mode=gather&role=student";
const DISALLOWED_DEMO_CHROME_VIOLATIONS = new Set([
	"scrollable-region-focusable",
	"color-contrast",
]);

test.describe("item demos chrome accessibility", () => {
	test("avoids known chrome a11y regressions with debug panels open", async ({ page }) => {
		await page.goto(DELIVERY_PATH, { waitUntil: "networkidle" });

		const sessionToggle = page.getByRole("button", { name: "Toggle item session panel" });
		const instrumentationToggle = page.getByRole("button", {
			name: "Toggle instrumentation panel",
		});
		await expect(sessionToggle).toBeVisible();
		await expect(instrumentationToggle).toBeVisible();
		await sessionToggle.click();
		await instrumentationToggle.click();

		const axeResults = await new AxeBuilder({ page }).disableRules(["region"]).analyze();
		const matched = axeResults.violations.filter((violation) =>
			DISALLOWED_DEMO_CHROME_VIOLATIONS.has(violation.id),
		);
		expect(
			matched,
			`Unexpected demo-chrome accessibility violations: ${JSON.stringify(matched, null, 2)}`,
		).toEqual([]);
	});
});
