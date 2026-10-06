import { expect, test, type Page } from "@playwright/test";
import { expectDemoChromeReady } from "../../../test-support/demo-menu";

/**
 * The protractor's own pointer handling: drag, rotate about its vertex, and
 * the bound that lets it overhang an item card, which has to account for the
 * turned protractor's extent being centred off its vertex. Runs in WebKit as
 * well as Chromium; touch input is driven through CDP, so Chromium only.
 */

const SECTION_DEMO = "/single-question";
const ITEM_DEMO = "/question-passage?mode=candidate&layout=splitpane";
const PROTRACTOR = ".pie-tool-protractor";

type Box = { left: number; top: number; right: number; bottom: number };
type Point = { x: number; y: number };

async function openProtractor(page: Page, path: string) {
	await page.goto(path, { waitUntil: "networkidle" });
	await expectDemoChromeReady(page);
	await page
		.getByRole("button", { name: "Protractor", exact: true })
		.first()
		.click();
	await expect(page.locator(PROTRACTOR)).toBeVisible();
}

function boxOf(page: Page, selector: string): Promise<Box> {
	return page.locator(selector).evaluate((element) => {
		const rect = element.getBoundingClientRect();
		return {
			left: rect.left,
			top: rect.top,
			right: rect.right,
			bottom: rect.bottom,
		};
	});
}

/** The vertex on screen, read from the zero-size marker placed on it. */
async function vertexOf(page: Page): Promise<Point> {
	const marker = await boxOf(page, ".pie-tool-protractor__pivot");
	return { x: marker.left, y: marker.top };
}

const centreOf = (box: Box): Point => ({
	x: (box.left + box.right) / 2,
	y: (box.top + box.bottom) / 2,
});

function rotationOf(page: Page) {
	return page.locator(PROTRACTOR).evaluate((element) => {
		const matrix = new DOMMatrix(getComputedStyle(element).transform);
		const degrees = (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
		return (degrees + 360) % 360;
	});
}

async function mouseDrag(page: Page, from: Point, to: Point) {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 10 });
	await page.mouse.up();
}

/** Sweeps the rotation handle a quarter turn clockwise about the vertex. */
async function quarterTurn(page: Page) {
	const vertex = await vertexOf(page);
	const handle = centreOf(
		await boxOf(page, ".pie-tool-protractor__rotate-handle"),
	);
	const radius = vertex.y - handle.y;
	await page.mouse.move(handle.x, handle.y);
	await page.mouse.down();
	for (let step = 1; step <= 10; step++) {
		const angle = ((-90 + step * 9) * Math.PI) / 180;
		await page.mouse.move(
			vertex.x + radius * Math.cos(angle),
			vertex.y + radius * Math.sin(angle),
		);
	}
	await page.mouse.up();
}

