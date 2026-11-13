import { expect, type Page, test } from "@playwright/test";

/**
 * Load failures and config binding problems arise before the inner player
 * exists, so the item player reports them to the instrumentation provider
 * itself. A fake provider in `loaderConfig` records what reaches it.
 */
type TrackedError = { message: string; attributes: Record<string, unknown> };

const DEMO = "/demo/multiple-choice-radio-simple/delivery";

async function mountTrackedPlayer(page: Page, config: unknown) {
	await page.evaluate((nextConfig) => {
		const tracked: TrackedError[] = [];
		(window as any).__trackedErrors = tracked;
		const instrumentationProvider = {
			providerId: "test",
			providerName: "Test",
			initialize: async () => {},
			trackError: (error: Error, attributes: Record<string, unknown>) =>
				tracked.push({ message: error.message, attributes }),
			trackEvent: () => {},
			destroy: () => {},
			isReady: () => true,
		};
		const source = document.querySelector("pie-item-player");
		const player = document.createElement("pie-item-player") as HTMLElement & {
			config: unknown;
			loaderConfig: unknown;
		};
		for (const { name, value } of source?.attributes ?? []) {
			if (name !== "id" && name !== "config") player.setAttribute(name, value);
		}
		player.id = "tracked-player";
		player.loaderConfig = { instrumentationProvider };
		player.config = nextConfig;
		document.body.append(player);
	}, config);
}

const trackedErrors = (page: Page) =>
	page.evaluate(() => (window as any).__trackedErrors as TrackedError[]);

test.describe("item player error instrumentation", () => {
	test("reports a load failure to the instrumentation provider", async ({
		page,
	}) => {
		await page.goto(DEMO, { waitUntil: "domcontentloaded" });
		await mountTrackedPlayer(page, {});

		await expect(page.locator("#tracked-player .pie-player-error")).toBeVisible({
			timeout: 30_000,
		});
		const errors = await trackedErrors(page);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.attributes).toMatchObject({
			component: "pie-item-player",
			errorType: "ITEM_PLAYER_LOAD_ERROR",
			stage: "validate-config",
			recoverable: false,
		});
	});

	test("renders an item whose models share an id and reports the binding problem", async ({
		page,
	}) => {
		await page.goto(DEMO, { waitUntil: "domcontentloaded" });
		await page.waitForFunction(
			() => (document.querySelector("pie-item-player") as any)?.config,
		);
		const config = await page.evaluate(() => {
			const source = document.querySelector("pie-item-player") as
				| (HTMLElement & { config?: unknown })
				| null;
			const raw = source?.config;
			const parsed = typeof raw === "string" ? JSON.parse(raw) : structuredClone(raw);
			const item = parsed.item ?? parsed;
			item.models.push({ ...item.models[0] });
			return parsed;
		});

		const loaded = page.evaluate(
			() =>
				new Promise<boolean>((resolve) => {
					document.addEventListener(
						"load-complete",
						(event) => {
							if ((event.target as Element).closest("#tracked-player")) resolve(true);
						},
					);
					setTimeout(() => resolve(false), 30_000);
				}),
		);
		await mountTrackedPlayer(page, config);
		expect(await loaded).toBe(true);
		await expect(page.locator("#tracked-player .pie-player-error")).toHaveCount(0);

		const errors = await trackedErrors(page);
		expect(errors).toHaveLength(1);
		expect(errors[0]?.message).toContain("Duplicate model id");
		expect(errors[0]?.attributes).toMatchObject({
			component: "pie-item-player",
			errorType: "ITEM_PLAYER_CONFIG_BINDING",
			recoverable: true,
			configRole: "item",
		});
	});
});
