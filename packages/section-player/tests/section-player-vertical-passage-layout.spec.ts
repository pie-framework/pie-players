import { expect, test } from "@playwright/test";

const VERTICAL_DEMO_PATH = "/three-questions?mode=candidate&layout=vertical";

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

	test("keeps vertical container scrollbar styling available when content overflows", async ({
		page,
	}) => {
		await page.goto(VERTICAL_DEMO_PATH, { waitUntil: "networkidle" });

		const verticalContainer = page.locator(".pie-section-player-vertical-content");
		await expect(verticalContainer).toBeVisible();

		const metrics = await page.evaluate(() => {
			const pane = document.querySelector(
				".pie-section-player-vertical-content",
			) as HTMLElement | null;
			if (!pane) {
				return { found: false, canScroll: false, scrollbarWidth: "", overflowY: "" };
			}

			if (pane.scrollHeight <= pane.clientHeight + 1) {
				const filler = document.createElement("div");
				filler.setAttribute("data-pie-scroll-test-filler", "true");
				filler.setAttribute("aria-hidden", "true");
				filler.style.height = "900px";
				filler.style.pointerEvents = "none";
				pane.appendChild(filler);
			}

			return {
				found: true,
				canScroll: pane.scrollHeight > pane.clientHeight,
				scrollbarWidth: getComputedStyle(pane, "::-webkit-scrollbar").width,
				overflowY: getComputedStyle(pane).overflowY,
			};
		});

		expect(metrics.found).toBe(true);
		expect(metrics.canScroll).toBe(true);
		expect(metrics.overflowY).toBe("auto");
		expect(metrics.scrollbarWidth).toBe("12px");
	});
});
