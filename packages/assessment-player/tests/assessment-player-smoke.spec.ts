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
});
