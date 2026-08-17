import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * The selection door onto the dictionaries, end to end.
 *
 * The claim: selecting a word and activating the strip's lookup opens the dictionary
 * panel already answered, and the strip's own keyboard model reaches that action like
 * any other control. Both depend on a real selection, a real focus trap crossing two
 * shadow boundaries, and the request resolving to the toolbar that hosts the tool —
 * none of which a unit test settles.
 *
 * The door is a shortcut, not the way in: `section-dictionary-tools.spec.ts` covers the
 * panel's field, which is the route for a learner who cannot originate a selection.
 */

const DEMO_PATH = "/dictionary-tools";

/** This demo is bespoke rather than built on the shared runtime, so it has no menu. */
async function gotoDemo(page: Page) {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expect(
		page.locator('[data-testid="dictionary-tools-player"]'),
	).toBeVisible();
	await expect(page.locator(".item-toolbar__button").first()).toBeVisible();
}

function strip(page: Page): Locator {
	return page.locator("pie-tool-annotation-toolbar [role='toolbar']");
}

function selectionAction(page: Page, id: string): Locator {
	return strip(page).locator(`[data-pie-selection-action="${id}"]`);
}

function dictionaryPanel(page: Page): Locator {
	return page.locator("pie-tool-dictionary .pie-tool-dictionary");
}

function picturePanel(page: Page): Locator {
	return page.locator(
		"pie-tool-picture-dictionary .pie-tool-picture-dictionary",
	);
}

/**
 * Select one word of the passage with no pointer event of any kind.
 *
 * Offsets are found by walking to the text node that holds the word rather than
 * indexing the paragraph's first child: the passage's markup carries whitespace, so
 * offset 0 of the first text node lands outside the rendered text and Chromium
 * collapses the range — measured, and it silently yields an empty selection.
 *
 * This stands in for a screen reader's own selection command, not for a sighted
 * keyboard-only learner: Chromium will not extend a selection with Shift+Arrow in
 * non-editable content without caret browsing. That is the whole reason the panel
 * carries its own field.
 */
async function selectWord(page: Page, word: string): Promise<string> {
	await page
		.locator("pie-passage-shell [data-region='content']")
		.first()
		.evaluate((root, target) => {
			const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
			while (walker.nextNode()) {
				const node = walker.currentNode as Text;
				const index = (node.textContent ?? "").indexOf(target);
				if (index < 0) continue;
				const selection = window.getSelection();
				if (!selection) throw new Error("Selection API unavailable.");
				const range = document.createRange();
				range.setStart(node, index);
				range.setEnd(node, index + target.length);
				selection.removeAllRanges();
				selection.addRange(range);
				return;
			}
			throw new Error(`Passage has no "${target}" to select.`);
		}, word);

	const selected = await page.evaluate(
		() => window.getSelection()?.toString().trim() ?? "",
	);
	expect(selected).toBe(word);
	return selected;
}

