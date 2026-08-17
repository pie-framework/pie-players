import { expect, test } from "@playwright/test";
import { expectDemoChromeReady } from "../../../test-support/demo-menu";

/**
 * The panels are QA and developer surfaces, so their obligation is to the person
 * inspecting a section rather than to a test taker. They were failing that: each
 * read DaisyUI's `--color-*` slots directly, so under a colour scheme the panel
 * chrome stayed light while the page around it went dark.
 *
 * `packages/section-player-tools-shared/tests/panel-theming.test.ts` guards the
 * source. This checks the other half, that the tokens resolve to something legible
 * once the panel is actually mounted inside a themed page.
 */
const PANELS = [
	{ label: "Toggle session panel", surface: ".pie-shared-floating-panel" },
	{
		label: "Toggle event broadcast panel",
		surface: ".pie-section-player-tools-event-debugger",
	},
];

test.describe("debug panels under a colour scheme", () => {
	test("keep their chrome legible on a dark scheme", async ({ page }) => {
		await page.setViewportSize({ width: 1400, height: 1000 });
		await page.goto("/tts-ssml?mode=candidate&layout=splitpane", {
			waitUntil: "networkidle",
		});
		await expectDemoChromeReady(page);

		for (const panel of PANELS) {
			const toggle = page.getByRole("button", { name: panel.label });
			if ((await toggle.count()) === 0) continue;
			await toggle.first().click();
		}

		const readings: Record<string, { light: number; dark: number }> = {};
		const surfaces: Record<string, string[]> = {};

		for (const schemeId of ["black-on-white", "white-on-black"]) {
			await page.evaluate(async (id) => {
				const host =
					document.querySelector('pie-theme[scope="document"]') ||
					document.querySelector("pie-theme");
				host?.setAttribute("scheme", id);
				await new Promise((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(resolve)),
				);
			}, schemeId);
			await page.waitForTimeout(150);

			for (const panel of PANELS) {
				const element = page.locator(panel.surface).first();
				if ((await element.count()) === 0) continue;

				const measured = await element.evaluate((node) => {
					const canvas = document.createElement("canvas");
					canvas.width = 1;
					canvas.height = 1;
					const context = canvas.getContext("2d", {
						willReadFrequently: true,
					});
					if (!context) throw new Error("Canvas color parser unavailable");
					const luminance = (value: string) => {
						context.clearRect(0, 0, 1, 1);
						context.fillStyle = "rgba(1, 2, 3, 0.5)";
						context.fillStyle = value;
						context.fillRect(0, 0, 1, 1);
						const channels = [
							...context.getImageData(0, 0, 1, 1).data.slice(0, 3),
						].map((channel) => {
							const normalized = channel / 255;
							return normalized <= 0.04045
								? normalized / 12.92
								: ((normalized + 0.055) / 1.055) ** 2.4;
						});
						return (
							0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
						);
					};
					const ratio = (foreground: string, background: string) => {
						const a = luminance(foreground);
						const b = luminance(background);
						return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
					};
					const style = getComputedStyle(node);
					return {
						surface: style.backgroundColor,
						ink: style.color,
						text: ratio(style.color, style.backgroundColor),
					};
				});

				expect(
					measured.text,
					`${panel.surface} on ${schemeId} (${measured.ink} on ${measured.surface})`,
				).toBeGreaterThanOrEqual(4.5);
				readings[panel.surface] ??= { light: 0, dark: 0 };
				readings[panel.surface][
					schemeId === "black-on-white" ? "light" : "dark"
				] = measured.text;
				(surfaces[panel.surface] ??= []).push(measured.surface);
			}
		}

		expect(
			Object.keys(readings).length,
			"no debug panel was mounted, so nothing was measured",
		).toBeGreaterThan(0);

		// The ratios above would also pass on the old DaisyUI-slot version, whose
		// panel stayed light on both schemes. The surface having to differ between a
		// light and a dark scheme is what says the panel follows the scheme at all.
		for (const [selector, values] of Object.entries(surfaces)) {
			expect(
				new Set(values).size,
				`${selector} surface across schemes: ${values.join(" / ")}`,
			).toBeGreaterThan(1);
		}
	});
});
