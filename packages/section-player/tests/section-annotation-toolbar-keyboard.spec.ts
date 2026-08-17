import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectDemoChromeReady } from "../../../test-support/demo-menu";

/**
 * The annotation toolbar's keyboard path, end to end.
 *
 * The defect this covers: the toolbar was shown from `mouseup` and `touchend`
 * only, so a selection made with Shift+Arrow never produced it and highlight,
 * underline and read-aloud-selection had no keyboard route at all — WCAG 2.2
 * SC 2.1.1. It also carried `role="toolbar"` while leaving every button its own
 * tab stop, so the arrow keys the role advertises did nothing.
 *
 * These run in a browser because that is the only place the claim can be
 * settled: `selectionchange` timing, focus moving into a shadow root, and the
 * roving tabindex are all real-DOM behaviour.
 */

const DEMO_PATH = "/tts-ssml?mode=candidate&layout=splitpane";

async function gotoDemo(page: Page) {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expectDemoChromeReady(page);
}

function strip(page: Page): Locator {
	return page.locator("pie-tool-annotation-toolbar [role='toolbar']");
}

function stripButtons(page: Page): Locator {
	return strip(page).locator("button");
}

/**
 * Select passage text with no pointer event of any kind.
 *
 * This stands in for a screen reader's own selection command — JAWS and NVDA set a
 * DOM selection in browse mode, and the `selectionchange` trigger is what makes
 * those reach the toolbar. It cannot stand in for a sighted keyboard-only user:
 * Chromium does not extend a selection with Shift+Arrow in non-editable content
 * unless caret browsing is switched on, which was verified here — twelve
 * Shift+ArrowRight presses against this passage leave the selection empty. That is a
 * fact about browsers rather than something this component can fix, and it is why a
 * capability reachable *only* through this strip cannot be made keyboard accessible.
 */
async function selectPassageText(page: Page): Promise<string> {
	await page
		.locator("pie-passage-shell [data-region='content'] p")
		.first()
		.evaluate((node) => {
			const textNode = node.firstChild;
			if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
				throw new Error("Passage paragraph has no direct text node.");
			}
			const text = textNode.textContent ?? "";
			const selection = window.getSelection();
			if (!selection) throw new Error("Selection API unavailable.");
			const range = document.createRange();
			range.setStart(textNode, 5);
			range.setEnd(textNode, Math.min(40, text.length));
			selection.removeAllRanges();
			selection.addRange(range);
			// Deliberately no synthetic `mouseup`: needing one is the defect.
		});

	return page.evaluate(() => window.getSelection()?.toString().trim() ?? "");
}

