import { expect, test, type Page } from "@playwright/test";

const DEMO_PATH = "/tts-ssml?mode=candidate&layout=splitpane";
const IDLE_TIMEOUT_MS = 900;
const IDLE_BUFFER_MS = 300;

type PaneSelector =
	| "aside.pie-section-player-passages-pane"
	| "main.pie-section-player-items-pane";

async function gotoDemo(page: Page) {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expect(page.getByRole("main", { name: "Items" })).toBeVisible();
	await expect(page.locator("aside.pie-section-player-passages-pane")).toBeVisible();
}

async function ensurePaneCanScroll(page: Page, selector: PaneSelector) {
	const metrics = await page.evaluate((paneSelector) => {
		const pane = document.querySelector(paneSelector) as HTMLElement | null;
		if (!pane) return { found: false, clientHeight: 0, scrollHeight: 0 };

		if (pane.scrollHeight <= pane.clientHeight + 1) {
			const filler = document.createElement("div");
			filler.setAttribute("data-pie-scroll-test-filler", "true");
			filler.setAttribute("aria-hidden", "true");
			filler.style.height = "900px";
			filler.style.pointerEvents = "none";
			pane.appendChild(filler);
		}

		return {
			found: true,
			clientHeight: pane.clientHeight,
			scrollHeight: pane.scrollHeight,
		};
	}, selector);

	expect(metrics.found).toBe(true);
	expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
}

async function triggerPaneScroll(page: Page, selector: PaneSelector) {
	await page.evaluate((paneSelector) => {
		const pane = document.querySelector(paneSelector) as HTMLElement | null;
		if (!pane) return;

		const maxScroll = Math.max(0, pane.scrollHeight - pane.clientHeight);
		pane.scrollTop = Math.min(Math.max(48, pane.scrollTop + 48), maxScroll);
	}, selector);
}

test.describe("section player transient pane scrollbars", () => {
	test("adds active class while scrolling and clears it after idle timeout per pane", async ({
		page,
	}) => {
		await gotoDemo(page);

		const panes: PaneSelector[] = [
			"aside.pie-section-player-passages-pane",
			"main.pie-section-player-items-pane",
		];

		for (const paneSelector of panes) {
			await ensurePaneCanScroll(page, paneSelector);
			const pane = page.locator(paneSelector);

			await expect(pane).toHaveClass(/pie-pane-scrollbars-managed/);
			await expect(pane).not.toHaveClass(/pie-pane-scrolling/);

			await triggerPaneScroll(page, paneSelector);
			await expect(pane).toHaveClass(/pie-pane-scrolling/);

			await page.waitForTimeout(IDLE_TIMEOUT_MS + IDLE_BUFFER_MS);
			await expect(pane).not.toHaveClass(/pie-pane-scrolling/);
		}
	});
});
