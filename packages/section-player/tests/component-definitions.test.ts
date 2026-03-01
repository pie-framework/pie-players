import { describe, expect, test } from "bun:test";
import { DEFAULT_PLAYER_DEFINITIONS } from "../src/component-definitions";

describe("DEFAULT_PLAYER_DEFINITIONS", () => {
	test("maps iife, esm, and preloaded to pie-item-player", () => {
		expect(DEFAULT_PLAYER_DEFINITIONS.iife.tagName).toBe("pie-item-player");
		expect(DEFAULT_PLAYER_DEFINITIONS.esm.tagName).toBe("pie-item-player");
		expect(DEFAULT_PLAYER_DEFINITIONS.preloaded.tagName).toBe("pie-item-player");
	});

	test("uses strategy attributes for each mode", () => {
		expect(DEFAULT_PLAYER_DEFINITIONS.iife.attributes?.strategy).toBe("iife");
		expect(DEFAULT_PLAYER_DEFINITIONS.esm.attributes?.strategy).toBe("esm");
		expect(DEFAULT_PLAYER_DEFINITIONS.preloaded.attributes?.strategy).toBe("preloaded");
	});
});