test.describe("protractor pointer handling", () => {
	test("a drag moves the protractor by the pointer's travel", async ({
		page,
	}) => {
		await openProtractor(page, SECTION_DEMO);
		const before = await boxOf(page, PROTRACTOR);
		const grab = { x: before.left + 200, y: before.top + 150 };
		await mouseDrag(page, grab, { x: grab.x + 100, y: grab.y + 50 });
		const after = await boxOf(page, PROTRACTOR);
		expect(after.left - before.left).toBeCloseTo(100, 0);
		expect(after.top - before.top).toBeCloseTo(50, 0);
		await expect(page.locator(PROTRACTOR)).toBeFocused();
	});

	test("the handle turns the protractor about its vertex", async ({ page }) => {
		await openProtractor(page, SECTION_DEMO);
		const vertex = await vertexOf(page);
		await quarterTurn(page);
		expect(await rotationOf(page)).toBeCloseTo(90, 0);
		const turnedVertex = await vertexOf(page);
		expect(turnedVertex.x).toBeCloseTo(vertex.x, 0);
		expect(turnedVertex.y).toBeCloseTo(vertex.y, 0);
	});

	test("on an item card a turned protractor overhangs but keeps part of itself inside", async ({
		page,
	}) => {
		await openProtractor(page, ITEM_DEMO);
		const cardRight = await page
			.locator(PROTRACTOR)
			.evaluate(
				(element) =>
					(element as HTMLElement).offsetParent!.getBoundingClientRect().right,
			);
		await quarterTurn(page);
		const turned = await boxOf(page, ".pie-tool-protractor__frame");
		// The card is taller than the viewport, so grab near the top of the turned
		// frame, which is on screen, rather than at its centre, which may not be.
		const grab = { x: centreOf(turned).x, y: turned.top + 30 };
		await mouseDrag(page, grab, { x: grab.x + 2000, y: grab.y });
		// The frame is the turned protractor's visible extent; its left edge stops
		// 100px inside the card however far the pointer goes.
		const stopped = await boxOf(page, ".pie-tool-protractor__frame");
		expect(stopped.left).toBeLessThan(cardRight);
		expect(cardRight - stopped.left).toBeCloseTo(100, 0);
	});

	test("touch drags, and a cancelled touch lets go", async ({
		page,
		browserName,
	}) => {
		test.skip(
			browserName !== "chromium",
			"touch input is dispatched through CDP",
		);
		await openProtractor(page, SECTION_DEMO);
		const cdp = await page.context().newCDPSession(page);
		await cdp.send("Emulation.setTouchEmulationEnabled", {
			enabled: true,
			maxTouchPoints: 5,
		});
		const touch = (
			type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel",
			points: Point[],
		) =>
			cdp.send("Input.dispatchTouchEvent", {
				type,
				touchPoints: points.map((point, id) => ({ ...point, id })),
			});

		const before = await boxOf(page, PROTRACTOR);
		const grab = { x: before.left + 200, y: before.top + 150 };
		await touch("touchStart", [grab]);
		for (let step = 1; step <= 10; step++) {
			await touch("touchMove", [
				{ x: grab.x + step * 10, y: grab.y + step * 5 },
			]);
		}
		await touch("touchEnd", []);
		const dragged = await boxOf(page, PROTRACTOR);
		expect(dragged.left - before.left).toBeCloseTo(100, 0);
		expect(dragged.top - before.top).toBeCloseTo(50, 0);

		const press = { x: dragged.left + 200, y: dragged.top + 150 };
		await touch("touchStart", [press]);
		await touch("touchMove", [{ x: press.x + 30, y: press.y }]);
		await touch("touchCancel", []);
		const cancelled = await boxOf(page, PROTRACTOR);
		await page.mouse.move(press.x + 300, press.y + 100);
		expect(await boxOf(page, PROTRACTOR)).toEqual(cancelled);
	});
});

test.describe("protractor tap controls", () => {
	const CONTROLS = ".pie-tool-protractor__controls";
	const press = (page: Page, name: string) =>
		page.getByRole("button", { name, exact: true }).click();

	test("show while the protractor has focus, and a press keeps them up", async ({
		page,
	}) => {
		await openProtractor(page, SECTION_DEMO);
		const controls = page.locator(CONTROLS);
		await expect(page.locator(PROTRACTOR)).toBeFocused();
		await expect(controls).toBeVisible();
		await press(page, "Move tool right");
		await expect(page.locator(PROTRACTOR)).toBeFocused();
		await expect(controls).toBeVisible();
		await page.getByText("Which greenhouse gas").click();
		await expect(controls).toBeHidden();
	});

	test("move by 10px and turn by 5° and 1° without a drag", async ({
		page,
	}) => {
		await openProtractor(page, SECTION_DEMO);
		const before = await boxOf(page, PROTRACTOR);
		await press(page, "Move tool right");
		await press(page, "Move tool down");
		const moved = await boxOf(page, PROTRACTOR);
		expect(moved.left - before.left).toBeCloseTo(10, 0);
		expect(moved.top - before.top).toBeCloseTo(10, 0);
		await press(page, "Rotate 5° clockwise");
		expect(await rotationOf(page)).toBeCloseTo(5, 0);
		await press(page, "Rotate 1° counterclockwise");
		expect(await rotationOf(page)).toBeCloseTo(4, 0);
		await press(page, "Rotate 5° counterclockwise");
		expect(await rotationOf(page)).toBeCloseTo(359, 0);
	});

	test("stay level and clear of the protractor at a quarter turn", async ({
		page,
	}) => {
		await openProtractor(page, SECTION_DEMO);
		const upright = await boxOf(page, CONTROLS);
		expect(upright.top).toBeGreaterThan((await boxOf(page, PROTRACTOR)).bottom);
		for (let step = 0; step < 18; step++)
			await press(page, "Rotate 5° clockwise");
		expect(await rotationOf(page)).toBeCloseTo(90, 0);
		const turned = await boxOf(page, CONTROLS);
		// Level: the strip's screen box keeps its upright shape.
		expect(turned.right - turned.left).toBeCloseTo(
			upright.right - upright.left,
			0,
		);
		expect(turned.bottom - turned.top).toBeCloseTo(
			upright.bottom - upright.top,
			0,
		);
		// Clear: a quarter turn puts the tool's bottom edge on its left.
		expect(turned.right).toBeLessThan((await boxOf(page, PROTRACTOR)).left);
	});
});
