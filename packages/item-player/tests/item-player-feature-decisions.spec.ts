/**
 * `<pie-item-player>` applies the toolkit's `autoplayAudio` decision, which it
 * requests as `itemFeatureDecisionsContext`. A change of decision or attribute
 * after load commits the pending session, announces `feature-decision-applied`
 * and remounts the item, since elements read autoplay at mount.
 *
 * Authored `autoplay` attributes leave the item's markup in view mode, so the
 * model setting is the only start for its audio.
 *
 * The page answers the request itself, as `<pie-item-scope>` does, so this
 * covers the player without a toolkit.
 */

import { expect, test, type Page } from "@playwright/test";
import { openDemoMenuIfCollapsed } from "../../../test-support/demo-menu";

const DELIVERY_PATH =
	"/demo/multiple-choice-radio-simple/delivery?mode=gather&role=student";
const DELIVERY_PROMPT = "Which is the largest planet";

type Seen =
	| { kind: "applied"; detail: Record<string, unknown> }
	| { kind: "session"; reason: unknown; payload: string };

declare global {
	interface Window {
		__pieDecide?: (features: Record<string, unknown>) => void;
		__pieSeen?: Seen[];
	}
}

/** Answers the player's request before it mounts, and records what it reports. */
async function answerFeatureDecisions(page: Page) {
	await page.addInitScript(() => {
		const callbacks = new Set<(value: unknown) => void>();
		let current: unknown = { features: {} };
		window.__pieSeen = [];
		window.addEventListener(
			"context-request",
			(event) => {
				const request = event as Event & {
					context?: unknown;
					callback?: (value: unknown) => void;
				};
				if (request.context !== Symbol.for("pie.itemFeatureDecisions")) return;
				event.stopImmediatePropagation();
				if (!request.callback) return;
				callbacks.add(request.callback);
				request.callback(current);
			},
			true,
		);
		window.__pieDecide = (features) => {
			current = { features };
			for (const callback of callbacks) callback(current);
		};
		window.addEventListener(
			"feature-decision-applied",
			(event) => {
				window.__pieSeen?.push({
					kind: "applied",
					detail: (event as CustomEvent).detail,
				});
			},
			true,
		);
		window.addEventListener(
			"session-changed",
			(event) => {
				const detail = ((event as CustomEvent).detail ?? {}) as Record<
					string,
					unknown
				>;
				window.__pieSeen?.push({
					kind: "session",
					reason: detail.sessionCommitReason ?? null,
					payload: JSON.stringify(detail.session ?? null),
				});
			},
			true,
		);
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
}

/** Tags the rendered element, so a remount shows as an untagged one. */
async function tagElement(page: Page) {
	return page.evaluate(() => {
		const element = Array.from(
			document.querySelectorAll("pie-item-player *"),
		).find(
			(candidate) =>
				candidate.tagName.includes("-") &&
				"session" in candidate &&
				"model" in candidate,
		) as (Element & { __pieTag?: boolean }) | undefined;
		if (!element) return false;
		element.__pieTag = true;
		return true;
	});
}

const remounted = (page: Page) =>
	page.evaluate(() => {
		const element = Array.from(
			document.querySelectorAll("pie-item-player *"),
		).find(
			(candidate) =>
				candidate.tagName.includes("-") &&
				"session" in candidate &&
				"model" in candidate,
		) as (Element & { __pieTag?: boolean }) | undefined;
		return element ? element.__pieTag !== true : null;
	});

const seen = (page: Page) => page.evaluate(() => window.__pieSeen ?? []);
const applied = async (page: Page) =>
	(await seen(page))
		.filter((entry) => entry.kind === "applied")
		.map((entry) => (entry as { detail: unknown }).detail);

test("no decision announces nothing", async ({
	page,
}) => {
	await answerFeatureDecisions(page);
	await gotoDelivery(page);
	await page.waitForTimeout(500);
	expect(await applied(page)).toEqual([]);
});

test("a decision after load remounts the item and announces what it displaced", async ({
	page,
}) => {
	await answerFeatureDecisions(page);
	await gotoDelivery(page);
	expect(await tagElement(page)).toBe(true);

	await page.evaluate(() => {
		window.__pieDecide?.({
			autoplayAudio: { granted: false, rule: "support-conflict" },
		});
	});
	await expect.poll(() => applied(page)).toEqual([
		{ featureId: "autoplayAudio", granted: false, rule: "support-conflict" },
	]);
	await expect.poll(() => remounted(page)).toBe(true);

	// The attribute set on is what a hold displaces.
	expect(await tagElement(page)).toBe(true);
	await page.evaluate(() => {
		(
			document.querySelector("pie-item-player") as unknown as {
				autoplayAudioEnabled: boolean;
			}
		).autoplayAudioEnabled = true;
	});
	await expect.poll(async () => (await applied(page)).at(-1)).toEqual({
		featureId: "autoplayAudio",
		granted: false,
		rule: "support-conflict",
		overrode: "attribute",
	});
	await expect.poll(() => remounted(page)).toBe(true);

	// An unchanged decision re-enters nothing.
	const count = (await applied(page)).length;
	await page.evaluate(() => {
		window.__pieDecide?.({
			autoplayAudio: { granted: false, rule: "support-conflict" },
		});
	});
	await page.waitForTimeout(500);
	expect(await applied(page)).toHaveLength(count);
});

test("a pending response commits before the decision remounts the item", async ({
	page,
}) => {
	await answerFeatureDecisions(page);
	await gotoDelivery(page);
	await page.evaluate(() => {
		(
			document.querySelector("pie-item-player") as unknown as {
				session: unknown;
			}
		).session = { id: "attempt-1", data: [] };
	});
	await page.locator("pie-item-player").getByText("Mercury").first().click();
	await page.waitForTimeout(500);
	const staged = await page.evaluate(() => {
		const element = Array.from(
			document.querySelectorAll("pie-item-player *"),
		).find(
			(candidate) =>
				candidate.tagName.includes("-") &&
				"session" in candidate &&
				"model" in candidate,
		) as (Element & { session?: Record<string, unknown> }) | undefined;
		if (!element?.session) return false;
		// Session first, dispatch deferred, as an element writes a response.
		element.session.value = ["jupiter"];
		return true;
	});
	expect(staged, "the demo element exposes no session to stage").toBe(true);
	await page.evaluate(() => {
		if (window.__pieSeen) window.__pieSeen.length = 0;
		window.__pieDecide?.({
			autoplayAudio: { granted: true, rule: "item-requirement" },
		});
	});

	await expect.poll(() => applied(page)).toHaveLength(1);
	const order = await seen(page);
	const commit = order.findIndex(
		(entry) => entry.kind === "session" && entry.payload.includes("jupiter"),
	);
	const announce = order.findIndex((entry) => entry.kind === "applied");
	expect(commit, "the pending response was not committed").toBeGreaterThan(-1);
	expect(commit).toBeLessThan(announce);
});

test("authored autoplay leaves the markup, trusted markup included", async ({
	page,
}) => {
	await gotoDelivery(page);
	await page.evaluate(() => {
		const player = document.querySelector("pie-item-player") as unknown as {
			config: { markup: string } | string;
			trustMarkup: boolean;
		};
		const config =
			typeof player.config === "string" ? JSON.parse(player.config) : player.config;
		player.trustMarkup = true;
		player.config = {
			...config,
			markup: `${config.markup}<audio id="authored-audio" autoplay controls></audio>`,
		};
	});
	const audio = page.locator("pie-item-player #authored-audio");
	await expect(audio).toBeAttached({ timeout: 15_000 });
	expect(await audio.evaluate((element) => element.hasAttribute("autoplay"))).toBe(
		false,
	);
	expect(await audio.evaluate((element) => element.hasAttribute("controls"))).toBe(
		true,
	);
});
