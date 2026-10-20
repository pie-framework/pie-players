import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";

/**
 * An expanded `<pie-item-summary>` from the `./browser` build, served from a stub origin: the
 * player mounts near the viewport, swaps in for the summary on its `load-complete`, and leaves the
 * summary showing when it fails. Elements are preloaded as a stub registration, so no element code
 * is fetched. Requires `bun run build:e2e:item-list`.
 */

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BROWSER_DIR = path.join(PACKAGE_ROOT, "dist/browser");
const ORIGIN = "http://pie-item-list.test";

test.beforeAll(() => {
	if (!existsSync(path.join(BROWSER_DIR, "pie-item-list.js"))) {
		throw new Error(
			`[pie-item-summary-player.spec] ${BROWSER_DIR} has no build. Run "bun run build:e2e:item-list" first.`,
		);
	}
});

const STUB_TAG = "multiple-choice--version-11-0-0";

async function openPage(page: Page): Promise<void> {
	await page.route(`${ORIGIN}/**`, async (route) => {
		const { pathname } = new URL(route.request().url());
		if (pathname === "/") {
			await route.fulfill({
				contentType: "text/html",
				body: `<!doctype html><html><body><script type="module" src="./pie-item-list.js"></script></body></html>`,
			});
			return;
		}
		const file = path.join(BROWSER_DIR, pathname);
		if (!file.startsWith(BROWSER_DIR) || !existsSync(file)) {
			await route.fulfill({ status: 404 });
			return;
		}
		await route.fulfill({ contentType: "text/javascript", body: readFileSync(file) });
	});
	await page.goto(`${ORIGIN}/`);
	await page.waitForFunction(() => customElements.get("pie-item-summary") !== undefined);
}

/** Registers a stub for the item's element, so the preloaded player finds it defined. */
async function preloadStubElement(page: Page): Promise<void> {
	await page.evaluate((tag) => {
		customElements.define(
			tag,
			class extends HTMLElement {
				set model(value: { prompt?: string }) {
					this.textContent = `Rendered: ${value?.prompt ?? ""}`;
				}
			},
		);
	}, STUB_TAG);
}

/** Appends an expanded row and records the events it dispatches. */
async function appendRow(page: Page, { top = 0 }: { top?: number } = {}): Promise<void> {
	await page.evaluate((top) => {
		const row = document.createElement("pie-item-summary") as HTMLElement & Record<string, unknown>;
		row.style.display = "block";
		row.style.marginTop = `${top}px`;
		row.config = {
			id: "item",
			elements: { "multiple-choice": "@pie-element/multiple-choice@11.0.0" },
			models: [{ id: "1", element: "multiple-choice", prompt: "<p>Pick one</p>" }],
			markup: '<multiple-choice id="1"></multiple-choice>',
		};
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
	}, top);
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
