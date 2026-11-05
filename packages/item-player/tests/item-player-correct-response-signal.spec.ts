/**
 * `correct-responses-populated` is the tamper signal for the answer key.
 *
 * `add-correct-response`, `env` and `mode` are public attributes on
 * `<pie-item-player>`, so any page script can set them, and
 * `populateCorrectResponses` escalates internally to `role: "instructor"` to
 * generate the answers. With the default `hosted={false}` the player loads a
 * `client-player.js` bundle, so the controllers and the answer key are already
 * in the browser — a learner can reveal correct answers from the console.
 *
 * No gate is available at this layer: a legitimate preview (`mode="view"`,
 * `role="student"`, controllers client-side — a shape real hosts ship) is
 * indistinguishable from a tampered delivery from inside the player. The
 * boundary is `hosted="true"` / `player.js`. What the player can do is report
 * the population so a host acts on it server-side.
 *
 * The setup below *is* the attack: set the attribute from the page, exactly as
 * a learner with devtools would. So this asserts both that detection fires and
 * that the payload carries no answers — it is forwarded to a host's telemetry
 * provider, and shipping the answer key there would be the same leak wearing a
 * different hat.
 *
 * Verifying a change to the emit means rebuilding the *item player*, not just
 * `players-shared`: the shared renderer is bundled into
 * `packages/item-player/dist/pie-item-player.js`, which is what the demo app
 * loads. `bun run build:e2e:item-player` covers both. A control run that skips
 * it passes against the previous bundle and proves nothing.
 */

import { expect, test, type Page } from "@playwright/test";
import { openDemoMenuIfCollapsed } from "../../../test-support/demo-menu";

const DEMO_ID = "multiple-choice-radio-simple";
const DELIVERY_PATH = `/demo/${DEMO_ID}/delivery?mode=gather&role=student`;
const DELIVERY_PROMPT = "Which is the largest planet in our solar system?";

type Observed = {
	itemId?: string;
	mode?: string;
	role?: string;
	bundleType?: string;
	populatedCount?: number;
	elements?: string[];
	detailKeys: string[];
	rawDetail: string;
};

