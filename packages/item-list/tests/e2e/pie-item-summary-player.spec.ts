import { expect, type Page, test } from "@playwright/test";
import {
	assertBrowserBuild,
	itemConfig,
	openPage,
	preloadStubElement,
	STUB_TAG,
} from "./browser-page.js";

/**
 * An expanded `<pie-item-summary>` from the `./browser` build: the player mounts near the viewport,
 * swaps in for the summary on its `load-complete`, and leaves the summary showing when it fails.
 */

test.beforeAll(() => assertBrowserBuild("pie-item-summary-player.spec"));

/** Appends an expanded row and records the events it dispatches. */
async function appendRow(page: Page, { top = 0 }: { top?: number } = {}): Promise<void> {
	await page.evaluate(
		({ top, config }) => {
			const row = document.createElement("pie-item-summary") as HTMLElement & Record<string, unknown>;
			row.style.display = "block";
			row.style.marginTop = `${top}px`;
			row.config = config;
			row.strategy = "preloaded";
			row.expanded = true;
			const events: unknown[] = [];
			(window as unknown as { rowEvents: unknown[] }).rowEvents = events;
			document.body.addEventListener("load-complete", (event) =>
				events.push({ type: "load-complete", ...(event as CustomEvent).detail }),
			);
			document.body.addEventListener("player-error", (event) =>
				events.push({ type: "player-error", ...(event as CustomEvent).detail }),
			);
			document.body.append(row);
		},
		{ top, config: itemConfig("item", "<p>Pick one</p>") },
	);
}

function rowEvents(page: Page): Promise<Record<string, unknown>[]> {
	return page.evaluate(() => (window as unknown as { rowEvents: Record<string, unknown>[] }).rowEvents);
}

test.describe("<pie-item-summary> player view", () => {
	test("replaces the summary with the player once it has loaded", async ({ page }) => {
		await openPage(page);
		await preloadStubElement(page);
		await appendRow(page);
		const player = page.locator("pie-item-summary pie-item-player");
		await expect(page.locator(`pie-item-summary ${STUB_TAG}`)).toHaveText("Rendered: <p>Pick one</p>");
		await expect(page.locator(".pie-item-summary")).toHaveCount(0);
		await expect(player).toBeVisible();
		expect(await player.evaluate((element) => (element as unknown as { addCorrectResponse: boolean }).addCorrectResponse)).toBe(true);
		await expect
			.poll(() => rowEvents(page))
			.toEqual([
				{ type: "load-complete", view: "summary" },
				{ type: "load-complete", view: "player" },
			]);

		await page.locator("pie-item-summary").evaluate((row) => {
			(row as unknown as { expanded: boolean }).expanded = false;
		});
		await expect(player).toHaveCount(0);
		await expect(page.locator(".pie-item-summary__prompt")).toHaveText("Pick one");
	});

	test("keeps the summary and re-dispatches the player's error when it fails", async ({ page }) => {
		await openPage(page);
		await appendRow(page);
		await expect
			.poll(async () => (await rowEvents(page)).find((event) => event.type === "player-error"))
			.toMatchObject({ code: "ITEM_PLAYER_LOAD_ERROR", recoverable: false });
		await expect(page.locator("pie-item-summary pie-item-player")).toHaveCount(0);
		await expect(page.locator(".pie-item-summary__prompt")).toHaveText("Pick one");
		expect((await rowEvents(page)).filter((event) => event.type === "player-error")).toHaveLength(1);
	});

	test("mounts the player only once the row nears the viewport", async ({ page }) => {
		await openPage(page);
		await preloadStubElement(page);
		await appendRow(page, { top: 5000 });
		await expect(page.locator(".pie-item-summary__prompt")).toHaveText("Pick one");
		await page.waitForTimeout(300);
		await expect(page.locator("pie-item-summary pie-item-player")).toHaveCount(0);
		await page.locator("pie-item-summary").scrollIntoViewIfNeeded();
		await expect(page.locator(`pie-item-summary ${STUB_TAG}`)).toHaveText("Rendered: <p>Pick one</p>");
	});
});
