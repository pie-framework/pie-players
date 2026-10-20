/**
 * `<pie-item-player>` answers `interfaceLocaleContext` for the elements it
 * renders, from its `locale`, and republishes once a lazily loaded catalog is
 * resident.
 *
 * The request is dispatched from inside the rendered element, as an element's own
 * bundled copy of `@pie-players/pie-context` would, so this holds whether or not
 * the published element reads the context yet.
 */

import { expect, test } from "@playwright/test";

const DELIVERY_PATH =
	"/demo/extended-text-entry-default/delivery?mode=gather&role=student";

test("the player answers interfaceLocaleContext from its locale", async ({
	page,
}) => {
	await page.goto(DELIVERY_PATH, { waitUntil: "domcontentloaded" });
	const editable = page
		.locator('pie-item-player [contenteditable="true"]')
		.first();
	await expect(editable).toBeVisible({ timeout: 30_000 });

	const seen = await editable.evaluate(async (node) => {
		const values: unknown[] = [];
		const request = Object.assign(
			new Event("context-request", { bubbles: true, composed: true }),
			{
				context: Symbol.for("pie.interfaceLocale"),
				contextTarget: node,
				subscribe: true,
				callback: (value: unknown) => values.push(value),
			},
		);
		node.dispatchEvent(request);

		// The Dutch catalog is a lazy chunk, so the republish lands when it does.
		const untilCount = async (count: number) => {
			const deadline = Date.now() + 10_000;
			while (values.length < count && Date.now() < deadline) {
				await new Promise((resolve) => setTimeout(resolve, 25));
			}
		};
		const player = document.querySelector("pie-item-player") as {
			locale?: string;
		};
		player.locale = "nl-NL";
		await untilCount(2);
		player.locale = "";
		await untilCount(3);
		return values;
	});

	expect(seen).toEqual([
		{ locale: "en-US", direction: "ltr" },
		{ locale: "nl-NL", direction: "ltr" },
		{ locale: "en-US", direction: "ltr" },
	]);
});