test.describe("dictionary selection door", () => {
	test("a selection offers a lookup on the strip", async ({ page }) => {
		await gotoDemo(page);
		await selectWord(page, "Photosynthesis");

		await expect(strip(page)).toBeVisible();
		// Named for the selection, as the strip's own controls are.
		await expect(selectionAction(page, "dictionary")).toHaveAttribute(
			"aria-label",
			/selected text/i,
		);
		await expect(selectionAction(page, "pictureDictionary")).toBeVisible();
	});

	test("activating it opens the panel already answered", async ({ page }) => {
		await gotoDemo(page);
		await selectWord(page, "Photosynthesis");
		await selectionAction(page, "dictionary").click();

		const panel = dictionaryPanel(page);
		await expect(panel).toBeVisible();
		// The learner never touched the field: the term arrived with the request.
		await expect(panel.locator("input")).toHaveValue("Photosynthesis");
		await expect(panel.locator(".pie-tool-dictionary__word")).toContainText(
			"photosynthesis",
		);
		await expect(
			panel.locator(".pie-tool-dictionary__definition").first(),
		).toContainText("sunlight");

		// The strip goes away rather than sitting over the answer it just fetched.
		await expect(strip(page)).toBeHidden();
	});

	test("the picture dictionary opens the same way", async ({ page }) => {
		await gotoDemo(page);
		// "water" has a picture and no word entry, so this is a distinct path rather
		// than the same lookup reached twice.
		await selectWord(page, "water");
		await expect(strip(page)).toBeVisible();
		await selectionAction(page, "pictureDictionary").click();

		const panel = picturePanel(page);
		await expect(panel).toBeVisible();
		const image = panel.locator(".pie-tool-picture-dictionary__image").first();
		await expect(image).toBeVisible();
		await expect(image).toHaveAttribute("alt", "Water");
		await expect
			.poll(() =>
				image.evaluate((node) => (node as HTMLImageElement).naturalWidth),
			)
			.toBeGreaterThan(0);
	});

	test("the action is arrow-reachable inside the strip's single tab stop", async ({
		page,
	}) => {
		await gotoDemo(page);
		await selectWord(page, "Photosynthesis");
		await expect(strip(page)).toBeVisible();

		// The strip keeps one tab stop and moves with the arrow keys, so a new button
		// has to join that model rather than become a tab stop of its own.
		const tabbable = await strip(page)
			.locator("button")
			.evaluateAll(
				(nodes) =>
					nodes.filter((node) => node.getAttribute("tabindex") === "0").length,
			);
		expect(tabbable).toBe(1);

		await page.keyboard.press("Shift+F10");
		const action = selectionAction(page, "dictionary");
		await expect
			.poll(
				async () => {
					if (await action.evaluate((node) => node.matches(":focus")))
						return true;
					await page.keyboard.press("ArrowRight");
					return false;
				},
				{ timeout: 5000 },
			)
			.toBe(true);

		await page.keyboard.press("Enter");

		const panel = dictionaryPanel(page);
		await expect(panel).toBeVisible();
		await expect(panel.locator(".pie-tool-dictionary__word")).toContainText(
			"photosynthesis",
		);
	});

	// The latch that keeps the strip down must not take it away for good: the selection
	// survives on purpose, and Shift+F10 is how a learner asks for the strip again.
	test("the strip is still reachable for the same selection after acting on it", async ({
		page,
	}) => {
		await gotoDemo(page);
		await selectWord(page, "Photosynthesis");
		await selectionAction(page, "dictionary").click();
		await expect(strip(page)).toBeHidden();

		await page.keyboard.press("Shift+F10");
		await expect(strip(page)).toBeVisible();
	});

	test("a second lookup answers the new word instead of closing the panel", async ({
		page,
	}) => {
		await gotoDemo(page);
		await selectWord(page, "Photosynthesis");
		await selectionAction(page, "dictionary").click();

		const panel = dictionaryPanel(page);
		await expect(panel.locator(".pie-tool-dictionary__word")).toContainText(
			"photosynthesis",
		);

		// Showing rather than toggling is the point: asking again with the panel open
		// must answer the new word, not close the tool on the learner.
		await selectWord(page, "glucose");
		await expect(strip(page)).toBeVisible();
		await selectionAction(page, "dictionary").click();

		await expect(panel).toBeVisible();
		await expect(panel.locator(".pie-tool-dictionary__word")).toContainText(
			"glucose",
		);
	});
});

/**
 * A requested term reaches the panel through the params seam, which is reapplied on
 * every sync — so the panel cannot tell a re-render from a fresh ask by looking at the
 * term. Each request carries an identity instead. Keyed on the last search rather than
 * on that identity, reopening the panel re-issues the selection that opened it and
 * discards the lookup the learner typed, which is what this covers; the session's own
 * tests in `players-shared` cover the identity rule directly.
 */
test.describe("asking twice", () => {
	async function openFromSelection(page: Page, word: string) {
		await selectWord(page, word);
		await expect(strip(page)).toBeVisible();
		await selectionAction(page, "dictionary").click();
	}

	function headword(page: Page): Locator {
		return dictionaryPanel(page).locator(".pie-tool-dictionary__word");
	}

	test("a typed lookup survives closing and reopening the panel", async ({
		page,
	}) => {
		await gotoDemo(page);
		await openFromSelection(page, "Photosynthesis");
		await expect(headword(page)).toContainText("photosynthesis");

		const panel = dictionaryPanel(page);
		await panel.locator("input").fill("evidence");
		await panel.locator("input").press("Enter");
		await expect(headword(page)).toContainText("evidence");

		const toggle = page
			.locator('.item-toolbar__button[aria-label^="Dictionary"]')
			.first();
		await toggle.click();
		await expect(panel).toBeHidden();
		await toggle.click();
		await expect(panel).toBeVisible();

		// Keyed on the last search instead, reopening re-issues the selection that
		// opened the panel and throws away the word the learner went on to type.
		await expect(headword(page)).toContainText("evidence");
	});
});

test.describe("selection door where no dictionary is granted", () => {
	// The strip must not offer a lookup no toolbar can service. This demo carries the
	// annotation strip and no dictionary, which is the ordinary case for most sections.
	test("offers no lookup action", async ({ page }) => {
		await page.goto("/question-passage?mode=candidate&layout=splitpane", {
			waitUntil: "networkidle",
		});
		await page
			.locator("pie-passage-shell [data-region='content'] p")
			.first()
			.evaluate((node) => {
				const textNode = node.firstChild as Text;
				const selection = window.getSelection();
				if (!selection) throw new Error("Selection API unavailable.");
				const range = document.createRange();
				range.setStart(textNode, 5);
				range.setEnd(textNode, Math.min(40, textNode.length));
				selection.removeAllRanges();
				selection.addRange(range);
			});

		await expect(strip(page)).toBeVisible();
		await expect(selectionAction(page, "dictionary")).toHaveCount(0);
		await expect(selectionAction(page, "pictureDictionary")).toHaveCount(0);
	});
});
