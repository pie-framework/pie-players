import { describe, expect, test } from "bun:test";
import { keepEqual, sameContent } from "../src/components/same-content.js";

describe("sameContent", () => {
	test("compares plain objects and arrays by content, in any key order", () => {
		expect(sameContent({ a: [1, { b: "x" }], c: null }, { c: null, a: [1, { b: "x" }] })).toBe(true);
		expect(sameContent({ a: [1, 2] }, { a: [1, 3] })).toBe(false);
		expect(sameContent({ a: 1 }, { a: 1, b: undefined })).toBe(false);
		expect(sameContent([1], { 0: 1 })).toBe(false);
	});

	test("compares functions and class instances by identity", () => {
		const fetcher = () => {};
		expect(sameContent({ fetcher }, { fetcher })).toBe(true);
		expect(sameContent({ fetcher }, { fetcher: () => {} })).toBe(false);
		expect(sameContent(new Map(), new Map())).toBe(false);
	});

	test("terminates on cyclic values", () => {
		const a: Record<string, unknown> = { id: "a" };
		a.self = a;
		const b: Record<string, unknown> = { id: "a" };
		b.self = b;
		expect(sameContent(a, b)).toBe(true);
		expect(sameContent(a, { id: "b", self: a })).toBe(false);
	});
});

describe("keepEqual", () => {
	test("keeps the previous object when the next one has the same content", () => {
		const previous = { id: "item" };
		expect(keepEqual(previous, { id: "item" })).toBe(previous);
		const next = { id: "other" };
		expect(keepEqual(previous, next)).toBe(next);
	});
});
