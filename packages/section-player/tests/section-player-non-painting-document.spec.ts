import { expect, test } from "@playwright/test";

/**
 * PIE-885 regression: composition delivery must not depend on the document
 * painting.
 *
 * `PieAssessmentToolkit` publishes the section composition to the players
 * through exactly one path — the `composition-changed` event — and schedules
 * that emit behind a one-shot latch. It used to arm only
 * `requestAnimationFrame`, chosen whenever `window.requestAnimationFrame`
 * merely *existed* rather than when it was known to fire. In a document that
 * never paints the callback never ran, the latch never cleared, no
 * `composition-changed` was dispatched, and every `pie-section-player` route
 * rendered no items at all. The `queueMicrotask` fallback could not rescue it,
 * because it was only reached when rAF was absent entirely.
 *
 * The failure was permanent, not slow: a background tab recovers when its
 * pending frame becomes due on refocus, but a context with no compositor —
 * headless browsers, hidden/offscreen tabs, agent and CI automation harnesses —
 * never gets that frame.
 *
 * Headless Chromium does fire rAF, so the non-painting document is constructed
 * deterministically: the init script below hands out frame handles and never
 * invokes a callback. That is the observable behaviour of a document with no
 * compositor, without depending on how a given Chromium build treats an
 * offscreen surface.
 *
 * Svelte's own render path is microtask-driven and its `tick()` already races
 * rAF against `setTimeout`, so neutering rAF does not stall the framework —
 * only code that treats a frame as a guaranteed callback.
 */

const DEMO_PATH = "/tts-ssml?mode=candidate&layout=splitpane";

test.describe("section player in a document that never paints", () => {
	test("renders section items with no animation frame callbacks", async ({
		page,
	}) => {
		await page.addInitScript(() => {
			let nextFrameHandle = 0;
			// Hand out plausible, monotonic handles so callers that store and
			// later cancel one behave exactly as they would against a real
			// compositor. Nothing is ever invoked.
			window.requestAnimationFrame = ((): number => {
				nextFrameHandle += 1;
				return nextFrameHandle;
			}) as typeof window.requestAnimationFrame;
			window.cancelAnimationFrame = (() => {
				/* no queued callback to cancel */
			}) as typeof window.cancelAnimationFrame;
		});

		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const itemsPane = page.locator("main.pie-section-player-items-pane");
		const itemCards = itemsPane.locator("pie-section-player-item-card");

		// The composition has to reach the layout kernel for any card to exist.
		// Before the fix the kernel kept its initial empty composition
		// (`section: null`, empty `items`/`renderables`) and this count stayed 0.
		await expect(itemCards.first()).toBeVisible({ timeout: 30_000 });

		// And real item content, not just the card shell — this is the same
		// signal `section-player-toolkit-observability.spec.ts` interacts with.
		await expect(
			itemsPane.locator('input[type="radio"], input[type="checkbox"]').first(),
		).toBeVisible();

		await expect(itemsPane.getByText("Loading section content...")).toHaveCount(
			0,
		);
	});
});
