import { expect, test } from "@playwright/test";

// The toolkit composed around one item with no section player. The host's
// resolver reads the profile, so each profile change below is a policy change
// the toolbar has to follow without a reload. Tall enough that the open graphing
// shell, anchored bottom-left, leaves the profile controls clickable.
test.use({ viewport: { width: 1280, height: 1100 } });

test("the calculator's visibility and flavor follow a profile change mid-session", async ({
	page,
}) => {
	test.setTimeout(120_000);
	await page.goto("/calculator-pnp", { waitUntil: "networkidle" });

	const toolbar = page.locator(
		'[data-testid="calculator-pnp-item"] pie-item-toolbar',
	);
	const profile = page.getByTestId("calculator-pnp-profile");
	const calculatorButton = toolbar.getByRole("button", {
		name: /calculator$/i,
	});
	const shell = page.locator('[data-pie-tool-shell="calculator"]');
	const container = shell.locator(
		".pie-tool-calculator__container[data-calculator-type]",
	);

	await expect(
		toolbar.getByRole("button", { name: "Scientific Calculator" }),
	).toBeVisible({ timeout: 60_000 });
	await calculatorButton.click();
	await expect(container).toHaveAttribute("data-calculator-type", "scientific");

	await profile.getByLabel("calculator + graphingCalculator").check();
	await expect(
		toolbar.getByRole("button", { name: "Graphing Calculator" }),
	).toBeVisible();
	await expect(container).toHaveAttribute("data-calculator-type", "graphing");
	await expect(shell.locator(".pie-tool-shell__title")).toHaveText(
		"Graphing Calculator",
	);

	await profile.getByLabel("No calculator").check();
	await expect(calculatorButton).toHaveCount(0);
	await expect(shell).toBeHidden();
});
