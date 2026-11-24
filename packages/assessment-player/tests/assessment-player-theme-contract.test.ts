import { describe, expect, test } from "bun:test";

const source = await Bun.file(
	new URL(
		"../src/components/AssessmentPlayerDefaultElement.ts",
		import.meta.url,
	),
).text();

describe("assessment-player theme token contract", () => {
	test("navigation surfaces read the canonical background token", () => {
		expect(source.replace(/\s+/g, "")).toContain("var(--pie-background,#fff)");
		expect(source).not.toContain("--pie-background-light");
	});

	test("the Back and Next buttons draw from the button tokens", () => {
		// Painted from the page's surface and ink, they rendered as a plain box
		// that ignored a host's or a scheme's button palette.
		const rule = (selector: string) =>
			source.match(new RegExp(`${selector.replace(/[.:()]/g, "\\$&")} \\{[^}]*\\}`))?.[0] ?? "";
		const resting = rule(".pie-assessment-player-nav-btn");
		expect(resting).toContain("border: 1px solid var(--pie-button-border,");
		expect(resting).toContain("background: var(--pie-button-bg,");
		expect(resting).toContain("color: var(--pie-button-color,");
		const hover = rule(".pie-assessment-player-nav-btn:hover:not(:disabled)");
		expect(hover).toContain("background: var(--pie-button-hover-bg,");
		expect(hover).toContain("border-color: var(--pie-button-hover-border,");
		expect(hover).toContain("color: var(--pie-button-hover-color,");
	});
});
