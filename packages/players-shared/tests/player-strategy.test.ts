import { describe, expect, test } from "bun:test";
import {
	normalizeItemPlayerStrategy,
	resolveItemPlayerView,
} from "../src/player-strategy";

describe("normalizeItemPlayerStrategy", () => {
	test("returns provided strategy when valid", () => {
		expect(normalizeItemPlayerStrategy("iife")).toBe("iife");
		expect(normalizeItemPlayerStrategy("esm")).toBe("esm");
		expect(normalizeItemPlayerStrategy("preloaded")).toBe("preloaded");
	});

	test("falls back for invalid or missing strategy", () => {
		expect(normalizeItemPlayerStrategy("invalid")).toBe("iife");
		expect(normalizeItemPlayerStrategy(undefined, "esm")).toBe("esm");
		expect(normalizeItemPlayerStrategy(null, "preloaded")).toBe("preloaded");
	});
});

describe("resolveItemPlayerView", () => {
	test("maps author mode to author view", () => {
		expect(resolveItemPlayerView("author")).toBe("author");
	});

	test("defaults non-author modes to delivery", () => {
		expect(resolveItemPlayerView("gather")).toBe("delivery");
		expect(resolveItemPlayerView("view")).toBe("delivery");
		expect(resolveItemPlayerView("evaluate")).toBe("delivery");
	});

	test("accepts a non-default fallback", () => {
		expect(resolveItemPlayerView("gather", "print")).toBe("print");
	});
});
