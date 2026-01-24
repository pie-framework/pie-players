import { describe, expect, test } from "bun:test";
import { ToolConfigResolver } from "../src/services/ToolConfigResolver";

describe("ToolConfigResolver", () => {
	test("itemConfig wins and returns source=item", () => {
		const resolver = new ToolConfigResolver();
		const out = resolver.resolveTool(
			"calculator",
			{
				calculator: {
					type: "scientific",
					required: true,
					settings: { foo: "bar" },
				},
			},
			{ calculator: "0" },
			{ accommodations: ["calculator"] },
		);

		expect(out).toEqual({
			enabled: true,
			type: "scientific",
			required: true,
			settings: { foo: "bar" },
			source: "item",
		});
	});

	test("roster blocks tool when allowance is '0'", () => {
		const resolver = new ToolConfigResolver();
		const out = resolver.resolveTool(
			"dictionary",
			undefined,
			{ dictionary: "0" },
			{ accommodations: ["dictionary"] },
		);
		expect(out).toBeNull();
	});

	test("roster enables tool when allowance is '1'", () => {
		const resolver = new ToolConfigResolver();
		const out = resolver.resolveTool(
			"calculator",
			undefined,
			{ calculator: "1" },
			{ accommodations: [] },
		);
		expect(out).toEqual({ enabled: true, required: false, source: "roster" });
	});

	test("student accommodation enables tool when not blocked/configured elsewhere", () => {
		const resolver = new ToolConfigResolver();
		const out = resolver.resolveTool("tts", undefined, undefined, {
			accommodations: ["tts"],
		});
		expect(out).toEqual({ enabled: true, required: false, source: "student" });
	});

	test("resolveAll aggregates tool ids across levels", () => {
		const resolver = new ToolConfigResolver();
		const out = resolver.resolveAll({
			itemConfig: { tts: { required: true } },
			rosterConfig: { calculator: "1", dictionary: "0" },
			studentProfile: { accommodations: ["highlight"] },
		});

		expect(Array.from(out.keys()).sort()).toEqual([
			"calculator",
			"highlight",
			"tts",
		]);
		expect(out.get("dictionary")).toBeUndefined();
	});
});
