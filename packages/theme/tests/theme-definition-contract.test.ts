import { describe, expect, test } from "bun:test";

import {
	assertCanonicalThemeDefinitions,
	diagnoseThemeContrast,
	getBaseThemeVariables,
	getDefaultColorSchemeDescriptor,
	getRequiredSchemeTokens,
	listBuiltInColorSchemeDefinitions,
} from "../src/theme-definitions.js";
import { renderPieThemeCss } from "../src/theme-css.js";

describe("canonical theme definitions", () => {
	test("passes its build-time invariant check", () => {
		expect(() => assertCanonicalThemeDefinitions()).not.toThrow();
	});

	test("every built-in supplies exactly the required Scheme Participation set", () => {
		const required = [...getRequiredSchemeTokens()].sort();
		for (const scheme of listBuiltInColorSchemeDefinitions()) {
			expect(Object.keys(scheme.variables).sort(), scheme.id).toEqual(required);
		}
	});

	test("built-in identifiers, labels, and order remain stable", () => {
		expect(
			listBuiltInColorSchemeDefinitions().map(({ id, name }) => ({ id, name })),
		).toEqual([
			{ id: "black-on-white", name: "Black on White" },
			{ id: "white-on-black", name: "White on Black" },
			{ id: "rose-on-green", name: "Rose on Green" },
			{ id: "yellow-on-blue", name: "Yellow on Blue" },
			{ id: "black-on-rose", name: "Black on Rose" },
			{
				id: "light-gray-on-dark-gray",
				name: "Light Gray on Dark Gray",
			},
			{ id: "grey-on-light-grey", name: "Grey on Light Grey" },
			{
				id: "purple-on-light-green",
				name: "Purple on Light Green",
			},
			{ id: "black-on-violet", name: "Black on Violet" },
			{ id: "yellow-on-navy", name: "Yellow on Navy" },
		]);
	});

	test("composites the transparent default Base Theme onto a visible swatch", () => {
		expect(getBaseThemeVariables("light")["--pie-background"]).toBe(
			"rgba(255, 255, 255, 0)",
		);
		expect(getDefaultColorSchemeDescriptor().preview).toEqual({
			bg: "#ffffff",
			text: "black",
			primary: "#3f51b5",
		});
	});

	test("all named semantic WCAG relationships pass", () => {
		for (const baseTheme of ["light", "dark"] as const) {
			const baseVariables = getBaseThemeVariables(baseTheme);
			expect(
				diagnoseThemeContrast(
					baseTheme === "light"
						? { ...baseVariables, "--pie-background": "#ffffff" }
						: baseVariables,
					`${baseTheme}-base`,
				),
			).toEqual([]);
		}
		for (const scheme of listBuiltInColorSchemeDefinitions()) {
			expect(diagnoseThemeContrast(scheme.variables, scheme.id)).toEqual([]);
		}
	});

	test("does not certify contrast against the transparent light backdrop", () => {
		expect(
			diagnoseThemeContrast(getBaseThemeVariables("light"), "light-base"),
		).toContainEqual(
			expect.objectContaining({ code: "contrast-unmeasurable" }),
		);
	});

	test("pins intentional palette corrections", () => {
		const schemes = new Map(
			listBuiltInColorSchemeDefinitions().map((scheme) => [scheme.id, scheme]),
		);
		expect(schemes.get("rose-on-green")?.variables["--pie-black"]).toBe(
			"#3d0022",
		);
		expect(
			schemes.get("black-on-rose")?.variables["--pie-correct-tertiary"],
		).toBe("#007000");
		const darkGray = schemes.get("light-gray-on-dark-gray")?.variables;
		expect(darkGray?.["--pie-correct-tertiary"]).toBe("#00bb00");
		expect(darkGray?.["--pie-incorrect"]).toBe("#ff6a6a");
		expect(darkGray?.["--pie-missing"]).toBe("#ff6a6a");
		expect(darkGray?.["--pie-missing-icon"]).toBe("#6868ff");
	});

	test("the dark Base Theme owns the annotation toolbar boundary", () => {
		expect(
			getBaseThemeVariables("dark")["--pie-tool-annotation-toolbar-border"],
		).toBe("#949494");
	});
});

describe("generated CSS adapters", () => {
	test("match checked-in artifacts byte for byte", async () => {
		const rendered = renderPieThemeCss();
		expect(
			await Bun.file(new URL("../src/tokens.css", import.meta.url)).text(),
		).toBe(rendered.tokensCss);
		expect(
			await Bun.file(
				new URL("../src/color-schemes.css", import.meta.url),
			).text(),
		).toBe(rendered.colorSchemesCss);
	});

	test("emits exactly one unlayered selector rule per built-in", () => {
		const css = renderPieThemeCss().colorSchemesCss;
		const selectors = [
			...css.matchAll(/^\[data-color-scheme="([^"]+)"\] \{/gm),
		].map((match) => match[1]);
		expect(selectors).toEqual(
			listBuiltInColorSchemeDefinitions().map((scheme) => scheme.id),
		);
		expect(css).not.toContain(":root");
		expect(css).not.toContain("data-theme");
		expect(css).not.toContain("@layer");
		expect(css).not.toContain("!important");
	});

	test("base CSS remains unlayered and preserves explicit light selectors", () => {
		const css = renderPieThemeCss().tokensCss;
		expect(css).toContain(":root,");
		expect(css).toContain('[data-theme="light"],');
		expect(css).toContain(':where(pie-theme[theme="light"])');
		expect(css).toContain(':where(pie-theme[theme="dark"])');
		expect(css).not.toContain("@layer");
		expect(css).not.toContain("!important");
		expect(css).not.toContain("forced-color-adjust: none");
	});
});
