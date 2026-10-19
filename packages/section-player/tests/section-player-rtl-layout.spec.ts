import { expect, test, type Page } from "@playwright/test";

/**
 * The cards lay out by the writing direction of the subtree they sit in.
 *
 * `direction` inherits through the flat tree, so one `dir` on the shell host
 * reaches every card header without a stamp of its own — which is also how
 * the interface-locale stamps reach it. The card CSS pushes end-of-row
 * controls (the item toolbar, the formative button) to the trailing edge with
 * `margin-inline-start`, and this spec holds that to geometry: an attribute
 * assertion cannot see a physical `margin-left` that fails to flip.
 */

const WIDE = { width: 1500, height: 950 };

/** Gap between a control and each edge of its container, in pixels. */
type EdgeGaps = { leading: number; trailing: number };

/**
 * Gaps for every container on the page that holds the control: the demo
 * renders a passage card and an item card, each with its own header and
 * toolbar, and each card's own CSS rule has to flip.
 */
async function edgeGaps(
	page: Page,
	containerSelector: string,
	controlSelector: string,
): Promise<EdgeGaps[]> {
	return page.evaluate(
		([containerSelector, controlSelector]) => {
			return Array.from(document.querySelectorAll(containerSelector)).map(
				(container) => {
					const control = container.querySelector(controlSelector);
					if (!control) return { leading: NaN, trailing: NaN };
					const c = container.getBoundingClientRect();
					const t = control.getBoundingClientRect();
					// "Leading" is the left edge here; which gap is small flips
					// with the writing direction, which is what the assertions pin.
					return {
						leading: Math.round(t.left - c.left),
						trailing: Math.round(c.right - t.right),
					};
				},
			);
		},
		[containerSelector, controlSelector],
	);
}

function expectAllHugTrailingEdgeLtr(gaps: EdgeGaps[]): void {
	for (const gap of gaps) {
		expect(gap.trailing, "ltr: control at the trailing edge").toBeLessThan(
			80,
		);
		expect(gap.leading, "ltr: control away from the leading edge").toBeGreaterThan(
			100,
		);
	}
}

function expectAllHugTrailingEdgeRtl(gaps: EdgeGaps[]): void {
	for (const gap of gaps) {
		expect(gap.leading, "rtl: control at the trailing edge").toBeLessThan(80);
		expect(
			gap.trailing,
			"rtl: control away from the leading edge",
		).toBeGreaterThan(100);
	}
}

test.describe("section player rtl layout", () => {
	test("the card header's item toolbar hugs the trailing edge, and flips with dir", async ({
		page,
	}) => {
		await page.setViewportSize(WIDE);
		await page.goto("/question-passage?mode=candidate&layout=splitpane", {
			waitUntil: "networkidle",
		});

		const header = page.locator(".pie-section-player-content-card-header").first();
		await expect(header).toBeVisible();
		await expect(header.locator("pie-item-toolbar")).toBeVisible();

		// Left-to-right, every toolbar sits at the right edge (the header's own
		// padding accounts for a small residual gap on that side).
		expectAllHugTrailingEdgeLtr(
			await edgeGaps(
				page,
				".pie-section-player-content-card-header",
				"pie-item-toolbar",
			),
		);

		await page.evaluate(() => {
			document
				.querySelector("pie-section-player-shell")
				?.setAttribute("dir", "rtl");
		});
		// Right-to-left, the same rule must push each toolbar to the left edge.
		// `margin-inline-start` flips; a physical `margin-left` would leave the
		// toolbar against the title at the start side.
		expectAllHugTrailingEdgeRtl(
			await edgeGaps(
				page,
				".pie-section-player-content-card-header",
				"pie-item-toolbar",
			),
		);
	});
});
