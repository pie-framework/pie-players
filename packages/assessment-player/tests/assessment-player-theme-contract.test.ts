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
});
