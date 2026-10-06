import { expect, test, type Page } from "@playwright/test";
import { expectDemoChromeReady } from "../../../test-support/demo-menu";

// The section toolbar re-renders its tools on every coordinator policy emit and
// on an interface-locale change. An open overlay has to come through that as the
// same element, or the learner's ruler jumps back and forgets its unit.
const DEMO_PATH = "/tts-ssml?mode=candidate&layout=splitpane";
const LAYOUT_TAG = "pie-section-player-splitpane";
const RULER = 'pie-tool-ruler[tool-id^="ruler:section:"]';

type RulerState = {
	marked: boolean;
	transform: string;
	cmPressed: string | null;
};

async function captureCoordinator(page: Page): Promise<void> {
	await page.addInitScript(() => {
		document.addEventListener(
			"toolkit-ready",
			(event) => {
				const coordinator = (event as CustomEvent<{ coordinator?: unknown }>)
					.detail?.coordinator;
				if (coordinator) {
					(window as unknown as { __coordinator: unknown }).__coordinator =
						coordinator;
				}
			},
			true,
		);
	});
}

async function rulerState(page: Page): Promise<RulerState> {
	return page.locator(RULER).evaluate((element) => {
		const inner =
			element.shadowRoot?.querySelector<HTMLElement>(".pie-tool-ruler");
		const units = element.shadowRoot?.querySelectorAll(
			".pie-tool-ruler__unit-button",
		);
		return {
			marked: (element as unknown as { __marked?: boolean }).__marked === true,
			transform: inner?.style.transform ?? "",
			cmPressed: units?.[1]?.getAttribute("aria-pressed") ?? null,
		};
	});
}

test.describe("section toolbar overlay state", () => {
	test("an open ruler keeps its position and unit through policy emits and a locale change", async ({
		page,
	}) => {
		await captureCoordinator(page);
		await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
		await expectDemoChromeReady(page);
		await page.waitForFunction(() => "__coordinator" in window);

		const toolbar = page
			.locator(".pie-section-player-toolbar-pane--right")
			.first()
			.locator("pie-section-toolbar")
			.first();
		await toolbar.getByRole("button", { name: "Ruler", exact: true }).click();
		const ruler = page.locator(RULER);
		await expect(ruler).toHaveCount(1);
		const body = page.locator(`${RULER} .pie-tool-ruler`);
		await expect(body).toBeVisible();

		const box = await body.boundingBox();
		if (!box) throw new Error("ruler has no box");
		const startX = box.x + box.width * 0.3;
		const startY = box.y + box.height * 0.5;
		await page.mouse.move(startX, startY);
		await page.mouse.down();
		for (let step = 1; step <= 10; step++) {
			await page.mouse.move(startX + step * 12, startY + step * 9);
		}
		await page.mouse.up();
		await page.locator(`${RULER} .pie-tool-ruler__unit-button`).nth(1).click();
		await ruler.evaluate((element) => {
			(element as unknown as { __marked: boolean }).__marked = true;
		});

		const moved = await rulerState(page);
		expect(moved.transform).not.toBe("");
		expect(moved.cmPressed).toBe("true");

		await page.evaluate(() => {
			const coordinator = (
				window as unknown as {
					__coordinator: {
						updateToolConfig(id: string, updates: object): void;
						updateCurrentItemRef(ref: object | null): void;
						updateAssessment(assessment: object | null): void;
						boundAssessment?: object | null;
						assessmentId: string;
					};
				}
			).__coordinator;
			coordinator.updateToolConfig("ruler", { enabled: true });
			coordinator.updateCurrentItemRef({ identifier: "overlay-state-ref" });
			coordinator.updateAssessment({
				...(coordinator.boundAssessment ?? { id: coordinator.assessmentId }),
			});
		});
		await expect.poll(() => rulerState(page)).toEqual(moved);

		await page.locator(LAYOUT_TAG).evaluate((element) => {
			element.setAttribute("locale", "nl-NL");
		});
		// The toolbar has re-rendered once the tools landmark is Dutch.
		await expect(
			page.getByRole("complementary", {
				name: "Hulpmiddelen voor dit onderdeel",
			}),
		).toBeAttached();
		await expect(ruler).toHaveCount(1);
		expect(await rulerState(page)).toEqual(moved);
	});
});
