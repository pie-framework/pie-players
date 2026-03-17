import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("AssessmentPlayerDefaultElement observability forwarding contract", () => {
	test("declares section-player runtime/player override properties", () => {
		const source = readFileSync(
			join(import.meta.dir, "../src/components/AssessmentPlayerDefaultElement.ts"),
			"utf8",
		);
		expect(source).toContain("sectionPlayerRuntime");
		expect(source).toContain("sectionPlayerPlayer");
	});

	test("forwards overrides to mounted section element", () => {
		const source = readFileSync(
			join(import.meta.dir, "../src/components/AssessmentPlayerDefaultElement.ts"),
			"utf8",
		);
		expect(source).toContain("(sectionEl as any).runtime = this.sectionPlayerRuntime");
		expect(source).toContain("(sectionEl as any).player = this.sectionPlayerPlayer");
	});

	test("includes override fields in assessment-player runtime config types", () => {
		const source = readFileSync(
			join(import.meta.dir, "../src/types.ts"),
			"utf8",
		);
		expect(source).toContain("sectionPlayerRuntime?");
		expect(source).toContain("sectionPlayerPlayer?");
	});
});
