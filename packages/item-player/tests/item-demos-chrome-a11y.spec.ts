import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openDemoMenuIfCollapsed } from "../../../test-support/demo-menu";

const DELIVERY_PATH =
	"/demo/multiple-choice-radio-simple/delivery?mode=gather&role=student";
const DISALLOWED_DEMO_CHROME_VIOLATIONS = new Set([
	"scrollable-region-focusable",
	"color-contrast",
]);

test.describe("item demos chrome accessibility", () => {
	test("avoids known chrome a11y regressions with debug panels open", async ({
		page,
	}) => {
		await page.goto(DELIVERY_PATH, { waitUntil: "networkidle" });
		await openDemoMenuIfCollapsed(page);

		const sessionToggle = page.getByRole("button", {
			name: "Toggle item session panel",
		});
		const instrumentationToggle = page.getByRole("button", {
			name: "Toggle instrumentation panel",
		});
		await expect(sessionToggle).toBeVisible();
		await expect(instrumentationToggle).toBeVisible();
		await sessionToggle.click();
		await instrumentationToggle.click();

		const axeResults = await new AxeBuilder({ page })
			.disableRules(["region"])
			.analyze();
		const matched = axeResults.violations.filter((violation) =>
			DISALLOWED_DEMO_CHROME_VIOLATIONS.has(violation.id),
		);
		expect(
			matched,
			`Unexpected demo-chrome accessibility violations: ${JSON.stringify(matched, null, 2)}`,
		).toEqual([]);
	});

	test("uses the shared compact menu without horizontal overflow", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 320, height: 900 });
		await page.goto(DELIVERY_PATH, { waitUntil: "networkidle" });

		const demoControls = page.getByRole("navigation", {
			name: "Demo controls",
		});
		const menuButton = demoControls.getByRole("button", {
			name: "Menu",
			exact: true,
		});
		await expect(menuButton).toBeVisible();
		await expect(
			demoControls.getByRole("link", { name: "Delivery" }),
		).toBeHidden();

		await menuButton.click();
		await expect(
			demoControls.getByRole("link", { name: "Delivery" }),
		).toBeVisible();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true);

		await demoControls
			.getByRole("button", { name: "Close", exact: true })
			.press("Escape");
		await expect(menuButton).toBeFocused();
	});
});
