import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openDemoMenuIfCollapsed } from "../../../test-support/demo-menu";

const DEMO_PATH = "/tts-ssml?mode=candidate&layout=splitpane";
const DISALLOWED_DEMO_CHROME_VIOLATIONS = new Set([
	"scrollable-region-focusable",
	"color-contrast",
]);

test.describe("section demos chrome accessibility", () => {
	test("avoids known chrome a11y regressions with debug panels open", async ({
		page,
	}) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		await openDemoMenuIfCollapsed(page);

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

		const axeResults = await new AxeBuilder({ page })
			.disableRules(["region"])
			// vite-error-overlay is the dev-server crash overlay — not product surface.
			.exclude("vite-error-overlay")
			.analyze();
		const matched = axeResults.violations.filter((violation) =>
			DISALLOWED_DEMO_CHROME_VIOLATIONS.has(violation.id),
		);
		expect(
			matched,
			`Unexpected demo-chrome accessibility violations: ${JSON.stringify(matched, null, 2)}`,
		).toEqual([]);
	});

	test("collapses demo controls without overlap at narrow widths", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1400, height: 900 });
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const demoControls = page.getByRole("navigation", {
			name: "Demo controls",
		});
		const menuButton = demoControls.getByRole("button", {
			name: "Menu",
			exact: true,
		});
		const studentLink = demoControls.getByRole("link", { name: "Student" });

		await expect(menuButton).toBeVisible();
		await expect(menuButton).toHaveAttribute("aria-expanded", "false");
		await expect(studentLink).toBeHidden();

		await menuButton.click();
		const closeButton = demoControls.getByRole("button", {
			name: "Close",
			exact: true,
		});
		await expect(closeButton).toHaveAttribute("aria-expanded", "true");
		await expect(studentLink).toBeVisible();
		await expect(
			demoControls.getByRole("button", { name: "Reset sessions" }),
		).toBeVisible();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true);

		await closeButton.press("Escape");
		await expect(menuButton).toBeFocused();
		await expect(menuButton).toHaveAttribute("aria-expanded", "false");
		await expect(studentLink).toBeHidden();

		await page.setViewportSize({ width: 1401, height: 900 });
		await expect(menuButton).toBeHidden();
		await expect(studentLink).toBeVisible();

		const regions = await demoControls.evaluate((element) => {
			const start = element
				.querySelector(".pie-demo-menu-bar__start")
				?.getBoundingClientRect();
			const primary = element
				.querySelector(".pie-demo-menu-bar__primary-controls")
				?.getBoundingClientRect();
			const secondary = element
				.querySelector(".pie-demo-menu-bar__secondary-controls")
				?.getBoundingClientRect();
			return {
				startRight: start?.right ?? Number.POSITIVE_INFINITY,
				primaryLeft: primary?.left ?? Number.NEGATIVE_INFINITY,
				primaryRight: primary?.right ?? Number.POSITIVE_INFINITY,
				secondaryLeft: secondary?.left ?? Number.NEGATIVE_INFINITY,
			};
		});
		expect(regions.startRight).toBeLessThanOrEqual(regions.primaryLeft);
		expect(regions.primaryRight).toBeLessThanOrEqual(regions.secondaryLeft);
	});

	test("uses the shared compact menu in the print showcase", async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 900 });
		await page.goto("/print-showcase", { waitUntil: "networkidle" });

		const demoControls = page.getByRole("navigation", {
			name: "Demo controls",
		});
		const menuButton = demoControls.getByRole("button", {
			name: "Menu",
			exact: true,
		});
		await expect(menuButton).toBeVisible();
		await expect(
			demoControls.getByRole("button", { name: "Print", exact: true }),
		).toBeHidden();

		await menuButton.click();
		await expect(
			demoControls.getByRole("button", { name: "Print", exact: true }),
		).toBeVisible();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true);
	});
});
