import { describe, expect, test } from "bun:test";

import {
	clampOffsetOverlappingBlock,
	rotatedExtent,
	rotationCentreShift,
} from "../src/ui/overlay-containment.js";

describe("rotationCentreShift", () => {
	const protractor = { width: 400, height: 210 };
	const vertex = { x: 200, y: 200 };

	test("is zero unturned and for a box turned about its centre", () => {
		expect(rotationCentreShift(protractor, vertex, 0)).toEqual({ x: 0, y: 0 });
		const aboutCentre = rotationCentreShift(protractor, { x: 200, y: 105 }, 37);
		expect(aboutCentre.x).toBeCloseTo(0);
		expect(aboutCentre.y).toBeCloseTo(0);
	});

	test("swings the centre around the origin", () => {
		// The centre sits 95px above the vertex; a quarter turn clockwise on
		// screen carries it 95px to the vertex's right, a half turn below it.
		const quarter = rotationCentreShift(protractor, vertex, 90);
		expect(quarter.x).toBeCloseTo(95);
		expect(quarter.y).toBeCloseTo(95);
		const half = rotationCentreShift(protractor, vertex, 180);
		expect(half.x).toBeCloseTo(0);
		expect(half.y).toBeCloseTo(190);
	});
});

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
