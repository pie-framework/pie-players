import { expect, test } from "@playwright/test";

const DEMO_PATH = "/three-section-assessment";

test.describe("assessment player smoke", () => {
	test("renders default layout and supports back/next section navigation", async ({
		page,
	}) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const host = page.locator("pie-assessment-player-default");
		await expect(host).toBeVisible();

		const position = host.locator(".pie-assessment-player-current-position");
		await expect(position).toHaveText("Section 1 of 3");

		const backButton = host.getByRole("button", { name: "Back" });
		const nextButton = host.getByRole("button", { name: "Next" });
		await expect(backButton).toBeDisabled();
		await expect(nextButton).toBeEnabled();

		await nextButton.click();

		await expect(position).toHaveText("Section 2 of 3");
		await expect(backButton).toBeEnabled();
		await expect(nextButton).toBeEnabled();
	});

	test("persists section route on refresh for same attempt", async ({ page }) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const host = page.locator("pie-assessment-player-default");
		const position = host.locator(".pie-assessment-player-current-position");
		const nextButton = host.getByRole("button", { name: "Next" });

		await expect(nextButton).toBeEnabled();
		await nextButton.click();
		await expect(position).toHaveText("Section 2 of 3");

		await page.reload({ waitUntil: "networkidle" });
		await expect(position).toHaveText("Section 2 of 3");
	});

	test("forwards sectionPlayerRuntime loaderConfig to nested item players", async ({
		page,
	}) => {
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });

		const host = page.locator("pie-assessment-player-default");
		await expect(host).toBeVisible();
		await expect(host.locator(".pie-assessment-player-current-position")).toHaveText(
			"Section 1 of 3",
		);
		await expect(page.locator("pie-item-player").first()).toBeVisible({
			timeout: 30_000,
		});

		await page.evaluate(() => {
			const assessmentHost = document.querySelector(
				"pie-assessment-player-default",
			) as HTMLElement & { sectionPlayerRuntime?: Record<string, unknown> };
			if (!assessmentHost) {
				throw new Error("assessment player host not found");
			}
			assessmentHost.sectionPlayerRuntime = {
				player: {
					loaderConfig: {
						trackPageActions: true,
						maxResourceRetries: 9,
						resourceRetryDelay: 654,
					},
				},
			};
		});

		await host.getByRole("button", { name: "Next" }).click();
		await expect(host.locator(".pie-assessment-player-current-position")).toHaveText(
			"Section 2 of 3",
		);

		await page.waitForFunction(() => {
			const players = Array.from(document.querySelectorAll("pie-item-player")) as Array<
				HTMLElement & { loaderConfig?: Record<string, unknown> }
			>;
			if (!players.length) return false;
			return players.every((player) => {
				const cfg = player.loaderConfig;
				return (
					cfg?.trackPageActions === true &&
					cfg?.maxResourceRetries === 9 &&
					cfg?.resourceRetryDelay === 654
				);
			});
		});
	});
});
