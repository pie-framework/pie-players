import { expect, type Page, test } from "@playwright/test";
import {
	assertBrowserBuild,
	itemConfig,
	openPage,
	preloadStubElement,
	STUB_TAG,
} from "./browser-page.js";

/**
 * `<pie-item-list>` from the `./browser` build: a row's button expands it into the item's player,
 * long summaries clip with a fade, and both extension forms render into the row.
 */

test.beforeAll(() => assertBrowserBuild("pie-item-list.spec"));

const LONG_PROMPT = Array.from({ length: 12 }, (_, index) => `<p>Line ${index + 1}</p>`).join("");

/** Mounts a list with a long and a short item, a tag-name `actions`, and function `details` and `highlights`. */
async function mountList(page: Page): Promise<void> {
	await page.evaluate(
		({ long, short }) => {
			customElements.define(
				"row-actions",
				class extends HTMLElement {
					set item(entry: { id: string }) {
						this.textContent = `Edit ${entry.id}`;
					}
				},
			);
			const list = document.createElement("pie-item-list") as HTMLElement & Record<string, unknown>;
			list.strategy = "preloaded";
			list.actions = "row-actions";
			list.details = (entry: { id: string; data?: { owner: string } }, host: HTMLElement) => {
				host.textContent = `${entry.id} by ${entry.data?.owner}`;
			};
			list.highlights = (entry: { data?: { match?: string } }, host: HTMLElement) => {
				if (entry.data?.match) host.textContent = entry.data.match;
			};
			list.items = [
				{ id: "long", config: long, data: { owner: "Ada", match: "Line 12" } },
				{ id: "short", config: short, data: { owner: "Grace" } },
			];
			const events: unknown[] = [];
			(window as unknown as { listEvents: unknown[] }).listEvents = events;
			list.addEventListener("expanded-change", (event) => events.push((event as CustomEvent).detail));
			document.body.append(list);
		},
		{ long: itemConfig("long", LONG_PROMPT), short: itemConfig("short", "<p>Pick one</p>") },
	);
}

function row(page: Page, id: string) {
	return page.locator(`.pie-item-list__row[data-item-id="${id}"]`);
}

test.describe("<pie-item-list>", () => {
	test("renders both extension forms and clips only a summary that overflows", async ({ page }) => {
		await openPage(page);
		await mountList(page);
		await expect(row(page, "long").locator(".pie-item-list__details")).toHaveText("long by Ada");
		await expect(row(page, "short").locator("row-actions")).toHaveText("Edit short");
		// Outside the clip, so the collapsed row still shows its match; empty, it takes no space.
		await expect(row(page, "long").locator(".pie-item-list__highlights")).toBeVisible();
		await expect(row(page, "long").locator(".pie-item-list__highlights")).toHaveText("Line 12");
		await expect(row(page, "short").locator(".pie-item-list__highlights")).toBeHidden();
		const longView = row(page, "long").locator(".pie-item-list__view");
		await expect(longView).toHaveAttribute("data-overflowing", "");
		expect(await longView.evaluate((view) => view.getBoundingClientRect().height)).toBeLessThan(
			await longView.evaluate((view) => view.scrollHeight),
		);
		await expect(row(page, "short").locator(".pie-item-list__view")).not.toHaveAttribute(
			"data-overflowing",
			"",
		);
	});

	test("expands a row into its player from its button, keeping focus on the button", async ({ page }) => {
		await openPage(page);
		await preloadStubElement(page);
		await mountList(page);
		const button = row(page, "short").getByRole("button", { name: "Show the full item" });
		await expect(button).toHaveAttribute("aria-expanded", "false");
		await button.click();
		await expect(button).toHaveAttribute("aria-expanded", "true");
		await expect(row(page, "short").locator(STUB_TAG)).toHaveText("Rendered: <p>Pick one</p>");
		await expect(row(page, "short")).not.toHaveAttribute("aria-busy", "true");
		await expect(row(page, "long").locator("pie-item-player")).toHaveCount(0);
		await expect(button).toBeFocused();
		expect(await page.evaluate(() => (window as unknown as { listEvents: unknown[] }).listEvents)).toEqual([
			{ id: "short", expanded: true },
		]);

		await button.click();
		await expect(row(page, "short").locator("pie-item-player")).toHaveCount(0);
		await expect(row(page, "short").locator(".pie-item-summary__prompt")).toHaveText("Pick one");
	});
});
