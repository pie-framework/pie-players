import { describe, expect, test } from "bun:test";
import { DEFAULT_TOOL_MODULE_LOADERS } from "../src/index";

describe("default tool module loaders", () => {
	test("uses theme as the only color-scheme tool id", () => {
		expect("theme" in DEFAULT_TOOL_MODULE_LOADERS).toBe(true);
		expect("colorScheme" in DEFAULT_TOOL_MODULE_LOADERS).toBe(false);
	});
});
