import { expect, test, type Locator, type Page } from "@playwright/test";

const DEMO_PATH = "/demo/tts-ssml?mode=candidate&layout=splitpane";

type ToolSpec = {
	id: string;
	buttonAriaLabel: string;
	toolHostTag: string;
	panelRole: "dialog" | "application";
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
		panelRole: "application",
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

test.describe("section toolbar tools", () => {
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
			await expect(host.locator(`[role="${spec.panelRole}"]`).first()).toBeVisible();

			await button.click();
			await expect(button).toHaveAttribute("aria-pressed", "false");
			await expect(host.locator(`[role="${spec.panelRole}"]`)).toHaveCount(0);
		}
	});
});
