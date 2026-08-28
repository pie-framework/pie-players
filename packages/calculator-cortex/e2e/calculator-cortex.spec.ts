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

test("fits every shipped panel size without clipping anything", async ({
	page,
}) => {
	/*
	 * Every node, not the root, and both panel sizes rather than one.
	 *
	 * This test used to compare `#calculator`'s scrollHeight against its clientHeight
	 * and stop there. It passed while the shipped graphing panel cut 12px off the
	 * readout and the whole plot column off a narrow one: a flex item shrunk below
	 * its content does not clip, it paints outside its box, so the surplus never
	 * reached the root's scrollHeight and the keypad was simply drawn over the graph
	 * controls. The demo's `shell` size was also one figure for all three types and
	 * larger than any of them, so the size measured was not a size that ships.
	 *
	 * The invariant is that nothing is unreachable: a node may overflow only where it
	 * or an ancestor can scroll to the rest, the calculator never scrolls sideways,
	 * and every target stays at 24px (WCAG 2.5.8) whatever the tier does to key
	 * heights.
	 */
	for (const path of ["/", "/scientific.html", "/graphing.html"]) {
		await page.goto(path);
		await page.waitForFunction(() => window.__cortexReady === true);

		for (const panel of ["shell", "floor"]) {
			await page.locator("#panel").selectOption(panel);
			await page.waitForTimeout(500);

			/*
			 * Every layer, not just the one that opens. The function layers are taller
			 * than the numeric one, and a layer that is never shown is never measured.
			 */
			const tabs = page.getByRole("group", { name: "Keypad layer" });
			const layerNames = (await tabs.count())
				? await tabs.getByRole("button").allTextContents()
				: [""];
			// Named, so a selector that stops matching degrades to a failure rather than
			// to measuring the opening layer three times.
			expect(layerNames, `${path} layer tabs`).toEqual(
				path === "/"
					? [""]
					: path === "/scientific.html"
						? ["Basic", "Scientific"]
						: ["Basic", "Graphing"],
			);

			for (const layerName of layerNames) {
				if (layerName) {
					await tabs
						.getByRole("button", { name: layerName, exact: true })
						.click();
					await page.waitForTimeout(250);
				}
				const where = `${path} ${panel} ${layerName || "numeric"}`;
				const report = await page.locator("#calculator").evaluate((root) => {
					const calculator = root.querySelector(
						".pie-cortex-calculator",
					) as HTMLElement;
					const scrolls = (element: Element, axis: "x" | "y"): boolean => {
						const overflow = getComputedStyle(element)[
							axis === "y" ? "overflowY" : "overflowX"
						];
						return overflow === "auto" || overflow === "scroll";
					};
					const reachable = (element: Element, axis: "x" | "y"): boolean => {
						for (
							let node: Element | null = element;
							node;
							node = node === calculator ? null : node.parentElement
						) {
							if (scrolls(node, axis)) return true;
						}
						return false;
					};
					const clipped: string[] = [];
					const walk = (element: Element): void => {
						const className =
							typeof element.className === "string" ? element.className : "";
						const label =
							className.replace(/svelte-\w+/g, "").trim() ||
							element.tagName.toLowerCase();
						/*
						 * Visually-hidden text is clipped by design — a 1x1 box with
						 * `overflow: hidden` is the mechanism — and is reached by a screen
						 * reader rather than by scrolling.
						 */
						if (className.includes("pie-cortex-sr-only")) return;
						if (
							element.scrollHeight > element.clientHeight + 1 &&
							!reachable(element, "y")
						) {
							clipped.push(
								`${label} +${element.scrollHeight - element.clientHeight}px`,
							);
						}
						if (
							element.scrollWidth > element.clientWidth + 1 &&
							!reachable(element, "x")
						) {
							clipped.push(
								`${label} sideways +${element.scrollWidth - element.clientWidth}px`,
							);
						}
						for (const child of element.children) walk(child);
					};
					walk(calculator);
					const targets = [
						...calculator.querySelectorAll("button, select, [role=button]"),
					]
						.map((element) => element.getBoundingClientRect())
						.filter((box) => box.width > 0)
						.map((box) => Math.round(Math.min(box.width, box.height)));
					return {
						clipped,
						smallestTarget: Math.min(...targets),
						rootScrollsSideways: calculator.scrollWidth > calculator.clientWidth + 1,
					};
				});

				expect(report.clipped, `${where} clips content`).toEqual([]);
				expect(
					report.rootScrollsSideways,
					`${where} scrolls sideways`,
				).toBe(false);
				// 2.5.8 at Level AA. The density tiers trade 2.5.5's 44px for fitting a
				// panel a learner has shrunk; they never trade past this.
				expect(
					report.smallestTarget,
					`${where} smallest target`,
				).toBeGreaterThanOrEqual(24);
			}
		}
	}
});

