import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

function contrastRatio(foreground: string, background: string): number {
	const parse = (value: string): [number, number, number] => {
		// SVG carries its colours as presentation attributes, so an axis stroke read
		// with `getAttribute` comes back as hex while a computed style comes back as
		// `rgb()`. Both reach this helper.
		const hex = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
		if (hex) {
			const full =
				hex.length === 3
					? hex
							.split("")
							.map((digit) => digit + digit)
							.join("")
					: hex;
			return [0, 2, 4].map((index) =>
				Number.parseInt(full.slice(index, index + 2), 16),
			) as [number, number, number];
		}
		const channels = value.match(/[\d.]+/g)?.map(Number);
		if (!channels || channels.length < 3) {
			throw new Error(`Expected an RGB or hex color, received ${value}`);
		}
		// Alpha is rejected rather than dropped. `.slice(0, 3)` used to discard it,
		// which would have scored a transparent surface against whatever the first
		// three channels happened to be — certifying an illegible pairing as passing.
		// The canonical light theme publishes `--pie-background` as
		// `rgba(255, 255, 255, 0)`, so this is a reachable case, not a hypothetical.
		if (channels.length > 3 && channels[3] !== 1) {
			throw new Error(
				`Expected an opaque color, received ${value}. A translucent surface has no fixed contrast.`,
			);
		}
		return channels.slice(0, 3) as [number, number, number];
	};
	const luminance = (value: string): number => {
		const channels = parse(value).map((channel) => {
			const normalized = channel / 255;
			return normalized <= 0.04045
				? normalized / 12.92
				: ((normalized + 0.055) / 1.055) ** 2.4;
		});
		return (
			(channels[0] ?? 0) * 0.2126 +
			(channels[1] ?? 0) * 0.7152 +
			(channels[2] ?? 0) * 0.0722
		);
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
		await expect(
			page.locator(`[data-mode-link="${demo.mode}"]`),
		).toHaveAttribute("aria-current", "page");
		await expect
			.poll(() => page.evaluate(() => window.__cortexResult))
			.toBe(demo.result);

		if (demo.mode === "graphing") {
			await expect(page.getByText("Series 1, solid: y=x^2")).toBeVisible();
			await expect(page.locator(".pie-cortex-jsxgraph svg")).toBeVisible();
			await expect
				.poll(() =>
					page.locator(".pie-cortex-trace [role=status]").textContent(),
				)
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
	await page.locator("math-field").locator('[part="keyboard-sink"]').focus();
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
	await expect(
		calculator.getByRole("button", { name: "Bereken" }),
	).toBeVisible();
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
		.poll(() =>
			darkCalculator.evaluate(
				(element) => getComputedStyle(element).backgroundColor,
			),
		)
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
	// The series chip is both the legend and the show/hide control, and it carries
	// its series colour as `color` so the rule inside it inherits via `currentcolor`.
	const chip = page.locator(".pie-cortex-series-chip--color-1");
	await expect
		.poll(() => chip.evaluate((element) => getComputedStyle(element).color))
		.toBe("rgb(255, 0, 255)");
	await expect
		.poll(async () =>
			page
				.locator(".pie-cortex-jsxgraph svg path")
				.evaluateAll((paths) =>
					paths.map((path) => path.getAttribute("stroke")),
				)
				.then(
					(strokes) =>
						strokes.includes("#ff00ff") || strokes.includes("rgb(255, 0, 255)"),
				),
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
	const chips = page.locator(".pie-cortex-series-chip");
	await expect(chips).toHaveCount(6);
	const background = await page
		.locator(".pie-cortex-jsxgraph")
		.evaluate((element) => getComputedStyle(element).backgroundColor);
	for (let index = 0; index < 6; index += 1) {
		const foreground = await chips
			.nth(index)
			.evaluate((element) => getComputedStyle(element).color);
		expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(3);
	}
});

test("keeps the dark-theme plot axes and tick labels legible", async ({
	page,
}) => {
	/*
	 * The plot div is `aria-hidden`, so axe never evaluates anything inside it — this
	 * is the only gate on it. JSXGraph was previously initialised with bare
	 * `axis: true` / `grid: true` and used its light defaults in every theme: tick
	 * labels came out `fill: rgb(0, 0, 0)` on a `#1f2937` plot, 1.43:1, and axes
	 * `#666666` at about 2.2:1. Tick labels are text (1.4.3, 4.5:1); axes are a
	 * graphical object (1.4.11, 3:1).
	 */
	await page.goto("/graphing.html");
	await page.waitForFunction(() => window.__cortexReady === true);
	await page.locator("#theme").selectOption("dark");
	await page.waitForFunction(() => window.__cortexReady === true);
	await expect(page.locator(".pie-cortex-jsxgraph svg")).toBeVisible();

	const background = await page
		.locator(".pie-cortex-jsxgraph")
		.evaluate((element) => getComputedStyle(element).backgroundColor);

	const tickFills = await page
		.locator(".pie-cortex-jsxgraph text")
		.evaluateAll((nodes) =>
			nodes.map((node) => getComputedStyle(node).fill).filter(Boolean),
		);
	expect(tickFills.length).toBeGreaterThan(0);
	for (const fill of tickFills) {
		expect(contrastRatio(fill, background)).toBeGreaterThanOrEqual(4.5);
	}

	const axisStrokes = await page
		.locator(".pie-cortex-jsxgraph line")
		.evaluateAll((nodes) =>
			nodes
				.map((node) => node.getAttribute("stroke"))
				.filter((stroke): stroke is string => Boolean(stroke)),
		);
	expect(axisStrokes.length).toBeGreaterThan(0);
	for (const stroke of axisStrokes) {
		expect(contrastRatio(stroke, background)).toBeGreaterThanOrEqual(3);
	}
});

test("keeps the keypad to a single tab stop and writes through the mathfield", async ({
	page,
}) => {
	/*
	 * A real `<button>` per key would put 20-35 stops between the display and
	 * everything after it — one scan step each for switch access, and all of it
	 * redundant for anyone who can type. Arrow keys move within the keypad instead.
	 */
	await page.goto("/scientific.html");
	await page.waitForFunction(() => window.__cortexReady === true);

	const keys = page.locator(".pie-cortex-key");
	await expect(keys.first()).toBeVisible();
	expect(
		await keys.evaluateAll(
			(nodes) =>
				nodes.filter((node) => node.getAttribute("tabindex") === "0").length,
		),
	).toBe(1);

	await page.evaluate(() => window.__cortexCalculator?.clear());
	await page.getByRole("button", { name: "7", exact: true }).click();
	await page.getByRole("button", { name: "Plus" }).click();
	await page.getByRole("button", { name: "3", exact: true }).click();
	await expect
		.poll(() => page.evaluate(() => window.__cortexCalculator?.getValue()))
		.toBe("7+3");

	// Every key whose visible label is a word carries that word in its accessible
	// name — WCAG 2.5.3, and what voice control speaks.
	for (const [label, name] of [
		["sin", "sin, sine"],
		["ln", "ln, natural logarithm"],
	] as const) {
		await page.getByRole("button", { name: "Scientific", exact: true }).click();
		const key = page.getByRole("button", { name });
		await expect(key).toBeVisible();
		expect((await key.textContent())?.trim()).toContain(label);
	}
});

test("fills its panel at the shipped tool size without clipping", async ({
	page,
}) => {
	/*
	 * The shipped panel is 380px wide inside a viewport that is far wider, so the
	 * package's size-dependent rules are container queries. When they were viewport
	 * media queries the graphing grid stayed at its 34rem floor inside a 333px box
	 * and the shell — which sets `overflow-x: hidden` — clipped the right 229px,
	 * most of the plot.
	 */
	for (const path of ["/", "/scientific.html", "/graphing.html"]) {
		await page.goto(path);
		await page.waitForFunction(() => window.__cortexReady === true);
		await page.locator("#panel").selectOption("shell");
		await page.waitForTimeout(400);
		const box = await page.locator("#calculator").evaluate((element) => ({
			clientWidth: element.clientWidth,
			scrollWidth: element.scrollWidth,
			clientHeight: element.clientHeight,
			scrollHeight: element.scrollHeight,
		}));
		expect(box.scrollWidth, `${path} scrolls sideways`).toBeLessThanOrEqual(
			box.clientWidth,
		);
		expect(box.scrollHeight, `${path} overflows its panel`).toBeLessThanOrEqual(
			box.clientHeight + 1,
		);
	}
});

test("has no serious or critical automated accessibility violations", async ({
	page,
}) => {
	// Both themes. The scan used to run light only — the demo defaults to `auto` and
	// headless Chromium reports `prefers-color-scheme: light` — so every dark-theme
	// contrast defect, including the plot's black tick labels, was outside the gate.
	for (const theme of ["light", "dark"] as const)
		for (const demo of modes) {
			await page.goto(demo.path);
			await page.waitForFunction(() => window.__cortexReady === true);
			await page.locator("#theme").selectOption(theme);
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
			expect(material, `${demo.mode} ${theme} demo accessibility`).toEqual([]);
			// `heading-order` is only "moderate", so the filter above cannot fail on it —
			// and it is exactly what breaks if the calculator's own `h2` is ever demoted
			// to a span while the graph view keeps its `h3`s.
			expect(
				results.violations.filter(
					(violation) => violation.id === "heading-order",
				),
				`${demo.mode} ${theme} heading order`,
			).toEqual([]);
		}
});
