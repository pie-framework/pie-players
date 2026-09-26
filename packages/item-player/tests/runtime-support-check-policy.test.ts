import { describe, expect, test } from "bun:test";
import { shouldProbeRuntimeSupport } from "../src/runtime-support-check";

describe("runtime-support check policy", () => {
	test("ignores runtimeSupportCheck for iife", () => {
		expect(shouldProbeRuntimeSupport("iife", "on")).toBe(false);
	});

	test("honors runtimeSupportCheck for esm", () => {
		expect(shouldProbeRuntimeSupport("esm", "on")).toBe(true);
		expect(shouldProbeRuntimeSupport("esm", "off")).toBe(false);
	});

	test("ignores runtimeSupportCheck for preloaded, which loads nothing", () => {
		expect(shouldProbeRuntimeSupport("preloaded", "on")).toBe(false);
		expect(shouldProbeRuntimeSupport("preloaded", "off")).toBe(false);
	});
});
