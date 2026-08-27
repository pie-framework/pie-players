import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("runs all modes from bundled assets without external network requests", async ({
	page,
}) => {
	const externalRequests: string[] = [];
	page.on("request", (request) => {
		const url = new URL(request.url());
		if (url.hostname !== "127.0.0.1") externalRequests.push(request.url());
	});

	await page.goto("/");
	await page.waitForFunction(() => window.__cortexReady === true);

	await expect
		.poll(() => page.evaluate(() => window.__cortexResults))
		.toEqual({ basic: "4", scientific: "0.5" });
	await expect(page.locator("math-field")).toHaveCount(3);
	await expect(
		page.locator("math-field").first().locator('[part="keyboard-sink"]'),
	).toHaveAttribute("aria-label", "Basic calculator expression");
	await expect(page.getByRole("region", { name: "Basic calculator" })).toBeVisible();
	await expect(
		page.getByRole("region", { name: "Scientific calculator" }),
	).toBeVisible();
	await expect(page.getByText("Series 1, solid: y=x^2")).toBeVisible();
	await expect(page.locator(".pie-cortex-jsxgraph svg")).toBeVisible();
	await expect
		.poll(() => page.locator(".pie-cortex-trace [role=status]").textContent())
		.not.toContain("No sampled graph point");

	await page.evaluate(() => window.__cortexCalculators?.[0]?.clear());
	await page
		.locator("math-field")
		.first()
		.locator('[part="keyboard-sink"]')
		.focus();
	await page.keyboard.type("3+4");
	await page.keyboard.press("Enter");
	await expect
		.poll(() => page.evaluate(() => window.__cortexCalculators?.[0]?.getHistory?.()[0]?.result))
		.toBe("7");
	const telemetry = await page.evaluate(() => window.__cortexTelemetry ?? []);
	expect(
		telemetry.some((entry) => entry.eventName === "pie-tool-operation-success"),
	).toBe(true);
	for (const entry of telemetry) {
		const keys = Object.keys(entry.payload ?? {});
		for (const privateKey of [
			"expression",
			"latex",
			"result",
			"state",
			"history",
			"coordinates",
		]) {
			expect(keys).not.toContain(privateKey);
		}
	}
	expect(externalRequests).toEqual([]);
});

test("has no serious or critical automated accessibility violations", async ({
	page,
}) => {
	await page.goto("/");
	await page.waitForFunction(() => window.__cortexReady === true);
	const results = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
		// MathLive intentionally implements its editable custom element with a
		// single named keyboard sink in its open shadow root. Axe treats the host's
		// ElementInternals semantics as a second control even after the host is
		// removed from the tab order, producing a nested-control false positive.
		.disableRules(["nested-interactive"])
		.analyze();
	const material = results.violations.filter(
		(violation) =>
			violation.impact === "serious" || violation.impact === "critical",
	);
	expect(material).toEqual([]);
});
