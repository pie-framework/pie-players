import { describe, expect, test } from "bun:test";
import { resolveSessionCommitContextValue } from "../src/session-commit-context";

describe("resolveSessionCommitContextValue", () => {
	test("unset leaves the element its own default", () => {
		expect(resolveSessionCommitContextValue(undefined)).toEqual({});
	});

	test("carries a host's delay, 0 included", () => {
		expect(resolveSessionCommitContextValue(3000)).toEqual({
			idleSaveDelayMs: 3000,
		});
		expect(resolveSessionCommitContextValue(0)).toEqual({ idleSaveDelayMs: 0 });
	});

	test("drops a value an element cannot use", () => {
		for (const value of [
			-1,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			"1500",
			null,
		]) {
			expect(resolveSessionCommitContextValue(value)).toEqual({});
		}
	});
});