test.describe("annotation toolbar keyboard access", () => {
	test("a selection made without a pointer shows the toolbar", async ({
		page,
	}) => {
		await gotoDemo(page);
		const selected = await selectPassageText(page);

		expect(selected.length).toBeGreaterThan(0);
		await expect(strip(page)).toBeVisible();
	});

	test("no pointer event is needed for the toolbar to appear", async ({
		page,
	}) => {
		// A programmatic selection with no mouse event of any kind. Before the fix
		// this required dispatching a synthetic `mouseup`, which is what the
		// existing TTS spec had to do to get the strip on screen.
		await gotoDemo(page);
		await page
			.locator("pie-passage-shell [data-region='content'] p")
			.first()
			.evaluate((node) => {
				const textNode = node.firstChild as Text;
				const selection = window.getSelection();
				if (!selection) throw new Error("Selection API unavailable.");
				const range = document.createRange();
				range.setStart(textNode, 3);
				range.setEnd(textNode, Math.min(30, textNode.length));
				selection.removeAllRanges();
				selection.addRange(range);
			});

		await expect(strip(page)).toBeVisible();
	});

	test("the strip is one tab stop with the ARIA toolbar key model", async ({
		page,
	}) => {
		await gotoDemo(page);
		await selectPassageText(page);
		await expect(strip(page)).toBeVisible();

		const buttons = stripButtons(page);
		const count = await buttons.count();
		expect(count).toBeGreaterThan(2);

		// Exactly one control is reachable with Tab; the rest are arrow-reachable.
		const tabbable = await buttons.evaluateAll(
			(nodes) =>
				nodes.filter((node) => node.getAttribute("tabindex") === "0").length,
		);
		expect(tabbable).toBe(1);

		// Shift+F10 is the documented way in, because the strip is a floating layer
		// whose DOM position bears no relation to where the selection is.
		await page.keyboard.press("Shift+F10");
		await expect(buttons.nth(0)).toBeFocused();

		await page.keyboard.press("ArrowRight");
		await expect(buttons.nth(1)).toBeFocused();

		await page.keyboard.press("ArrowLeft");
		await expect(buttons.nth(0)).toBeFocused();

		await page.keyboard.press("End");
		await expect(buttons.nth(count - 1)).toBeFocused();

		await page.keyboard.press("Home");
		await expect(buttons.nth(0)).toBeFocused();
	});

	test("Escape dismisses the strip and leaves the selection alone", async ({
		page,
	}) => {
		await gotoDemo(page);
		const selected = await selectPassageText(page);
		await page.keyboard.press("Shift+F10");
		await expect(stripButtons(page).first()).toBeFocused();

		await page.keyboard.press("Escape");
		await expect(strip(page)).toBeHidden();

		// The learner's place in the text survives dismissal.
		const stillSelected = await page.evaluate(
			() => window.getSelection()?.toString().trim() ?? "",
		);
		expect(stillSelected).toBe(selected);
	});

	/**
	 * The defect: the anchor was the selection's centre and the stylesheet shifted it
	 * by half a width, with nothing clamping the result — so a selection near an edge
	 * put the leftmost swatch off screen, where a pointer cannot reach it.
	 */
	test("stays inside the viewport for a selection at the left edge", async ({
		page,
	}) => {
		await gotoDemo(page);
		// This selection starts at the passage's own left edge, ~25px from the
		// viewport's, and is narrower than the strip. Measured before the fix: the
		// centred anchor placed the strip at x ≈ -109, so its first controls were off
		// screen entirely.
		await selectPassageText(page);

		const box = await strip(page).boundingBox();
		if (!box) throw new Error("Strip has no box.");
		const viewport = page.viewportSize();
		if (!viewport) throw new Error("No viewport.");
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.y).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
		expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);

		// And every control is inside it, which is the thing the learner needs.
		const controls = stripButtons(page);
		for (let index = 0; index < (await controls.count()); index += 1) {
			const control = await controls.nth(index).boundingBox();
			if (!control) throw new Error(`Control ${index} has no box.`);
			expect(control.x).toBeGreaterThanOrEqual(0);
			expect(control.x + control.width).toBeLessThanOrEqual(viewport.width);
		}
	});

	test("flips below a selection with no room above it", async ({ page }) => {
		await gotoDemo(page);
		// Scroll the passage so its first line sits at the very top of the viewport,
		// which is where extending a selection past the fold leaves it.
		await page
			.locator("pie-passage-shell [data-region='content'] p")
			.first()
			.evaluate((node) => {
				node.scrollIntoView({ block: "start" });
				const textNode = node.firstChild as Text;
				const selection = window.getSelection();
				if (!selection) throw new Error("Selection API unavailable.");
				const range = document.createRange();
				range.setStart(textNode, 3);
				range.setEnd(textNode, Math.min(30, textNode.length));
				selection.removeAllRanges();
				selection.addRange(range);
			});

		const box = await strip(page).boundingBox();
		if (!box) throw new Error("Strip has no box.");
		expect(box.y).toBeGreaterThanOrEqual(0);
	});

	test("highlighting from the keyboard applies the annotation", async ({
		page,
	}) => {
		await gotoDemo(page);
		await selectPassageText(page);
		await page.keyboard.press("Shift+F10");
		await expect(stripButtons(page).first()).toBeFocused();

		// The first control is a highlight swatch, activated the way any button is.
		await page.keyboard.press("Enter");

		await expect(strip(page)).toBeHidden();
		const announcement = page.locator(
			"pie-tool-annotation-toolbar [role='status']",
		);
		await expect(announcement).toContainText("highlighted");
	});
});
