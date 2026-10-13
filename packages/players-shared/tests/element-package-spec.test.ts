import { describe, expect, test } from "bun:test";

import { isScopedPackageSpec } from "../src/loaders/element-package-spec.js";

describe("isScopedPackageSpec", () => {
	test.each([
		"@pie-element/rubric",
		"@pie-element/multiple-choice@latest",
		"@pie-element/multiple-choice@next",
		"@pie-element/multiple-choice@13.2.0",
		"@pie-element/ebsr@13.2.1-next.174",
		"@pie-element/hotspot@8.0.0-hotfix.2",
		"@pie-element/hotspot@8.0.0+build.7",
		"@pie-lib/math-rendering~x@1.0.0",
	])("accepts %p", (spec) => {
		expect(isScopedPackageSpec(spec)).toBe(true);
	});

	test.each([
		"@pie-element/multiple-choice@1.0.0/../../../gh/owner/repo@main",
		"@pie-element/multiple-choice@1.0.0/dist",
		"@pie-element/multiple-choice/../../gh/owner/repo@main",
		"@pie-element/multiple-choice/author@1.0.0",
		"@pie-element/multiple-choice@1.0.0?x=1",
		"@pie-element/multiple-choice@1.0.0#x",
		"@pie-element/multiple-choice@1.0.0\\..\\x",
		"@pie-element/multiple-choice@^1.0.0",
		"@pie-element/multiple-choice@v1.0.0",
		"@pie-element/multiple-choice@1.0",
		"@pie-element/multiple-choice@",
		"@pie-element/multiple-choice@1.0.0@latest",
		"@pie-element/Multiple-Choice@1.0.0",
		"@pie-element/.hidden@1.0.0",
		"@pie-element/multiple choice@1.0.0",
		"@pie-element@1.0.0",
		"@/multiple-choice@1.0.0",
		"multiple-choice@1.0.0",
		"https://cdn.example.com/x.js",
		"",
	])("rejects %p", (spec) => {
		expect(isScopedPackageSpec(spec)).toBe(false);
	});

	test.each([[undefined], [null], [42], [{}], [["@pie-element/rubric"]]])(
		"rejects the non-string %p",
		(spec) => {
			expect(isScopedPackageSpec(spec)).toBe(false);
		},
	);
});
