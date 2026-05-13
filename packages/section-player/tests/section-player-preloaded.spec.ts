import { expect, test } from "@playwright/test";

const SPLITPANE_PRELOADED_PATH =
	"/tts-ssml?mode=candidate&layout=splitpane&player=preloaded";
const VERTICAL_PRELOADED_PATH =
	"/tts-ssml?mode=candidate&layout=vertical&player=preloaded";
const FIXED_PRELOADED_EXPECTED_TAGS = [
	"passage-element--version-5-3-3",
	"multiple-choice--version-11-4-3",
	"categorize-element--version-11-3-2",
];

test.describe("section player preloaded strategy", () => {
	test("splitpane renders item shells with preloaded strategy", async ({ page }) => {
		const bundleRequests: string[] = [];
		const esmRequests: string[] = [];
		page.on("request", (request) => {
			const url = request.url();
			if (url.includes("/bundles/")) bundleRequests.push(url);
			if (url.includes("esm.sh")) esmRequests.push(url);
		});

		await page.goto(SPLITPANE_PRELOADED_PATH, { waitUntil: "networkidle" });
		await expect(page.locator(".preload-status")).toHaveCount(0, { timeout: 30_000 });
		await expect(page.getByRole("main", { name: "Items" })).toBeVisible({
			timeout: 30_000,
		});
		await expect(
			page.locator('pie-item-shell[data-pie-shell-root="item"]'),
		).toHaveCount(3, { timeout: 30_000 });

		const playerAttrs = await page.locator("pie-item-player").evaluateAll((els) =>
			els.map((el) => ({
				strategy: el.getAttribute("strategy"),
			})),
		);
		expect(playerAttrs.length).toBeGreaterThan(0);
		for (const attrs of playerAttrs) {
			expect(attrs.strategy).toBe("preloaded");
		}

		expect(bundleRequests.length).toBeGreaterThan(0);
		expect(esmRequests.length).toBe(0);
	});

	test("vertical layout renders with preloaded strategy", async ({ page }) => {
		await page.goto(VERTICAL_PRELOADED_PATH, { waitUntil: "networkidle" });
		await expect(page.locator(".preload-status")).toHaveCount(0, { timeout: 30_000 });
		await expect(page.locator(".preload-status.error")).toHaveCount(0);
		await expect(
			page.locator('pie-item-shell[data-pie-shell-root="item"]'),
		).toHaveCount(3, { timeout: 30_000 });
	});

	test("fixed-version demo preloads pinned passage and item versions", async ({
		page,
	}) => {
		const bundleRequests: string[] = [];
		page.on("request", (request) => {
			const url = request.url();
			if (url.includes("/bundles/")) bundleRequests.push(url);
		});
		const fixedUrl = new URL("http://section-demos.local/preloaded-fixed-elements");
		fixedUrl.searchParams.set("mode", "candidate");
		fixedUrl.searchParams.set("layout", "splitpane");
		fixedUrl.searchParams.set(
			"pie-overrides[@pie-element/multiple-choice]",
			"latest",
		);
		fixedUrl.searchParams.set("pie-overrides[@pie-element/categorize]", "latest");
		fixedUrl.searchParams.set("pie-overrides[@pie-element/passage]", "latest");

		await page.goto(`${fixedUrl.pathname}${fixedUrl.search}`, {
			waitUntil: "networkidle",
		});
		await expect(page.locator(".preload-status")).toHaveCount(0, {
			timeout: 30_000,
		});
		await expect(page.getByRole("main", { name: "Items" })).toBeVisible({
			timeout: 30_000,
		});
		await expect(page.getByText("Player Error")).toHaveCount(0);
		await expect(
			page.getByText("Which field fixes the multiple-choice package version"),
		).toBeVisible();
		await expect(
			page.getByText("Sort each demo responsibility into the part of the preloaded flow"),
		).toBeVisible();

		const strategyValues = await page.locator("pie-item-player").evaluateAll((els) =>
			els.map((el) => el.getAttribute("strategy")),
		);
		expect(strategyValues.length).toBeGreaterThan(0);
		for (const strategy of strategyValues) {
			expect(strategy).toBe("preloaded");
		}

		const renderedTags = await page.evaluate(() => {
			const found = new Set<string>();
			const visit = (root: Document | ShadowRoot) => {
				root.querySelectorAll("*").forEach((element) => {
					found.add(element.localName);
					if (element.shadowRoot) visit(element.shadowRoot);
				});
			};
			visit(document);
			return [...found].sort();
		});
		for (const tag of FIXED_PRELOADED_EXPECTED_TAGS) {
			expect(renderedTags).toContain(tag);
		}

		expect(bundleRequests.length).toBe(1);
		const decodedBundleUrl = decodeURIComponent(bundleRequests[0] || "");
		expect(decodedBundleUrl).toContain("@pie-element/categorize@11.3.2");
		expect(decodedBundleUrl).toContain("@pie-element/multiple-choice@11.4.3");
		expect(decodedBundleUrl).toContain("@pie-element/passage@5.3.3");
	});

	test("forwards runtime.player.loaderConfig to embedded item players", async ({
		page,
	}) => {
		await page.goto("/tts-ssml?mode=candidate&layout=splitpane&player=iife", {
			waitUntil: "networkidle",
		});
		await expect(page.getByRole("main", { name: "Items" })).toBeVisible();
		await expect(page.locator("pie-item-player").first()).toBeVisible({
			timeout: 30_000,
		});

		await page.evaluate(() => {
			const sectionPlayer = document.querySelector(
				"pie-section-player-splitpane",
			) as HTMLElement & { runtime?: Record<string, unknown> };
			if (!sectionPlayer) {
				throw new Error("section player host not found");
			}
			sectionPlayer.runtime = {
				player: {
					loaderConfig: {
						trackPageActions: true,
						maxResourceRetries: 7,
						resourceRetryDelay: 321,
					},
				},
			};
		});

		await page.waitForFunction(() => {
			const players = Array.from(document.querySelectorAll("pie-item-player")) as Array<
				HTMLElement & { loaderConfig?: Record<string, unknown> }
			>;
			if (!players.length) return false;
			return players.every((player) => {
				const cfg = player.loaderConfig;
				return (
					cfg?.trackPageActions === true &&
					cfg?.maxResourceRetries === 7 &&
					cfg?.resourceRetryDelay === 321
				);
			});
		});
	});

	test("reconfigures runtime loaderConfig and updates embedded item players", async ({
		page,
	}) => {
		await page.goto("/tts-ssml?mode=candidate&layout=splitpane&player=iife", {
			waitUntil: "networkidle",
		});
		await expect(page.locator("pie-item-player").first()).toBeVisible({
			timeout: 30_000,
		});

		await page.evaluate(() => {
			const sectionPlayer = document.querySelector(
				"pie-section-player-splitpane",
			) as HTMLElement & { runtime?: Record<string, unknown> };
			if (!sectionPlayer) {
				throw new Error("section player host not found");
			}
			sectionPlayer.runtime = {
				player: {
					loaderConfig: {
						trackPageActions: true,
						maxResourceRetries: 1,
						resourceRetryDelay: 10,
					},
				},
			};
		});

		await page.waitForFunction(() => {
			const players = Array.from(document.querySelectorAll("pie-item-player")) as Array<
				HTMLElement & {
					loaderConfig?: {
						maxResourceRetries?: number;
						resourceRetryDelay?: number;
					};
				}
			>;
			if (players.length === 0) return false;
			return players.every(
				(player) =>
					player.loaderConfig?.maxResourceRetries === 1 &&
					player.loaderConfig?.resourceRetryDelay === 10,
			);
		});

		await page.evaluate(() => {
			const sectionPlayer = document.querySelector(
				"pie-section-player-splitpane",
			) as HTMLElement & { runtime?: Record<string, unknown> };
			if (!sectionPlayer) {
				throw new Error("section player host not found");
			}
			sectionPlayer.runtime = {
				player: {
					loaderConfig: {
						trackPageActions: true,
						maxResourceRetries: 2,
						resourceRetryDelay: 25,
					},
				},
			};
		});

		await page.waitForFunction(() => {
			const players = Array.from(document.querySelectorAll("pie-item-player")) as Array<
				HTMLElement & {
					loaderConfig?: {
						maxResourceRetries?: number;
						resourceRetryDelay?: number;
					};
				}
			>;
			if (players.length === 0) return false;
			return players.every(
				(player) =>
					player.loaderConfig?.maxResourceRetries === 2 &&
					player.loaderConfig?.resourceRetryDelay === 25,
			);
		});
	});

	test("iife section strategy propagates verbatim to embedded item-players", async ({
		page,
	}) => {
		// The section-player no longer substitutes `iife` → `preloaded` on
		// embedded item-players. That substitution was the parent-to-child
		// state coupling behind the "missing tags: pie-passage--version-3-2-4"
		// section-swap race: the section-player pre-registered aggregate
		// elements once then rewrote the embedded strategy to `preloaded`,
		// so any later section-swap that added new tags produced items
		// asserting pre-registration the host had not done.
		//
		// Under the new architecture, section and items share the deep
		// `ElementLoader` primitive. The primitive deduplicates concurrent
		// identical load requests, so letting each item-player inherit
		// `iife` verbatim does not cost extra fetches — the aggregate pre-warm
		// satisfies every per-item call synchronously-ish.
		await page.goto("/tts-ssml?mode=candidate&layout=splitpane&player=iife", {
			waitUntil: "networkidle",
		});
		await expect(page.getByRole("main", { name: "Items" })).toBeVisible();
		await expect(page.locator("pie-item-player").first()).toBeVisible({
			timeout: 30_000,
		});
		const strategyValues = await page.locator("pie-item-player").evaluateAll((els) =>
			els.map((el) => el.getAttribute("strategy")),
		);
		expect(strategyValues.length).toBeGreaterThan(0);
		for (const strategy of strategyValues) {
			expect(strategy).toBe("iife");
		}
	});
});
