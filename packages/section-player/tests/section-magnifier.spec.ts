import { expect, test, type Page } from "@playwright/test";

/**
 * The magnifier opened from the section toolbar, where its lens mounts inside
 * the toolbar's own row: focus entering it must not scroll the page, the
 * coordinator's z-index must survive the lens re-rendering, closing it must
 * hand focus back to the button that opened it, and Escape pressed elsewhere
 * must close it without moving focus.
 */
const DEMO_PATH = "/magnifier?mode=candidate&layout=splitpane&page=magnifier-granted";
const BUTTON_LABEL = "Magnifier, enlarge the content under a lens";
const LENS = "pie-tool-magnifier .pie-tool-magnifier";

async function gotoDemo(page: Page) {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expect(page.getByRole("button", { name: BUTTON_LABEL })).toBeVisible();
}

/** Every non-zero scroll offset in the page, shadow roots included. */
function scrollOffsets(page: Page) {
	return page.evaluate(() => {
		function* walk(root: Document | ShadowRoot): Generator<Element> {
			for (const element of root.querySelectorAll("*")) {
				yield element;
				if (element.shadowRoot) yield* walk(element.shadowRoot);
			}
		}
		const offsets: Array<[string, number, number]> = [];
		for (const element of walk(document)) {
			if (element.scrollLeft !== 0 || element.scrollTop !== 0) {
				offsets.push([
					`${element.tagName}.${element.className || ""}`,
					element.scrollLeft,
					element.scrollTop,
				]);
			}
		}
		return offsets;
	});
}

/** Scroll offsets once smooth scrolling has come to rest. */
async function settledScrollOffsets(page: Page) {
	let previous = await scrollOffsets(page);
	for (;;) {
		await page.waitForTimeout(150);
		const current = await scrollOffsets(page);
		if (JSON.stringify(current) === JSON.stringify(previous)) return current;
		previous = current;
	}
}

/** The focused element's class, or its aria-label, looking through shadow roots. */
function focused(page: Page) {
	return page.evaluate(() => {
		let active = document.activeElement;
		while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
		if (!active) return null;
		return {
			className: typeof active.className === "string" ? active.className : "",
			label: active.getAttribute("aria-label"),
		};
	});
}

function untilLensFocused(page: Page) {
	return expect
		.poll(async () => (await focused(page))?.className ?? "")
		.toContain("pie-tool-magnifier");
}

async function openLens(page: Page) {
	await page.getByRole("button", { name: BUTTON_LABEL }).click();
	await untilLensFocused(page);
}

function lensStyle(page: Page) {
	return page.locator(LENS).evaluate((lens: HTMLElement) => ({
		left: lens.style.left,
		width: lens.style.width,
		height: lens.style.height,
		zIndex: lens.style.zIndex,
	}));
}

test.describe("magnifier", () => {
	test("pressing the lens takes focus without scrolling an ancestor", async ({
		page,
	}) => {
		// At phone size, with the page at its top, the lens is on screen while the
		// toolbar row it mounts in is below the fold. Focus entering the lens must
		// not reach the row's scroll-into-view, which would pull the page and the
		// lens out from under the pointer.
		await page.setViewportSize({ width: 320, height: 568 });
		await gotoDemo(page);
		await page.getByRole("button", { name: BUTTON_LABEL }).focus();
		await page.keyboard.press("Enter");
		await untilLensFocused(page);
		await page.evaluate(() => {
			let active = document.activeElement;
			while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
			(active as HTMLElement | null)?.blur();
			function* walk(root: Document | ShadowRoot): Generator<Element> {
				for (const element of root.querySelectorAll("*")) {
					yield element;
					if (element.shadowRoot) yield* walk(element.shadowRoot);
				}
			}
			for (const element of walk(document)) element.scrollTop = 0;
		});
		const before = await settledScrollOffsets(page);
		const lens = await page.locator(LENS).boundingBox();
		if (!lens) throw new Error("the lens has no box");

		await page.mouse.click(lens.x + lens.width / 2, lens.y + lens.height / 2);
		await untilLensFocused(page);

		expect(await settledScrollOffsets(page)).toEqual(before);
	});

	test("the lens keeps its place in the stack as it moves", async ({ page }) => {
		await gotoDemo(page);
		await openLens(page);
		const opened = await lensStyle(page);
		expect(Number(opened.zIndex)).toBeGreaterThanOrEqual(1000);

		await page.keyboard.press("ArrowLeft");

		const moved = await lensStyle(page);
		expect(moved.left).not.toBe(opened.left);
		expect(moved.zIndex).toBe(opened.zIndex);
	});

	test("tap controls move the focused lens and change one dimension at a time", async ({
		page,
	}) => {
		await gotoDemo(page);
		await openLens(page);
		const opened = await lensStyle(page);
		const lens = page.locator(LENS);

		await lens.getByRole("button", { name: "Move tool left" }).click();
		await lens.getByRole("button", { name: "Make the magnifier narrower" }).click();
		const narrowed = await lensStyle(page);
		expect(narrowed.left).not.toBe(opened.left);
		expect(narrowed.width).not.toBe(opened.width);
		expect(narrowed.height).toBe(opened.height);

		await lens.getByRole("button", { name: "Make the magnifier shorter" }).click();
		const shortened = await lensStyle(page);
		expect(shortened.width).toBe(narrowed.width);
		expect(shortened.height).not.toBe(narrowed.height);
		// A press on a control leaves focus on the lens, which keeps them shown.
		expect((await focused(page))?.className).toContain("pie-tool-magnifier");
	});

	test("the tap controls wrap to stay inside a phone-width pane", async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 568 });
		await gotoDemo(page);
		// Below the fold at this size, so it is pressed from the keyboard.
		await page.getByRole("button", { name: BUTTON_LABEL }).focus();
		await page.keyboard.press("Enter");
		await untilLensFocused(page);

		const strip = await page.locator(`${LENS} .pie-tool-magnifier__controls`).boundingBox();
		if (!strip) throw new Error("the tap controls have no box");
		expect(strip.x).toBeGreaterThanOrEqual(0);
		expect(strip.x + strip.width).toBeLessThanOrEqual(320);
		// On one row it would be about 42px tall and run into the pane's gutter.
		expect(strip.height).toBeGreaterThan(60);
	});

	test("focus beneath the lens shows in it, and Escape there closes it in place", async ({
		page,
	}) => {
		await gotoDemo(page);
		await openLens(page);

		// Back out of the lens, past the button that opened it, to the control
		// before that, so focus staying put differs from focus being returned.
		await page.keyboard.press("Shift+Tab");
		await page.keyboard.press("Shift+Tab");
		const outside = await focused(page);
		expect(outside?.className ?? "").not.toContain("pie-tool-magnifier");
		expect(outside?.label).not.toBe(BUTTON_LABEL);
		const ring = page.locator(`${LENS} .pie-tool-magnifier__focus`);
		await expect(ring).toHaveCount(1);

		await page.keyboard.press("Escape");

		await expect(page.locator(LENS)).toHaveCount(0);
		expect((await focused(page))?.label).toBe(outside?.label);
	});

	test("Escape closes the lens and returns focus to its button", async ({
		page,
	}) => {
		await gotoDemo(page);
		await openLens(page);

		await page.keyboard.press("Escape");

		await expect(page.locator(LENS)).toHaveCount(0);
		expect((await focused(page))?.label).toBe(BUTTON_LABEL);
	});
});
