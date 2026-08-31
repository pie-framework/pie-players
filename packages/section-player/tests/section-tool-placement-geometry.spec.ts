import { expect, test, type Page } from "@playwright/test";
import { expectDemoChromeReady } from "../../../test-support/demo-menu";

/**
 * Placement level decides which element is a frameless overlay's containing
 * block, so it is the axis these tools have to be covered on, and geometry is
 * the assertion that matters: a tool that renders and responds while sitting
 * outside the content it was placed on satisfies every other check.
 *
 * The demo route places every frameless tool at every level it supports. Ruler
 * and protractor declare `section`, `item` and `element`; the line reader adds
 * `passage`.
 */
const DEMO_PATH = "/question-passage?mode=candidate&layout=splitpane";

const CARD_BOUNDARY = "[data-pie-tool-overlay-boundary]";

type Placement = {
	level: "section" | "item" | "passage";
	/** `item-id` of the card toolbar, or null for the section toolbar. */
	ownerId: string | null;
	label: string;
};

type FramelessTool = {
	id: string;
	buttonAriaLabel: string;
	hostTag: string;
	panelSelector: string;
	placements: Placement[];
};

const SECTION: Placement = {
	level: "section",
	ownerId: null,
	label: "section",
};
const ITEM: Placement = {
	level: "item",
	ownerId: "renaissance-q1",
	label: "item",
};
const PASSAGE: Placement = {
	level: "passage",
	ownerId: "passage-renaissance-001",
	label: "passage",
};

const FRAMELESS_TOOLS: FramelessTool[] = [
	{
		id: "lineReader",
		buttonAriaLabel: "Line Reader, reading guide",
		hostTag: "pie-tool-line-reader",
		panelSelector: ".pie-tool-line-reader",
		placements: [SECTION, ITEM, PASSAGE],
	},
	{
		id: "ruler",
		buttonAriaLabel: "Ruler",
		hostTag: "pie-tool-ruler",
		panelSelector: ".pie-tool-ruler",
		placements: [ITEM],
	},
	{
		id: "protractor",
		buttonAriaLabel: "Protractor",
		hostTag: "pie-tool-protractor",
		panelSelector: ".pie-tool-protractor",
		placements: [ITEM],
	},
];

type Box = { left: number; top: number; right: number; bottom: number };

type OpenedTool = {
	panel: Box;
	/** The box the panel is contained by: its card, or the viewport at section level. */
	container: Box;
	/** Whether the host landed inside a declared boundary. */
	mountedAtBoundary: boolean;
	scrollBefore: Array<[string, number, number]>;
	scrollAfter: Array<[string, number, number]>;
};

async function gotoDemo(page: Page) {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expectDemoChromeReady(page);
}

/**
 * Opens one tool and reports the geometry, measured in the page rather than
 * through locators: the panel lives in a tool's shadow root, its container is
 * decided by the flattened tree, and ancestor scroll offsets have to be sampled
 * either side of the same click.
 */
function openAndMeasure(
	page: Page,
	args: {
		buttonAriaLabel: string;
		hostTag: string;
		panelSelector: string;
		level: string;
		ownerId: string | null;
	},
): Promise<OpenedTool> {
	return page.evaluate(async (input) => {
		function* walk(root: Document | ShadowRoot): Generator<Element> {
			for (const element of root.querySelectorAll("*")) {
				yield element;
				if (element.shadowRoot) yield* walk(element.shadowRoot);
			}
		}
		const boxOf = (rect: DOMRect) => ({
			left: rect.left,
			top: rect.top,
			right: rect.right,
			bottom: rect.bottom,
		});
		const scrollOffsets = () => {
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
		};

		let toolbar: Element | null = null;
		for (const element of walk(document)) {
			if (input.ownerId === null) {
				if (element.tagName === "PIE-SECTION-TOOLBAR") toolbar = element;
			} else if (
				element.tagName === "PIE-ITEM-TOOLBAR" &&
				element.getAttribute("item-id") === input.ownerId
			) {
				toolbar = element;
			}
		}
		if (!toolbar?.shadowRoot) throw new Error(`no toolbar for ${input.level}`);

		let button: HTMLElement | null = null;
		for (const candidate of walk(toolbar.shadowRoot)) {
			if (candidate.getAttribute("aria-label") === input.buttonAriaLabel) {
				button = candidate as HTMLElement;
			}
		}
		if (!button) {
			throw new Error(`no ${input.buttonAriaLabel} button at ${input.level}`);
		}

		const scrollBefore = scrollOffsets();
		button.click();

		let panel: Element | null = null;
		let host: Element | null = null;
		for (let attempt = 0; attempt < 20 && !panel; attempt++) {
			await new Promise((resolve) => setTimeout(resolve, 100));
			for (const element of walk(document)) {
				if (
					element.tagName === input.hostTag.toUpperCase() &&
					(element.getAttribute("tool-id") || "").includes(`:${input.level}:`)
				) {
					host = element;
				}
			}
			panel = host?.shadowRoot?.querySelector(input.panelSelector) ?? null;
		}
		if (!panel || !host) throw new Error(`${input.hostTag} never opened`);

		const boundary = host.parentElement?.closest(
			"[data-pie-tool-overlay-boundary]",
		);
		const container = boundary
			? boxOf(boundary.getBoundingClientRect())
			: { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };

		return {
			panel: boxOf(panel.getBoundingClientRect()),
			container,
			mountedAtBoundary: Boolean(boundary),
			scrollBefore,
			scrollAfter: scrollOffsets(),
		};
	}, args);
}

