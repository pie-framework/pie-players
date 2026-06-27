import { describe, expect, test } from "bun:test";

const source = await Bun.file(
	new URL("../tool-tts-inline.svelte", import.meta.url),
).text();
const styleSource = source.slice(source.indexOf("<style>"));

const cssRuleBody = (selector: string): string => {
	const selectorIndex = styleSource.indexOf(`${selector} {`);
	if (selectorIndex === -1) {
		throw new Error(`Could not find CSS rule for ${selector}`);
	}
	const openBrace = styleSource.indexOf("{", selectorIndex);
	const closeBrace = styleSource.indexOf("\n\t}", openBrace);
	if (openBrace === -1 || closeBrace === -1) {
		throw new Error(`Could not parse CSS rule for ${selector}`);
	}
	return styleSource.slice(openBrace + 1, closeBrace);
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

describe("tool-tts-inline active trigger styling contract", () => {
	test("legacy button alias variables fall back through canonical button tokens", () => {
		const triggerBody = cssRuleBody(".pie-tool-tts-inline__trigger");
		const triggerHoverBody = cssRuleBody(
			".pie-tool-tts-inline__trigger:hover:not(:disabled),\n\t.pie-tool-tts-inline__control:hover:not(:disabled)",
		);
		const controlBody = cssRuleBody(".pie-tool-tts-inline__control");

		expect(triggerBody.replace(/\s+/g, "")).toContain(
			"--pie-button-border-color,var(--pie-button-border,",
		);
		expect(triggerBody.replace(/\s+/g, "")).toContain(
			"--pie-button-background-color,var(--pie-button-bg,",
		);
		expect(controlBody.replace(/\s+/g, "")).toContain(
			"--pie-button-border-color,var(--pie-button-border,",
		);
		expect(controlBody.replace(/\s+/g, "")).toContain(
			"--pie-button-background-color,var(--pie-button-bg,",
		);
		expect(triggerHoverBody.replace(/\s+/g, "")).toContain(
			"--pie-button-hover-background-color,var(--pie-button-hover-bg,",
		);
	});

	test("active trigger exposes component-scoped host override variables", () => {
		const body = cssRuleBody(".pie-tool-tts-inline__trigger--active");

		expect(body).toContain("--pie-tool-trigger-active-background");
		expect(body).toContain("--pie-tool-trigger-active-color");
		expect(body).toContain("--pie-tool-trigger-active-border-color");
	});

	test("active trigger foreground fallback preserves the normal button color path", () => {
		const body = cssRuleBody(".pie-tool-tts-inline__trigger--active");

		expect(body).toContain("--pie-button-color");
		expect(body).toContain("--pie-text");
		expect(body.replace(/\s+/g, "")).not.toContain(
			"--pie-tool-trigger-active-color,var(--pie-primary",
		);
	});

	test("active trigger hover cannot mask the active trigger variables", () => {
		const body = cssRuleBody(
			".pie-tool-tts-inline__trigger--active:hover:not(:disabled)",
		);

		expect(body).toContain("--pie-tool-trigger-active-background");
		expect(body).toContain("--pie-tool-trigger-active-color");
		expect(body).toContain("--pie-tool-trigger-active-border-color");
	});

	test("documented custom active trigger colors meet WCAG AA contrast", () => {
		expect(contrastRatio("#ffffff", "#1268aa")).toBeGreaterThanOrEqual(4.5);
	});
});
