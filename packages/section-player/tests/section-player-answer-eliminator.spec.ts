import { expect, test, type Locator, type Page } from "@playwright/test";

// The answer eliminator on the demo's paths: multiple choice 13.2 and EBSR 14.2
// through the legacy adapters, and the current multiple choice, which supplies
// its own choices. The page's controls change the strategy, the toggle style
// and the item mode mid-session, so each test below eliminates first and then
// switches.
test.use({ viewport: { width: 1280, height: 1100 } });

const ELIMINATOR = "Strike Through, eliminate answer choices";
const ELIMINATED_ROW = "[data-pie-answer-eliminated]";

async function openEliminator(page: Page, itemId: string): Promise<Locator> {
	const item = page.getByTestId(itemId);
	const trigger = item
		.locator("pie-item-toolbar")
		.getByRole("button", { name: ELIMINATOR });
	await expect(trigger).toBeVisible({ timeout: 60_000 });
	await trigger.click();
	await expect(trigger).toHaveAttribute("aria-pressed", "true");
	await expect(toggles(item).first()).toBeVisible({ timeout: 30_000 });
	return item;
}

const toggles = (item: Locator) =>
	item.getByRole("button", { name: /^Eliminate / });

const toggle = (item: Locator, choice: string) =>
	item.getByRole("button", { name: `Eliminate ${choice}`, exact: true });

const toggleNames = (item: Locator) =>
	toggles(item).evaluateAll((buttons) =>
		buttons.map((button) => button.getAttribute("aria-label")),
	);

/**
 * The choices the strike marks lie over, by their labels' text. Each mark sits
 * in the choice's container, outside the dimmed label, and over it.
 */
const struckChoices = (scope: Locator | Page) =>
	scope.locator("[data-pie-answer-eliminator-strike]").evaluateAll((marks) => {
		const struck: string[] = [];
		for (const mark of marks) {
			const label = mark.parentElement?.querySelector(
				"[data-pie-answer-eliminator-label]",
			);
			if (!label || label.contains(mark)) continue;
			const m = mark.getBoundingClientRect();
			const l = label.getBoundingClientRect();
			const over =
				m.left < l.right && l.left < m.right && m.top < l.bottom && l.top < m.bottom;
			const copy = label.cloneNode(true) as Element;
			for (const added of copy.querySelectorAll(
				".pie-answer-eliminator-sr-announcement",
			)) {
				added.remove();
			}
			const text = (copy.textContent ?? "").replace(/\s+/g, " ").trim();
			if (over && !struck.includes(text)) struck.push(text);
		}
		return struck;
	});

const controls = (page: Page) => page.getByTestId("answer-eliminator-controls");

test("a legacy multiple choice row ends with a toggle that strikes the choice out and restores it", async ({
	page,
}) => {
	test.setTimeout(120_000);
	await page.goto("/answer-eliminator", { waitUntil: "networkidle" });
	const item = await openEliminator(page, "ae-legacy-mc");

	// Named by the choice alone: the letter is the item's, not the choice's.
	expect(await toggleNames(item)).toEqual([
		"Eliminate Carbon dioxide",
		"Eliminate Oxygen",
		"Eliminate Nitrogen",
		"Eliminate Water vapour, which leaves through the stomata on the underside of the leaf",
	]);
	await expect(item.locator(ELIMINATED_ROW)).toHaveCount(0);

	await toggle(item, "Oxygen").click();
	await expect(toggle(item, "Oxygen")).toHaveAttribute("aria-pressed", "true");
	const row = item.locator(ELIMINATED_ROW);
	await expect(row).toHaveCount(1);
	// The toggle closes the whole row, after the input and its label.
	await expect(
		row.locator(":scope > .pie-answer-eliminator-toggle:last-child"),
	).toHaveCount(1);
	await expect(
		row.locator(".MuiFormControlLabel-label[data-pie-answer-eliminator-label]"),
	).toHaveCount(1);
	await expect(
		item.getByRole("radio", { name: /Oxygen \(eliminated\)/ }),
	).toBeDisabled();
	await expect.poll(() => struckChoices(item)).toEqual(["B. Oxygen"]);

	await toggle(item, "Oxygen").click();
	await expect(toggle(item, "Oxygen")).toHaveAttribute("aria-pressed", "false");
	await expect(item.locator(ELIMINATED_ROW)).toHaveCount(0);
	await expect(item.locator(".pie-answer-eliminator-sr-announcement")).toHaveCount(0);
	await expect(item.getByRole("radio", { name: /Oxygen/ })).toBeEnabled();
	await expect.poll(() => struckChoices(item)).toEqual([]);
});

