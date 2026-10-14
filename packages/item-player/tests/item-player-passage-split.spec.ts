import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openDemoMenuIfCollapsed } from "../../../test-support/demo-menu";

const DELIVERY_PATH =
	"/demo/multiple-choice-radio-simple/delivery?mode=gather&role=student";
const DELIVERY_PROMPT = "Which is the largest planet in our solar system?";

type PassageOptions = {
	passageLayout?: string;
	allowedResize?: boolean;
	widthPx: number;
};

type Box = { left: number; right: number; top: number; bottom: number };

async function gotoDelivery(page: Page) {
	await page.setViewportSize({ width: 1400, height: 900 });
	await page.goto(DELIVERY_PATH, { waitUntil: "domcontentloaded" });
	await expect(
		page.getByRole("navigation", { name: "Demo controls" }),
	).toBeVisible({ timeout: 15_000 });
	await openDemoMenuIfCollapsed(page);
	await expect(page.getByText(DELIVERY_PROMPT)).toBeVisible({ timeout: 15_000 });
}

/** Re-render the demo's item with a passage, at a fixed player width. */
async function renderWithPassage(page: Page, options: PassageOptions) {
	await page.evaluate(async ({ passageLayout, allowedResize, widthPx }) => {
		const player = document.querySelector("pie-item-player") as any;
		const currentConfig = structuredClone(player.config);
		const loaded = new Promise((resolve) => {
			player.addEventListener("load-complete", resolve, { once: true });
		});
		player.style.display = "block";
		player.style.width = `${widthPx}px`;
		if (passageLayout !== undefined) player.passageLayout = passageLayout;
		player.renderStimulus = true;
		player.allowedResize = Boolean(allowedResize);
		player.config = {
			id: "split-item",
			pie: currentConfig,
			passage: {
				id: "passage",
				markup: '<p data-test-passage="true">Stimulus passage</p>',
				elements: {},
				models: [],
			},
		};
		await loaded;
	}, options);
	await expect(page.locator("[data-test-passage]")).toBeVisible();
}

async function boxes(page: Page): Promise<{ passage: Box; item: Box }> {
	return await page.evaluate(() => {
		const box = (selector: string) => {
			const rect = document
				.querySelector(`pie-item-player ${selector}`)!
				.getBoundingClientRect();
			return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
		};
		return { passage: box(".pie-passage-container"), item: box(".pie-item-container") };
	});
}

async function setPlayerWidth(page: Page, widthPx: number) {
	await page.evaluate((width) => {
		(document.querySelector("pie-item-player") as HTMLElement).style.width = `${width}px`;
	}, widthPx);
}

test.describe("pie-item-player passage layout", () => {
	test("stacks the passage above the item by default", async ({ page }) => {
		await gotoDelivery(page);
		await renderWithPassage(page, { allowedResize: true, widthPx: 1200 });

		const { passage, item } = await boxes(page);
		expect(passage.bottom).toBeLessThanOrEqual(item.top);
		await expect(page.getByRole("separator")).toHaveCount(0);
	});

	test("splitpane puts the passage beside the item, without a divider unless resize is allowed", async ({
		page,
	}) => {
		await gotoDelivery(page);
		await renderWithPassage(page, { passageLayout: "splitpane", widthPx: 1200 });

		const { passage, item } = await boxes(page);
		expect(passage.right).toBeLessThanOrEqual(item.left);
		expect(Math.abs(passage.top - item.top)).toBeLessThan(1);
		expect(Math.abs(passage.right - passage.left - (item.right - item.left))).toBeLessThan(1);
		await expect(page.getByRole("separator")).toHaveCount(0);
	});

	test("allowed-resize makes the split a keyboard-operable divider", async ({ page }) => {
		await gotoDelivery(page);
		await renderWithPassage(page, {
			passageLayout: "splitpane",
			allowedResize: true,
			widthPx: 1200,
		});

		const divider = page.getByRole("separator", {
			name: "Resize passage and question panels",
		});
		await expect(divider).toHaveAttribute("aria-valuenow", "50");
		await expect(divider).toHaveAttribute("aria-valuetext", "50% passage width");
		const passageId = await page
			.locator("pie-item-player .pie-passage-container")
			.getAttribute("id");
		await expect(divider).toHaveAttribute("aria-controls", passageId!);

		const before = (await boxes(page)).passage;
		await divider.focus();
		await page.keyboard.press("ArrowRight");
		await expect(divider).toHaveAttribute("aria-valuenow", "55");
		const after = (await boxes(page)).passage;
		expect(after.right - after.left).toBeGreaterThan(before.right - before.left);

		await page.keyboard.press("Home");
		await expect(divider).toHaveAttribute("aria-valuenow", "20");
		await page.keyboard.press("End");
		await expect(divider).toHaveAttribute("aria-valuenow", "80");

		const results = await new AxeBuilder({ page })
			.include("pie-item-player .pie-item-player-split-divider")
			.analyze();
		expect(results.violations).toEqual([]);
	});

	test("a pointer drag resizes the split relative to the player width", async ({
		page,
	}) => {
		await gotoDelivery(page);
		await renderWithPassage(page, {
			passageLayout: "splitpane",
			allowedResize: true,
			widthPx: 1000,
		});

		const divider = page.getByRole("separator");
		const box = (await divider.boundingBox())!;
		const x = box.x + box.width / 2;
		const y = box.y + Math.min(box.height / 2, 40);
		await page.mouse.move(x, y);
		await page.mouse.down();
		await page.mouse.move(x + 100, y, { steps: 5 });
		await page.mouse.up();
		await expect(divider).toHaveAttribute("aria-valuenow", "60");
	});

	test("stacks below the breakpoint and keeps the rendered elements across it", async ({
		page,
	}) => {
		const pageErrors: string[] = [];
		page.on("pageerror", (error) => pageErrors.push(error.message));
		await gotoDelivery(page);
		await renderWithPassage(page, {
			passageLayout: "splitpane",
			allowedResize: true,
			widthPx: 1200,
		});
		await page.evaluate(() => {
			(document.querySelector("pie-item-player .pie-item-container > *") as any).__splitProbe =
				true;
		});

		await setPlayerWidth(page, 600);
		await expect(page.getByRole("separator")).toHaveCount(0);
		await expect
			.poll(async () => {
				const { passage, item } = await boxes(page);
				return passage.bottom <= item.top;
			})
			.toBe(true);

		await setPlayerWidth(page, 1200);
		await expect(page.getByRole("separator")).toHaveCount(1);
		const { passage, item } = await boxes(page);
		expect(passage.right).toBeLessThanOrEqual(item.left);
		const sameElement = await page.evaluate(
			() =>
				(document.querySelector("pie-item-player .pie-item-container > *") as any)
					.__splitProbe === true,
		);
		expect(sameElement).toBe(true);
		expect(pageErrors).toEqual([]);
	});
});
