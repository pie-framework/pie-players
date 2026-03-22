import { expect, test, type Locator, type Page } from "@playwright/test";

const DEMO_PATH = "/tts-ssml?mode=candidate&layout=splitpane";

type ToolSpec = {
	id: string;
	buttonAriaLabel: string;
	toolHostTag: string;
	panelRole: "dialog" | "application" | "group";
};

const SECTION_TOOL_SPECS: ToolSpec[] = [
	{
		id: "theme",
		buttonAriaLabel: "Theme - Change colors and contrast",
		toolHostTag: "pie-tool-theme",
		panelRole: "dialog",
	},
	{
		id: "graph",
		buttonAriaLabel: "Graph - Graphing calculator",
		toolHostTag: "pie-tool-graph",
		panelRole: "dialog",
	},
	{
		id: "periodicTable",
		buttonAriaLabel: "Periodic table - Chemistry reference",
		toolHostTag: "pie-tool-periodic-table",
		panelRole: "dialog",
	},
	{
		id: "protractor",
		buttonAriaLabel: "Open protractor tool",
		toolHostTag: "pie-tool-protractor",
		panelRole: "application",
	},
	{
		id: "lineReader",
		buttonAriaLabel: "Line reader - Reading guide",
		toolHostTag: "pie-tool-line-reader",
		panelRole: "group",
	},
	{
		id: "ruler",
		buttonAriaLabel: "Open ruler tool",
		toolHostTag: "pie-tool-ruler",
		panelRole: "application",
	},
];

async function gotoDemo(page: Page) {
	await page.goto(DEMO_PATH, { waitUntil: "networkidle" });
	await expect(page.getByRole("link", { name: "Student" })).toBeVisible();
}

function sectionToolbar(page: Page): Locator {
	return page
		.locator(".pie-section-player-toolbar-pane--right")
		.first()
		.locator("pie-section-toolbar")
		.first();
}

async function getComputedBackgroundColor(locator: Locator): Promise<string> {
	return await locator.evaluate((element) => getComputedStyle(element as HTMLElement).backgroundColor);
}

async function getRect(locator: Locator): Promise<{
	x: number;
	y: number;
	width: number;
	height: number;
}> {
	return await locator.evaluate((element) => {
		const rect = (element as HTMLElement).getBoundingClientRect();
		return {
			x: Math.round(rect.x),
			y: Math.round(rect.y),
			width: Math.round(rect.width),
			height: Math.round(rect.height),
		};
	});
}