test("EBSR takes toggles in both parts, and each item keeps its own strikes", async ({
	page,
}) => {
	test.setTimeout(120_000);
	await page.goto("/answer-eliminator", { waitUntil: "networkidle" });
	const mc = await openEliminator(page, "ae-legacy-mc");
	const ebsr = await openEliminator(page, "ae-legacy-ebsr");

	expect(await toggleNames(ebsr)).toEqual([
		"Eliminate The nucleus",
		"Eliminate The chloroplasts",
		"Eliminate The cell wall",
		"Eliminate Chloroplasts hold chlorophyll",
		"Eliminate Chlorophyll absorbs light",
		"Eliminate The nucleus stores DNA",
		"Eliminate The cell wall gives shape",
	]);

	await toggle(mc, "Oxygen").click();
	await toggle(ebsr, "The cell wall").click();
	await toggle(ebsr, "The nucleus stores DNA").click();
	await expect(ebsr.locator(ELIMINATED_ROW)).toHaveCount(2);
	await expect(
		ebsr.getByRole("radio", { name: /The cell wall \(eliminated\)/ }),
	).toBeDisabled();
	await expect(
		ebsr.getByRole("checkbox", { name: /The nucleus stores DNA \(eliminated\)/ }),
	).toBeDisabled();

	// Each item's marks lie over its own choices only.
	await expect.poll(() => struckChoices(mc)).toEqual(["B. Oxygen"]);
	await expect
		.poll(async () => (await struckChoices(ebsr)).sort())
		.toEqual([
			expect.stringContaining("The cell wall"),
			expect.stringContaining("The nucleus stores DNA"),
		]);

	// Restoring one item's choice leaves the other item's strikes in place.
	await toggle(mc, "Oxygen").click();
	await expect.poll(() => struckChoices(mc)).toEqual([]);
	await expect
		.poll(async () => (await struckChoices(ebsr)).sort())
		.toEqual([
			expect.stringContaining("The cell wall"),
			expect.stringContaining("The nucleus stores DNA"),
		]);
});

test("the current multiple choice, which supplies its own choices, eliminates text and math choices", async ({
	page,
}) => {
	test.setTimeout(120_000);
	await page.goto("/answer-eliminator", { waitUntil: "networkidle" });
	const item = await openEliminator(page, "ae-current-mc");

	await expect(toggles(item)).toHaveCount(4);
	await toggle(item, "There is no solution").click();
	await expect(toggle(item, "There is no solution")).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await expect(
		item.getByRole("checkbox", { name: /There is no solution/ }),
	).toBeDisabled();

	const math = toggles(item).first();
	await math.click();
	await expect(math).toHaveAttribute("aria-pressed", "true");
	await expect(item.locator(ELIMINATED_ROW)).toHaveCount(2);
});

test("switching the strategy mid-session redraws the elimination", async ({ page }) => {
	test.setTimeout(120_000);
	await page.goto("/answer-eliminator", { waitUntil: "networkidle" });
	const item = await openEliminator(page, "ae-legacy-mc");
	await toggle(item, "Oxygen").click();
	const row = item.locator(ELIMINATED_ROW);

	await controls(page).getByLabel("Mask", { exact: true }).check();
	await expect(page).toHaveURL(/strategy=mask/);
	const masked = row.locator(".pie-answer-eliminator-masked");
	await expect(masked).toHaveCount(1);
	await expect(masked).toHaveCSS("opacity", "0.2");
	await expect(toggle(item, "Oxygen")).toHaveAttribute("aria-pressed", "true");
	await expect.poll(() => struckChoices(item)).toEqual([]);

	await controls(page).getByLabel("Cross", { exact: true }).check();
	await expect(row.locator("svg.pie-answer-eliminator-cross")).toHaveCount(1);
	await expect(item.locator(".pie-answer-eliminator-masked")).toHaveCount(0);
	await expect(toggle(item, "Oxygen")).toHaveAttribute("aria-pressed", "true");

	await controls(page).getByLabel("Strike through", { exact: true }).check();
	await expect(item.locator(".pie-answer-eliminator-cross")).toHaveCount(0);
	await expect.poll(() => struckChoices(item)).toEqual(["B. Oxygen"]);
});

