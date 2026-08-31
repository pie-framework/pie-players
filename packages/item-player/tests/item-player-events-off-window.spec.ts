/**
 * `<pie-item-player>`'s events reach the element, and nothing reaches `window`.
 *
 * The shared renderer's `dispatch()` helper used to fire a DOM event alongside
 * each callback, and the call was a bare `dispatchEvent(event)` with no local
 * binding — which resolves to `window.dispatchEvent`. So every public event the
 * player emitted also fired on `window`: `load-complete`, `player-error`,
 * `model-updated`, `model-loaded`, and `session-changed`, whose detail carries
 * the learner's responses. Any script sharing the host page — an analytics tag,
 * an extension content script — could read every item's responses off `window`
 * with no way to attribute them to a player instance, and no host opt-in.
 *
 * The custom element already owned DOM emission for all five through
 * `handlePlayerEvent`, which dispatches from the host element, so the window
 * dispatch was duplicate reach rather than the only route. It is gone; the
 * callbacks are the whole path.
 *
 * Listeners go on in `addInitScript` so they are installed before the player
 * mounts and cannot miss `load-complete`. The host-route listener sits on
 * `document` rather than the element: the demo route wraps the player in a keyed
 * block, so a reference taken at init time is replaced on remount.
 *
 * Verifying a change here means rebuilding the *item player*, not just
 * `players-shared`: the shared renderer is bundled into
 * `packages/item-player/dist/pie-item-player.js`, which is what the demo app
 * loads. `bun run build:e2e:item-player` covers both.
 */

import { expect, test, type Page } from "@playwright/test";
import { openDemoMenuIfCollapsed } from "../../../test-support/demo-menu";

const DEMO_ID = "multiple-choice-radio-simple";
const DELIVERY_PATH = `/demo/${DEMO_ID}/delivery?mode=gather&role=student`;
const DELIVERY_PROMPT = "Which is the largest planet in our solar system?";

const PLAYER_EVENTS = [
	"load-complete",
	"player-error",
	"session-changed",
	"model-updated",
	"model-loaded",
] as const;

type Counts = Record<string, number>;

declare global {
	interface Window {
		__pieWindowEvents?: Counts;
		__pieElementEvents?: Counts;
		__pieWindowSessionDetails?: string[];
	}
}

async function installListeners(page: Page) {
	await page.addInitScript((names: readonly string[]) => {
		window.__pieWindowEvents = {};
		window.__pieElementEvents = {};
		window.__pieWindowSessionDetails = [];
		for (const name of names) {
			window.__pieWindowEvents[name] = 0;
			window.__pieElementEvents[name] = 0;
			// Capture phase on window catches anything dispatched at or below it,
			// including an event that bubbles up from the element.
			window.addEventListener(
				name,
				(event) => {
					const target = event.target as Node | null;
					// An event dispatched on the element legitimately bubbles to
					// window. Only count the ones whose target IS window, which is
					// what the bare `dispatchEvent` produced.
					if (target === (window as unknown as Node)) {
						(window.__pieWindowEvents as Counts)[name] += 1;
						if (name === "session-changed") {
							window.__pieWindowSessionDetails?.push(
								JSON.stringify((event as CustomEvent).detail ?? null),
							);
						}
					}
				},
				true,
			);
			// A `document`-level listener rather than one on the element: the demo
			// route wraps the player in a keyed block, so an element reference taken
			// at init time is replaced on remount and its listeners go with it.
			// Hosts listen at `document` for the same reason.
			document.addEventListener(name, (event) => {
				const node = event.target as Element | null;
				if (node?.closest?.("pie-item-player")) {
					(window.__pieElementEvents as Counts)[name] += 1;
				}
			});
		}
	}, PLAYER_EVENTS);
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

test.describe("item-player events stay off window", () => {
	test("the element receives events and window receives none", async ({
		page,
	}) => {
		await installListeners(page);
		await gotoDelivery(page);

		// An interaction, so `session-changed` — the event whose detail carries
		// the learner's responses — is actually exercised rather than assumed.
		await page
			.locator('label[for^="choice-"]')
			.filter({ hasText: "Jupiter" })
			.first()
			.click();

		await expect
			.poll(
				() =>
					page.evaluate(
						() => window.__pieElementEvents?.["session-changed"] ?? 0,
					),
				{ timeout: 20_000 },
			)
			.toBeGreaterThan(0);

		const elementCounts = await page.evaluate(
			() => window.__pieElementEvents ?? {},
		);
		const windowCounts = await page.evaluate(
			() => window.__pieWindowEvents ?? {},
		);
		const windowSessionDetails = await page.evaluate(
			() => window.__pieWindowSessionDetails ?? [],
		);

		// The host-facing route still works.
		expect(elementCounts["load-complete"]).toBeGreaterThan(0);
		expect(elementCounts["session-changed"]).toBeGreaterThan(0);

		// Nothing is dispatched at window itself.
		for (const name of PLAYER_EVENTS) {
			expect(
				windowCounts[name],
				`${name} should not be dispatched on window`,
			).toBe(0);
		}
		// Stated separately: the response payload is the reason this matters.
		expect(windowSessionDetails).toEqual([]);
	});
});
