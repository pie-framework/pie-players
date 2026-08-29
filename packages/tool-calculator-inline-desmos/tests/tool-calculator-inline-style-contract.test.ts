import { describe, expect, test } from "bun:test";

const source = await Bun.file(
	new URL(
		"../../tool-calculator-shared/CalculatorInlineTool.svelte",
		import.meta.url,
	),
).text();

const cssRuleBody = (selector: string): string => {
	const selectorIndex = source.indexOf(selector);
	if (selectorIndex === -1) {
		throw new Error(`Could not find CSS rule for ${selector}`);
	}
	const openBrace = source.indexOf("{", selectorIndex);
	const closeBrace = source.indexOf("\n\t}", openBrace);
	if (openBrace === -1 || closeBrace === -1) {
		throw new Error(`Could not parse CSS rule for ${selector}`);
	}
	return source.slice(openBrace + 1, closeBrace);
};

const hexToRgb = (hex: string): [number, number, number] => {
	const normalized = hex.replace("#", "");
	return [0, 2, 4].map((index) =>
		Number.parseInt(normalized.slice(index, index + 2), 16),
	) as [number, number, number];
};

const relativeLuminance = ([red, green, blue]: [number, number, number]) => {
	const toLinear = (channel: number) => {
		const value = channel / 255;
		return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	};
	return (
		0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue)
	);
};

const contrastRatio = (foreground: string, background: string): number => {
	const fg = relativeLuminance(hexToRgb(foreground));
	const bg = relativeLuminance(hexToRgb(background));
	const lighter = Math.max(fg, bg);
	const darker = Math.min(fg, bg);
	return (lighter + 0.05) / (darker + 0.05);
};

describe("tool-calculator-inline active trigger styling contract", () => {
	test("active button exposes component-scoped host override variables", () => {
		const body = cssRuleBody(".pie-tool-calculator-inline__button--active");

		expect(body).toContain("--pie-tool-trigger-active-background");
		expect(body).toContain("--pie-tool-trigger-active-color");
		expect(body).toContain("--pie-tool-trigger-active-border-color");
	});

	test("resting and hover fills resolve through the button tokens", () => {
		/*
		 * `--pie-background` is the page token, which a host may point at its own
		 * backdrop. A trigger filled from it took `--pie-text` ink over whatever the
		 * host painted, and shipped transparent under the base light theme in all
		 * three inline calculator packages. `--pie-button-bg` and
		 * `--pie-button-hover-bg` are required in both base themes and all ten
		 * colour schemes, so nothing behind them fires under a theme.
		 */
		expect(
			cssRuleBody(".pie-tool-calculator-inline__button").replace(/\s+/g, ""),
		).toContain(
			"background-color:var(--pie-button-background-color,var(--pie-button-bg,var(--pie-white,#fff)))",
		);
		expect(
			cssRuleBody(
				".pie-tool-calculator-inline__button:hover:not(:disabled)",
			).replace(/\s+/g, ""),
		).toContain(
			"background-color:var(--pie-button-hover-background-color,var(--pie-button-hover-bg,var(--pie-secondary-background,#f5f5f5)))",
		);
	});

	test("no surface fill resolves through --pie-background", () => {
		/*
		 * Ported from `packages/calculator-cortex/tests/calculator-cortex-style-contract.test.ts`.
		 * Scans declaration values only, so the `--active` rules that blend ink
		 * through `--pie-background` under `--pie-fixed-hue-collapse` are untouched.
		 */
		for (const [, value] of source.matchAll(
			/(?:^|\n)\s*background(?:-color)?:\s*([^;]+);/g,
		)) {
			expect(value ?? "").not.toMatch(/var\(\s*--pie-background\s*[,)]/);
		}
	});

	test("active hover keeps the active trigger background contract", () => {
		const body = cssRuleBody(
			".pie-tool-calculator-inline__button--active:hover:not(:disabled)",
		);

		expect(body).toContain("--pie-tool-trigger-active-background");
		expect(body.replace(/\s+/g, "")).not.toContain(
			"background-color:var(--pie-primary-dark",
		);
	});

	test("active icon follows the active trigger foreground contract", () => {
		const body = cssRuleBody(
			".pie-tool-calculator-inline__button--active .pie-tool-calculator-inline__icon",
		);

		expect(body).toMatch(
			/--pie-tool-trigger-active-color|color:\\s*inherit|color:\\s*currentColor/,
		);
		expect(body).not.toMatch(/color:\\s*white/);
	});

	test("active hover icon cannot be masked by the generic hover icon rule", () => {
		const activeHoverIconSelector =
			".pie-tool-calculator-inline__button--active:hover:not(:disabled) .pie-tool-calculator-inline__icon";
		const hasActiveHoverIconRule = source.includes(activeHoverIconSelector);
		const genericHoverSkipsActive = source.includes(
			".pie-tool-calculator-inline__button:not(.pie-tool-calculator-inline__button--active):hover:not(:disabled) .pie-tool-calculator-inline__icon",
		);

		expect(hasActiveHoverIconRule || genericHoverSkipsActive).toBe(true);
	});

	test("documented custom active trigger colors meet WCAG AA contrast", () => {
		expect(contrastRatio("#ffffff", "#1268aa")).toBeGreaterThanOrEqual(4.5);
	});

	test("active trigger ink collapses to the page colour under a scheme", () => {
		for (const selector of [
			".pie-tool-calculator-inline__button--active",
			".pie-tool-calculator-inline__button--active:hover:not(:disabled)",
		]) {
			const body = cssRuleBody(selector).replace(/\s+/g, "");
			expect(body, selector).toContain("--pie-fixed-hue-collapse");
			expect(body, selector).toContain("var(--pie-background");
		}
	});

	test("the deeper hover fill collapses to --pie-primary, not --pie-primary-dark", () => {
		// `--pie-primary-dark` pairs with the page colour at 3.56:1 under Light Gray
		// on Dark Gray, so it cannot carry this glyph once the ink follows the page.
		const body = cssRuleBody(
			".pie-tool-calculator-inline__button--active:hover:not(:disabled)",
		).replace(/\s+/g, "");
		expect(body).toContain("color-mix(insrgb,var(--pie-primary,");
		// Light Gray on Dark Gray: `--pie-primary-dark` #888888 against the page
		// #333333, versus #aaaaaa for `--pie-primary` on the same page.
		expect(contrastRatio("#888888", "#333333")).toBeLessThan(4.5);
		expect(contrastRatio("#aaaaaa", "#333333")).toBeGreaterThanOrEqual(4.5);
	});

	test("white is not a legible ink on every scheme's primary", () => {
		// Why the pinned ink had to go: the schemes whose primary is a pale yellow
		// put white on it at about 1:1, while the page colour they pair it with
		// clears AA. Yellow on Blue, primary #ffff66 on page #000066.
		expect(contrastRatio("#ffffff", "#ffff66")).toBeLessThan(4.5);
		expect(contrastRatio("#000066", "#ffff66")).toBeGreaterThanOrEqual(4.5);
	});
});
