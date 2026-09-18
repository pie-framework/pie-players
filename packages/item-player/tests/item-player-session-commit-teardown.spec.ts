/**
 * What each commit seam delivers, in a real browser, against live PIE elements.
 *
 * The demo loads published elements, so this exercises the synthesized path -
 * the one that has to work without an element release. The pending state is
 * staged by writing the element's session in place and not dispatching, which
 * is exactly the window the element's own `debounce` leaves open and the only
 * way to hold that window open deterministically. The element half of the
 * contract is pinned in `pie-elements-ng`; what this spec owns is the player's
 * half: that the sweep finds the element, that the payload survives the
 * renderer's forwarding, and that each seam reaches what it claims to reach.
 */

import { expect, test, type Page } from "@playwright/test";
import { openDemoMenuIfCollapsed } from "../../../test-support/demo-menu";

const DELIVERY_PATH =
	"/demo/multiple-choice-radio-simple/delivery?mode=gather&role=student";
const DELIVERY_PROMPT = "Which is the largest planet";

type Observed = {
	hasSessionKey: boolean;
	sessionIsNull: boolean;
	intent: unknown;
	commitReason: unknown;
	payload: string;
};

declare global {
	interface Window {
		__pieCommitEvents?: Observed[];
		__pieElementEvents?: Observed[];
		__pieCommitErrors?: string[];
	}
}

function recordEvents() {
	const describe = (event: Event): Observed => {
		const detail = ((event as CustomEvent).detail ?? {}) as Record<
			string,
			unknown
		>;
		let payload = "";
		try {
			payload = JSON.stringify(detail.session ?? null);
		} catch {
			payload = "";
		}
		return {
			hasSessionKey: "session" in detail,
			sessionIsNull: detail.session === null,
			intent: detail.intent ?? null,
			commitReason: detail.sessionCommitReason ?? null,
			payload,
		};
	};
	window.__pieCommitEvents = [];
	window.__pieElementEvents = [];
	window.__pieCommitErrors = [];
	window.addEventListener("error", (event) => {
		window.__pieCommitErrors?.push(String(event.message));
	});
	document.addEventListener("session-changed", (event) => {
		window.__pieCommitEvents?.push(describe(event));
	});
	const player = document.querySelector("pie-item-player");
	player?.addEventListener("session-changed", (event) => {
		window.__pieElementEvents?.push(describe(event));
	});
}

async function gotoDelivery(page: Page) {
	await page.goto(DELIVERY_PATH, { waitUntil: "domcontentloaded" });
	await expect(
		page.getByRole("navigation", { name: "Demo controls" }),
	).toBeVisible({ timeout: 15_000 });
	await openDemoMenuIfCollapsed(page);
	await expect(page.getByText(DELIVERY_PROMPT).first()).toBeVisible({
		timeout: 30_000,
	});
	await page.evaluate(recordEvents);
}

/** Answer through the UI, so the element writes and announces it itself. */
async function answer(page: Page, label: string) {
	await page.locator("pie-item-player").getByText(label).first().click();
	await page.waitForTimeout(500);
}

/**
 * Write a second response the way an element does - session first, dispatch
 * deferred - and leave the dispatch pending.
 */
async function stagePendingResponse(page: Page, value: string) {
	const staged = await page.evaluate((choice) => {
		// The rendered tag is version-qualified, so the element is found the way
		// the sweep finds it: by the two halves of the element contract.
		const element = Array.from(
			document.querySelectorAll("pie-item-player *"),
		).find(
			(candidate) =>
				candidate.tagName.includes("-") &&
				"session" in candidate &&
				"model" in candidate,
		) as (Element & { session?: Record<string, unknown> }) | undefined;
		if (!element?.session) return null;
		element.session.value = [choice];
		return element.tagName.toLowerCase();
	}, value);
	expect(staged, "the demo element exposes no session to stage").not.toBeNull();
}

async function hidePage(page: Page) {
	await page.evaluate(() => {
		Object.defineProperty(document, "visibilityState", {
			value: "hidden",
			configurable: true,
		});
		document.dispatchEvent(new Event("visibilitychange"));
	});
	await page.waitForTimeout(500);
}

