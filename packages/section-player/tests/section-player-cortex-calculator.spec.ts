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

// Section demos load the Cortex provider from its built chunks. The spec ends
// once the evaluation worker's script is served: the first evaluation's time
// limit covers the worker's cold start, which a CI runner exceeds, and each
// timeout starts the worker cold again.
for (const player of ["iife", "esm", "preloaded"] as const) {
	test(`Cortex calculator opens and starts its worker under the ${player} player`, async ({
		page,
	}) => {
		test.setTimeout(180_000);
		const workerScripts: number[] = [];
		page.on("response", (response) => {
			if (response.url().includes("evaluation-worker")) {
				workerScripts.push(response.status());
			}
		});

		await page.goto(demoPath(player), { waitUntil: "networkidle" });
		await expectDemoChromeReady(page);

		const calculatorButton = page
			.locator("pie-section-player-item-card")
			.first()
			.getByRole("button", { name: /^(basic |scientific )?calculator$/i });
		await expect(calculatorButton).toBeVisible({ timeout: 60_000 });
		await calculatorButton.click();
		const calculator = page
			.locator('[data-pie-tool-shell="calculator"]')
			.first();
		await expect(calculator).toBeVisible();

		const field = calculator.locator("math-field");
		// A press made while the keypad settles can be lost, so each attempt
		// starts from a cleared field.
		await expect(async () => {
			await calculator
				.getByRole("button", { name: "Clear", exact: true })
				.click();
			for (const key of ["digit-7", "multiply", "digit-8"]) {
				await calculator.locator(`[data-key-id="${key}"]`).click();
			}
			await expect
				.poll(
					() =>
						field.evaluate(
							(element) => (element as HTMLElement & { value: string }).value,
						),
					{ timeout: 5_000 },
				)
				.toBe("7\\times8");
		}).toPass({ timeout: 60_000 });

		await calculator.locator('[data-key-id="commit"]').click();
		await expect.poll(() => workerScripts, { timeout: 30_000 }).toContain(200);
	});
}
