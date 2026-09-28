import { expect, test, type Page } from "@playwright/test";
import { expectDemoChromeReady } from "../../../test-support/demo-menu";

/**
 * The ruler's own pointer handling: drag, rotate about its centre, and the
 * bound that lets it overhang an item card without being lost behind it. Runs
 * in WebKit as well as Chromium, because Safari's pointer capture is what iPad
 * learners get; touch input itself is driven through CDP, so Chromium only.
 */

const SECTION_DEMO = "/single-question";
const ITEM_DEMO = "/question-passage?mode=candidate&layout=splitpane";

type Box = { left: number; top: number; right: number; bottom: number };

async function openRuler(page: Page, path: string) {
	await page.goto(path, { waitUntil: "networkidle" });
	await expectDemoChromeReady(page);
	await page.getByRole("button", { name: "Ruler", exact: true }).first().click();
	const ruler = page.locator(".pie-tool-ruler");
	await expect(ruler).toBeVisible();
	return ruler;
}

async function boxOf(page: Page, selector: string): Promise<Box> {
	const box = await page.locator(selector).boundingBox();
	if (!box) throw new Error(`${selector} has no box`);
	return {
		left: box.x,
		top: box.y,
		right: box.x + box.width,
		bottom: box.y + box.height,
	};
}

const centreOf = (box: Box) => ({
	x: (box.left + box.right) / 2,
	y: (box.top + box.bottom) / 2,
});

/** Rotation in degrees, read back from the computed transform matrix. */
function rotationOf(page: Page) {
	return page.locator(".pie-tool-ruler").evaluate((element) => {
		const matrix = new DOMMatrix(getComputedStyle(element).transform);
		const degrees = (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
		return (degrees + 360) % 360;
	});
}

async function mouseDrag(
	page: Page,
	from: { x: number; y: number },
	to: { x: number; y: number },
) {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	await page.mouse.move(to.x, to.y, { steps: 10 });
	await page.mouse.up();
}

test.describe("ruler pointer handling", () => {
	test("a drag moves the ruler by the pointer's travel", async ({ page }) => {
		await openRuler(page, SECTION_DEMO);
		const before = await boxOf(page, ".pie-tool-ruler");
		const grab = { x: before.left + 120, y: before.top + 20 };
		await mouseDrag(page, grab, { x: grab.x + 100, y: grab.y + 50 });
		const after = await boxOf(page, ".pie-tool-ruler");
		expect(after.left - before.left).toBeCloseTo(100, 0);
		expect(after.top - before.top).toBeCloseTo(50, 0);
		await expect(page.locator(".pie-tool-ruler")).toBeFocused();
	});

	test("the handle turns the ruler about its centre", async ({ page }) => {
		await openRuler(page, SECTION_DEMO);
		const centre = centreOf(await boxOf(page, ".pie-tool-ruler"));
		const handle = centreOf(await boxOf(page, ".pie-tool-ruler__rotate-handle"));
		const radius = centre.y - handle.y;
		// Sweep a quarter turn clockwise, from above the centre to its right.
		await mouseDrag(page, handle, { x: centre.x + radius, y: centre.y });
		expect(await rotationOf(page)).toBeCloseTo(90, 0);
		const turnedCentre = centreOf(await boxOf(page, ".pie-tool-ruler"));
		expect(turnedCentre.x).toBeCloseTo(centre.x, 0);
		expect(turnedCentre.y).toBeCloseTo(centre.y, 0);
	});

	test("on an item card the ruler overhangs but keeps part of itself inside", async ({
		page,
	}) => {
		await openRuler(page, ITEM_DEMO);
		const card = await page
			.locator(".pie-tool-ruler")
			.evaluate((element) => {
				const rect = (element as HTMLElement).offsetParent!.getBoundingClientRect();
				return { left: rect.left, right: rect.right };
			});
		const before = await boxOf(page, ".pie-tool-ruler");
		const grab = { x: before.left + 120, y: before.top + 20 };

		await mouseDrag(page, grab, { x: grab.x + 150, y: grab.y });
		const overhanging = await boxOf(page, ".pie-tool-ruler");
		expect(overhanging.left - before.left).toBeCloseTo(150, 0);
		expect(overhanging.right).toBeGreaterThan(card.right);

		const regrab = { x: overhanging.left + 50, y: overhanging.top + 20 };
		await mouseDrag(page, regrab, { x: regrab.x + 2000, y: regrab.y });
		const stopped = await boxOf(page, ".pie-tool-ruler");
		expect(card.right - stopped.left).toBeCloseTo(100, 0);
	});

	test("touch drags and rotates, and a cancelled touch lets go", async ({
		page,
		browserName,
	}) => {
		test.skip(browserName !== "chromium", "touch input is dispatched through CDP");
		await openRuler(page, SECTION_DEMO);
		const cdp = await page.context().newCDPSession(page);
		await cdp.send("Emulation.setTouchEmulationEnabled", {
			enabled: true,
			maxTouchPoints: 5,
		});
		const touch = (
			type: "touchStart" | "touchMove" | "touchEnd" | "touchCancel",
			points: Array<{ x: number; y: number }>,
		) =>
			cdp.send("Input.dispatchTouchEvent", {
				type,
				touchPoints: points.map((point, id) => ({ ...point, id })),
			});

		const before = await boxOf(page, ".pie-tool-ruler");
		const grab = { x: before.left + 120, y: before.top + 20 };
		await touch("touchStart", [grab]);
		for (let step = 1; step <= 10; step++) {
			await touch("touchMove", [{ x: grab.x + step * 10, y: grab.y + step * 5 }]);
		}
		await touch("touchEnd", []);
		const dragged = await boxOf(page, ".pie-tool-ruler");
		expect(dragged.left - before.left).toBeCloseTo(100, 0);
		expect(dragged.top - before.top).toBeCloseTo(50, 0);

		// A second finger landing mid-drag neither moves nor pinches the ruler.
		const second = { x: dragged.left + 300, y: dragged.top + 60 };
		const first = { x: dragged.left + 120, y: dragged.top + 20 };
		await touch("touchStart", [first]);
		await touch("touchStart", [first, second]);
		await touch("touchMove", [
			{ x: first.x - 40, y: first.y },
			{ x: second.x + 200, y: second.y + 200 },
		]);
		await touch("touchEnd", []);
		const twoFingers = await boxOf(page, ".pie-tool-ruler");
		expect(twoFingers.left - dragged.left).toBeCloseTo(-40, 0);
		expect(twoFingers.top - dragged.top).toBeCloseTo(0, 0);

		const centre = centreOf(twoFingers);
		const handle = centreOf(await boxOf(page, ".pie-tool-ruler__rotate-handle"));
		const radius = centre.y - handle.y;
		await touch("touchStart", [handle]);
		for (let step = 1; step <= 10; step++) {
			const angle = ((-90 + step * 9) * Math.PI) / 180;
			await touch("touchMove", [
				{ x: centre.x + radius * Math.cos(angle), y: centre.y + radius * Math.sin(angle) },
			]);
		}
		await touch("touchEnd", []);
		expect(await rotationOf(page)).toBeCloseTo(90, 0);

		const turned = await boxOf(page, ".pie-tool-ruler");
		const press = centreOf(turned);
		await touch("touchStart", [press]);
		await touch("touchMove", [{ x: press.x + 30, y: press.y }]);
		await touch("touchCancel", []);
		const cancelled = await boxOf(page, ".pie-tool-ruler");
		await page.mouse.move(press.x + 300, press.y + 100);
		expect(await boxOf(page, ".pie-tool-ruler")).toEqual(cancelled);
	});
});
