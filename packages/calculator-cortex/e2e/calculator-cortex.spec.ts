import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const modes = [
	{ path: "/", mode: "basic", label: "Basic calculator", result: "4" },
	{
		path: "/scientific.html",
		mode: "scientific",
		label: "Scientific calculator",
		result: "0.5",
	},
	{
		path: "/graphing.html",
		mode: "graphing",
		label: "Graphing calculator",
		result: "",
	},
] as const;

test("serves every calculator mode as an isolated package demo", async ({
	page,
}) => {
	const externalRequests: string[] = [];
	page.on("request", (request) => {
		const url = new URL(request.url());
		if (url.hostname !== "127.0.0.1") externalRequests.push(request.url());
	});

	for (const demo of modes) {
		await page.goto(demo.path);
		await page.waitForFunction(() => window.__cortexReady === true);
		await expect
			.poll(() => page.evaluate(() => window.__cortexMode))
			.toBe(demo.mode);
		await expect(page.locator("math-field")).toHaveCount(1);
		await expect(page.getByRole("region", { name: demo.label })).toBeVisible();
		await expect(
			page.getByRole("navigation", { name: "Calculator modes" }),
		).toBeVisible();
		await expect(page.locator(`[data-mode-link="${demo.mode}"]`)).toHaveAttribute(
			"aria-current",
			"page",
		);
		await expect
			.poll(() => page.evaluate(() => window.__cortexResult))
			.toBe(demo.result);

		if (demo.mode === "graphing") {
			await expect(page.getByText("Series 1, solid: y=x^2")).toBeVisible();
			await expect(page.locator(".pie-cortex-jsxgraph svg")).toBeVisible();
			await expect
				.poll(() => page.locator(".pie-cortex-trace [role=status]").textContent())
				.not.toContain("No sampled graph point");
		}
	}

	expect(externalRequests).toEqual([]);
});

test("supports physical-keyboard commit without leaking calculator content", async ({
	page,
}) => {
	await page.goto("/");
	await page.waitForFunction(() => window.__cortexReady === true);
	await expect(
		page.locator("math-field").locator('[part="keyboard-sink"]'),
	).toHaveAttribute("aria-label", "Basic calculator expression");

	await page.evaluate(() => window.__cortexCalculator?.clear());
	await page
		.locator("math-field")
		.locator('[part="keyboard-sink"]')
		.focus();
	await page.keyboard.type("3+4");
	await page.keyboard.press("Enter");
	await expect
		.poll(() =>
			page.evaluate(() => window.__cortexCalculator?.getHistory?.()[0]?.result),
		)
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
});

test("has no serious or critical automated accessibility violations", async ({
	page,
}) => {
	for (const demo of modes) {
		await page.goto(demo.path);
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
		expect(material, `${demo.mode} demo accessibility`).toEqual([]);
	}
});
