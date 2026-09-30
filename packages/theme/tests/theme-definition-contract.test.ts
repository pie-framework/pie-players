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
import { contrastRatio } from "../src/contrast.js";

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

	test("the default Base Theme publishes an opaque page surface", () => {
		/*
		 * Was `rgba(255, 255, 255, 0)`, so PIE content revealed the host's page.
		 * Components read the token as an opaque surface and rendered see-through
		 * menus and bleeding text (PIE-940), and two declared relationships could
		 * not be certified at all. Opacity is now the contract; a host that wants
		 * its own surface to show through sets the token itself.
		 */
		expect(getBaseThemeVariables("light")["--pie-background"]).toBe("#ffffff");
		expect(getDefaultColorSchemeDescriptor().preview).toEqual({
			bg: "#ffffff",
			text: "black",
			primary: "#3f51b5",
		});
	});

	test("all named semantic WCAG relationships pass", () => {
		for (const baseTheme of ["light", "dark"] as const) {
			expect(
				diagnoseThemeContrast(
					getBaseThemeVariables(baseTheme),
					`${baseTheme}-base`,
				),
			).toEqual([]);
		}
		for (const scheme of listBuiltInColorSchemeDefinitions()) {
			expect(diagnoseThemeContrast(scheme.variables, scheme.id)).toEqual([]);
		}
	});

	test("the selectable hover fill clears 3:1 against the page wherever the text allows", () => {
		/*
		 * A hover fill that keeps the page's ink has to clear 4.5:1 under the text
		 * and 3:1 against the page, which multiply to 13.5:1 of text on the page.
		 * Below that a palette cannot have both, so the fill must spend the text
		 * pair down to the floor instead: the closest to 3:1 it can get.
		 */
		const hex = (value: string) => {
			const normalized = value === "black" ? "#000000" : value;
			const channel = (offset: number) =>
				Number.parseInt(normalized.slice(offset, offset + 2), 16);
			return { r: channel(1), g: channel(3), b: channel(5), a: 1 };
		};
		const palettes = [
			["light-base", getBaseThemeVariables("light")],
			["dark-base", getBaseThemeVariables("dark")],
			...listBuiltInColorSchemeDefinitions().map(
				(scheme) => [scheme.id, scheme.variables] as const,
			),
		] as const;
		for (const [id, variables] of palettes) {
			const text = hex(variables["--pie-text"] as string);
			const page = hex(variables["--pie-background"] as string);
			const fill = hex(variables["--pie-blue-grey-300"] as string);
			const textOnPage = contrastRatio(text, page);
			const fillOnPage = contrastRatio(fill, page);
			const textOnFill = contrastRatio(text, fill);
			if (textOnPage >= 13.5) {
				expect({ id, fillOnPage: fillOnPage >= 3 }).toEqual({
					id,
					fillOnPage: true,
				});
			} else {
				expect({ id, textOnFill: textOnFill < 4.75 }).toEqual({
					id,
					textOnFill: true,
				});
			}
		}
	});

	test("every relationship against the page surface is measurable", () => {
		/*
		 * The transparent light base left the annotation underline and the
		 * annotation toolbar boundary permanently `contrast-unmeasurable`, since
		 * their effective contrast depended on the host's backdrop. Both are
		 * certifiable now, so no relationship in either base theme may come back
		 * unmeasurable.
		 */
		for (const baseTheme of ["light", "dark"] as const) {
			expect(
				diagnoseThemeContrast(
					getBaseThemeVariables(baseTheme),
					`${baseTheme}-base`,
				).filter((diagnostic) => diagnostic.code === "contrast-unmeasurable"),
			).toEqual([]);
		}
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
