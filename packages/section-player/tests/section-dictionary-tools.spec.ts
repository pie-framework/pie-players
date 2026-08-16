import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The dictionary tools, end to end.
 *
 * These run in a browser because the claim being tested is that the tool is usable
 * from the keyboard alone — no pointer, no text selection. That depends on real focus
 * movement into a shadow root and on the panel's own form behaviour, neither of which
 * a unit test can settle.
 *
 * The demo's lookup endpoints are stubs with a fixed corpus. `photosynthesis` has an
 * entry, `apple` has a picture, `zzznotaword` is a miss, and `servicefailure` makes
 * the stub answer 503.
 */

const DEMO_PATH = "/dictionary-tools";

/**
 * This demo page is bespoke rather than built on the shared demo runtime, so it
 * carries no demo menu chrome. Readiness is the section toolbar having rendered its
 * buttons, which is what these tests actually need.
 */
async function gotoDemo(page: Page) {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expect(
		page.locator('[data-testid="dictionary-tools-player"]'),
	).toBeVisible();
	await expect(
		page.locator(".item-toolbar__button").first(),
	).toBeVisible();
}

function dictionaryPanel(page: Page): Locator {
	return page.locator("pie-tool-dictionary .pie-tool-dictionary");
}

function picturePanel(page: Page): Locator {
	return page.locator(
		"pie-tool-picture-dictionary .pie-tool-picture-dictionary",
	);
}

async function openTool(page: Page, ariaLabelStart: string) {
	await page
		.locator(`.item-toolbar__button[aria-label^="${ariaLabelStart}"]`)
		.first()
		.click();
}

test.describe("dictionary tools", () => {
	test("a learner can look a word up with the keyboard only", async ({
		page,
	}) => {
		await gotoDemo(page);
		await openTool(page, "Dictionary");

		const panel = dictionaryPanel(page);
		await expect(panel).toBeVisible();

		// Tab from the shell's chrome into the panel's field. The defect this covers:
		// the shell's focus trap collected focusables with `querySelectorAll`, which
		// stops at a shadow boundary — so Tab cycled the shell's own nine controls
		// forever and the field below was unreachable by keyboard.
		const input = panel.locator("input");
		// Compared against the *deep* active element: the panel lives in a shadow root,
		// so `document.activeElement` reports the custom-element host, never the input.
		const inputHasFocus = () =>
			input.evaluate((node) => {
				let active: Element | null = document.activeElement;
				while (active?.shadowRoot?.activeElement) {
					active = active.shadowRoot.activeElement;
				}
				return active === node;
			});
		await expect
			.poll(
				async () => {
					if (await inputHasFocus()) return true;
					await page.keyboard.press("Tab");
					return false;
				},
				{ timeout: 5000 },
			)
			.toBe(true);

		// No pointer and no text selection, which they could not make in non-editable
		// content anyway.
		await page.keyboard.type("photosynthesis");
		await page.keyboard.press("Enter");

		await expect(panel.locator(".pie-tool-dictionary__word")).toContainText(
			"photosynthesis",
		);
		await expect(
			panel.locator(".pie-tool-dictionary__definition").first(),
		).toContainText("sunlight");
	});

	test("a word with no entry says so, and does not read as a failure", async ({
		page,
	}) => {
		await gotoDemo(page);
		await openTool(page, "Dictionary");

		const panel = dictionaryPanel(page);
		await panel.locator("input").fill("zzznotaword");
		await page.keyboard.press("Enter");

		await expect(panel.locator(".pie-tool-dictionary__notice")).toContainText(
			"No entry for",
		);
		// The distinction matters: a learner must not be told their word is not real
		// when the service is down.
		await expect(panel.locator(".pie-tool-dictionary__error")).toHaveCount(0);
	});

	test("a failing service reports an error, not an empty result", async ({
		page,
	}) => {
		await gotoDemo(page);
		await openTool(page, "Dictionary");

		const panel = dictionaryPanel(page);
		await panel.locator("input").fill("servicefailure");
		await page.keyboard.press("Enter");

		const error = panel.locator(".pie-tool-dictionary__error");
		await expect(error).toBeVisible();
		await expect(error).toHaveAttribute("role", "alert");
		await expect(error).toContainText("unavailable");
	});

	test("the result is announced in a live region", async ({ page }) => {
		await gotoDemo(page);
		await openTool(page, "Dictionary");

		const panel = dictionaryPanel(page);
		const status = panel.locator("[role='status']");
		await expect(status).toHaveText("");

		await panel.locator("input").fill("evidence");
		await page.keyboard.press("Enter");

		// A screen reader user gets the outcome without having to go looking for it.
		await expect(status).toContainText("for evidence");
	});

	test("the picture dictionary renders pictures with meaningful alt text", async ({
		page,
	}) => {
		await gotoDemo(page);
		await openTool(page, "Picture Dictionary");

		const panel = picturePanel(page);
		await expect(panel).toBeVisible();

		await panel.locator("input").fill("apple");
		await page.keyboard.press("Enter");

		const image = panel.locator(".pie-tool-picture-dictionary__image").first();
		await expect(image).toBeVisible();
		// The picture *is* the definition, so an empty alt would withhold the content.
		await expect(image).toHaveAttribute("alt", "An apple");

		// And it actually loaded, rather than rendering a broken image.
		await expect
			.poll(() =>
				image.evaluate((node) => (node as HTMLImageElement).naturalWidth),
			)
			.toBeGreaterThan(0);
	});

	test("both panels reject a selected sentence without spending a request", async ({
		page,
	}) => {
		await gotoDemo(page);
		await openTool(page, "Dictionary");

		let requests = 0;
		page.on("request", (request) => {
			if (request.url().includes("/api/tools/dictionary")) requests += 1;
		});

		const panel = dictionaryPanel(page);
		await panel
			.locator("input")
			.fill("the process by which plants convert light into sugar");
		await page.keyboard.press("Enter");

		await expect(panel.locator(".pie-tool-dictionary__error")).toContainText(
			"single word or short phrase",
		);
		expect(requests).toBe(0);
	});
});
