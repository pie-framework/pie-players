import { expect, test } from "@playwright/test";

const SPLITPANE_PRELOADED_PATH =
	"/demo/tts-ssml?mode=candidate&layout=splitpane&player=preloaded";
const VERTICAL_PRELOADED_PATH =
	"/demo/tts-ssml?mode=candidate&layout=vertical&player=preloaded";

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
		await expect(page.getByRole("main", { name: "Items" })).toBeVisible();
		await expect(page.locator('pie-item-shell[data-pie-shell-root="item"]')).toHaveCount(
			3,
		);

		const playerAttrs = await page.locator("pie-item-player").evaluateAll((els) =>
			els.map((el) => ({
				strategy: el.getAttribute("strategy"),
				skipElementLoading:
					el.hasAttribute("skip-element-loading") ||
					el.getAttribute("skip-element-loading"),
			})),
		);
		expect(playerAttrs.length).toBeGreaterThan(0);
		for (const attrs of playerAttrs) {
			expect(attrs.strategy).toBe("preloaded");
			expect(Boolean(attrs.skipElementLoading)).toBe(false);
		}

		expect(bundleRequests.length).toBeGreaterThan(0);
		expect(esmRequests.length).toBe(0);
	});

	test("vertical layout renders with preloaded strategy", async ({ page }) => {
		await page.goto(VERTICAL_PRELOADED_PATH, { waitUntil: "networkidle" });
		await expect(page.locator(".preload-status.error")).toHaveCount(0);
		await expect(
			page.locator('pie-item-shell[data-pie-shell-root="item"]'),
		).toHaveCount(3, { timeout: 30_000 });
	});
});