test("steps key size down instead of clipping a panel it cannot fill", async ({
	page,
}) => {
	/*
	 * The tiers themselves, rather than their consequence. A panel at the size it
	 * opens at keeps the 44px of WCAG 2.5.5; below what that fits, keys give up
	 * height so the keypad keeps its rows, and the attribute says which tier is in
	 * force so a failure names the cause rather than a pixel count.
	 */
	await page.goto("/scientific.html");
	await page.waitForFunction(() => window.__cortexReady === true);

	const measure = async () =>
		await page.locator("#calculator").evaluate((root) => {
			const calculator = root.querySelector(
				".pie-cortex-calculator",
			) as HTMLElement;
			const key = calculator.querySelector(".pie-cortex-key") as HTMLElement;
			return {
				density: calculator.dataset.pieDensity,
				keyHeight: Math.round(key.getBoundingClientRect().height),
			};
		});

	await page.locator("#panel").selectOption("shell");
	await page.waitForTimeout(400);
	expect(await measure()).toEqual({ density: "comfortable", keyHeight: 44 });

	// Smaller than any panel this tool opens at, which a learner reaches by dragging
	// a corner or by zooming to 400%.
	await page.locator("#calculator").evaluate((root) => {
		root.classList.remove("pie-cortex-demo-calculator--shell");
		(root as HTMLElement).style.width = "380px";
		(root as HTMLElement).style.height = "340px";
		(root as HTMLElement).style.maxWidth = "none";
	});
	await page.waitForTimeout(400);
	const compact = await measure();
	expect(compact.density).toBe("compact");
	expect(compact.keyHeight).toBeLessThan(44);
	expect(compact.keyHeight).toBeGreaterThanOrEqual(24);
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

test("traces a plotted series from the keyboard and clamps at its ends", async ({
	page,
}) => {
	/*
	 * The plot is `aria-hidden`, so this readout is the graph for a keyboard-only or
	 * screen-reader learner. It was asserted to be *rendered* and never to move:
	 * `moveTrace` clamping to the wrong bound, or the series selector losing its
	 * points, would leave the accommodation present and inert.
	 */
	await page.goto("/graphing.html");
	await page.waitForFunction(() => window.__cortexReady === true);

	const readout = page.locator(".pie-cortex-trace__readout");
	const point = /x\s*(-?[\d.,]+),\s*y\s*(-?[\d.,]+)/;
	await expect(readout).toHaveText(point);

	const coordinates = async (): Promise<[number, number]> => {
		const matched = (await readout.textContent())?.match(point);
		if (!matched?.[1] || !matched[2]) {
			throw new Error(`The trace readout is not a coordinate: ${matched}`);
		}
		return [
			Number(matched[1].replace(/,/g, "")),
			Number(matched[2].replace(/,/g, "")),
		];
	};

	const first = await coordinates();
	// Already at the first sampled point: there is nowhere earlier to go, and the
	// control must hold rather than wrap to the far end of the series.
	await page.getByRole("button", { name: "Previous point" }).click();
	expect(await coordinates()).toEqual(first);

	await page.getByRole("button", { name: "Next point" }).click();
	const second = await coordinates();
	expect(second[0]).toBeGreaterThan(first[0]);
	// y=x^2 over a symmetric viewport: moving right from the left edge descends.
	expect(second[1]).toBeLessThan(first[1]);

	// Selecting the series resets the trace to its first point.
	await page
		.locator(".pie-cortex-trace__series select")
		.selectOption({ index: 0 });
	expect(await coordinates()).toEqual(first);
});

test("keeps graphing-mode telemetry free of expressions and coordinates", async ({
	page,
}) => {
	/*
	 * The graphing mode is where a payload can carry a learner's coordinates, and
	 * the only privacy assertion ran against basic mode. Values are checked as well
	 * as key names: a coordinate smuggled into a `detail` string passes a key scan.
	 */
	await page.goto("/graphing.html");
	await page.waitForFunction(() => window.__cortexReady === true);
	await expect(page.locator(".pie-cortex-trace__readout")).toHaveText(
		/x\s*-?[\d.,]+/,
	);

	await page.evaluate(async () => {
		window.__cortexCalculator?.setValue("y=3x^2+1");
		await window.__cortexCalculator?.evaluate?.("7\\times6").catch(() => {});
		await window.__cortexCalculator?.evaluate?.("1\\div0").catch(() => {});
	});

	const telemetry = await page.evaluate(() => window.__cortexTelemetry ?? []);
	expect(telemetry.length).toBeGreaterThan(0);
	expect(
		telemetry.some((entry) => entry.eventName === "pie-tool-operation-error"),
	).toBe(true);

	const strings = (value: unknown): string[] => {
		if (typeof value === "string") return [value];
		if (Array.isArray(value)) return value.flatMap(strings);
		if (value && typeof value === "object") {
			return Object.values(value).flatMap(strings);
		}
		return [];
	};

	for (const entry of telemetry) {
		expect(entry.payload).toMatchObject({ backend: "cortex" });
		for (const privateKey of [
			"expression",
			"latex",
			"result",
			"state",
			"history",
			"coordinates",
			"series",
			"viewport",
		]) {
			expect(Object.keys(entry.payload ?? {})).not.toContain(privateKey);
		}
		for (const text of strings(entry.payload)) {
			expect(text).not.toContain("3x^2");
			expect(text).not.toContain("7\\times6");
			expect(text).not.toBe("42");
		}
	}
});

test("computes a parenthesised expression pressed on the shipped keypad", async ({
	page,
}) => {
	/*
	 * `(` and `)` shipped as keys while the expression policy refused every
	 * parenthesised expression, and nothing caught it: the suites reached `2+2`,
	 * `3+4`, `\sin(30)`, `5!` and `50\%`, none of which groups. This presses the two
	 * keys and reads the answer, so the keypad, the mathfield, the policy and the
	 * worker are proved on one path.
	 */
	await page.goto("/");
	await page.waitForFunction(() => window.__cortexReady === true);
	await page.evaluate(() => window.__cortexCalculator?.clear());

	for (const name of [
		"Open parenthesis",
		"2",
		"Plus",
		"3",
		"Close parenthesis",
		"Times",
		"4",
	]) {
		await page.getByRole("button", { name, exact: true }).click();
	}
	await expect
		.poll(() => page.evaluate(() => window.__cortexCalculator?.getValue()))
		.toBe("(2+3)\\times4");

	await page.getByRole("button", { name: "Calculate", exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(() => window.__cortexCalculator?.getHistory?.()[0]?.result),
		)
		.toBe("20");
	await expect(page.locator(".pie-cortex-result")).toHaveText("20");
});

test("pans, zooms and resets the graph viewport from the keyboard alone", async ({
	page,
}) => {
	/*
	 * JSXGraph moves its own viewport only from pointer bindings — drag, wheel,
	 * pinch — so before these controls a keyboard-only or switch-access learner
	 * could read the default window and nothing outside it: the trace moves within
	 * the sampled window and cannot leave it. Every control here is driven by Enter
	 * on a focused button rather than by a click, because that is the claim.
	 */
	await page.goto("/graphing.html");
	await page.waitForFunction(() => window.__cortexReady === true);
	// The board loads asynchronously and every control no-ops until it exists, so
	// wait for it to have rendered before pressing anything.
	await expect(
		page.locator(".pie-cortex-jsxgraph text").first(),
	).toBeAttached();

	const summary = page.getByText(/Viewport x from/);
	const bounds = async (): Promise<[number, number, number, number]> => {
		const text = await summary.textContent();
		const matched = text?.match(
			/x from (-?[\d.,]+) to (-?[\d.,]+), y from (-?[\d.,]+) to (-?[\d.,]+)/,
		);
		if (!matched) throw new Error(`No viewport summary: ${text}`);
		return matched
			.slice(1, 5)
			.map((value) => Number(value.replace(/,/g, ""))) as [
			number,
			number,
			number,
			number,
		];
	};
	const pressWithKeyboard = async (name: string): Promise<void> => {
		const button = page.getByRole("button", { name, exact: true });
		await button.focus();
		await expect(button).toBeFocused();
		await page.keyboard.press("Enter");
	};
	const settled = async (
		read: (box: [number, number, number, number]) => number,
		expected: (value: number) => boolean,
		label: string,
	): Promise<void> => {
		await expect
			.poll(async () => expected(read(await bounds())), { message: label })
			.toBe(true);
	};

	/*
	 * `__cortexReady` is set before the board's own first sample lands, and a board
	 * still settling its container size samples again. Pressing into that window
	 * read a viewport a pending sample then overwrote, which made this test flaky
	 * in a full run and pass alone. Two identical reads is the readiness signal.
	 */
	const stableBounds = async (): Promise<[number, number, number, number]> => {
		let previous = (await bounds()).join(":");
		for (let attempt = 0; attempt < 20; attempt += 1) {
			await page.waitForTimeout(150);
			const current = await bounds();
			if (current.join(":") === previous) return current;
			previous = current.join(":");
		}
		throw new Error("The graph viewport never settled.");
	};

	const [defaultXMin, defaultXMax, defaultYMin] = await stableBounds();
	const defaultSpan = defaultXMax - defaultXMin;

	await pressWithKeyboard("Zoom in");
	await settled(
		([xMin, xMax]) => xMax - xMin,
		(span) => span < defaultSpan,
		"zoom in narrows the x span",
	);

	const [zoomedXMin] = await stableBounds();
	await pressWithKeyboard("Pan right");
	await settled(
		([xMin]) => xMin,
		(xMin) => xMin > zoomedXMin,
		"pan right raises xMin",
	);

	await pressWithKeyboard("Pan left");
	await settled(
		([xMin]) => xMin,
		(xMin) => Math.abs(xMin - zoomedXMin) < 1e-6,
		"pan left returns xMin",
	);

	// The window moves, not the plot: "up" shows higher y values. JSXGraph's own
	// arrow methods name the opposite, which is why the mapping is crossed.
	const [, , panYMin] = await stableBounds();
	await pressWithKeyboard("Pan up");
	await settled(
		([, , yMin]) => yMin,
		(yMin) => yMin > panYMin,
		"pan up raises yMin",
	);

	await pressWithKeyboard("Zoom out");
	await pressWithKeyboard("Reset view");
	await settled(
		([xMin, xMax]) => xMax - xMin,
		(span) => Math.abs(span - defaultSpan) < 1e-6,
		"reset restores the default span",
	);
	const [resetXMin, , resetYMin] = await stableBounds();
	expect(resetXMin).toBeCloseTo(defaultXMin, 6);
	expect(resetYMin).toBeCloseTo(defaultYMin, 6);
});

/*
 * Typing sequences, and only the answer asserted.
 *
 * The sequences are derived from mathquill's `test/unit/typing.test.js`, which
 * covers what a mathematical editor does to raw keystrokes: `/` opens a
 * fraction over what precedes it, `^` opens a superscript the next character
 * lands inside, function names auto-recognize, and an unmatched `(` closes
 * itself. Those behaviours belong to MathLive here and are not this package's to
 * assert -- so nothing below inspects the intermediate LaTeX.
 *
 * What is ours is the seam: whatever the editor builds from an ordinary typing
 * sequence has to survive `validateExpression` and come back as the right
 * answer. The unit scenarios feed that policy hand-written LaTeX; only a real
 * mathfield produces the LaTeX a learner's keystrokes actually generate, and the
 * two have already disagreed -- `2x`, `(4+5)` and the inverse-trig keys all
 * validated as typed strings long before they were reachable from the keypad.
 */
const TYPED: ReadonlyArray<{
	readonly path: string;
	readonly keys: readonly string[];
	readonly answer: string;
	readonly why: string;
}> = [
	{ path: "/", keys: ["1/2"], answer: "0.5", why: "`/` builds a fraction" },
	{
		path: "/",
		/*
		 * The `ArrowRight`s are the point. A fraction keeps the cursor in its
		 * denominator, so typing straight through gives `3/(4+1/4)` and answers
		 * 0.7058823529 -- which is what this test asserted until it was run.
		 */
		keys: ["3/4", "ArrowRight", "+1/4", "ArrowRight"],
		answer: "1",
		why: "two fractions, each exited before the next operator",
	},
	{
		path: "/",
		keys: ["(2+3"],
		answer: "5",
		why: "an unclosed parenthesis, which the editor closes",
	},
	{ path: "/", keys: ["2(3+4"], answer: "14", why: "a coefficient on a group" },
	{
		path: "/",
		keys: ["-5+3"],
		answer: "-2",
		why: "a leading sign, for which there is no dedicated key",
	},
	{
		path: "/",
		keys: [".5+.25"],
		answer: "0.75",
		why: "a bare leading decimal point",
	},
	// Scientific, because basic mode holds no `power` capability -- `2^3` typed
	// into the basic calculator is refused, and correctly so.
	{
		path: "/scientific.html",
		keys: ["2^3"],
		answer: "8",
		why: "`^` builds a superscript",
	},
	{
		path: "/scientific.html",
		keys: ["2^3", "ArrowRight", "+1"],
		answer: "9",
		why: "an exponent exited before the next operator",
	},
	{
		path: "/scientific.html",
		keys: ["sin30"],
		answer: "0.5",
		/*
		 * The function name auto-recognizes and the argument follows with no
		 * delimiter, which is the shape that made `InvisibleOperator` necessary.
		 */
		why: "a function name and an implicit argument",
	},
	{
		path: "/scientific.html",
		keys: ["sqrt", "Enter", "16"],
		answer: "4",
		why: "a radical opened by its command name",
	},
];

for (const entry of TYPED) {
	test(`answers a sequence typed as ${entry.keys.join(" ")}`, async ({
		page,
	}) => {
		await page.goto(entry.path);
		await page.waitForFunction(() => window.__cortexReady === true);
		const before = await page.evaluate(
			() => window.__cortexCalculator?.getHistory?.().length ?? 0,
		);
		await page.evaluate(() => window.__cortexCalculator?.clear());
		await page.locator("math-field").locator('[part="keyboard-sink"]').focus();
		for (const chunk of entry.keys) {
			if (/^[A-Z]/.test(chunk)) await page.keyboard.press(chunk);
			else await page.keyboard.type(chunk);
		}
		await page.keyboard.press("Enter");
		/*
		 * `clear()` empties the input, not the history, and each demo seeds one
		 * calculation -- so asserting on `getHistory()[0]` alone passes on the
		 * seeded entry whenever the typed expression is refused and never commits.
		 * That is how three of these tests first "failed" against correct code.
		 */
		await expect
			.poll(() =>
				page.evaluate(
					() => window.__cortexCalculator?.getHistory?.().length ?? 0,
				),
			)
			.toBe(before + 1);
		expect(
			await page.evaluate(
				() => window.__cortexCalculator?.getHistory?.()[0]?.result,
			),
		).toBe(entry.answer);
	});
}

test("computes a base-n logarithm and a fraction from the scientific layer", async ({
	page,
}) => {
	/*
	 * Both keys insert a template with one placeholder, because a second one would
	 * be unreachable: `ArrowRight` leaves a subscript rather than crossing to the
	 * next placeholder, and MathLive binds `moveToNextPlaceholder` to Tab, which
	 * this keypad spends on being a single tab stop. That constraint is invisible
	 * in the layout table and only a real mathfield shows it, so it is asserted
	 * here — the first two-slot templates written for these keys produced
	 * `\\log_28(\\placeholder{})` and lost the argument entirely.
	 */
	await page.goto("/scientific.html");
	await page.waitForFunction(() => window.__cortexReady === true);
	await page.getByRole("button", { name: "Scientific", exact: true }).click();

	await page.evaluate(() => window.__cortexCalculator?.clear());
	await page
		.getByRole("button", { name: "Logarithm with a chosen base", exact: true })
		.click();
	await page.keyboard.type("2");
	await page.keyboard.press("ArrowRight");
	await page.keyboard.type("8");
	await expect
		.poll(() => page.evaluate(() => window.__cortexCalculator?.getValue()))
		.toBe("\\log_28");
	/*
	 * The Calculate key, pressed while the scientific layer is showing. It used to
	 * sit on the numeric layer alone, so a learner who built an expression from
	 * these keys had to switch layers back to reach a key they could see; Enter
	 * worked, but a pointer or switch-access user has no Enter. Every layer now
	 * carries one, in the same corner.
	 */
	await expect(
		page.getByRole("button", { name: "Calculate", exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "Calculate", exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(() => window.__cortexCalculator?.getHistory?.()[0]?.result),
		)
		.toBe("3");

	/*
	 * `#@` takes what is already typed as the numerator. The scientific layer is
	 * already showing from the top of this test — switching layers here instead
	 * would leave focus on the toggle and swallow the digit typed after the key.
	 */
	await page.evaluate(() => window.__cortexCalculator?.clear());
	await page.locator("math-field").locator('[part="keyboard-sink"]').focus();
	await page.keyboard.type("12");
	await page.getByRole("button", { name: "Fraction", exact: true }).click();
	await page.keyboard.type("4");
	await expect
		.poll(() => page.evaluate(() => window.__cortexCalculator?.getValue()))
		.toBe("\\frac{12}{4}");
	await page.keyboard.press("Enter");
	await expect
		.poll(() =>
			page.evaluate(() => window.__cortexCalculator?.getHistory?.()[0]?.result),
		)
		.toBe("3");
});

test("enters a negative number from the keypad without a sign key", async ({
	page,
}) => {
	/*
	 * Why this package ships no `(-)` key. A handheld separates the sign from the
	 * subtraction operator because there they are different operations; in a
	 * mathfield `-` is contextual, so pressing Minus on an empty expression negates
	 * and the same key subtracts mid-expression. Pinned rather than assumed — the
	 * keypad diff against Perseus flagged the missing key, and this is the evidence
	 * it is not needed.
	 */
	await page.goto("/");
	await page.waitForFunction(() => window.__cortexReady === true);
	await page.evaluate(() => window.__cortexCalculator?.clear());
	for (const name of ["Minus", "5", "Plus", "3"]) {
		await page.getByRole("button", { name, exact: true }).click();
	}
	await expect
		.poll(() => page.evaluate(() => window.__cortexCalculator?.getValue()))
		.toBe("-5+3");
	await page.getByRole("button", { name: "Calculate", exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(() => window.__cortexCalculator?.getHistory?.()[0]?.result),
		)
		.toBe("-2");
});

test("crosses a traced series in a bounded number of presses", async ({
	page,
}) => {
	/*
	 * The sampler takes one point per pixel, up to 1,200, so a one-point step made
	 * the trace resolution-dependent: traversing the plot cost as many presses as it
	 * was wide. The traversal is a fixed number of stops instead.
	 */
	await page.goto("/graphing.html");
	await page.waitForFunction(() => window.__cortexReady === true);

	const readout = page.locator(".pie-cortex-trace__readout");
	const point = /x\s*(-?[\d.,]+)/;
	await expect(readout).toHaveText(point);
	const xOf = async (): Promise<number> => {
		const matched = (await readout.textContent())?.match(point);
		if (!matched?.[1])
			throw new Error("The trace readout is not a coordinate.");
		return Number(matched[1].replace(/,/g, ""));
	};

	const start = await xOf();
	const next = page.getByRole("button", { name: "Next point", exact: true });
	let presses = 0;
	let current = start;
	while (presses < 60) {
		await next.click();
		presses += 1;
		const moved = await xOf();
		if (moved === current) break;
		current = moved;
	}
	expect(presses).toBeLessThan(60);
	// It reached the far end of the series, not merely a few points along it.
	expect(current).toBeGreaterThan(start + 15);
});
