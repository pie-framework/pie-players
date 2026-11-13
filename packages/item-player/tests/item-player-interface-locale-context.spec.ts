/**
 * `<pie-item-player>` answers `interfaceLocaleContext` for the elements it
 * renders only once a host chose a locale, with the host's requested tag from
 * the moment `locale` is set. Unanswered, an element labels its chrome in the
 * language its item declares; a default `en-US` answer would override that
 * declaration, which is why the player stays silent until then.
 *
 * The request is dispatched from inside the rendered element, as an element's own
 * bundled copy of `@pie-players/pie-context` would, so this holds whether or not
 * the published element reads the context yet.
 */

import { expect, test } from "@playwright/test";

const DELIVERY_PATH =
	"/demo/extended-text-entry-default/delivery?mode=gather&role=student";

test("the player answers interfaceLocaleContext only once a host sets a locale, with the tag it set", async ({
	page,
}) => {
	await page.goto(DELIVERY_PATH, { waitUntil: "domcontentloaded" });
	const editable = page
		.locator('pie-item-player [contenteditable="true"]')
		.first();
	await expect(editable).toBeVisible({ timeout: 30_000 });

	const seen = await editable.evaluate(async (node) => {
		const context = Symbol.for("pie.interfaceLocale");
		const request = (subscribe: boolean, values: unknown[]) => {
			const callback = (value: unknown) => values.push(value);
			node.dispatchEvent(
				Object.assign(
					new Event("context-request", { bubbles: true, composed: true }),
					{ context, contextTarget: node, subscribe, callback },
				),
			);
			return callback;
		};
		const waitFor = async (done: () => boolean) => {
			const deadline = Date.now() + 10_000;
			while (!done() && Date.now() < deadline) {
				await new Promise((resolve) => setTimeout(resolve, 25));
			}
		};
		const localeOf = (value: unknown) => (value as { locale?: string })?.locale;
		const pause = (ms: number) =>
			new Promise((resolve) => setTimeout(resolve, ms));

		// An element subscribed before any provider answers: its bundled
		// pie-context's document root replays the request when one announces
		// itself, which this listener stands in for. A root already on the page
		// may answer the same callback too, so the checks below read the
		// sequence of distinct answers.
		const early: unknown[] = [];
		const earlyCallback = request(true, early);
		document.addEventListener("context-provider", (event) => {
			if ((event as Event & { context?: unknown }).context !== context) return;
			node.dispatchEvent(
				Object.assign(
					new Event("context-request", { bubbles: true, composed: true }),
					{
						context,
						contextTarget: node,
						subscribe: true,
						callback: earlyCallback,
					},
				),
			);
		});

		const beforeLocale: unknown[] = [];
		request(false, beforeLocale);
		await pause(250);

		const player = document.querySelector("pie-item-player") as {
			locale?: string;
		};
		// `en-GB` ships with elements, not with the player, which serves its
		// own chrome in `en-US`; the answer is still the tag the host set.
		player.locale = "en-GB";
		await waitFor(() => early.length > 0);
		const britishAnswer: unknown[] = [];
		request(false, britishAnswer);

		// Whatever the player's own catalog load does, the answer names the
		// request at once and nothing re-fires it afterwards.
		player.locale = "nl-NL";
		await waitFor(() => localeOf(early.at(-1)) === "nl-NL");
		const answeredDutch = early.length;
		await pause(1_000);
		const refiredAfterDutch = early.length - answeredDutch;

		player.locale = "";
		await waitFor(() => localeOf(early.at(-1)) === "en-US");
		const distinct = early.filter(
			(value, index) =>
				index === 0 || localeOf(value) !== localeOf(early[index - 1]),
		);
		return { beforeLocale, britishAnswer, refiredAfterDutch, distinct };
	});

	expect(seen.beforeLocale).toEqual([]);
	expect(seen.britishAnswer).toEqual([{ locale: "en-GB", direction: "ltr" }]);
	expect(seen.refiredAfterDutch).toBe(0);
	expect(seen.distinct).toEqual([
		{ locale: "en-GB", direction: "ltr" },
		{ locale: "nl-NL", direction: "ltr" },
		{ locale: "en-US", direction: "ltr" },
	]);
});
