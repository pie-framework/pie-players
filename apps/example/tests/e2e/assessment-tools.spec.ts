import { test, expect } from "@playwright/test";

const EXPECTED_TOOLS_NO_MAGNIFIER: Array<{
	label: string;
	tag: string;
}> = [
	{ label: "Calculator", tag: "pie-tool-calculator" },
	{ label: "Graph", tag: "pie-tool-graph" },
	{ label: "Periodic Table", tag: "pie-tool-periodic-table" },
	{ label: "Protractor", tag: "pie-tool-protractor" },
	{ label: "Line Reader", tag: "pie-tool-line-reader" },
	{ label: "Ruler", tag: "pie-tool-ruler" },
];

const MAGNIFIER_TOOL = { label: "Magnifier", tag: "pie-tool-magnifier" };

const OPEN_LOCATOR_BY_TAG: Record<
	string,
	{ role: "dialog" | "application"; name: RegExp }
> = {
	"pie-tool-calculator": { role: "dialog", name: /Calculator tool/i },
	"pie-tool-graph": { role: "dialog", name: /Graph Tool/i },
	"pie-tool-periodic-table": { role: "dialog", name: /Periodic Table/i },
	"pie-tool-protractor": { role: "application", name: /Protractor tool/i },
	"pie-tool-line-reader": { role: "application", name: /Line Reader tool/i },
	"pie-tool-ruler": { role: "application", name: /Ruler tool/i },
};

test("assessment demo: bottom tools render and toggle open/closed", async ({
	page,
}) => {
	test.setTimeout(120_000);
	await page.goto("/assessment/");

	// Wait for the setup UI to be ready (stable selectors).
	await expect(
		page.locator('select[aria-label="Select assessment template"]'),
	).toBeVisible({ timeout: 30_000 });

	// Start the assessment (enables the real player shell).
	const startBtn = page.getByRole("button", { name: "Start" });
	await expect(startBtn).toBeEnabled();
	await startBtn.click();

	// Confirm the page switched to "started" state.
	await expect(page.getByRole("button", { name: "Back to setup" })).toBeVisible();

	const player = page.locator("pie-assessment-player");
	await expect(player).toBeAttached();
	await expect(player).toBeVisible();

	// Bottom tools strip
	const toolbar = player.locator("pie-tool-toolbar");
	await expect(toolbar).toBeVisible();

	// Buttons render
	for (const tool of [...EXPECTED_TOOLS_NO_MAGNIFIER, MAGNIFIER_TOOL]) {
		await expect(toolbar.getByRole("button", { name: tool.label })).toBeVisible();
	}

	// Open each tool once and verify it becomes visible.
	// Then close it again when possible, so overlays don't block subsequent toolbar clicks.
	for (const tool of EXPECTED_TOOLS_NO_MAGNIFIER) {
		// Scope to the toolbar button strip so we don't accidentally match tool-internal
		// buttons like "Close calculator" or "Calculator settings".
		const button = toolbar
			.locator(".tool-toolbar__buttons")
			.getByRole("button", { name: tool.label, exact: true });
		await button.click({ force: true });

		const openMeta = OPEN_LOCATOR_BY_TAG[tool.tag];
		await expect(
			page.getByRole(openMeta.role, { name: openMeta.name }),
		).toBeVisible({ timeout: 10_000 });

		// Close only when the tool provides an explicit close button.
		// (Some tools like ruler/line-reader are designed as persistent overlays without a close UI.)
		if (tool.tag !== "pie-tool-ruler") {
			const toolEl = page.locator(
				`pie-assessment-player pie-tool-toolbar ${tool.tag}`,
			);
			const closeBtn = toolEl.locator('button[aria-label^="Close"]');
			if (await closeBtn.count()) {
				await closeBtn.first().click();

				await expect(
					page.getByRole(openMeta.role, { name: openMeta.name }),
				).toBeHidden({ timeout: 10_000 });
			}
		}
	}

	// Magnifier: verify it opens and renders the magnifier region, then close it.
	{
		const button = toolbar
			.locator(".tool-toolbar__buttons")
			.getByRole("button", { name: MAGNIFIER_TOOL.label, exact: true });

		await button.click();

		await expect(
			page.getByRole("region", { name: "Content magnifier" }),
		).toBeVisible({ timeout: 10_000 });
	}
});