test.describe("frameless tool placement geometry", () => {
	for (const tool of FRAMELESS_TOOLS) {
		for (const placement of tool.placements) {
			test(`${tool.id} opens inside its ${placement.label} container`, async ({
				page,
			}) => {
				await gotoDemo(page);

				const measured = await openAndMeasure(page, {
					buttonAriaLabel: tool.buttonAriaLabel,
					hostTag: tool.hostTag,
					panelSelector: tool.panelSelector,
					level: placement.level,
					ownerId: placement.ownerId,
				});

				// Card-level placement resolves against the host's declared boundary;
				// section-level placement has none above it and resolves against the
				// viewport.
				expect(measured.mountedAtBoundary).toBe(placement.level !== "section");

				// One pixel of tolerance: a card box can land off whole pixels.
				expect(
					measured.panel.left,
					`${tool.id} at ${placement.label} overflows its container to the left`,
				).toBeGreaterThanOrEqual(measured.container.left - 1);
				expect(
					measured.panel.right,
					`${tool.id} at ${placement.label} overflows its container to the right`,
				).toBeLessThanOrEqual(measured.container.right + 1);
				expect(
					measured.panel.top,
					`${tool.id} at ${placement.label} overflows its container at the top`,
				).toBeGreaterThanOrEqual(measured.container.top - 1);
				expect(
					measured.panel.bottom,
					`${tool.id} at ${placement.label} overflows its container at the bottom`,
				).toBeLessThanOrEqual(measured.container.bottom + 1);
			});

			test(`${tool.id} at ${placement.label} opens without scrolling an ancestor`, async ({
				page,
			}) => {
				await gotoDemo(page);

				const measured = await openAndMeasure(page, {
					buttonAriaLabel: tool.buttonAriaLabel,
					hostTag: tool.hostTag,
					panelSelector: tool.panelSelector,
					level: placement.level,
					ownerId: placement.ownerId,
				});

				// A panel positioned outside its pane gets revealed by the browser
				// scrolling that pane, which takes the content with it. Scroll offsets
				// either side of the click are how that shows up.
				expect(
					measured.scrollAfter,
					`opening ${tool.id} at ${placement.label} scrolled an ancestor`,
				).toEqual(measured.scrollBefore);
			});
		}
	}

	test("a tool opened at every level stays inside its own container", async ({
		page,
	}) => {
		await gotoDemo(page);

		// The line reader is the one tool placed at all three levels, so it is where
		// three instances coexist, each answering to a different container.
		for (const placement of [SECTION, ITEM, PASSAGE]) {
			const measured = await openAndMeasure(page, {
				buttonAriaLabel: "Line Reader, reading guide",
				hostTag: "pie-tool-line-reader",
				panelSelector: ".pie-tool-line-reader",
				level: placement.level,
				ownerId: placement.ownerId,
			});
			expect(
				measured.panel.right,
				`line reader at ${placement.label} overflows its container`,
			).toBeLessThanOrEqual(measured.container.right + 1);
			expect(
				measured.panel.left,
				`line reader at ${placement.label} overflows its container`,
			).toBeGreaterThanOrEqual(measured.container.left - 1);
		}

		await expect(page.locator("pie-tool-line-reader")).toHaveCount(3);
		await expect(page.locator(`${CARD_BOUNDARY} > pie-tool-line-reader`)).toHaveCount(2);
	});
});
