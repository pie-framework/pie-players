import { type Page, expect, test } from "@playwright/test";

/**
 * E2E tests for the heading-accessibility demo.
 *
 * Covers the two props as host surface: they have to reach the player custom
 * element as reflected attributes, because a PIE element walks up to the nearest
 * player host to resolve them and re-renders on a MutationObserver watching
 * those attributes. A prop that stops at the property is honoured at first paint
 * and inert after it.
 *
 * The element owns the outline, so these expectations follow its contract, not a
 * transform of ours: the visually-hidden item heading sits at
 * `baseHeadingLevel`, and authored `data-heading` content nests one level below
 * it — unconditionally, so suppressing the item heading leaves the gap rather
 * than promoting content.
 */

const DEMO_PATH = "/heading-accessibility?mode=candidate&layout=splitpane";

/**
 * The item heading has no attribute hook — the element styles it with a
 * generated class — so it is identified the way a screen-reader user encounters
 * it: a heading inside the player that is visually hidden.
 */
function countVisuallyHiddenHeadings(page: Page): Promise<number> {
	return page.evaluate(() => {
		const player = document.querySelector("pie-item-player");
		if (!player) return -1;
		return [...player.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter((node) => {
			const style = getComputedStyle(node);
			return (
				style.position === "absolute" &&
				Number.parseFloat(style.width) <= 2 &&
				Number.parseFloat(style.height) <= 2
			);
		}).length;
	});
}

test.describe("heading-accessibility demo — baseHeadingLevel & includeSrHeading", () => {
	test("demo page loads and renders the nordic countries question", async ({
		page,
	}) => {
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

		const checkbox = page.locator(
			'[data-testid="include-sr-heading-checkbox"]',
		);
		await expect(checkbox).toBeChecked();
	});

	test("baseHeadingLevel reaches the player element as a reflected attribute", async ({
		page,
	}) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		await expect(
			page.getByText("Which of the following are Nordic countries?"),
		).toBeVisible({ timeout: 30_000 });

		// The element resolves the value off this attribute and observes it for
		// changes, so a property that never reflects makes the host's control
		// one-shot. Pins the reflection in @pie-players/pie-item-player.
		await expect(page.locator("pie-item-player")).toHaveAttribute(
			"base-heading-level",
			"2",
		);
		await expect(page.locator("pie-item-player")).toHaveAttribute(
			"include-sr-heading",
			"",
		);
	});

	test("data-heading paragraphs nest one level below the item heading", async ({
		page,
	}) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		await page.waitForSelector("pie-section-player-splitpane", {
			state: "attached",
		});

		// Wait for the PIE element to render (networkidle is not always enough for
		// async bundle loading; poll for the prompt text).
		await expect(
			page.getByText("Which of the following are Nordic countries?"),
		).toBeVisible({ timeout: 30_000 });

		// baseHeadingLevel=2 belongs to the item heading, so content starts at h3.
		const headingLevelResult = await page.evaluate(() => {
			const first = document.querySelector('[data-heading="heading1"]');
			const second = document.querySelector('[data-heading="heading2"]');
			return {
				heading1Tag: first?.tagName?.toLowerCase() ?? null,
				heading2Tag: second?.tagName?.toLowerCase() ?? null,
			};
		});

		expect(headingLevelResult.heading1Tag).toBe("h3");
		expect(headingLevelResult.heading2Tag).toBe("h4");
		await expect(
			page.getByRole("heading", { name: "Multiple Select Question", level: 2 }),
		).toBeAttached();
	});

	test("changing baseHeadingLevel to 3 moves the whole outline down a level", async ({
		page,
	}) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		await expect(
			page.getByText("Which of the following are Nordic countries?"),
		).toBeVisible({ timeout: 30_000 });

		// Change to h3 base level. Live, not one-shot: the reflected attribute is
		// what the element observes.
		await page.selectOption('[data-testid="base-heading-level-select"]', "3");

		// The element should re-render; wait for the updated heading.
		await expect(
			page.getByRole("heading", {
				name: "Which of the following are Nordic countries?",
				level: 4,
			}),
		).toBeVisible({ timeout: 15_000 });

		const result = await page.evaluate(() => {
			const first = document.querySelector('[data-heading="heading1"]');
			const second = document.querySelector('[data-heading="heading2"]');
			return {
				heading1Tag: first?.tagName?.toLowerCase() ?? null,
				heading2Tag: second?.tagName?.toLowerCase() ?? null,
			};
		});

		expect(result.heading1Tag).toBe("h4");
		expect(result.heading2Tag).toBe("h5");
		await expect(
			page.getByRole("heading", { name: "Multiple Select Question", level: 3 }),
		).toBeAttached();
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

	test("unchecking includeSrHeading removes the visually-hidden heading", async ({
		page,
	}) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		await expect(
			page.getByText("Which of the following are Nordic countries?"),
		).toBeVisible({ timeout: 30_000 });
		expect(await countVisuallyHiddenHeadings(page)).toBe(1);

		await page.locator('[data-testid="include-sr-heading-checkbox"]').uncheck();

		// Reflection clears the attribute rather than writing "false": the default
		// is on, and a present boolean attribute means on whatever its value.
		await expect(page.locator("pie-item-player")).not.toHaveAttribute(
			"include-sr-heading",
			/.*/,
		);
		await expect
			.poll(() => countVisuallyHiddenHeadings(page), { timeout: 15_000 })
			.toBe(0);

		// Visible content is untouched.
		await expect(
			page.getByRole("heading", {
				name: "Which of the following are Nordic countries?",
				level: 3,
			}),
		).toBeVisible();
	});

	test("re-checking includeSrHeading restores the visually-hidden heading", async ({
		page,
	}) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		await expect(
			page.getByText("Which of the following are Nordic countries?"),
		).toBeVisible({ timeout: 30_000 });

		const checkbox = page.locator(
			'[data-testid="include-sr-heading-checkbox"]',
		);

		await checkbox.uncheck();
		await expect
			.poll(() => countVisuallyHiddenHeadings(page), { timeout: 15_000 })
			.toBe(0);

		await checkbox.check();
		await expect
			.poll(() => countVisuallyHiddenHeadings(page), { timeout: 15_000 })
			.toBe(1);
	});
});
