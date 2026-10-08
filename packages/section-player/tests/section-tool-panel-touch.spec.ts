import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectDemoChromeReady } from "../../../test-support/demo-menu";

/**
 * Touch drags of the tool panels that move by pointer besides the ruler and
 * protractor: the line reader and the floating tool shell. A drag follows the
 * finger that started it, ignores a second finger, and ends when the browser
 * cancels the touch, as iPadOS does when it takes a touch over for a system
 * gesture. Touch input is dispatched through CDP, so this runs in the Chromium
 * project only.
 */

type Point = { x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };
type TouchType = "touchStart" | "touchMove" | "touchEnd" | "touchCancel";

async function boxOf(locator: Locator): Promise<Box> {
	const box = await locator.boundingBox();
	if (!box) throw new Error("the panel has no box");
	return box;
}

/** Dispatches touches; a point's index in `points` is its touch id. */
async function touchInput(page: Page) {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("Emulation.setTouchEmulationEnabled", {
		enabled: true,
		maxTouchPoints: 5,
	});
	return (type: TouchType, points: Point[]) =>
		cdp.send("Input.dispatchTouchEvent", {
			type,
			touchPoints: points.map((point, id) => ({ ...point, id })),
		});
}

type Grab = (box: Box) => Point;

interface Panel {
	name: string;
	/** Opens the panel and returns it with the point to grab it by. */
	open: (page: Page) => Promise<{ panel: Locator; grabIn: Grab }>;
}

/** Towards the middle of the viewport, so no panel meets its containment bound. */
function inwardFrom(page: Page, grab: Point): Point {
	const viewport = page.viewportSize();
	if (!viewport) throw new Error("no viewport");
	return {
		x: grab.x < viewport.width / 2 ? 1 : -1,
		y: grab.y < viewport.height / 2 ? 1 : -1,
	};
}

const PANELS: Panel[] = [
	{
		name: "the line reader",
		open: async (page) => {
			await page.goto("/single-question", { waitUntil: "networkidle" });
			await expectDemoChromeReady(page);
			await page
				.getByRole("button", { name: "Line Reader, reading guide", exact: true })
				.first()
				.click();
			const panel = page.locator(".pie-tool-line-reader");
			await expect(panel).toBeVisible();
			// The frame band above the reading window, clear of the resize handles.
			return {
				panel,
				grabIn: (box) => ({ x: box.x + box.width / 2 - 100, y: box.y + 12 }),
			};
		},
	},
	{
		name: "the floating tool shell",
		open: async (page) => {
			await page.goto("/three-questions?mode=candidate&layout=splitpane", {
				waitUntil: "networkidle",
			});
			const player = page.locator("pie-section-player-splitpane");
			const questions = player.getByRole("tab", { name: "Questions", exact: true });
			if (await questions.count()) await questions.press("Enter");
			await player.getByRole("button", { name: "Calculator", exact: true }).first().click();
			const panel = page.locator('[data-pie-tool-shell="calculator"]:visible');
			await expect(panel).toBeVisible();
			// On the title, far enough from the corner that touch adjustment does not
			// snap the press onto the resize handle there.
			const header = await boxOf(panel.locator(".pie-tool-shell__header"));
			const headerMiddle = header.y - (await boxOf(panel)).y + header.height / 2;
			return { panel, grabIn: (box) => ({ x: box.x + 90, y: box.y + headerMiddle }) };
		},
	},
];

for (const { name, open } of PANELS) {
	test(`${name} follows the finger that grabbed it, not a second one`, async ({ page }) => {
		const { panel, grabIn } = await open(page);
		const touch = await touchInput(page);
		const before = await boxOf(panel);
		const grab = grabIn(before);
		const inward = inwardFrom(page, grab);
		await touch("touchStart", [grab]);
		for (let step = 1; step <= 5; step++) {
			await touch("touchMove", [
				{ x: grab.x + inward.x * step * 10, y: grab.y + inward.y * step * 5 },
			]);
		}
		const held = { x: grab.x + inward.x * 50, y: grab.y + inward.y * 25 };
		const second = { x: held.x + 20, y: held.y };
		await touch("touchStart", [held, second]);
		for (let step = 1; step <= 5; step++) {
			await touch("touchMove", [held, { x: second.x + step * 20, y: second.y + step * 10 }]);
		}
		await touch("touchEnd", []);
		const dragged = await boxOf(panel);
		expect(dragged.x - before.x).toBeCloseTo(inward.x * 50, 0);
		expect(dragged.y - before.y).toBeCloseTo(inward.y * 25, 0);
	});

	test(`${name} lets go of a cancelled touch`, async ({ page }) => {
		const { panel, grabIn } = await open(page);
		const touch = await touchInput(page);
		const press = grabIn(await boxOf(panel));
		await touch("touchStart", [press]);
		await touch("touchMove", [{ x: press.x + 30, y: press.y }]);
		await touch("touchCancel", []);
		// A pointer passing over the panel afterwards leaves it where it is.
		const cancelled = await boxOf(panel);
		await page.mouse.move(press.x, press.y);
		await page.mouse.move(press.x + 40, press.y + 20, { steps: 5 });
		expect(await boxOf(panel)).toEqual(cancelled);
	});
}
