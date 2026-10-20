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
 * collapsed rows clip the passage to a line and the item to the clip height, both extension forms
 * render into the row, and the built-in highlights render the entry's search matches.
 */

test.beforeAll(() => assertBrowserBuild("pie-item-list.spec"));

const lines = (count: number) =>
	Array.from({ length: count }, (_, index) => `<p>Line ${index + 1}</p>`).join("");

interface ListOptions {
	passage?: boolean;
}

/** Mounts a list with a long and a short item, a tag-name `actions` and a function `details`. */
async function mountList(page: Page, { passage = false }: ListOptions = {}): Promise<void> {
	await page.evaluate(
		({ long, short, passageConfig }) => {
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
			list.items = [
				{
					id: "long",
					config: long,
					passage: passageConfig ?? undefined,
					highlights: [{ label: "Prompt", snippets: ["Line <mark>12</mark>"] }],
					data: { owner: "Ada" },
				},
				{ id: "short", config: short, data: { owner: "Grace" } },
			];
			const events: unknown[] = [];
			(window as unknown as { listEvents: unknown[] }).listEvents = events;
			list.addEventListener("expanded-change", (event) => events.push((event as CustomEvent).detail));
			document.body.append(list);
		},
		{
			long: itemConfig("long", lines(12)),
			short: itemConfig("short", "<p>Pick one</p>"),
			passageConfig: passage ? itemConfig("passage", lines(30)) : null,
		},
	);
}

function row(page: Page, id: string) {
	return page.locator(`.pie-item-list__row[data-item-id="${id}"]`);
}

const height = (locator: ReturnType<Page["locator"]>) =>
	locator.evaluate((node) => node.getBoundingClientRect().height);

test.describe("<pie-item-list>", () => {
	test("renders both extension forms, the entry's highlights, and clips only a summary that overflows", async ({
		page,
	}) => {
		await openPage(page);
		await mountList(page);
		await expect(row(page, "long").locator(".pie-item-list__details")).toHaveText("long by Ada");
		await expect(row(page, "short").locator("row-actions")).toHaveText("Edit short");
		// Outside the clip, so the collapsed row still shows its match.
		const highlights = row(page, "long").getByRole("group", { name: "Search matches" });
		await expect(highlights).toBeVisible();
		await expect(highlights.locator("mark")).toHaveText("12");
		await expect(row(page, "short").locator(".pie-item-list__highlights")).toHaveCount(0);
		const longItem = row(page, "long").locator(".pie-item-list__item");
		await expect(longItem).toHaveAttribute("data-overflowing", "");
		expect(await height(longItem)).toBeLessThan(await longItem.evaluate((node) => node.scrollHeight));
		await expect(row(page, "short").locator(".pie-item-list__item")).not.toHaveAttribute(
			"data-overflowing",
			"",
		);
	});

	test("clips a collapsed passage to its first line and the item to `--pie-item-list-clip-height`", async ({
		page,
	}) => {
		await openPage(page);
		await mountList(page, { passage: true });
		await page.locator("pie-item-list").evaluate((list) => {
			list.style.setProperty("--pie-item-list-clip-height", "4em");
		});
		const passage = row(page, "long").locator(".pie-item-list__passage");
		const item = row(page, "long").locator(".pie-item-list__item");
		await expect(item.locator(".pie-item-summary__prompt")).toBeVisible();
		const fontSize = await item.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
		// One line of at most 1.5em, plus the passage's 0.75em padding and its border.
		expect(await height(passage)).toBeLessThanOrEqual(2.25 * fontSize + 2);
		expect(Math.round(await height(item))).toBe(Math.round(4 * fontSize));

		await row(page, "long").getByRole("button", { name: "Show the full item" }).click();
		await expect.poll(() => height(passage)).toBeGreaterThan(10 * fontSize);
	});

	test("expands a row into its player from its button, keeping focus on the button", async ({ page }) => {
		await openPage(page);
		await preloadStubElement(page);
		await mountList(page);
		const button = row(page, "short").getByRole("button", { name: "Show the full item" });
		await expect(button).toHaveAttribute("aria-expanded", "false");
		await expect(button).toHaveAccessibleDescription("short by Grace");
		await button.click();
		await expect(button).toHaveAttribute("aria-expanded", "true");
		await expect(row(page, "short").locator(STUB_TAG)).toHaveText("Rendered: <p>Pick one</p>");
		await expect(row(page, "short")).not.toHaveAttribute("aria-busy", "true");
		await expect(row(page, "long").locator("pie-item-player")).toHaveCount(0);
		await expect(button).toBeFocused();
		expect(await page.evaluate(() => (window as unknown as { listEvents: unknown[] }).listEvents)).toEqual([
			{ id: "short", expanded: true, expandedIds: ["short"] },
		]);

		await button.click();
		await expect(row(page, "short").locator("pie-item-player")).toHaveCount(0);
		await expect(row(page, "short").locator(".pie-item-summary__prompt")).toHaveText("Pick one");
	});

	test("keeps a tall expanded row's button in view, and scrolls back to it on collapse", async ({ page }) => {
		await openPage(page);
		await preloadStubElement(page);
		await page.addStyleTag({ content: `${STUB_TAG} { display: block; height: 2000px; }` });
		await mountList(page);
		await page.locator("pie-item-list").evaluate((list) => {
			list.style.setProperty("--pie-item-list-sticky-top", "40px");
		});
		const button = row(page, "long").getByRole("button", { name: "Show the full item" });
		await button.click();
		await expect(row(page, "long").locator(STUB_TAG)).toBeVisible();
		await page.evaluate(() => window.scrollTo(0, 1200));
		const fontSize = await button.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
		const top = await button.evaluate((node) => node.getBoundingClientRect().top);
		expect(Math.abs(top - (40 + 0.5 * fontSize))).toBeLessThan(2);

		await button.click();
		await expect(row(page, "long").locator(STUB_TAG)).toHaveCount(0);
		await expect(button).toBeInViewport();
	});
});
