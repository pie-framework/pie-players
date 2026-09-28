import { describe, expect, test } from "bun:test";

import {
	clampOffsetOverlappingBlock,
	rotatedExtent,
} from "../src/ui/overlay-containment.js";

describe("rotatedExtent", () => {
	test("is the box itself unturned and its transpose at a quarter turn", () => {
		expect(rotatedExtent({ width: 540, height: 100 }, 0)).toEqual({
			width: 540,
			height: 100,
		});
		const quarter = rotatedExtent({ width: 540, height: 100 }, 90);
		expect(quarter.width).toBeCloseTo(100);
		expect(quarter.height).toBeCloseTo(540);
	});

	test("grows to the diagonal projection at 45 degrees", () => {
		const turned = rotatedExtent({ width: 100, height: 100 }, 45);
		expect(turned.width).toBeCloseTo(100 * Math.SQRT2);
		expect(turned.height).toBeCloseTo(100 * Math.SQRT2);
	});
});

describe("clampOffsetOverlappingBlock", () => {
	const block = { width: 545, height: 800 };
	const ruler = { width: 540, height: 100 };

	test("lets a box overhang its block until only `visible` pixels remain inside", () => {
		// travel = 545 / 2 + 540 / 2 - 100 = 442.5 each way
		expect(clampOffsetOverlappingBlock({ x: 300, y: 0 }, ruler, block, 100)).toEqual({
			x: 300,
			y: 0,
		});
		expect(clampOffsetOverlappingBlock({ x: 9999, y: 0 }, ruler, block, 100).x).toBe(442.5);
		expect(clampOffsetOverlappingBlock({ x: -9999, y: 0 }, ruler, block, 100).x).toBe(-442.5);
	});

	test("keeps all of an extent smaller than `visible`", () => {
		// A 60px-tall box in the block keeps its whole height inside.
		const clamped = clampOffsetOverlappingBlock(
			{ x: 0, y: 9999 },
			{ width: 540, height: 60 },
			block,
			100,
		);
		expect(clamped.y).toBe(800 / 2 + 60 / 2 - 60);
	});
});
