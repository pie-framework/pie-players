import { expect, test } from "@playwright/test";

const REFLOW_ROUTES = [
	"/question-passage?mode=candidate&layout=splitpane",
	"/tts-ssml?mode=candidate&layout=splitpane",
];

test.describe("section player splitpane reflow", () => {
	for (const route of REFLOW_ROUTES) {
		test(`avoids horizontal overflow at 320px for ${route}`, async ({ page }) => {
			await page.setViewportSize({ width: 320, height: 900 });
			await page.goto(route, { waitUntil: "networkidle" });

			const host = page.locator("pie-section-player-splitpane").first();
			await expect(host).toBeVisible();

			const layoutContainer = page
				.locator(
					".pie-section-player-split-content, .pie-section-player-vertical-content, .pie-section-player-tabbed-frame, .pie-section-player-tabbed-content",
				)
				.first();
			await expect(layoutContainer).toBeVisible();

			await expect
				.poll(async () => {
					return await layoutContainer.evaluate((element) => {
						const el = element as HTMLElement;
						return el.scrollWidth <= el.clientWidth + 1;
					});
				})
				.toBe(true);

			const tabbedItemsLabel = page
				.locator('[data-pie-purpose="item-label"][role="tab"]')
				.first();
			if ((await tabbedItemsLabel.count()) > 0) {
				await tabbedItemsLabel.click();
				await expect(tabbedItemsLabel).toHaveAttribute("aria-selected", "true");
			}

			const itemPane = page
				.locator(
					'.pie-section-player-tab-panel[role="tabpanel"][id$="-panel-items"], .pie-section-player-tab-panel--items, .pie-section-player-items-pane, .pie-section-player-items-section',
				)
				.first();
			await expect(itemPane).toBeVisible();
			await expect
				.poll(async () => {
					return await itemPane.evaluate((element) => {
						const el = element as HTMLElement;
						return el.scrollWidth <= el.clientWidth + 1;
					});
				})
				.toBe(true);

			const tabbedPassageLabel = page
				.locator('[data-pie-purpose="passage-label"][role="tab"]')
				.first();
			if ((await tabbedPassageLabel.count()) > 0) {
				await tabbedPassageLabel.click();
				await expect(tabbedPassageLabel).toHaveAttribute("aria-selected", "true");
			}

			const passagePane = page
				.locator(
					'.pie-section-player-tab-panel[role="tabpanel"][id$="-panel-passage"], .pie-section-player-tab-panel--passages, .pie-section-player-passages-pane, .pie-section-player-passages-section',
				)
				.first();
			if ((await passagePane.count()) > 0) {
				await expect
					.poll(async () => {
						return await passagePane.evaluate((element) => {
							const el = element as HTMLElement;
							return el.scrollWidth <= el.clientWidth + 1;
						});
					})
					.toBe(true);
			}
		});
	}

	test("keeps wide default layout in splitpane", async ({ page }) => {
		await page.setViewportSize({ width: 1800, height: 900 });

		await page.goto("/question-passage?mode=candidate&layout=splitpane", {
			waitUntil: "networkidle",
		});
		const splitpaneHostWithPassage = page.locator("pie-section-player-splitpane").first();
		const splitWithPassage = splitpaneHostWithPassage
			.locator(".pie-section-player-split-frame")
			.first();
		await expect(splitWithPassage).toBeVisible();
		await expect
			.poll(async () =>
				await splitWithPassage.evaluate(
					(element) => (element as HTMLElement).getBoundingClientRect().width,
				),
			)
			.toBeGreaterThan(1150);
		const withPassageWidth = await splitWithPassage.evaluate(
			(element) => (element as HTMLElement).getBoundingClientRect().width,
		);
		expect(withPassageWidth).toBeGreaterThan(1400);

		await page.goto("/single-question?mode=candidate&layout=splitpane", {
			waitUntil: "networkidle",
		});
		const splitpaneHostNoPassage = page.locator("pie-section-player-splitpane").first();
		const splitNoPassage = splitpaneHostNoPassage
			.locator(".pie-section-player-split-frame")
			.first();
		await expect(splitNoPassage).toBeVisible();
		await expect
			.poll(async () =>
				await splitNoPassage.evaluate(
					(element) => (element as HTMLElement).getBoundingClientRect().width,
				),
			)
			.toBeGreaterThan(750);
		const noPassageWidth = await splitNoPassage.evaluate(
			(element) => (element as HTMLElement).getBoundingClientRect().width,
		);
		expect(noPassageWidth).toBeGreaterThan(1400);
	});

	test("keeps wide default layout in vertical", async ({ page }) => {
		await page.setViewportSize({ width: 1800, height: 900 });

		await page.goto("/question-passage?mode=candidate&layout=vertical", {
			waitUntil: "networkidle",
		});
		const verticalHostWithPassage = page.locator("pie-section-player-vertical").first();
		const verticalWithPassage = verticalHostWithPassage
			.locator(".pie-section-player-vertical-frame")
			.first();
		await expect(verticalWithPassage).toBeVisible();
		await expect
			.poll(async () =>
				await verticalWithPassage.evaluate(
					(element) => (element as HTMLElement).getBoundingClientRect().width,
				),
			)
			.toBeGreaterThan(1150);
		const withPassageWidth = await verticalWithPassage.evaluate(
			(element) => (element as HTMLElement).getBoundingClientRect().width,
		);
		expect(withPassageWidth).toBeGreaterThan(1400);

		await page.goto("/single-question?mode=candidate&layout=vertical", {
			waitUntil: "networkidle",
		});
		const verticalHostNoPassage = page.locator("pie-section-player-vertical").first();
		const verticalNoPassage = verticalHostNoPassage
			.locator(".pie-section-player-vertical-frame")
			.first();
		await expect(verticalNoPassage).toBeVisible();
		await expect
			.poll(async () =>
				await verticalNoPassage.evaluate(
					(element) => (element as HTMLElement).getBoundingClientRect().width,
				),
			)
			.toBeGreaterThan(750);
		const noPassageWidth = await verticalNoPassage.evaluate(
			(element) => (element as HTMLElement).getBoundingClientRect().width,
		);
		expect(noPassageWidth).toBeGreaterThan(1400);
	});

	test("applies PIE-117 width constraints when frame max-width is configured", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1800, height: 900 });

		await page.goto("/question-passage?mode=candidate&layout=splitpane", {
			waitUntil: "networkidle",
		});
		const splitpaneHostWithPassage = page.locator("pie-section-player-splitpane").first();
		const splitWithPassage = splitpaneHostWithPassage
			.locator(".pie-section-player-split-frame")
			.first();
		await splitWithPassage.evaluate((element) => {
			(element as HTMLElement).style.setProperty(
				"--pie-section-player-layout-max-width",
				"1200px",
			);
		});
		await expect
			.poll(async () =>
				await splitWithPassage.evaluate(
					(element) => (element as HTMLElement).getBoundingClientRect().width,
				),
			)
			.toBeLessThanOrEqual(1201);
		const splitWithPassageWidth = await splitWithPassage.evaluate(
			(element) => (element as HTMLElement).getBoundingClientRect().width,
		);
		expect(splitWithPassageWidth).toBeGreaterThan(1150);

		await page.goto("/single-question?mode=candidate&layout=splitpane", {
			waitUntil: "networkidle",
		});
		const splitpaneHostNoPassage = page.locator("pie-section-player-splitpane").first();
		const splitNoPassage = splitpaneHostNoPassage
			.locator(".pie-section-player-split-frame")
			.first();
		await splitNoPassage.evaluate((element) => {
			(element as HTMLElement).style.setProperty(
				"--pie-section-player-layout-max-width",
				"800px",
			);
		});
		await expect
			.poll(async () =>
				await splitNoPassage.evaluate(
					(element) => (element as HTMLElement).getBoundingClientRect().width,
				),
			)
			.toBeLessThanOrEqual(801);
		const splitNoPassageWidth = await splitNoPassage.evaluate(
			(element) => (element as HTMLElement).getBoundingClientRect().width,
		);
		expect(splitNoPassageWidth).toBeGreaterThan(750);

		await page.goto("/question-passage?mode=candidate&layout=vertical", {
			waitUntil: "networkidle",
		});
		const verticalHostWithPassage = page.locator("pie-section-player-vertical").first();
		const verticalWithPassage = verticalHostWithPassage
			.locator(".pie-section-player-vertical-frame")
			.first();
		await verticalWithPassage.evaluate((element) => {
			(element as HTMLElement).style.setProperty(
				"--pie-section-player-layout-max-width",
				"1200px",
			);
		});
		await expect
			.poll(async () =>
				await verticalWithPassage.evaluate(
					(element) => (element as HTMLElement).getBoundingClientRect().width,
				),
			)
			.toBeLessThanOrEqual(1201);
		const verticalWithPassageWidth = await verticalWithPassage.evaluate(
			(element) => (element as HTMLElement).getBoundingClientRect().width,
		);
		expect(verticalWithPassageWidth).toBeGreaterThan(1150);

		await page.goto("/single-question?mode=candidate&layout=vertical", {
			waitUntil: "networkidle",
		});
		const verticalHostNoPassage = page.locator("pie-section-player-vertical").first();
		const verticalNoPassage = verticalHostNoPassage
			.locator(".pie-section-player-vertical-frame")
			.first();
		await verticalNoPassage.evaluate((element) => {
			(element as HTMLElement).style.setProperty(
				"--pie-section-player-layout-max-width",
				"800px",
			);
		});
		await expect
			.poll(async () =>
				await verticalNoPassage.evaluate(
					(element) => (element as HTMLElement).getBoundingClientRect().width,
				),
			)
			.toBeLessThanOrEqual(801);
		const verticalNoPassageWidth = await verticalNoPassage.evaluate(
			(element) => (element as HTMLElement).getBoundingClientRect().width,
		);
		expect(verticalNoPassageWidth).toBeGreaterThan(750);
	});
});
