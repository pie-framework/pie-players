import { expect, type Page, test } from "@playwright/test";

// `/custom-layout` builds its layout from `<pie-section-player-kernel-host>`
// and the two panes alone: items in the left column, the passage in the right.
const CUSTOM_LAYOUT_PATH = "/custom-layout";

type RecordedEvent = { type: string; stage?: string; sourceCe?: string };

declare global {
	interface Window {
		__pieCustomLayoutEvents?: RecordedEvent[];
	}
}

async function recordReadinessEvents(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const events: RecordedEvent[] = [];
		window.__pieCustomLayoutEvents = events;
		for (const type of ["pie-stage-change", "pie-loading-complete"]) {
			document.addEventListener(type, (event) => {
				const detail = (event as CustomEvent<{ stage?: string; sourceCe?: string }>)
					.detail;
				events.push({ type, stage: detail?.stage, sourceCe: detail?.sourceCe });
			});
		}
	});
}

const recordedEvents = (page: Page) =>
	page.evaluate(() => window.__pieCustomLayoutEvents ?? []);

test.describe("section player custom layout", () => {
	test("renders a host-built layout and reaches loading-complete", async ({
		page,
	}) => {
		const pageErrors: string[] = [];
		page.on("pageerror", (error) => pageErrors.push(error.message));
		await recordReadinessEvents(page);
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto(CUSTOM_LAYOUT_PATH, { waitUntil: "networkidle" });

		const host = page.locator("pie-section-player-kernel-host");
		const itemsColumn = page.locator('[data-custom-layout-column="items"]');
		const passagesColumn = page.locator('[data-custom-layout-column="passages"]');

		await expect(
			itemsColumn.locator(
				"pie-section-player-items-pane pie-section-player-item-card",
			),
		).toHaveCount(3, { timeout: 30_000 });
		await expect(itemsColumn.getByRole("radio").first()).toBeVisible();
		await expect(
			passagesColumn.locator(
				"pie-section-player-passages-pane pie-section-player-passage-card",
			),
		).toHaveCount(1);
		// The host's children are the layout, so the stock body is absent.
		await expect(host.locator(".pie-section-player-kernel-host-content")).toHaveCount(0);

		const itemsBox = await itemsColumn.boundingBox();
		const passagesBox = await passagesColumn.boundingBox();
		expect(itemsBox && passagesBox).toBeTruthy();
		expect(itemsBox?.x ?? 0).toBeLessThan(passagesBox?.x ?? 0);

		await expect
			.poll(
				async () =>
					(await recordedEvents(page)).filter(
						(event) => event.type === "pie-loading-complete",
					).length,
				{ timeout: 30_000, message: "pie-loading-complete never fired" },
			)
			.toBe(1);
		const events = await recordedEvents(page);
		const stages = events
			.filter((event) => event.type === "pie-stage-change")
			.map((event) => event.stage);
		for (const stage of ["composed", "engine-ready", "interactive"]) {
			expect(stages, `stage ${stage}`).toContain(stage);
		}
		expect(stages.indexOf("composed")).toBeLessThan(stages.indexOf("interactive"));
		expect(
			new Set(events.map((event) => event.sourceCe)),
		).toEqual(new Set(["pie-section-player-kernel-host"]));

		// Navigation and state come from the kernel host's own methods.
		const snapshot = await host.evaluate(
			(element) =>
				(
					element as HTMLElement & {
						getSnapshot(): {
							composition: { itemsCount: number; passagesCount: number };
						};
					}
				).getSnapshot(),
		);
		expect(snapshot.composition).toMatchObject({
			itemsCount: 3,
			passagesCount: 1,
		});

		expect(pageErrors).toEqual([]);
	});
});
