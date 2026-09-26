import { expect, type Page, test } from "@playwright/test";

// The demo pages persist the section session on the section's canonical
// `session-changed`, so one answer is one write of the persisted snapshot.
const PERSISTENCE_KEY_PREFIX = "pie:section-controller:v1:";
const SNAPSHOT_ENDPOINT = "/api/session-demo/snapshot";
const DEMO_PAGES: ReadonlyArray<{ path: string; store: "local" | "db" }> = [
	// Rendered through `SectionDemoRuntimePage`.
	{ path: "/three-questions", store: "local" },
	{ path: "/heading-accessibility", store: "local" },
	{ path: "/preloaded-fixed-elements", store: "local" },
	{ path: "/question-passage", store: "local" },
	{ path: "/quiz-engine-nds-icon", store: "local" },
	{ path: "/resource-observability", store: "local" },
	// Persists to the demo's session database.
	{ path: "/session-hydrate-db", store: "db" },
	{ path: "/single-question", store: "local" },
	{ path: "/tts-ssml", store: "local" },
];

declare global {
	interface Window {
		__sectionPersistWrites?: number;
	}
}

test.describe("section demo session persistence", () => {
	for (const { path, store } of DEMO_PAGES) {
		test(`${path} persists once per answer`, async ({ page }) => {
			const writes = await countSnapshotWrites(page, store);
			await page.goto(`${path}?mode=candidate&layout=splitpane`, {
				waitUntil: "networkidle",
			});
			const choice = page
				.locator(
					'pie-section-player-splitpane pie-item-player :is(input[type="radio"], input[type="checkbox"])',
				)
				.first();
			await expect(choice).toBeVisible({ timeout: 30_000 });
			const before = await writes();

			await choice.click();
			await expect
				.poll(writes, { timeout: 10_000 })
				.toBeGreaterThan(before);
			// Room for a late duplicate to land.
			await page.waitForTimeout(1_000);

			expect((await writes()) - before).toBe(1);
		});
	}
});

async function countSnapshotWrites(
	page: Page,
	store: "local" | "db",
): Promise<() => Promise<number>> {
	if (store === "db") {
		let puts = 0;
		page.on("request", (request) => {
			if (
				request.method() === "PUT" &&
				new URL(request.url()).pathname === SNAPSHOT_ENDPOINT
			) {
				puts += 1;
			}
		});
		return async () => puts;
	}
	await page.addInitScript((prefix) => {
		window.__sectionPersistWrites = 0;
		const setItem = Storage.prototype.setItem;
		Storage.prototype.setItem = function countedSetItem(key, value) {
			if (this === window.localStorage && key.startsWith(prefix)) {
				window.__sectionPersistWrites = (window.__sectionPersistWrites ?? 0) + 1;
			}
			return setItem.call(this, key, value);
		};
	}, PERSISTENCE_KEY_PREFIX);
	return () => page.evaluate(() => window.__sectionPersistWrites ?? 0);
}
