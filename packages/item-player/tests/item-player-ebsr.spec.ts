import { expect, test, type Page } from "@playwright/test";
import { openDemoMenuIfCollapsed } from "../../../test-support/demo-menu";

// Pinned: the bundle service caches `@latest` per encoding, so unpinned runs
// mix releases whose load-time session events differ.
const EBSR_DELIVERY_PATH =
	"/demo/ebsr-default/delivery?player=iife&pie-overrides%5Bpie-element%2Febsr%5D=15.0.3";
const EBSR_SESSION_STORAGE_KEY = "item-demos:session:ebsr-default";

async function gotoEbsrDelivery(page: Page) {
	await page.goto(EBSR_DELIVERY_PATH, { waitUntil: "domcontentloaded" });
	await expect(
		page.getByRole("navigation", { name: "Demo controls" }),
	).toBeVisible();
	await openDemoMenuIfCollapsed(page);
	await expect(page.getByRole("link", { name: "Delivery" })).toBeVisible();
}

async function hasShuffledEbsrSession(page: Page) {
	return await page.evaluate(() => {
		const player = document.querySelector("pie-item-player") as
			| HTMLElement
			| null;
		const session = (player as any)?.session;
		const entry = session?.data?.find?.(
			(item: { id?: string }) => item.id === "1",
		);
		return Boolean(
			entry?.shuffledValues?.partA?.length &&
				entry?.shuffledValues?.partB?.length,
		);
	});
}

test.describe("item-player demo EBSR", () => {
	test("delivery persists shuffled choice order without a controller loop", async ({
		page,
	}) => {
		await page.addInitScript(() => {
			(window as any).__ebsrSessionEvents = [];
			document.addEventListener(
				"session-changed",
				(event) => {
					const detail = (event as CustomEvent).detail;
					if (detail?.session) {
						(window as any).__ebsrSessionEvents.push(
							JSON.stringify(detail.session),
						);
					}
				},
				true,
			);
		});

		await gotoEbsrDelivery(page);

		await expect
			.poll(
				async () => await hasShuffledEbsrSession(page),
				{ timeout: 10_000 },
			)
			.toBe(true);

		const settledState = await page.evaluate(() => {
			const player = document.querySelector("pie-item-player") as
				| HTMLElement
				| null;
			return {
				session: JSON.stringify((player as any)?.session),
				eventCount: (window as any).__ebsrSessionEvents.length,
			};
		});
		await page.waitForTimeout(2_000);

		const laterState = await page.evaluate(() => {
			const player = document.querySelector("pie-item-player") as
				| HTMLElement
				| null;
			return {
				session: JSON.stringify((player as any)?.session),
				eventCount: (window as any).__ebsrSessionEvents.length,
			};
		});
		expect(laterState).toEqual(settledState);
	});

	test("repairs stale partial shuffledValues from persisted demo session", async ({
		page,
	}) => {
		await page.addInitScript(
			({ key }) => {
				sessionStorage.setItem(
					key,
					JSON.stringify({
						id: "ebsr-default-session",
						data: [
							{
								id: "1",
								shuffledValues: {
									partA: ["blue", "yellow", "green"],
								},
							},
						],
					}),
				);
			},
			{ key: EBSR_SESSION_STORAGE_KEY },
		);

		await gotoEbsrDelivery(page);

		await expect(page.getByText("Part A")).toBeVisible();
		await expect(page.getByText("Part B")).toBeVisible();
		await expect(page.locator('label[for^="choice-"]')).toHaveCount(7);
		await expect
			.poll(async () => await hasShuffledEbsrSession(page), {
				timeout: 10_000,
			})
			.toBe(true);
	});
});
