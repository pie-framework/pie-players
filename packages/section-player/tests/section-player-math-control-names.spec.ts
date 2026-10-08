import { expect, type Page, test } from "@playwright/test";

/**
 * The assessment toolkit labels the math inside a control with SRE's speech,
 * which puts that speech in the control's name (PIE-1153). The demo's second
 * choice holds (x - 2)(x - 3), which the IIFE element leaves unlabelled.
 */
const CHOICE_NAME =
	/factors easily into open paren x minus 2 close paren times open paren x minus 3 close paren$/;
const CHOICE_MATH = "pie-item-scope label mjx-container";

async function gotoDemo(page: Page, player: "iife" | "esm"): Promise<void> {
	await page.goto(
		`/tts-generated-ssml?mode=candidate&layout=splitpane&player=${player}`,
		{ waitUntil: "networkidle" },
	);
}

test.describe("section player math control names", () => {
	for (const player of ["iife", "esm"] as const) {
		test(`names the math in a choice with its speech (${player})`, async ({
			page,
		}) => {
			await gotoDemo(page, player);

			await expect(page.getByRole("radio", { name: CHOICE_NAME })).toBeAttached(
				{ timeout: 30_000 },
			);
		});
	}

	test("names the math again when MathJax replaces it", async ({ page }) => {
		await gotoDemo(page, "iife");
		const choice = page.getByRole("radio", { name: CHOICE_NAME });
		await expect(choice).toBeAttached({ timeout: 30_000 });

		await page.locator(CHOICE_MATH).evaluate((container) => {
			const replacement = container.cloneNode(true) as Element;
			replacement.removeAttribute("aria-label");
			container.replaceWith(replacement);
		});

		await expect(page.locator(CHOICE_MATH)).toHaveAttribute(
			"aria-label",
			/open paren x minus 2/,
		);
		await expect(choice).toBeAttached();
	});
});
