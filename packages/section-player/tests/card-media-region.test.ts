/**
 * Media-region sizing.
 *
 * What fills the region, and whether it has anything to show, belongs to the
 * capability registered on the `content-media` surface — see
 * `@pie-players/pie-tool-sign-language` for the first one. Only the host's sizing
 * is decidable here.
 */

import { describe, expect, test } from "bun:test";

import {
	clampMediaRegionPercent,
	MEDIA_REGION_DEFAULT_PERCENT,
	MEDIA_REGION_MAX_PERCENT,
	MEDIA_REGION_MIN_PERCENT,
	mediaRegionPercentFromDrag,
} from "../src/components/shared/card-media-region.js";

describe("media region sizing", () => {
	test("clamps to the region bounds", () => {
		expect(clampMediaRegionPercent(5)).toBe(MEDIA_REGION_MIN_PERCENT);
		expect(clampMediaRegionPercent(95)).toBe(MEDIA_REGION_MAX_PERCENT);
		expect(clampMediaRegionPercent(40)).toBe(40);
		expect(clampMediaRegionPercent(Number.NaN)).toBe(
			MEDIA_REGION_DEFAULT_PERCENT,
		);
	});

	test("converts a drag relative to the container, so the same drag means the same thing", () => {
		// Dragging left grows the region, which sits on the right.
		expect(
			mediaRegionPercentFromDrag({
				startPercent: 34,
				deltaX: -100,
				containerWidthPx: 1000,
			}),
		).toBe(44);
		expect(
			mediaRegionPercentFromDrag({
				startPercent: 34,
				deltaX: -50,
				containerWidthPx: 500,
			}),
		).toBe(44);
		expect(
			mediaRegionPercentFromDrag({
				startPercent: 34,
				deltaX: 100,
				containerWidthPx: 1000,
			}),
		).toBe(24);
	});

	test("clamps a drag past the bounds and survives a zero-width container", () => {
		expect(
			mediaRegionPercentFromDrag({
				startPercent: 34,
				deltaX: -900,
				containerWidthPx: 1000,
			}),
		).toBe(MEDIA_REGION_MAX_PERCENT);
		expect(
			mediaRegionPercentFromDrag({
				startPercent: 34,
				deltaX: -100,
				containerWidthPx: 0,
			}),
		).toBe(34);
	});
});
