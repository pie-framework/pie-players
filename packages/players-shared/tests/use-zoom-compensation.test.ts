import { describe, expect, test } from "bun:test";
import {
	approximateZoomFromWidths,
	computeZoomCompensation,
} from "../src/ui/zoom-compensation.js";

describe("approximateZoomFromWidths", () => {
	test("returns outer / inner ratio for typical zoom levels", () => {
		expect(approximateZoomFromWidths(1600, 1600)).toBeCloseTo(1);
		expect(approximateZoomFromWidths(1600, 800)).toBeCloseTo(2);
		expect(approximateZoomFromWidths(1600, 400)).toBeCloseTo(4);
	});

	test("falls back to 1 for non-finite / non-positive ratios", () => {
		expect(approximateZoomFromWidths(1600, 0)).toBe(1);
		expect(approximateZoomFromWidths(-1600, 800)).toBe(1);
		expect(approximateZoomFromWidths(Number.NaN, 800)).toBe(1);
		expect(approximateZoomFromWidths(1600, Number.NaN)).toBe(1);
	});
});

describe("computeZoomCompensation", () => {
	const MAX_ZOOM = 2;
	const MIN_COMPENSATION = 0.4;

	test("stays at 1 while zoom is at or below maxZoom", () => {
		expect(computeZoomCompensation(1, MAX_ZOOM, MIN_COMPENSATION)).toBe(1);
		expect(computeZoomCompensation(1.5, MAX_ZOOM, MIN_COMPENSATION)).toBe(1);
		expect(computeZoomCompensation(2, MAX_ZOOM, MIN_COMPENSATION)).toBe(1);
	});

	test("shrinks as maxZoom / zoom past the threshold", () => {
		expect(computeZoomCompensation(3, MAX_ZOOM, MIN_COMPENSATION)).toBeCloseTo(
			2 / 3,
		);
		expect(computeZoomCompensation(4, MAX_ZOOM, MIN_COMPENSATION)).toBeCloseTo(
			0.5,
		);
	});

	test("clamps at minCompensation to guard against inflated ratios", () => {
		expect(computeZoomCompensation(10, MAX_ZOOM, MIN_COMPENSATION)).toBe(
			MIN_COMPENSATION,
		);
		expect(computeZoomCompensation(1000, MAX_ZOOM, MIN_COMPENSATION)).toBe(
			MIN_COMPENSATION,
		);
	});
});