async function readEvents(page: Page) {
	return {
		atDocument: await page.evaluate(() => window.__pieCommitEvents ?? []),
		atPlayer: await page.evaluate(() => window.__pieElementEvents ?? []),
		errors: await page.evaluate(() => window.__pieCommitErrors ?? []),
	};
}

function assertContract(observed: Observed[]) {
	for (const event of observed) {
		expect(
			event.hasSessionKey,
			`an event reached a listener without a "session" key: ${JSON.stringify(event)}`,
		).toBe(true);
		if (event.sessionIsNull) {
			expect(
				event.intent,
				`a null session must declare intent: ${JSON.stringify(event)}`,
			).toBe("metadata-only");
		}
	}
}

test.describe("item-player session commit", () => {
	test("a hidden page delivers the pending response to a document listener", async ({
		page,
	}) => {
		await gotoDelivery(page);
		await answer(page, "Mercury");
		await stagePendingResponse(page, "jupiter");
		await hidePage(page);

		const { atDocument, errors } = await readEvents(page);

		expect(errors, `the commit raised page errors: ${errors.join(", ")}`).toEqual(
			[],
		);
		assertContract(atDocument);
		const committed = atDocument.filter(
			(event) => event.commitReason === "page-hidden",
		);
		expect(
			committed.length,
			"the page-hidden commit reached no document listener",
		).toBeGreaterThan(0);
		expect(
			committed.some((event) => event.payload.includes("jupiter")),
			`no committed event carried the staged response: ${JSON.stringify(committed)}`,
		).toBe(true);
	});

	test("an untouched item announces nothing when the page is hidden", async ({
		page,
	}) => {
		// The regression this guards: a synthesized event for an element the
		// learner never answered made the demo host re-push its own config, and
		// the item being loaded was discarded.
		await gotoDelivery(page);
		await hidePage(page);

		const { atDocument, errors } = await readEvents(page);

		expect(errors, `the commit raised page errors: ${errors.join(", ")}`).toEqual(
			[],
		);
		expect(
			atDocument.filter((event) => event.commitReason !== null),
			"an untouched item was announced",
		).toEqual([]);
	});

	test("the imperative commit reaches a document listener before the host unmounts", async ({
		page,
	}) => {
		// The path a host takes when it removes the player itself: called while
		// the player is still in the document, so the event still bubbles to
		// `document`.
		await gotoDelivery(page);
		await answer(page, "Mercury");
		await stagePendingResponse(page, "jupiter");

		await page.evaluate(() => {
			(
				document.querySelector("pie-item-player") as unknown as {
					commitPendingElementSessions?: () => void;
				}
			)?.commitPendingElementSessions?.();
		});
		await page.waitForTimeout(500);

		const { atDocument, errors } = await readEvents(page);

		expect(errors, `the commit raised page errors: ${errors.join(", ")}`).toEqual(
			[],
		);
		assertContract(atDocument);
		const committed = atDocument.filter(
			(event) => event.commitReason === "teardown",
		);
		expect(
			committed.some((event) => event.payload.includes("jupiter")),
			`the imperative commit carried no response: ${JSON.stringify(atDocument)}`,
		).toBe(true);
	});

	test("removing the player commits to a listener on the element", async ({
		page,
	}) => {
		// A custom element only learns it was removed once it is detached, so this
		// seam cannot reach `document`. It reaches the player's own backend save
		// and listeners bound to the element, which is what it claims.
		await gotoDelivery(page);
		await answer(page, "Mercury");
		await stagePendingResponse(page, "jupiter");

		await page.evaluate(() => {
			document.querySelector("pie-item-player")?.remove();
		});
		await page.waitForTimeout(1_000);

		const { atPlayer, errors } = await readEvents(page);

		expect(
			errors,
			`teardown raised page errors: ${errors.join(", ")}`,
		).toEqual([]);
		assertContract(atPlayer);
		expect(
			atPlayer.some((event) => event.payload.includes("jupiter")),
			`the teardown commit reached no listener on the player: ${JSON.stringify(atPlayer)}`,
		).toBe(true);
	});
});
