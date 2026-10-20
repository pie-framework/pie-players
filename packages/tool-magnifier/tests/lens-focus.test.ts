import { describe, expect, test } from "bun:test";

import { lensFocus } from "../src/lens-focus.js";

// A 1000px block from 100, a 200px lens over a 196px view at twice the size:
// the view shows 98px of the page.
const block = { start: 100, extent: 1000 };
const gutter = 8;
const at = (start: number, level = 2) =>
	lensFocus({ start, extent: 200 }, block, 196, level, gutter);

describe("lensFocus", () => {
	test("shows the block's near edge with the lens against it", () => {
		expect(at(block.start + gutter) - 98 / 2).toBe(block.start);
	});

	test("shows the block's far edge with the lens against it", () => {
		const farthest = block.start + block.extent - gutter - 200;
		expect(at(farthest) + 98 / 2).toBe(block.start + block.extent);
	});

	test("shows the block's centre with the lens centred", () => {
		const centred = block.start + (block.extent - 200) / 2;
		expect(at(centred)).toBe(block.start + block.extent / 2);
	});

	test("holds at the ends past the lens's travel", () => {
		expect(at(0)).toBe(at(block.start + gutter));
		expect(at(5000)).toBe(at(block.start + block.extent - gutter - 200));
	});

	test("centres a block narrower than the view", () => {
		const narrow = { start: 40, extent: 80 };
		expect(lensFocus({ start: 40, extent: 60 }, narrow, 196, 2, gutter)).toBe(80);
	});

	test("centres the view when the lens fills its block", () => {
		const filled = { start: 0, extent: 216 };
		expect(lensFocus({ start: 8, extent: 200 }, filled, 196, 4, gutter)).toBe(108);
	});
});
