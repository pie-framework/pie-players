import { expect, test } from "@playwright/test";
import { expectDemoChromeReady } from "../../../test-support/demo-menu";

function demoPath(player: "iife" | "esm"): string {
	const params = new URLSearchParams({
		mode: "candidate",
		layout: "splitpane",
		player,
	});
	// npm `latest` of multiple-choice is the legacy line, which publishes no
	// browser ESM build.
	if (player === "esm") {
		params.set("pie-overrides[@pie-element/multiple-choice]", "13.4.0-next.13");
	}
	return `/calculator-cortex?${params}`;
}

// Section demos load the Cortex provider from its built chunks, and the
// provider evaluates in a module worker.
for (const player of ["iife", "esm"] as const) {
	test(`Cortex calculator evaluates in its worker under the ${player} player`, async ({
		page,
	}) => {
		test.setTimeout(180_000);
		const workers: string[] = [];
		page.on("worker", (worker) => workers.push(worker.url()));

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
		// While a cold dev server is still serving the provider, a press can be lost
		// and the first evaluation can outlast its time limit, which includes
		// starting the worker. Each attempt starts from a cleared field.
		await expect(async () => {
			await calculator
				.getByRole("button", { name: "Clear", exact: true })
				.click();
			for (const key of ["digit-7", "multiply", "digit-8"]) {
				await calculator.locator(`[data-key-id="${key}"]`).click();
			}
			await expect
				.poll(() =>
					field.evaluate(
						(element) => (element as HTMLElement & { value: string }).value,
					),
				)
				.toBe("7\\times8");
			await calculator.locator('[data-key-id="commit"]').click();
			await expect(
				calculator.locator(".pie-cortex-tape__result").first(),
			).toHaveText("56", { timeout: 5_000 });
		}).toPass({ timeout: 120_000 });
		expect(workers.some((url) => url.includes("evaluation-worker"))).toBe(true);
	});
}