test("NDS icons replace every toggle mid-session and keep what is eliminated", async ({
	page,
}) => {
	test.setTimeout(120_000);
	await page.goto("/answer-eliminator", { waitUntil: "networkidle" });
	const item = await openEliminator(page, "ae-legacy-mc");
	await expect(item.locator(".pie-answer-eliminator-toggle--plain")).toHaveCount(4);
	await toggle(item, "Oxygen").click();

	await controls(page).getByLabel("NDS icons").check();
	await expect(page).toHaveURL(/nds=1/);
	await expect(
		item.locator("pie-nds-icon-button.pie-answer-eliminator-toggle--nds"),
	).toHaveCount(4);
	await expect(item.locator(".pie-answer-eliminator-toggle--plain")).toHaveCount(0);
	await expect(toggle(item, "Oxygen")).toHaveAttribute("aria-pressed", "true");
	await expect(toggle(item, "Nitrogen")).toHaveAttribute("aria-pressed", "false");
	await expect(item.locator(ELIMINATED_ROW)).toHaveCount(1);
});

test("evaluate mode freezes the eliminated choice's toggle, and gather brings the rest back", async ({
	page,
}) => {
	test.setTimeout(120_000);
	await page.goto("/answer-eliminator", { waitUntil: "networkidle" });
	const item = await openEliminator(page, "ae-legacy-mc");
	await toggle(item, "Oxygen").click();
	const oxygen = item.getByRole("radio", { name: /Oxygen/ });

	await controls(page).getByLabel("Evaluate", { exact: true }).check();
	await expect(page).toHaveURL(/mode=evaluate/);
	await expect(toggle(item, "Oxygen")).toBeVisible();
	await expect(toggle(item, "Oxygen")).toHaveAttribute("aria-pressed", "true");
	await expect(toggle(item, "Oxygen")).toBeDisabled();
	for (const choice of ["Carbon dioxide", "Nitrogen"]) {
		await expect(toggle(item, choice)).toBeHidden();
	}
	// The NDS button is disabled the same way.
	await controls(page).getByLabel("NDS icons").check();
	await expect(item.locator("pie-nds-icon-button[disabled]")).toHaveCount(1);
	await expect(toggle(item, "Oxygen")).toBeDisabled();
	await controls(page).getByLabel("NDS icons").uncheck();

	// The element re-renders its inputs for gather mode; the struck one stays blocked.
	await controls(page).getByLabel("Gather", { exact: true }).check();
	await expect(toggles(item)).toHaveCount(4);
	for (const choice of ["Carbon dioxide", "Nitrogen"]) {
		await expect(toggle(item, choice)).toBeVisible();
	}
	await expect(toggle(item, "Oxygen")).toHaveAttribute("aria-pressed", "true");
	await expect(toggle(item, "Oxygen")).toBeEnabled();
	await expect(oxygen).toBeDisabled();
	await expect(item.getByRole("radio", { name: /Nitrogen/ })).toBeEnabled();

	await toggle(item, "Oxygen").click();
	await expect(oxygen).toBeEnabled();
});

test("the controls start from the URL, so a state can be linked", async ({ page }) => {
	test.setTimeout(120_000);
	await page.goto("/answer-eliminator?strategy=cross&mode=evaluate&nds=1", {
		waitUntil: "networkidle",
	});
	await expect(controls(page).getByLabel("Cross", { exact: true })).toBeChecked();
	await expect(controls(page).getByLabel("Evaluate", { exact: true })).toBeChecked();
	await expect(controls(page).getByLabel("NDS icons")).toBeChecked();

	// The linked state reaches the eliminator, not only the controls.
	await page.goto("/answer-eliminator?strategy=cross&nds=1", { waitUntil: "networkidle" });
	const item = await openEliminator(page, "ae-legacy-mc");
	await expect(
		item.locator("pie-nds-icon-button.pie-answer-eliminator-toggle--nds"),
	).toHaveCount(4);
	await toggle(item, "Oxygen").click();
	await expect(item.locator(`${ELIMINATED_ROW} svg.pie-answer-eliminator-cross`)).toHaveCount(1);
});
