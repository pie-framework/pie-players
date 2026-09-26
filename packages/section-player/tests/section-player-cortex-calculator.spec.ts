import { expect, test } from "@playwright/test";
import { expectDemoChromeReady } from "../../../test-support/demo-menu";

function demoPath(player: "iife" | "esm" | "preloaded"): string {
	const params = new URLSearchParams({
		mode: "candidate",
		layout: "splitpane",
		player,
	});
	return `/calculator-cortex?${params}`;
}

// Section demos load the Cortex provider from its built chunks, and the
// provider evaluates in a module worker that starts when the calculator opens.
// The keys are pressed while the tool shell is still resizing the calculator it
// just opened, and the first evaluation waits on the worker's cold start.
for (const player of ["iife", "esm", "preloaded"] as const) {
	test(`Cortex calculator evaluates in its worker under the ${player} player`, async ({
		page,
	}) => {
		test.setTimeout(180_000);
		const workerScripts: string[] = [];
		page.on("request", (request) => {
			if (request.url().includes("evaluation-worker")) {
				workerScripts.push(request.url());
			}
		});

		await page.goto(demoPath(player), { waitUntil: "networkidle" });
		await expectDemoChromeReady(page);

		const calculatorButton = page
			.locator("pie-section-player-item-card")
			.first()
			.getByRole("button", { name: /^(basic |scientific )?calculator$/i });
		await expect(calculatorButton).toBeVisible({ timeout: 60_000 });
		expect(workerScripts).toEqual([]);
		await calculatorButton.click();
		const calculator = page
			.locator('[data-pie-tool-shell="calculator"]')
			.first();
		await expect(calculator).toBeVisible();

		for (const key of ["digit-7", "multiply", "digit-8"]) {
			await calculator.locator(`[data-key-id="${key}"]`).click();
		}
		await expect
			.poll(() =>
				calculator
					.locator("math-field")
					.evaluate(
						(element) => (element as HTMLElement & { value: string }).value,
					),
			)
			.toBe("7\\times8");
		expect(workerScripts).not.toEqual([]);

		await calculator.locator('[data-key-id="commit"]').click();
		await expect(
			calculator.locator(".pie-cortex-tape__result").first(),
		).toHaveText("56", { timeout: 30_000 });
	});
}
