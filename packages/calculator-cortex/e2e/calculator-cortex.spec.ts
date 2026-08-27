import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

function contrastRatio(foreground: string, background: string): number {
	const parse = (value: string): [number, number, number] => {
		const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
		if (!channels || channels.length !== 3) {
			throw new Error(`Expected an RGB color, received ${value}`);
		}
		return channels as [number, number, number];
	};
	const luminance = (value: string): number => {
		const channels = parse(value).map((channel) => {
			const normalized = channel / 255;
			return normalized <= 0.04045
				? normalized / 12.92
				: ((normalized + 0.055) / 1.055) ** 2.4;
		});
		return (channels[0] ?? 0) * 0.2126 + (channels[1] ?? 0) * 0.7152 + (channels[2] ?? 0) * 0.0722;
	};
	const first = luminance(foreground);
	const second = luminance(background);
	return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

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

test("applies locale, RTL, and explicit theme configuration in isolation", async ({
	page,
}) => {
	await page.goto("/");
	await page.waitForFunction(() => window.__cortexReady === true);

	await page.locator("#locale").selectOption("nl-NL");
	await page.waitForFunction(() => window.__cortexReady === true);
	const calculator = page.getByRole("region", {
		name: "Eenvoudige rekenmachine",
	});
	await expect(calculator).toHaveAttribute("lang", "nl-NL");
	await expect(calculator).toHaveAttribute("dir", "ltr");
	await expect(calculator.getByRole("button", { name: "Bereken" })).toBeVisible();
	await expect(
		page.locator("math-field").locator('[part="keyboard-sink"]'),
	).toHaveAttribute("aria-label", "Uitdrukking voor Eenvoudige rekenmachine");
	await page.evaluate(() => window.__cortexCalculator?.clear());
	await calculator.getByRole("button", { name: "Bereken" }).click();
	await expect(calculator.getByRole("alert")).toHaveText(
		"Controleer de uitdrukking en probeer het opnieuw.",
	);

	await page.locator("#direction").selectOption("rtl");
	await page.waitForFunction(() => window.__cortexReady === true);
	await expect(
		page.getByRole("region", { name: "Eenvoudige rekenmachine" }),
	).toHaveAttribute("dir", "rtl");

	await page.locator("#theme").selectOption("dark");
	await page.waitForFunction(() => window.__cortexReady === true);
	const darkCalculator = page.getByRole("region", {
		name: "Eenvoudige rekenmachine",
	});
	await expect(darkCalculator).toHaveAttribute("data-pie-theme", "dark");
	await expect
		.poll(() => darkCalculator.evaluate((element) => getComputedStyle(element).backgroundColor))
		.toBe("rgb(17, 24, 39)");
});

test("applies host graph-series theme hooks to the swatch and curve", async ({
	page,
}) => {
	await page.addInitScript(() => {
		document.addEventListener("DOMContentLoaded", () => {
			document
				.querySelector<HTMLElement>("#calculator")
				?.style.setProperty("--pie-calculator-series-1", "rgb(255, 0, 255)");
		});
	});
	await page.goto("/graphing.html");
	await page.waitForFunction(() => window.__cortexReady === true);
	const swatch = page.locator(".pie-cortex-series-swatch--color-1");
	await expect
		.poll(() => swatch.evaluate((element) => getComputedStyle(element).borderTopColor))
		.toBe("rgb(255, 0, 255)");
	await expect
		.poll(async () =>
			page
				.locator(".pie-cortex-jsxgraph svg path")
				.evaluateAll((paths) => paths.map((path) => path.getAttribute("stroke")))
				.then((strokes) => strokes.includes("#ff00ff") || strokes.includes("rgb(255, 0, 255)")),
		)
		.toBe(true);
});

test("keeps every built-in dark-theme series above non-text contrast", async ({
	page,
}) => {
	await page.goto("/graphing.html");
	await page.waitForFunction(() => window.__cortexReady === true);
	await page.locator("#theme").selectOption("dark");
	await page.waitForFunction(() => window.__cortexReady === true);
	const addExpression = page.getByRole("button", { name: "Add expression" });
	for (let index = 1; index < 6; index += 1) await addExpression.click();
	const swatches = page.locator(".pie-cortex-series-swatch");
	await expect(swatches).toHaveCount(6);
	const background = await page
		.locator(".pie-cortex-jsxgraph")
		.evaluate((element) => getComputedStyle(element).backgroundColor);
	for (let index = 0; index < 6; index += 1) {
		const foreground = await swatches
			.nth(index)
			.evaluate((element) => getComputedStyle(element).borderTopColor);
		expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(3);
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
