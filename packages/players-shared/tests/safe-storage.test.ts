import { afterEach, describe, expect, test } from "bun:test";
import {
	safeLocalStorageGet,
	safeLocalStorageSet,
} from "../src/ui/safe-storage";

const originalLocalStorage = (globalThis as any).localStorage;

afterEach(() => {
	(globalThis as any).localStorage = originalLocalStorage;
});

describe("safeLocalStorageGet", () => {
	test("returns null when localStorage is unavailable", () => {
		(globalThis as any).localStorage = undefined;
		expect(safeLocalStorageGet("x")).toBeNull();
	});

	test("returns value when localStorage works", () => {
		(globalThis as any).localStorage = {
			getItem: (k: string) => (k === "k" ? "v" : null),
		};
		expect(safeLocalStorageGet("k")).toBe("v");
	});

	test("returns null when localStorage throws", () => {
		(globalThis as any).localStorage = {
			getItem: () => {
				throw new Error("boom");
			},
		};
		expect(safeLocalStorageGet("k")).toBeNull();
	});
});

describe("safeLocalStorageSet", () => {
	test("does nothing when localStorage is unavailable", () => {
		(globalThis as any).localStorage = undefined;
		expect(() => safeLocalStorageSet("k", "v")).not.toThrow();
	});

	test("sets value when localStorage works", () => {
		let got: { k?: string; v?: string } = {};
		(globalThis as any).localStorage = {
			setItem: (k: string, v: string) => {
				got = { k, v };
			},
		};
		safeLocalStorageSet("k", "v");
		expect(got).toEqual({ k: "k", v: "v" });
	});

	test("swallows errors when localStorage throws", () => {
		(globalThis as any).localStorage = {
			setItem: () => {
				throw new Error("boom");
			},
		};
		expect(() => safeLocalStorageSet("k", "v")).not.toThrow();
	});
});
