import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

/**
 * Captures evidence images of the dictionary tools working.
 *
 * Not a behavioural test — the assertions here only keep a screenshot from being taken
 * of a panel that has not finished rendering. Behaviour lives in
 * `section-dictionary-tools.spec.ts`. Run this deliberately:
 *
 *   bunx playwright test packages/section-player/tests/dictionary-tools-screenshots.spec.ts \
 *     --config packages/section-player/playwright.config.ts
 *
 * Images land in `artifacts/dictionary-tools/` at the repo root, which is gitignored —
 * they are for attaching to a ticket, not for committing.
 */

const DEMO_PATH = "/dictionary-tools";
const OUT_DIR = resolve(
	dirname(new URL(import.meta.url).pathname),
	"../../../artifacts/dictionary-tools",
);

async function shot(page: Page, name: string, clip?: Locator) {
	await mkdir(OUT_DIR, { recursive: true });
	const path = `${OUT_DIR}/${name}.png`;
	if (clip) await clip.screenshot({ path });
	else await page.screenshot({ path, fullPage: false });
	console.log(`SAVED ${path}`);
}

async function gotoDemo(page: Page) {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expect(page.locator(".item-toolbar__button").first()).toBeVisible();
}

function shell(page: Page, toolId: string): Locator {
	return page.locator(`[data-pie-tool-shell="${toolId}"]`).first();
}

async function openTool(page: Page, ariaLabelStart: string) {
	await page
		.locator(`.item-toolbar__button[aria-label^="${ariaLabelStart}"]`)
		.first()
		.click();
}

test.describe("dictionary tools evidence", () => {
	test.use({ viewport: { width: 1400, height: 900 } });

	test("captures the dictionary states", async ({ page }) => {
		await gotoDemo(page);
		await shot(page, "01-section-with-toolbar");

		await openTool(page, "Dictionary");
		const panel = page.locator("pie-tool-dictionary .pie-tool-dictionary");
		await expect(panel).toBeVisible();
		await shot(page, "02-dictionary-empty", shell(page, "dictionary"));

		await panel.locator("input").fill("photosynthesis");
		await page.keyboard.press("Enter");
		await expect(panel.locator(".pie-tool-dictionary__word")).toContainText(
			"photosynthesis",
		);
		await shot(page, "03-dictionary-result", shell(page, "dictionary"));

		await panel.locator("input").fill("reason");
		await page.keyboard.press("Enter");
		await expect(panel.locator(".pie-tool-dictionary__sense")).toHaveCount(2);
		await shot(page, "04-dictionary-two-senses", shell(page, "dictionary"));

		await panel.locator("input").fill("zzznotaword");
		await page.keyboard.press("Enter");
		await expect(panel.locator(".pie-tool-dictionary__notice")).toContainText(
			"No entry for",
		);
		await shot(page, "05-dictionary-no-entry", shell(page, "dictionary"));

		await panel.locator("input").fill("servicefailure");
		await page.keyboard.press("Enter");
		await expect(panel.locator(".pie-tool-dictionary__error")).toBeVisible();
		await shot(page, "06-dictionary-service-error", shell(page, "dictionary"));
	});

	test("captures the picture dictionary states", async ({ page }) => {
		await gotoDemo(page);

		await openTool(page, "Picture Dictionary");
		const panel = page.locator(
			"pie-tool-picture-dictionary .pie-tool-picture-dictionary",
		);
		await expect(panel).toBeVisible();
		await shot(
			page,
			"07-picture-dictionary-empty",
			shell(page, "pictureDictionary"),
		);

		await panel.locator("input").fill("sun");
		await page.keyboard.press("Enter");
		const images = panel.locator(".pie-tool-picture-dictionary__image");
		await expect(images).toHaveCount(2);
		// Wait for decode, so the capture is not of empty boxes.
		await expect
			.poll(() =>
				images
					.first()
					.evaluate((node) => (node as HTMLImageElement).naturalWidth),
			)
			.toBeGreaterThan(0);
		await shot(
			page,
			"08-picture-dictionary-results",
			shell(page, "pictureDictionary"),
		);

		await panel.locator("input").fill("zzznotaword");
		await page.keyboard.press("Enter");
		await expect(
			panel.locator(".pie-tool-picture-dictionary__notice"),
		).toContainText("No picture for");
		await shot(
			page,
			"09-picture-dictionary-no-picture",
			shell(page, "pictureDictionary"),
		);
	});

	// Both tools are open here, but the shells stack at the same default position, so the
	// second covers the first. The value of this one is the panel in its real context —
	// over the passage and items — not a side-by-side comparison.
	test("captures a panel over the live section", async ({ page }) => {
		await gotoDemo(page);

		await openTool(page, "Dictionary");
		const dictionary = page.locator("pie-tool-dictionary .pie-tool-dictionary");
		await dictionary.locator("input").fill("evidence");
		await page.keyboard.press("Enter");
		await expect(dictionary.locator(".pie-tool-dictionary__word")).toBeVisible();

		await openTool(page, "Picture Dictionary");
		const pictures = page.locator(
			"pie-tool-picture-dictionary .pie-tool-picture-dictionary",
		);
		await pictures.locator("input").fill("leaf");
		await page.keyboard.press("Enter");
		await expect(
			pictures.locator(".pie-tool-picture-dictionary__image").first(),
		).toBeVisible();

		await shot(page, "10-panel-over-live-section");
	});

	test("captures the keyboard path into the field", async ({ page }) => {
		await gotoDemo(page);
		await openTool(page, "Dictionary");
		const panel = page.locator("pie-tool-dictionary .pie-tool-dictionary");
		const input = panel.locator("input");

		// Tab from the shell chrome into the field — the path the focus-trap fix opened.
		await expect
			.poll(
				async () => {
					const focused = await input.evaluate((node) => {
						let active: Element | null = document.activeElement;
						while (active?.shadowRoot?.activeElement) {
							active = active.shadowRoot.activeElement;
						}
						return active === node;
					});
					if (focused) return true;
					await page.keyboard.press("Tab");
					return false;
				},
				{ timeout: 5000 },
			)
			.toBe(true);

		await page.keyboard.type("current");
		await shot(page, "11-keyboard-focus-in-field", shell(page, "dictionary"));
	});

	test("captures the selection door", async ({ page }) => {
		await gotoDemo(page);

		// Offsets come from walking to the text node holding the word: the passage markup
		// carries whitespace, so offset 0 of the paragraph's first text node lands outside
		// the rendered text and Chromium collapses the range.
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
			}, "Photosynthesis");

		const strip = page.locator("pie-tool-annotation-toolbar [role='toolbar']");
		await expect(strip).toBeVisible();
		await expect(
			strip.locator('[data-pie-selection-action="dictionary"]'),
		).toBeVisible();
		await shot(page, "12-selection-strip-with-lookup");

		await strip.locator('[data-pie-selection-action="dictionary"]').click();
		const panel = page.locator("pie-tool-dictionary .pie-tool-dictionary");
		await expect(panel.locator(".pie-tool-dictionary__word")).toContainText(
			"photosynthesis",
		);
		// The whole page: the point of this one is that the learner typed nothing and the
		// strip is gone rather than sitting over the answer.
		await shot(page, "13-selection-opened-dictionary");
	});
});
