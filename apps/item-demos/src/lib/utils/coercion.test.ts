import { describe, expect, test } from "bun:test";
import { coerceMode, coerceRole } from "./coercion";

describe("coerceRole", () => {
	test("returns instructor only for explicit instructor role", () => {
		expect(coerceRole("instructor")).toBe("instructor");
		expect(coerceRole("student")).toBe("student");
		expect(coerceRole("anything-else")).toBe("student");
		expect(coerceRole(null)).toBe("student");
	});
});

describe("coerceMode", () => {
	test("keeps evaluate for instructor and guards student evaluate", () => {
		expect(coerceMode("evaluate", "instructor")).toBe("evaluate");
		expect(coerceMode("evaluate", "student")).toBe("gather");
	});

	test("passes through supported modes and defaults unknown to gather", () => {
		expect(coerceMode("view", "student")).toBe("view");
		expect(coerceMode("gather", "student")).toBe("gather");
		expect(coerceMode("browse", "student")).toBe("gather");
		expect(coerceMode("browse", "instructor")).toBe("gather");
		expect(coerceMode("unknown", "student")).toBe("gather");
		expect(coerceMode(null, "student")).toBe("gather");
	});
});
