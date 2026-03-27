import { describe, expect, test } from "bun:test";
import { intersectRangeWithElement } from "../src/services/tts/visual-line-ranges";

describe("visual-line-ranges", () => {
	test("intersectRangeWithElement returns intersected range for in-root overlap", () => {
		const originalDocument = (globalThis as { document?: Document }).document;
		const originalRange = (globalThis as { Range?: unknown }).Range;
		(globalThis as { Range?: unknown }).Range = {
			END_TO_START: 3,
			START_TO_END: 1,
			START_TO_START: 0,
			END_TO_END: 2,
		};
		const mockRootRange = {
			selectNodeContents: () => {},
		} as unknown as Range;
		const mockOutRange = {
			collapsed: false,
			setStart: () => {},
			setEnd: () => {},
		} as unknown as Range;
		const mockDocument = {
			createRange: (() => {
				let callCount = 0;
				return () => {
					callCount += 1;
					return callCount === 1 ? mockRootRange : mockOutRange;
				};
			})(),
		} as unknown as Document;
		const range = {
			startContainer: { ownerDocument: mockDocument },
			startOffset: 2,
			endContainer: { ownerDocument: mockDocument },
			endOffset: 9,
			compareBoundaryPoints: (how: number) => {
				if (how === Range.END_TO_START) return 1;
				if (how === Range.START_TO_END) return -1;
				if (how === Range.START_TO_START) return 1;
				if (how === Range.END_TO_END) return -1;
				return 0;
			},
		} as unknown as Range;
		const root = {} as Element;

		try {
			(globalThis as { document?: Document }).document = mockDocument;
			const result = intersectRangeWithElement(range, root);
			expect(result).toBe(mockOutRange);
		} finally {
			if (originalDocument !== undefined) {
				(globalThis as { document?: Document }).document = originalDocument;
			}
			if (originalRange !== undefined) {
				(globalThis as { Range?: unknown }).Range = originalRange;
			} else {
				delete (globalThis as { Range?: unknown }).Range;
			}
		}
	});

	test("intersectRangeWithElement returns null when compareBoundaryPoints is missing", () => {
		const range = {
			startContainer: {},
		} as unknown as Range;
		const root = {} as Element;
		expect(intersectRangeWithElement(range, root)).toBeNull();
	});

	test("intersectRangeWithElement returns null when document is undefined", () => {
		const original = (globalThis as { document?: Document }).document;
		const range = {
			startContainer: {},
			compareBoundaryPoints: () => 0,
		} as unknown as Range;
		try {
			delete (globalThis as { document?: Document }).document;
			expect(intersectRangeWithElement(range, {} as Element)).toBeNull();
		} finally {
			if (original !== undefined) {
				(globalThis as { document?: Document }).document = original;
			}
		}
	});
});
