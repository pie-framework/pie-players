/**
 * `<pie-item-player>` answers `interfaceLocaleContext` for the elements it
 * renders only once a host chose a locale, from its `locale`, and republishes
 * once a lazily loaded catalog is resident. Unanswered, an element labels its
 * chrome in the language its item declares; a default `en-US` answer would
 * override that declaration, which is why the player stays silent until then.
 *
 * The request is dispatched from inside the rendered element, as an element's own
 * bundled copy of `@pie-players/pie-context` would, so this holds whether or not
 * the published element reads the context yet.
 */

import { expect, test } from "@playwright/test";

const DELIVERY_PATH =
	"/demo/extended-text-entry-default/delivery?mode=gather&role=student";

test("the player answers interfaceLocaleContext only once a host sets a locale", async ({
	page,
}) => {
	await page.goto(DELIVERY_PATH, { waitUntil: "domcontentloaded" });
	const editable = page
		.locator('pie-item-player [contenteditable="true"]')
		.first();
	await expect(editable).toBeVisible({ timeout: 30_000 });

	const seen = await editable.evaluate(async (node) => {
		const request = (subscribe: boolean, values: unknown[]) =>
			node.dispatchEvent(
				Object.assign(
					new Event("context-request", { bubbles: true, composed: true }),
					{
						context: Symbol.for("pie.interfaceLocale"),
						contextTarget: node,
						subscribe,
						callback: (value: unknown) => values.push(value),
					},
				),
			);
		const waitFor = async (done: () => boolean) => {
			const deadline = Date.now() + 10_000;
			while (!done() && Date.now() < deadline) {
				await new Promise((resolve) => setTimeout(resolve, 25));
			}
		};
		const localeOf = (value: unknown) => (value as { locale?: string })?.locale;

		const beforeLocale: unknown[] = [];
		request(false, beforeLocale);
		await new Promise((resolve) => setTimeout(resolve, 250));

		const player = document.querySelector("pie-item-player") as {
			locale?: string;
		};
		player.locale = "nl-NL";
		// The Dutch catalog is a lazy chunk, so the answer names it once it lands.
		await waitFor(() => {
			const probe: unknown[] = [];
			request(false, probe);
			return localeOf(probe[0]) === "nl-NL";
		});
		const afterLocale: unknown[] = [];
		request(true, afterLocale);
		player.locale = "";
		await waitFor(() => localeOf(afterLocale.at(-1)) === "en-US");
		return { beforeLocale, afterLocale };
	});

	expect(seen.beforeLocale).toEqual([]);
	expect(seen.afterLocale.at(0)).toEqual({ locale: "nl-NL", direction: "ltr" });
	expect(seen.afterLocale.at(-1)).toEqual({ locale: "en-US", direction: "ltr" });
});
