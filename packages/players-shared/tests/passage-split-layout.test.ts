import { describe, expect, it } from "bun:test";
import {
	clampPassageSplitPercent,
	isPassageSplitStacked,
	PASSAGE_SPLIT_DEFAULT_PERCENT,
	PASSAGE_SPLIT_MAX_PERCENT,
	PASSAGE_SPLIT_MIN_PERCENT,
	PASSAGE_SPLIT_STACK_BREAKPOINT_PX,
	passageSplitPercentFromDrag,
	passageSplitPercentFromKey,
	resolvePassageLayout,
} from "../src/components/passage-split-layout.js";

describe("resolvePassageLayout", () => {
	it("opts in only on splitpane", () => {
		expect(resolvePassageLayout("splitpane")).toBe("splitpane");
		for (const value of ["vertical", "", "split", "SPLITPANE", undefined, null, true]) {
			expect(resolvePassageLayout(value)).toBe("vertical");
		}
	});
});

describe("isPassageSplitStacked", () => {
	it("stacks below the breakpoint, and not before the width is measured", () => {
		expect(isPassageSplitStacked(0)).toBe(false);
		expect(isPassageSplitStacked(PASSAGE_SPLIT_STACK_BREAKPOINT_PX - 1)).toBe(true);
		expect(isPassageSplitStacked(PASSAGE_SPLIT_STACK_BREAKPOINT_PX)).toBe(false);
	});
});

describe("clampPassageSplitPercent", () => {
	it("bounds the passage share and falls back on a non-number", () => {
		expect(clampPassageSplitPercent(5)).toBe(PASSAGE_SPLIT_MIN_PERCENT);
		expect(clampPassageSplitPercent(95)).toBe(PASSAGE_SPLIT_MAX_PERCENT);
		expect(clampPassageSplitPercent(Number.NaN)).toBe(PASSAGE_SPLIT_DEFAULT_PERCENT);
	});
});

describe("passageSplitPercentFromDrag", () => {
	it("is relative to the container width", () => {
		expect(
			passageSplitPercentFromDrag({ startPercent: 50, deltaX: 100, containerWidthPx: 1000 }),
		).toBe(60);
		expect(
			passageSplitPercentFromDrag({ startPercent: 50, deltaX: 100, containerWidthPx: 2000 }),
		).toBe(55);
	});

	it("grows the passage on a leftward drag in a right-to-left document", () => {
		expect(
			passageSplitPercentFromDrag({
				startPercent: 50,
				deltaX: -100,
				containerWidthPx: 1000,
				rtl: true,
			}),
		).toBe(60);
	});

	it("keeps the start value when the width is unknown", () => {
		expect(
			passageSplitPercentFromDrag({ startPercent: 40, deltaX: 300, containerWidthPx: 0 }),
		).toBe(40);
	});
});

describe("passageSplitPercentFromKey", () => {
	it("moves the divider the way the arrow points", () => {
		expect(passageSplitPercentFromKey({ key: "ArrowRight", percent: 50 })).toBe(55);
		expect(passageSplitPercentFromKey({ key: "ArrowLeft", percent: 50 })).toBe(45);
		expect(passageSplitPercentFromKey({ key: "ArrowLeft", percent: 50, rtl: true })).toBe(55);
	});

	it("jumps to the bounds on Home and End and ignores other keys", () => {
		expect(passageSplitPercentFromKey({ key: "Home", percent: 50 })).toBe(PASSAGE_SPLIT_MIN_PERCENT);
		expect(passageSplitPercentFromKey({ key: "End", percent: 50 })).toBe(PASSAGE_SPLIT_MAX_PERCENT);
		expect(passageSplitPercentFromKey({ key: "Enter", percent: 50 })).toBeUndefined();
	});
});
