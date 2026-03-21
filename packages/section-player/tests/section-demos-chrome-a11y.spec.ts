import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const DEMO_PATH = "/tts-ssml?mode=candidate&layout=splitpane";
const DISALLOWED_DEMO_CHROME_VIOLATIONS = new Set([
	"scrollable-region-focusable",
	"color-contrast",
]);

test.describe("section demos chrome accessibility", () => {
	test("avoids known chrome a11y regressions with debug panels open", async ({ page }) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const eventToggle = page.getByRole("button", {
			name: "Toggle event broadcast panel",
		});
		const instrumentationToggle = page.getByRole("button", {
			name: "Toggle instrumentation panel",
		});

		await expect(eventToggle).toBeVisible();
		await expect(instrumentationToggle).toBeVisible();

		await eventToggle.click();
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
