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

	// The demo stylesheet's reduced-motion rule is layered, and a layered
	// `!important` outranks the unlayered rule components.css sets inside item
	// content, so any duration it gives a transition is what content gets.
	test("leaves item content still under reduced motion", async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto(DELIVERY_PATH, { waitUntil: "networkidle" });
		const content = page.locator("[data-pie-content]").first();
		await expect(content).toBeVisible();

		const { checked, moving } = await content.evaluate((root) => {
			const elements = [root, ...root.querySelectorAll("*")];
			const moving: string[] = [];
			for (const element of elements) {
				for (const pseudo of [null, "::before", "::after"]) {
					const style = getComputedStyle(element, pseudo);
					const still = [
						style.transitionDuration,
						style.transitionDelay,
						style.animationDelay,
					]
						.flatMap((list) => list.split(","))
						.every((time) => Number.parseFloat(time) === 0);
					const brief = style.animationDuration
						.split(",")
						.every((time) => Number.parseFloat(time) <= 0.00001);
					if (!still || !brief) {
						moving.push(
							`${element.tagName.toLowerCase()}${pseudo ?? ""}: transition ${style.transitionDuration} after ${style.transitionDelay}, animation ${style.animationDuration} after ${style.animationDelay}`,
						);
					}
				}
			}
			return { checked: elements.length, moving };
		});
		expect(checked).toBeGreaterThan(5);
		expect(moving.slice(0, 10), `${moving.length} still moving`).toEqual([]);
	});
});
