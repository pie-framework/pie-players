import { describe, expect, test } from "bun:test";
import { DEFAULT_PLAYER_DEFINITIONS } from "../src/component-definitions";

describe("DEFAULT_PLAYER_DEFINITIONS", () => {
	test("maps iife, esm, and fixed to pie-item-player", () => {
		expect(DEFAULT_PLAYER_DEFINITIONS.iife.tagName).toBe("pie-item-player");
		expect(DEFAULT_PLAYER_DEFINITIONS.esm.tagName).toBe("pie-item-player");
		expect(DEFAULT_PLAYER_DEFINITIONS.fixed.tagName).toBe("pie-item-player");
	});

	test("uses strategy attributes for each mode", () => {
		expect(DEFAULT_PLAYER_DEFINITIONS.iife.attributes?.strategy).toBe("iife");
		expect(DEFAULT_PLAYER_DEFINITIONS.esm.attributes?.strategy).toBe("esm");
		expect(DEFAULT_PLAYER_DEFINITIONS.fixed.attributes?.strategy).toBe("preloaded");
	});
});
