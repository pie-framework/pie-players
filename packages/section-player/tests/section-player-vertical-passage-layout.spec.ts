import { expect, test } from "@playwright/test";

const VERTICAL_DEMO_PATH = "/demo/three-questions?mode=candidate&layout=vertical";

test.describe("section player vertical passage layout", () => {
	test("renders full passage content without clipping", async ({ page }) => {
		await page.goto(VERTICAL_DEMO_PATH, { waitUntil: "networkidle" });

		const verticalHost = page.locator("pie-section-player-vertical");
		await expect(verticalHost).toBeVisible();

		const passageHeading = page.getByRole("heading", {
			name: "Photosynthesis: The Foundation of Life on Earth",
		});
		await expect(passageHeading).toBeVisible();

		const passageContent = page
			.locator("pie-section-player-passage-card .pie-section-player__passage-content")
			.first();
		await expect(passageContent).toBeVisible();

		const metrics = await passageContent.evaluate((node) => ({
			clientHeight: node.clientHeight,
			scrollHeight: node.scrollHeight,
		}));

		// Full passage should render at natural height; no internal clipping container.
		expect(metrics.clientHeight).toBeGreaterThan(300);
		expect(metrics.scrollHeight - metrics.clientHeight).toBeLessThanOrEqual(2);

		await expect(
			page.getByText(
				"maintaining the delicate balance that makes Earth habitable for all organisms",
			),
		).toBeVisible();
	});
});
