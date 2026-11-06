import { expect, test, type Page } from "@playwright/test";

/**
 * The cards lay out by the writing direction of the subtree they sit in.
 *
 * `direction` inherits through the flat tree, so one `dir` on the shell host
 * reaches every card header without a stamp of its own — which is also how
 * the interface-locale stamps reach it. The card CSS pushes end-of-row
 * controls (the item toolbar, the check button) to the trailing edge with
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

	test("the shipped Arabic locale flips the header through its own stamps", async ({
		page,
	}) => {
		// No forced `dir` here: the real `ar` catalog's resolution stamps the
		// shell, and the geometry has to follow those stamps alone.
		await page.setViewportSize(WIDE);
		await page.goto("/interface-locale?locale=ar", {
			waitUntil: "networkidle",
		});

		const header = page.locator(".pie-section-player-content-card-header").first();
		await expect(header).toBeVisible();
		await expect(header.locator("pie-item-toolbar")).toBeVisible();
		await expect(page.locator("pie-section-player-shell")).toHaveAttribute(
			"dir",
			"rtl",
		);

		expectAllHugTrailingEdgeRtl(
			await edgeGaps(
				page,
				".pie-section-player-content-card-header",
				"pie-item-toolbar",
			),
		);
	});

	test("the card footer's check control mirrors like the header toolbar", async ({
		page,
	}) => {
		// Checklist point 1: the footer's check-answer button carries the same
		// `margin-inline-start: auto` trailing-edge rule as the header toolbar,
		// and the geometry has to flip with it. The item session control demo is the one
		// surface that renders the footer at all; the direction comes from a
		// forced `dir` for the same reason the first case forces it — the rule
		// reads the inherited direction, and the shipped-`ar` case above already
		// proves the stamping path end to end.
		await page.setViewportSize(WIDE);
		await page.goto("/item-session-control?mode=candidate&layout=splitpane", {
			waitUntil: "networkidle",
		});
		const button = page
			.locator('[data-canonical-item-id="isc-q1"] [data-pie-check-action]')
			.first();
		await expect(button).toBeVisible({ timeout: 30_000 });

		const container = '[data-canonical-item-id="isc-q1"]';
		expectAllHugTrailingEdgeLtr(await edgeGaps(page, container, "[data-pie-check-action]"));

		await page.evaluate(() => {
			document
				.querySelector("pie-section-player-shell")
				?.setAttribute("dir", "rtl");
		});
		expectAllHugTrailingEdgeRtl(await edgeGaps(page, container, "[data-pie-check-action]"));
	});

	test("split-pane pane order follows the writing direction", async ({
		page,
	}) => {
		// Checklist point 2: the passages pane leads in LTR and trails in RTL.
		// The split grid orders its tracks by the writing direction, so a
		// physical `direction: ltr` pin anywhere in the chain would show up here
		// as a pane that failed to move. Panes keep `min-width: 0` either way —
		// containment is asserted by the scroll contract, not re-asserted here.
		async function paneLefts(): Promise<{ passages: number; items: number }> {
			return page.evaluate(() => {
				const left = (selector: string) =>
					document.querySelector(selector)?.getBoundingClientRect().left ?? NaN;
				return {
					passages: left(".pie-section-player-passages-pane"),
					items: left(".pie-section-player-items-pane"),
				};
			});
		}

		await page.setViewportSize(WIDE);
		await page.goto("/question-passage?mode=candidate&layout=splitpane", {
			waitUntil: "networkidle",
		});

		const ltr = await paneLefts();
		expect(ltr.passages).toBeLessThan(ltr.items - 50);

		await page.evaluate(() => {
			document
				.querySelector("pie-section-player-shell")
				?.setAttribute("dir", "rtl");
		});
		const rtl = await paneLefts();
		expect(rtl.passages).toBeGreaterThan(rtl.items + 50);
	});

	test("the toolbar pane hugs the trailing edge and follows the direction", async ({
		page,
	}) => {
		// Checklist point 3. The demo's toolbar pane is a vertical icon column,
		// so the direction-sensitive question is where the pane sits, not how a
		// row reads: a column stacks top-to-bottom in every writing direction and
		// the demo renders no horizontal toolbar with enough buttons to pin an
		// order flip (the audit note records that gap alongside the annotation
		// toolbar, the horizontal surface a future case would target). What
		// geometry can hold: the pane hugs the trailing viewport edge, and follows
		// the writing direction — right under LTR, left under the shipped `ar`
		// catalog's own stamps — with its divider on the content side.
		async function paneAndColumn(): Promise<{
			paneLeft: number;
			paneRight: number;
			ys: number[];
		}> {
			const buttons = page.locator(
				".pie-section-player-toolbar-pane pie-item-toolbar .item-toolbar button",
			);
			const ys = await buttons.evaluateAll((nodes) =>
				nodes
					.map((b) => b.getBoundingClientRect())
					.filter((r) => r.width > 0)
					.map((r) => Math.round(r.top)),
			);
			const pane = await page
				.locator(".pie-section-player-toolbar-pane")
				.first()
				.evaluate((el) => {
					const r = el.getBoundingClientRect();
					return { left: r.left, right: r.right };
				});
			return { paneLeft: pane.left, paneRight: pane.right, ys };
		}

		await page.setViewportSize(WIDE);
		await page.goto("/interface-locale", { waitUntil: "networkidle" });
		await expect(
			page.getByRole("button", { name: "Theme, change colors and contrast" }),
		).toBeVisible();
		const ltr = await paneAndColumn();
		// The pane hugs the trailing (right) viewport edge.
		expect(WIDE.width - ltr.paneRight).toBeLessThan(40);

		await page.goto("/interface-locale?locale=ar", { waitUntil: "networkidle" });
		await expect(
			page.getByRole("button", { name: "المظهر، تغيير الألوان والتباين" }),
		).toBeVisible();
		const rtl = await paneAndColumn();
		// And now the trailing (left) edge: the pane followed the direction.
		expect(rtl.paneLeft).toBeLessThan(40);
		// The column's reading order is direction-independent by design: the same
		// tools stack in the same top-to-bottom order under both.
		expect(rtl.ys).toEqual(ltr.ys);
	});

	test("the tool window's contents mirror while its screen position stays put", async ({
		page,
	}) => {
		// Checklist point 5: a tool window mounts at `document.body`, outside
		// every pane, and the two halves of its contract pull in opposite
		// directions. Its *contents* follow the writing direction — the window
		// stamps itself like any other chrome. Its *position* must not mirror:
		// a window is a screen-anchored, draggable thing, and the default
		// placement is physical (`style.left`/`style.top`). The graph tool is the
		// demo's science-gated shelled window.
		async function openGraphWindow(locale: string | null) {
			const url = locale
				? `/interface-locale?locale=${locale}`
				: "/interface-locale";
			await page.setViewportSize(WIDE);
			await page.goto(url, { waitUntil: "networkidle" });
			const name =
				locale === "ar"
					? "الرسم البياني، المستوى الإحداثي"
					: "Graph, coordinate plane";
			await page.getByRole("button", { name }).click();
			const shell = page.locator('[data-pie-tool-shell="graph"]');
			await expect(shell).toBeVisible();
			return page.evaluate(() => {
				const shell = document.querySelector('[data-pie-tool-shell="graph"]');
				const rect = shell!.getBoundingClientRect();
				// The imperative header's own hooks: the title span and the controls
				// cluster (drag-move buttons and the close control) sit at opposite
				// ends of a space-between flex row.
				const title = shell!.querySelector(".pie-tool-shell__title");
				const controls = shell!.querySelector(".pie-tool-shell__controls");
				return {
					left: rect.left,
					top: rect.top,
					width: rect.width,
					dir: shell!.getAttribute("dir"),
					titleX: title?.getBoundingClientRect().left ?? NaN,
					controlsX: controls?.getBoundingClientRect().left ?? NaN,
				};
			});
		}

		const ltr = await openGraphWindow(null);
		expect(ltr.dir).toBe("ltr");
		// Title leads, controls trail — the LTR reading order.
		expect(ltr.titleX).toBeLessThan(ltr.controlsX);

		const rtl = await openGraphWindow("ar");
		expect(rtl.dir).toBe("rtl");
		// Same header row, mirrored: the title now leads from the right.
		expect(rtl.titleX).toBeGreaterThan(rtl.controlsX);
		// And the window itself did not move: same screen anchor, same size.
		expect(Math.abs(rtl.left - ltr.left)).toBeLessThan(24);
		expect(Math.abs(rtl.top - ltr.top)).toBeLessThan(24);
		expect(Math.abs(rtl.width - ltr.width)).toBeLessThan(24);
	});

	test("nothing clips or overflows horizontally under the Arabic locale", async ({
		page,
	}) => {
		// Checklist point 8: Arabic script needs taller line boxes and wider
		// strings, so the metrics half of the audit is overflow — no string may
		// clip inside its control (a `scrollWidth` past the box) and no horizontal
		// scroll may appear on the page. Vertical growth is fine; that is the
		// line-box point.
		await page.setViewportSize(WIDE);
		await page.goto("/interface-locale?locale=ar", { waitUntil: "networkidle" });
		await expect(
			page.getByRole("button", { name: "المظهر، تغيير الألوان والتباين" }),
		).toBeVisible();

		// The chrome's controls live inside custom elements' open shadow roots, so
		// the sweep collects them through Playwright's piercing locator.
		const chromeControls = page.locator(
			"pie-section-player-shell button, pie-section-player-shell [data-region='footer'] p, pie-section-player-shell .pie-section-player-nav-status",
		);
		const clipped = await chromeControls.evaluateAll((nodes) =>
			nodes
				// The item players' content roots are the content-language channel —
				// PIE elements render their own direction from their own stamps, and
				// their internals are not interface chrome. This audit is chrome-only.
				.filter((el) => !el.closest(".pie-item-player"))
				.filter((el) => {
					const r = el.getBoundingClientRect();
					if (r.width === 0) return false;
					return el.scrollWidth > el.clientWidth + 2;
				})
				.map(
					(el) =>
						`${el.tagName.toLowerCase()}.${[...el.classList].join(".")}: ${el.scrollWidth} > ${el.clientWidth}`,
				),
		);
		const pageOverflowX = await page.evaluate(
			() => document.documentElement.scrollWidth - window.innerWidth,
		);

		expect(clipped).toEqual([]);
		expect(pageOverflowX).toBeLessThanOrEqual(1);
	});
});
