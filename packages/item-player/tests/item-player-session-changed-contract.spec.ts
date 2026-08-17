/**
 * `session-changed` on `<pie-item-player>` carries one contract, not two.
 *
 * A PIE element emits its own `session-changed` carrying the element contract's
 * metadata detail — `complete`, `component`, no `session`. It used to bubble past
 * the player, so a host listening on `<pie-item-player>` received two events per
 * change under one name: the player's canonical one with `detail.session`, then the
 * element's with `detail.session` undefined. A host taking the last value got
 * nothing, and section-player's `ItemShellElement` carries dedupe machinery to
 * absorb the extra.
 *
 * The player now stops the element's event at its own boundary. What escapes is
 * either a canonical event with a session, or the deliberate metadata-only signal
 * (`session: null` with `intent: "metadata-only"` — see
 * `packages/item-player/src/session-forwarding.ts`). Both are readable without
 * guessing; an event with neither `session` nor `intent` is the regression.
 */

import { expect, test, type Page } from "@playwright/test";
import { openDemoMenuIfCollapsed } from "../../../test-support/demo-menu";

const DELIVERY_PATH =
	"/demo/extended-text-entry-default/delivery?mode=gather&role=student";
const DELIVERY_PROMPT = "This is the question prompt";
const DICTATED = "Session contract probe sentence.";

type Observed = {
	hasSessionKey: boolean;
	sessionIsNull: boolean;
	intent: unknown;
	value: unknown;
};

declare global {
	interface Window {
		__pieSessionEvents?: Observed[];
	}
}

async function gotoDelivery(page: Page) {
	await page.goto(DELIVERY_PATH, { waitUntil: "domcontentloaded" });
	await expect(
		page.getByRole("navigation", { name: "Demo controls" }),
	).toBeVisible({ timeout: 15_000 });
	await openDemoMenuIfCollapsed(page);
	await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({
		timeout: 30_000,
	});
}

test.describe("item-player session-changed contract", () => {
	test("every session-changed reaching the host is readable", async ({
		page,
	}) => {
		await gotoDelivery(page);

		await page.evaluate(() => {
			window.__pieSessionEvents = [];
			const player = document.querySelector("pie-item-player");
			player?.addEventListener("session-changed", (event) => {
				const detail = (event as CustomEvent).detail ?? {};
				const session = detail.session;
				window.__pieSessionEvents?.push({
					hasSessionKey: "session" in detail,
					sessionIsNull: session === null,
					intent: detail.intent ?? null,
					value: session?.data?.find(
						(entry: { id?: string }) => entry?.id === "1",
					)?.value,
				});
			});
		});

		const editable = page
			.locator('pie-item-player [contenteditable="true"]')
			.first();
		await editable.click();
		await page.keyboard.insertText(DICTATED);
		// Blur is the commit boundary — see item-player-dictation.spec.ts.
		await page.getByText(DELIVERY_PROMPT).click();

		await expect
			.poll(
				async () =>
					await page.evaluate(() => window.__pieSessionEvents?.length ?? 0),
				{ timeout: 15_000 },
			)
			.toBeGreaterThan(0);
		// Settle, so a late-arriving event is caught by the assertions rather than
		// after them.
		await page.waitForTimeout(2_000);

		const observed = await page.evaluate(() => window.__pieSessionEvents ?? []);

		// Every event states its shape: a session, or an explicit metadata-only null.
		for (const event of observed) {
			expect(
				event.hasSessionKey,
				`session-changed reached the host without a "session" key: ${JSON.stringify(event)}`,
			).toBe(true);
			if (event.sessionIsNull) {
				expect(
					event.intent,
					`a null session must declare intent: ${JSON.stringify(event)}`,
				).toBe("metadata-only");
			}
		}

		// And the response actually arrived on one of them.
		expect(
			observed.some(
				(event) =>
					typeof event.value === "string" && event.value.includes(DICTATED),
			),
			`No session-changed carried the dictated response: ${JSON.stringify(observed)}`,
		).toBe(true);
	});
});
