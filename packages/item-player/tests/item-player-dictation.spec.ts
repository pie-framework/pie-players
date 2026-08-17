/**
 * Non-embedded speech-to-text: platform dictation must reach the response.
 *
 * Speech-to-text has two delivery forms in assessment. *Embedded* means the test
 * system supplies the recognizer; PIE has none, and `docs/prds/speech-to-text.md`
 * scopes it. *Non-embedded* means the learner's own platform does it — ChromeOS
 * Dictation, Windows Voice Access, macOS Dictation, Dragon — and that form already
 * works: the platform inserts text into the focused editable, the response
 * editor's own input pipeline runs, and the element commits its session. It works
 * by construction rather than by design, so it is one editor upgrade away from
 * disappearing with no failing test. This spec is that failing test.
 *
 * What it asserts is the accommodation, not a PIE feature:
 *
 *   1. The response surface is a focusable editable. OS dictation targets the
 *      focused element, so a response that cannot take focus has nowhere to
 *      receive dictated text.
 *   2. *Inserted* text reaches the session. `keyboard.insertText` and CDP
 *      `Input.insertText` are the primitive the platform IME path uses: one
 *      trusted `beforeinput`/`input` pair with no key events. An editor that only
 *      handles `keydown` passes a typing test and fails dictation.
 *   3. A composition commits. macOS and ChromeOS dictation arrive as
 *      `compositionstart`/`compositionupdate`/`compositionend`, a different path
 *      through every rich-text editor than a plain insert.
 *   4. Insertion honours the caret, and successive bursts accumulate. A student
 *      dictates in bursts and corrects between them; an editor that resets the
 *      selection on commit discards the correction silently.
 *
 * **The commit boundary is blur, and that is asserted deliberately.** Neither
 * typing nor insertion commits while the editor holds focus — verified to 20s.
 * A host that snapshots the session on a timer while the learner is still in the
 * editor captures nothing. If a debounce is ever added, the pre-blur assertion
 * below fails, which is the intended signal: that is a change to
 * constructed-response persistence and should not land unnoticed.
 *
 * The demo resolves `@pie-element/extended-text-entry@latest` from the bundle
 * host, as the sibling item-player specs do, so this exercises the published
 * element (currently TipTap/ProseMirror over `contenteditable`) rather than a
 * workspace build.
 */

import { expect, test, type Page } from "@playwright/test";
import { openDemoMenuIfCollapsed } from "../../../test-support/demo-menu";

const DEMO_ID = "extended-text-entry-default";
const DELIVERY_PATH = `/demo/${DEMO_ID}/delivery?mode=gather&role=student`;
const DELIVERY_PROMPT = "This is the question prompt";
/** Model id in `apps/item-demos/src/lib/content/extended-text-entry-default.ts`. */
const SESSION_ENTRY_ID = "1";

const FIRST_BURST =
	"The water cycle moves water between the ocean and the air.";
const SECOND_BURST = "Evaporation lifts it and precipitation returns it.";
const COMPOSED = "Photosynthesis converts light into chemical energy.";

async function gotoDelivery(page: Page) {
	// `networkidle` is unreliable against vite dev (HMR websocket + lazy module
	// loads) — wait on rendered chrome as the mount signal, as the sibling specs do.
	await page.goto(DELIVERY_PATH, { waitUntil: "domcontentloaded" });
	await expect(
		page.getByRole("navigation", { name: "Demo controls" }),
	).toBeVisible({ timeout: 15_000 });
	await openDemoMenuIfCollapsed(page);
	await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({
		timeout: 30_000,
	});
}

/**
 * The learner's response surface.
 *
 * Located by `contenteditable` inside the player rather than by an editor-specific
 * class, because the point of this spec is that dictation survives an editor
 * change. Scoped to `pie-item-player` so the demo route's own JSON source editor
 * cannot match.
 */
function responseEditable(page: Page) {
	return page.locator('pie-item-player [contenteditable="true"]').first();
}

/**
 * Committed response markup, or `null` when nothing has committed.
 *
 * Read from `pie-item-player.session` rather than from a `session-changed`
 * listener on the player: the payload-carrying event is dispatched on the
 * element's inner wrapper and on `window`, and does not reach a listener bound to
 * `pie-item-player`. The property is the host-facing state either way.
 */
async function committedResponse(page: Page): Promise<string | null> {
	return await page.evaluate((entryId) => {
		const player = document.querySelector("pie-item-player") as {
			session?: { data?: Array<{ id?: string; value?: unknown }> };
		} | null;
		const entry = player?.session?.data?.find((item) => item?.id === entryId);
		return typeof entry?.value === "string" ? entry.value : null;
	}, SESSION_ENTRY_ID);
}

/** Plain text of the response surface, collapsed whitespace. */
async function responseText(page: Page): Promise<string> {
	return (await responseEditable(page).innerText()).replace(/\s+/g, " ").trim();
}

