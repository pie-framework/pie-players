import { expect, test } from "@playwright/test";

/**
 * E2E tests for the heading-accessibility demo.
 *
 * Covers:
 * - `baseHeadingLevel`: `data-heading` paragraphs are rewritten to the correct
 *   heading element level by the section player's item renderer.
 * - `includeSrHeading`: the visually-hidden SR heading can be toggled on/off
 *   from the host without affecting visible content.
 */

const DEMO_PATH = "/heading-accessibility?mode=candidate&layout=splitpane";

test.describe("heading-accessibility demo — baseHeadingLevel & includeSrHeading", () => {
	test("demo page loads and renders the nordic countries question", async ({ page }) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		// The section player host should be present.
		await expect(page.locator("pie-section-player-splitpane")).toBeVisible();

		// Demo controls should be visible.
		await expect(
			page.locator('[data-testid="heading-a11y-controls"]'),
		).toBeVisible();
		await expect(
			page.locator('[data-testid="base-heading-level-select"]'),
		).toBeVisible();
		await expect(
			page.locator('[data-testid="include-sr-heading-checkbox"]'),
		).toBeVisible();
	});

	test("baseHeadingLevel select defaults to h2", async ({ page }) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const select = page.locator('[data-testid="base-heading-level-select"]');
		await expect(select).toHaveValue("2");
	});

	test("includeSrHeading checkbox defaults to checked", async ({ page }) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const checkbox = page.locator('[data-testid="include-sr-heading-checkbox"]');
		await expect(checkbox).toBeChecked();
	});

	test("data-heading paragraphs are promoted to heading elements matching baseHeadingLevel", async ({
		page,
	}) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		await page.waitForSelector("pie-section-player-splitpane", { state: "attached" });

		// Wait for the PIE element to render (networkidle is not always enough for
		// async bundle loading; poll for the prompt text).
		await expect(
			page.getByText("Which of the following are Nordic countries?"),
		).toBeVisible({ timeout: 30_000 });

		// With baseHeadingLevel=2, heading1 → h2, heading2 → h3.
		const headingLevelResult = await page.evaluate(() => {
			const h2 = document.querySelector('[data-heading="heading1"]');
			const h3 = document.querySelector('[data-heading="heading2"]');
			return {
				heading1Tag: h2?.tagName?.toLowerCase() ?? null,
				heading2Tag: h3?.tagName?.toLowerCase() ?? null,
			};
		});

		expect(headingLevelResult.heading1Tag).toBe("h2");
		expect(headingLevelResult.heading2Tag).toBe("h3");
	});

	test("changing baseHeadingLevel to 3 promotes data-heading nodes to h3 and h4", async ({
		page,
	}) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		await expect(
			page.getByText("Which of the following are Nordic countries?"),
		).toBeVisible({ timeout: 30_000 });

		// Change to h3 base level.
		await page.selectOption('[data-testid="base-heading-level-select"]', "3");

		// The section player should re-render; wait for the updated heading.
		await expect(
			page.getByRole("heading", { name: "Which of the following are Nordic countries?", level: 3 }),
		).toBeVisible({ timeout: 15_000 });

		const result = await page.evaluate(() => {
			const h3 = document.querySelector('[data-heading="heading1"]');
			const h4 = document.querySelector('[data-heading="heading2"]');
			return {
				heading1Tag: h3?.tagName?.toLowerCase() ?? null,
				heading2Tag: h4?.tagName?.toLowerCase() ?? null,
			};
		});

		expect(result.heading1Tag).toBe("h3");
		expect(result.heading2Tag).toBe("h4");
	});

	test("data-heading attributes are preserved after rewrite so CSS keyed on [data-heading] still matches", async ({
		page,
	}) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		await expect(
			page.getByText("Which of the following are Nordic countries?"),
		).toBeVisible({ timeout: 30_000 });

		const attributesPresent = await page.evaluate(() => {
			const nodes = document.querySelectorAll("[data-heading]");
			return nodes.length >= 2;
		});

		expect(attributesPresent).toBe(true);
	});

	test("unchecking includeSrHeading removes the visually-hidden heading", async ({ page }) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		await expect(
			page.getByText("Which of the following are Nordic countries?"),
		).toBeVisible({ timeout: 30_000 });

		// Uncheck includeSrHeading.
		await page.locator('[data-testid="include-sr-heading-checkbox"]').uncheck();

		// The SR-only heading should no longer be in the DOM.
		// SR headings carry the `sr-only` / `pie-sr-only` class or aria-hidden pattern;
		// we check there is no element with `data-pie-sr-heading` attribute.
		const srHeadingCount = await page.evaluate(
			() => document.querySelectorAll("[data-pie-sr-heading]").length,
		);
		expect(srHeadingCount).toBe(0);
	});

	test("re-checking includeSrHeading restores the visually-hidden heading", async ({ page }) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		await expect(
			page.getByText("Which of the following are Nordic countries?"),
		).toBeVisible({ timeout: 30_000 });

		const checkbox = page.locator('[data-testid="include-sr-heading-checkbox"]');

		// Uncheck then re-check.
		await checkbox.uncheck();
		await checkbox.check();

		const srHeadingCount = await page.evaluate(
			() => document.querySelectorAll("[data-pie-sr-heading]").length,
		);
		expect(srHeadingCount).toBeGreaterThanOrEqual(1);
	});
});
