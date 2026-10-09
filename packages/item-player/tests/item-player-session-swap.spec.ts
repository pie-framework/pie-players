/**
 * A host that keeps the player mounted and hands it the next item's config and
 * session together, as a card keyed across sections does. A response still
 * pending in the outgoing element belongs to the outgoing session: it is
 * committed with that session and never written into the incoming one.
 */

import { expect, test, type Page } from "@playwright/test";
import { openDemoMenuIfCollapsed } from "../../../test-support/demo-menu";

const DELIVERY_PATH =
	"/demo/multiple-choice-radio-simple/delivery?mode=gather&role=student";
const DELIVERY_PROMPT = "Which is the largest planet";

type Committed = { sessionId: unknown; reason: unknown; payload: string };

declare global {
	interface Window {
		__pieSwapEvents?: Committed[];
		__pieNextSession?: { id: string; data: unknown[] };
	}
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
}

/** Write a response the way an element does - session first, dispatch deferred. */
async function stagePendingResponse(page: Page, value: string) {
	const staged = await page.evaluate((choice) => {
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

test("a pending response stays with the outgoing session when the host swaps item and session", async ({
	page,
}) => {
	await gotoDelivery(page);
	await page.evaluate(() => {
		const player = document.querySelector("pie-item-player") as unknown as {
			session: unknown;
		};
		player.session = { id: "attempt-1", data: [] };
	});
	await page.locator("pie-item-player").getByText("Mercury").first().click();
	await page.waitForTimeout(500);
	await stagePendingResponse(page, "jupiter");

	await page.evaluate(() => {
		window.__pieSwapEvents = [];
		document.addEventListener("session-changed", (event) => {
			const detail = ((event as CustomEvent).detail ?? {}) as Record<
				string,
				unknown
			>;
			const session = detail.session as { id?: unknown } | null | undefined;
			window.__pieSwapEvents?.push({
				sessionId: session?.id ?? null,
				reason: detail.sessionCommitReason ?? null,
				payload: JSON.stringify(session ?? null),
			});
		});
		const player = document.querySelector("pie-item-player") as unknown as {
			config: { id?: string };
			session: unknown;
		};
		const nextConfig = JSON.parse(JSON.stringify(player.config)) as {
			id?: string;
		};
		nextConfig.id = `${nextConfig.id ?? "item"}-next`;
		const next = { id: "attempt-2", data: [] as unknown[] };
		window.__pieNextSession = next;
		player.config = nextConfig;
		player.session = next;
	});
	await page.waitForTimeout(1_000);

	const events = await page.evaluate(() => window.__pieSwapEvents ?? []);
	const nextSession = await page.evaluate(() => window.__pieNextSession);
	expect(
		JSON.stringify(nextSession),
		"the outgoing response was written into the incoming session",
	).not.toContain("jupiter");
	const carried = events.filter((event) => event.payload.includes("jupiter"));
	expect(
		carried.length,
		`no event committed the pending response: ${JSON.stringify(events)}`,
	).toBeGreaterThan(0);
	for (const event of carried) {
		expect(event.sessionId, JSON.stringify(event)).toBe("attempt-1");
	}
});