async function focusResponse(page: Page) {
	const editable = responseEditable(page);
	await expect(editable).toBeVisible({ timeout: 30_000 });
	await editable.click();
	await expect
		.poll(async () =>
			page.evaluate(() => {
				// The editable lives in the element's own tree; walk shadow roots so a
				// shadow-encapsulated editor still reports honestly.
				let active: Element | null = document.activeElement;
				while (active?.shadowRoot?.activeElement) {
					active = active.shadowRoot.activeElement;
				}
				return active?.getAttribute("contenteditable");
			}),
		)
		.toBe("true");
	return editable;
}

/** Move focus out of the editor, which is what makes it commit. */
async function blurResponse(page: Page) {
	await page.getByText(DELIVERY_PROMPT).click();
}

test.describe("item-player non-embedded dictation", () => {
	test("an inserted burst commits on blur, not while focused", async ({
		page,
	}) => {
		await gotoDelivery(page);
		await focusResponse(page);

		// `insertText` emits a trusted input event with no key events — the shape the
		// platform IME path produces.
		await page.keyboard.insertText(FIRST_BURST);
		await expect
			.poll(async () => await responseText(page), { timeout: 15_000 })
			.toContain(FIRST_BURST);

		// Nothing is in the session yet. See the header: this is the current commit
		// boundary, asserted so a change to it surfaces here.
		await page.waitForTimeout(2_000);
		expect(await committedResponse(page)).toBeNull();

		await blurResponse(page);
		await expect
			.poll(async () => await committedResponse(page), { timeout: 15_000 })
			.toContain(FIRST_BURST);
	});

	test("successive bursts accumulate in order", async ({ page }) => {
		await gotoDelivery(page);

		await focusResponse(page);
		await page.keyboard.insertText(FIRST_BURST);
		await blurResponse(page);
		await expect
			.poll(async () => await committedResponse(page), { timeout: 15_000 })
			.toContain(FIRST_BURST);

		// The student stopped, read what was transcribed, and resumed. A second burst
		// continues the response rather than replacing it.
		await focusResponse(page);
		await page.keyboard.press("End");
		await page.keyboard.insertText(` ${SECOND_BURST}`);
		await blurResponse(page);
		await expect
			.poll(async () => await committedResponse(page), { timeout: 15_000 })
			.toContain(SECOND_BURST);

		const committed = await committedResponse(page);
		expect(committed).toContain(FIRST_BURST);
		expect(committed?.indexOf(FIRST_BURST)).toBeLessThan(
			committed?.indexOf(SECOND_BURST) ?? -1,
		);
	});

	test("insertion lands at the caret", async ({ page }) => {
		// A student correcting a mis-transcription puts the caret back and dictates
		// over it. An editor that resets the selection on commit would append instead
		// and lose the correction.
		await gotoDelivery(page);
		await focusResponse(page);
		await page.keyboard.insertText("AB");
		await page.keyboard.press("ArrowLeft");
		await page.keyboard.insertText("X");
		await expect
			.poll(async () => await responseText(page), { timeout: 15_000 })
			.toBe("AXB");

		await blurResponse(page);
		await expect
			.poll(async () => await committedResponse(page), { timeout: 15_000 })
			.toContain("AXB");
	});

	test("an IME composition commits to the session", async ({ page }) => {
		await gotoDelivery(page);
		await focusResponse(page);

		const cdp = await page.context().newCDPSession(page);
		// Interim recognition: text on screen, composition still open.
		await cdp.send("Input.imeSetComposition", {
			text: COMPOSED,
			selectionStart: COMPOSED.length,
			selectionEnd: COMPOSED.length,
		});
		await expect
			.poll(async () => await responseText(page), { timeout: 15_000 })
			.toContain("Photosynthesis");
		// Final recognition: the composition commits to the document.
		await cdp.send("Input.insertText", { text: COMPOSED });

		await blurResponse(page);
		await expect
			.poll(async () => await committedResponse(page), { timeout: 15_000 })
			.toContain(COMPOSED);
		await cdp.detach();

		const committed = await committedResponse(page);
		// The commit replaced the composition rather than appending to it.
		expect(committed?.indexOf(COMPOSED)).toBe(committed?.lastIndexOf(COMPOSED));
	});

	test("the response surface is a keyboard-reachable editable", async ({
		page,
	}) => {
		// OS dictation writes into whatever holds focus. A response that cannot be
		// focused from the keyboard gives a learner who dictates because they cannot
		// use a pointer no way to aim it.
		await gotoDelivery(page);
		const editable = responseEditable(page);
		await expect(editable).toBeVisible({ timeout: 30_000 });

		const surface = await editable.evaluate((node) => ({
			contentEditable: node.getAttribute("contenteditable"),
			tabIndex: (node as HTMLElement).tabIndex,
		}));
		expect(surface.contentEditable).toBe("true");
		// A contenteditable is focusable without an explicit tabindex; assert only
		// that nothing has removed it from the tab order.
		expect(surface.tabIndex).toBeGreaterThanOrEqual(0);

		await editable.focus();
		await page.keyboard.insertText("Focused without a pointer.");
		await blurResponse(page);
		await expect
			.poll(async () => await committedResponse(page), { timeout: 15_000 })
			.toContain("Focused without a pointer.");
	});
});
