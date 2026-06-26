import { describe, expect, test } from "bun:test";

const source = await Bun.file(
	new URL(
		"../src/components/AssessmentPlayerDefaultElement.ts",
		import.meta.url,
	),
).text();

describe("assessment-player theme token contract", () => {
	test("background-light compatibility alias falls through the canonical background token", () => {
		expect(source.replace(/\s+/g, "")).toContain(
			"var(--pie-background-light,var(--pie-background,#fff))",
		);
	});
});
