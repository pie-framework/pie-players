import { expect, test } from "@playwright/test";

const ROUTE = "/three-questions?mode=candidate&layout=splitpane";
const HINT = ".pie-section-player-scroll-hint";

/**
 * The scroll hint is the discoverability affordance for content below the fold:
 * PIE-549 added it so a learner does not click "Next >" with questions still
 * unseen, and PIE-625 made it a control that scrolls when clicked. Its state is
 * recomputed off a ResizeObserver, a subtree MutationObserver and a scroll
 * listener that all coalesce into one deferred layout read, so these assertions
 * poll rather than expecting a synchronous update.
 */
test.describe("section player scroll hint", () => {
	test("tracks scroll position and content growth", async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 600 });
		await page.goto(ROUTE, { waitUntil: "networkidle" });

		const pane = page.locator("pie-section-player-items-pane").first();
		await expect(pane).toBeVisible();

		const hint = page.locator(HINT).first();
		await expect(hint).toHaveCSS("visibility", "visible");

		// The control is labelled, whichever presentation the host opted into.
		await expect(
			page.getByRole("button", { name: "Scroll down" }).first(),
		).toBeAttached();

		const scrollToBottom = () =>
			page.evaluate(() => {
				const container = document.querySelector("pie-section-player-items-pane")
					?.parentElement as HTMLElement;
				container.scrollTop = container.scrollHeight;
			});

		await scrollToBottom();
		await expect(hint).toHaveCSS("visibility", "hidden");

		await page.evaluate(() => {
			const container = document.querySelector("pie-section-player-items-pane")
				?.parentElement as HTMLElement;
			container.scrollTop = 0;
		});
		await expect(hint).toHaveCSS("visibility", "visible");

		// Content that grows below the fold has to re-arm the hint: this is the
		// subtree childList path into the coalesced read.
		await scrollToBottom();
		await expect(hint).toHaveCSS("visibility", "hidden");

		await page.evaluate(() => {
			const cards = document.querySelectorAll("pie-section-player-item-card");
			const grown = document.createElement("div");
			grown.style.height = "600px";
			grown.setAttribute("data-test-grown", "1");
			cards[cards.length - 1]?.appendChild(grown);
		});
		await expect(hint).toHaveCSS("visibility", "visible");
	});

	// PIE-885: the coalesced read is scheduled on a timer, not an animation
	// frame, because a document with no compositor never runs a frame callback.
	// Constructed the same way as section-player-non-painting-document.spec.ts.
	test("arms in a document that never paints", async ({ page }) => {
		await page.addInitScript(() => {
			let nextFrameHandle = 0;
			window.requestAnimationFrame = ((): number => {
				nextFrameHandle += 1;
				return nextFrameHandle;
			}) as typeof window.requestAnimationFrame;
			window.cancelAnimationFrame = (() => {
				/* no queued callback to cancel */
			}) as typeof window.cancelAnimationFrame;
		});

		await page.setViewportSize({ width: 1280, height: 600 });
		await page.goto(ROUTE, { waitUntil: "networkidle" });

		const hint = page.locator(HINT).first();
		await expect(hint).toHaveCSS("visibility", "visible", { timeout: 30_000 });
	});

	test("clicking the hint scrolls the items pane down", async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 600 });
		await page.goto(ROUTE, { waitUntil: "networkidle" });

		const hint = page.locator(HINT).first();
		await expect(hint).toHaveCSS("visibility", "visible");

		await page.getByRole("button", { name: "Scroll down" }).first().click();

		await expect
			.poll(async () =>
				page.evaluate(() => {
					const container = document.querySelector(
						"pie-section-player-items-pane",
					)?.parentElement as HTMLElement;
					return container.scrollTop;
				}),
			)
			.toBeGreaterThan(0);
	});
});