declare global {
	interface Window {
		__pieCorrectResponseEvents?: Observed[];
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

async function listen(page: Page) {
	await page.evaluate(() => {
		window.__pieCorrectResponseEvents = [];
		const player = document.querySelector("pie-item-player");
		player?.addEventListener("correct-responses-populated", (event) => {
			const detail = ((event as CustomEvent).detail ?? {}) as Record<
				string,
				unknown
			>;
			window.__pieCorrectResponseEvents?.push({
				itemId: detail.itemId as string | undefined,
				mode: detail.mode as string | undefined,
				role: detail.role as string | undefined,
				bundleType: detail.bundleType as string | undefined,
				populatedCount: detail.populatedCount as number | undefined,
				elements: detail.elements as string[] | undefined,
				detailKeys: Object.keys(detail).sort(),
				rawDetail: JSON.stringify(detail),
			});
		});
	});
}

test.describe("item-player correct-response tamper signal", () => {
	test("setting add-correct-response from the page emits the signal", async ({
		page,
	}) => {
		await gotoDelivery(page);
		await listen(page);

		// The attack, verbatim: a learner flipping the attribute in devtools.
		await page.evaluate(() => {
			document
				.querySelector("pie-item-player")
				?.setAttribute("add-correct-response", "true");
		});

		await expect
			.poll(
				() =>
					page.evaluate(() => window.__pieCorrectResponseEvents?.length ?? 0),
				{ timeout: 20_000 },
			)
			.toBeGreaterThan(0);

		const observed = await page.evaluate(
			() => window.__pieCorrectResponseEvents ?? [],
		);
		const first = observed[0];

		// The env the player was handed, so a host can see the delivery context
		// it was tampered in rather than the escalated one used internally.
		expect(first.mode).toBe("gather");
		expect(first.role).toBe("student");
		// Population is only possible with controllers in the browser, which is
		// what `client-player.js` ships and `hosted="true"` avoids.
		expect(first.bundleType).toBe("client-player.js");
		expect(first.populatedCount).toBeGreaterThan(0);
		expect(first.elements?.length).toBeGreaterThan(0);
		for (const name of first.elements ?? []) {
			// `config.models[].element`, so the authored versioned element name
			// (`multiple-choice--version-latest`) rather than the rendered
			// `pie-`-prefixed tag that `makeUniqueTags` produces.
			expect(name).toBeTruthy();
			expect(typeof name).toBe("string");
		}
		expect(first.elements).toContain("multiple-choice--version-latest");
	});

	test("the payload carries no session data", async ({ page }) => {
		await gotoDelivery(page);
		await listen(page);

		await page.evaluate(() => {
			document
				.querySelector("pie-item-player")
				?.setAttribute("add-correct-response", "true");
		});

		await expect
			.poll(
				() =>
					page.evaluate(() => window.__pieCorrectResponseEvents?.length ?? 0),
				{ timeout: 20_000 },
			)
			.toBeGreaterThan(0);

		const observed = await page.evaluate(
			() => window.__pieCorrectResponseEvents ?? [],
		);

		for (const event of observed) {
			// An allow-list, so a field added later has to be considered here
			// rather than riding along into a host's telemetry.
			expect(event.detailKeys).toEqual([
				"bundleType",
				"elements",
				"itemId",
				"mode",
				"populatedCount",
				"role",
			]);
			expect(event.rawDetail).not.toContain("session");
			expect(event.rawDetail).not.toContain("value");
			expect(event.rawDetail).not.toContain("data");
		}
	});
});

declare global {
	interface Window {
		__pieBackendSaves?: string[];
		__pieCorrectResponseSessions?: string[];
	}
}

test.describe("item-player correct responses and the delivery backend", () => {
	test("a session filled with correct responses is never saved", async ({
		page,
	}) => {
		await gotoDelivery(page);
		await listen(page);

		// A custom delivery client that serves the item already on the page and
		// records every session the player writes. A delivery backend defaults the
		// player to `hosted`, whose bundle has no controllers to generate correct
		// responses with; a host that keeps controllers client-side opts out.
		await page.evaluate(() => {
			window.__pieBackendSaves = [];
			window.__pieCorrectResponseSessions = [];
			const player = document.querySelector("pie-item-player") as
				| (HTMLElement & {
						config?: unknown;
						backend?: unknown;
						hosted?: boolean;
					})
				| null;
			if (!player) throw new Error("no pie-item-player");
			const config = player.config;
			player.addEventListener("backend-load-complete", () => {
				player.dataset.backendLoaded = "true";
			});
			player.addEventListener("session-changed", (event) => {
				const detail = (event as CustomEvent).detail ?? {};
				if (detail.sessionSource === "correct-response") {
					window.__pieCorrectResponseSessions?.push(
						JSON.stringify(detail.session?.data ?? []),
					);
				}
			});
			player.hosted = false;
			player.backend = {
				delivery: {
					enabled: true,
					itemId: "correct-response-item",
					sessionId: "correct-response-session",
					autosave: { debounceMs: 0 },
					client: {
						async load() {
							return { config };
						},
						async saveSession(context: { session: { data: unknown[] } }) {
							window.__pieBackendSaves?.push(
								JSON.stringify(context.session.data),
							);
						},
					},
				},
			};
		});
		await expect(
			page.locator('pie-item-player[data-backend-loaded="true"]'),
		).toBeAttached({ timeout: 30_000 });
		await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible();

		// Control: a learner's response does reach the backend.
		await page
			.locator('label[for^="choice-"]')
			.filter({ hasText: "Mercury" })
			.click();
		await expect
			.poll(() => page.evaluate(() => window.__pieBackendSaves?.length ?? 0), {
				timeout: 10_000,
			})
			.toBeGreaterThan(0);
		const learnerSaves = await page.evaluate(
			() => window.__pieBackendSaves?.length ?? 0,
		);

		await page.evaluate(() => {
			document
				.querySelector("pie-item-player")
				?.setAttribute("add-correct-response", "true");
		});
		await expect
			.poll(
				() =>
					page.evaluate(
						() => window.__pieCorrectResponseSessions?.length ?? 0,
					),
				{ timeout: 20_000 },
			)
			.toBeGreaterThan(0);

		// The page going hidden flushes pending saves with keepalive.
		await page.evaluate(() => {
			Object.defineProperty(document, "visibilityState", {
				configurable: true,
				get: () => "hidden",
			});
			document.dispatchEvent(new Event("visibilitychange"));
			window.dispatchEvent(new Event("pagehide"));
		});
		await page.waitForTimeout(500);

		const { saves, answerKeys } = await page.evaluate(() => ({
			saves: window.__pieBackendSaves ?? [],
			answerKeys: window.__pieCorrectResponseSessions ?? [],
		}));
		expect(saves).toHaveLength(learnerSaves);
		for (const answerKey of answerKeys) expect(saves).not.toContain(answerKey);
	});
});
