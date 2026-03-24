import { expect, test, type Page } from "@playwright/test";

const DEMO_PATH = "/tts-ssml?mode=candidate&layout=splitpane";

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

async function assertPaneHasStableScrollbarStyling(page: Page, selector: PaneSelector) {
	const metrics = await page.evaluate((paneSelector) => {
		const pane = document.querySelector(paneSelector) as HTMLElement | null;
		if (!pane) {
			return {
				found: false,
				overflowY: "",
				hasTransientManagedClass: false,
				hasTransientScrollingClass: false,
				scrollbarWidth: "",
			};
		}

		const pseudoScrollbarStyle = getComputedStyle(pane, "::-webkit-scrollbar");
		return {
			found: true,
			overflowY: getComputedStyle(pane).overflowY,
			hasTransientManagedClass: pane.classList.contains("pie-pane-scrollbars-managed"),
			hasTransientScrollingClass: pane.classList.contains("pie-pane-scrolling"),
			scrollbarWidth: pseudoScrollbarStyle.width,
		};
	}, selector);

	expect(metrics.found).toBe(true);
	expect(metrics.overflowY).toBe("auto");
	expect(metrics.hasTransientManagedClass).toBe(false);
	expect(metrics.hasTransientScrollingClass).toBe(false);
	expect(metrics.scrollbarWidth).toBe("12px");
}

test.describe("section player splitpane scrollbars", () => {
	test("keeps pane scrollbar styling stable whenever pane content is scrollable", async ({
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

			await expect(pane).toBeVisible();
			await assertPaneHasStableScrollbarStyling(page, paneSelector);

			await page.evaluate((currentPaneSelector) => {
				const currentPane = document.querySelector(currentPaneSelector) as HTMLElement | null;
				if (!currentPane) return;
				const maxScroll = Math.max(0, currentPane.scrollHeight - currentPane.clientHeight);
				currentPane.scrollTop = Math.min(Math.max(48, currentPane.scrollTop + 48), maxScroll);
			}, paneSelector);

			await assertPaneHasStableScrollbarStyling(page, paneSelector);
		}
	});
});