test.describe("section toolbar tools", () => {
	test("stacks right-positioned section toolbar buttons vertically", async ({ page }) => {
		await gotoDemo(page);

		const toolbar = sectionToolbar(page);
		await expect(toolbar).toBeVisible();

		const buttons = toolbar.getByRole("button");
		await expect(buttons).toHaveCount(SECTION_TOOL_SPECS.length);

		const firstButtonRect = await getRect(buttons.nth(0));
		const secondButtonRect = await getRect(buttons.nth(1));

		// Right-positioned section tools should stack in a column.
		expect(secondButtonRect.y).toBeGreaterThan(firstButtonRect.y);
		expect(Math.abs(secondButtonRect.x - firstButtonRect.x)).toBeLessThanOrEqual(4);
	});

	test("renders expected section-level tool buttons in demo defaults", async ({ page }) => {
		test.setTimeout(180_000);
		await gotoDemo(page);

		const shell = page.locator("pie-section-player-shell").first();
		await expect(shell).toBeVisible();
		const shellUsesShadowDom = await shell.evaluate((element) =>
			Boolean((element as HTMLElement).shadowRoot),
		);
		expect(shellUsesShadowDom).toBe(true);

		const rightToolbarPane = page.locator(".pie-section-player-toolbar-pane--right").first();
		await expect(rightToolbarPane).toBeVisible();
		const layoutBody = page.locator(".pie-section-player-layout-body").first();
		await expect(layoutBody).toHaveClass(/pie-section-player-layout-body--inline-right/);
		await expect(rightToolbarPane.locator("pie-section-toolbar")).toHaveCount(1);

		const toolbar = sectionToolbar(page);
		await expect(toolbar).toHaveCount(1);
		await expect(toolbar).toBeVisible();
		await expect(toolbar.getByRole("button")).toHaveCount(SECTION_TOOL_SPECS.length);

		for (const spec of SECTION_TOOL_SPECS) {
			const button = toolbar.getByRole("button", {
				name: spec.buttonAriaLabel,
			});
			await expect(button, `Missing ${spec.id} button`).toBeVisible();
			await expect(button).toHaveAttribute("aria-pressed", "false");
			await button.click();
			await expect(button).toHaveAttribute("aria-pressed", "true");

			const host = page.locator(
				`${spec.toolHostTag}[tool-id^="${spec.id}:section:"]`,
			);
			await expect(host, `Missing ${spec.id} tool host`).toHaveCount(1);
			if (["protractor", "lineReader", "ruler"].includes(spec.id)) {
				await expect(host).toHaveAttribute("data-pie-tool-surface", "frameless");
			}
			if (spec.panelRole === "group") {
				await expect
					.poll(async () =>
						host.first().evaluate((element) => {
							const panel = element.shadowRoot?.querySelector(".pie-tool-line-reader");
							return panel?.getAttribute("role") || null;
						}),
					)
					.toBe("group");
			} else {
				await expect(host.locator(`[role="${spec.panelRole}"]`).first()).toBeVisible();
			}

			// Large dialog tools (e.g. graph) can cover the right toolbar; closing via the
			// hosted shell matches real UX and avoids Playwright "intercepts pointer events".
			// Inline tools (protractor, ruler, line reader) use toolbar toggle to close.
			if (spec.panelRole === "dialog") {
				const toolShell = page.locator(`[data-pie-tool-shell="${spec.id}"]`).first();
				await expect(toolShell.getByRole("button", { name: "Close tool" })).toBeVisible();
				await toolShell.getByRole("button", { name: "Close tool" }).click();
			} else {
				await button.click();
			}
			await expect(button).toHaveAttribute("aria-pressed", "false");
			await expect(host.locator(`[role="${spec.panelRole}"]`)).toHaveCount(0);
		}
	});

	test("uses top horizontal section toolbar when splitpane collapses", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 900, height: 900 });
		await gotoDemo(page);

		const splitDivider = page.getByRole("separator", {
			name: "Resize passages and items panels",
		});
		await expect(splitDivider).toHaveCount(0);

		await expect(page.locator(".pie-section-player-toolbar-pane--right")).toHaveCount(0);
		const themeButton = page.getByRole("button", {
			name: "Theme - Change colors and contrast",
		});
		const graphButton = page.getByRole("button", {
			name: "Graph - Graphing calculator",
		});
		await expect(themeButton).toBeVisible();
		await expect(graphButton).toBeVisible();

		const firstButtonRect = await getRect(themeButton);
		const secondButtonRect = await getRect(graphButton);

		// Collapsed splitpane should render top toolbar controls in a row.
		expect(secondButtonRect.x).toBeGreaterThan(firstButtonRect.x);
		expect(Math.abs(secondButtonRect.y - firstButtonRect.y)).toBeLessThanOrEqual(4);
	});

	test("restores hosted shell close button background after hover", async ({ page }) => {
		await gotoDemo(page);

		const toolbar = sectionToolbar(page);
		const graphButton = toolbar.getByRole("button", {
			name: "Graph - Graphing calculator",
		});
		await expect(graphButton).toBeVisible();
		await graphButton.click();
		await expect(graphButton).toHaveAttribute("aria-pressed", "true");

		const graphShell = page.locator('[data-pie-tool-shell="graph"]').first();
		await expect(graphShell).toBeVisible();
		const closeButton = graphShell.getByRole("button", { name: "Close tool" });
		await expect(closeButton).toBeVisible();

		const baseBackground = await getComputedBackgroundColor(closeButton);
		await closeButton.hover();
		await expect
			.poll(async () => await getComputedBackgroundColor(closeButton))
			.not.toBe(baseBackground);

		await page.mouse.move(0, 0);
		await expect
			.poll(async () => await getComputedBackgroundColor(closeButton))
			.toBe(baseBackground);
	});

	test("provides keyboard/single-action move and resize controls for hosted shells", async ({
		page,
	}) => {
		await gotoDemo(page);
		const toolbar = sectionToolbar(page);
		const graphButton = toolbar.getByRole("button", {
			name: "Graph - Graphing calculator",
		});
		await graphButton.click();

		const graphShell = page.locator('[data-pie-tool-shell="graph"]').first();
		await expect(graphShell).toBeVisible();

		const moveRight = graphShell.getByRole("button", { name: "Move tool right" });
		const grow = graphShell.getByRole("button", { name: "Grow tool window" });
		const center = graphShell.getByRole("button", { name: "Center tool window" });

		await expect(moveRight).toBeVisible();
		await expect(grow).toBeVisible();
		await expect(center).toBeVisible();

		const before = await getRect(graphShell);
		await moveRight.click();
		const moved = await getRect(graphShell);
		expect(moved.x).toBeGreaterThan(before.x);

		await grow.click();
		const resized = await getRect(graphShell);
		expect(resized.width).toBeGreaterThanOrEqual(moved.width);
		expect(resized.height).toBeGreaterThanOrEqual(moved.height);

		const header = graphShell.locator(".pie-tool-shell__header");
		await header.focus();
		await page.keyboard.press("ArrowLeft");
		const movedByKeyboard = await getRect(graphShell);
		expect(movedByKeyboard.x).toBeLessThanOrEqual(resized.x);
	});

	test("exposes split divider semantics and keyboard resizing in splitpane layout", async ({
		page,
	}) => {
		await gotoDemo(page);

		const divider = page.getByRole("separator", {
			name: "Resize passages and items panels",
		});
		await expect(divider).toBeVisible();
		await expect(divider).toHaveAttribute("aria-orientation", "vertical");
		await expect(divider).toHaveAttribute("aria-valuemin", "20");
		await expect(divider).toHaveAttribute("aria-valuemax", "80");

		const controlledPaneId = await divider.getAttribute("aria-controls");
		expect(controlledPaneId).toBeTruthy();
		await expect(page.locator(`#${controlledPaneId}`)).toBeVisible();

		await divider.focus();
		await expect(divider).toBeFocused();
		await expect(divider).toHaveAttribute("aria-valuenow", "50");
		await page.keyboard.press("ArrowRight");
		await expect(divider).toHaveAttribute("aria-valuenow", "55");
		await page.keyboard.press("End");
		await expect(divider).toHaveAttribute("aria-valuenow", "80");
		await page.keyboard.press("Home");
		await expect(divider).toHaveAttribute("aria-valuenow", "20");
	});
});
