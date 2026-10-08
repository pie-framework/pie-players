import { describe, expect, test } from "bun:test";

import { structurallyEqual } from "../src/utils/structural-equality.js";

describe("structurallyEqual", () => {
	test("compares plain objects by content, in any key order", () => {
		expect(
			structurallyEqual(
				{ id: "a1", settings: { blocked: ["x"], mode: "test" } },
				{ settings: { mode: "test", blocked: ["x"] }, id: "a1" },
			),
		).toBe(true);
		expect(structurallyEqual({ list: ["x", "y"] }, { list: ["y", "x"] })).toBe(
			false,
		);
		expect(structurallyEqual({ a: undefined }, {})).toBe(true);
		expect(structurallyEqual([1, 2], [1, 2, 3])).toBe(false);
		expect(structurallyEqual([], {})).toBe(false);
	});

	test("compares class instances by reference", () => {
		expect(structurallyEqual(new Map([["a", 1]]), new Map([["a", 2]]))).toBe(
			false,
		);
		const shared = new Date(0);
		expect(structurallyEqual({ at: shared }, { at: shared })).toBe(true);
	});

	test("terminates on cyclic values", () => {
		const a: Record<string, unknown> = { id: "a" };
		a.self = a;
		const b: Record<string, unknown> = { id: "a" };
		b.self = b;
		expect(structurallyEqual(a, b)).toBe(true);
	});
});
