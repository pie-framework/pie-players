import { describe, expect, test } from "bun:test";
import {
	hasLearnerResponse,
	hasResponseField,
	hasResponseValue,
	normalizeItemSessionChange,
} from "../src/pie/item-session-contract";

describe("normalizeItemSessionChange", () => {
	test("returns replace intent for canonical item-session payload", () => {
		const out = normalizeItemSessionChange({
			itemId: "item-1",
			sessionDetail: {
				session: {
					id: "item-1",
					data: [{ id: "choice", value: "A" }],
				},
				complete: true,
			},
		});

		expect(out.intent).toBe("replace-item-session");
		expect(out.itemId).toBe("item-1");
		expect(out.complete).toBe(true);
		expect(out.session).toEqual({
			id: "item-1",
			data: [{ id: "choice", value: "A" }],
		});
	});

	test("merges element payloads into previous item session", () => {
		const out = normalizeItemSessionChange({
			itemId: "item-1",
			sessionDetail: {
				session: { id: "el-1", value: "B" },
			},
			previousItemSession: {
				id: "item-1",
				data: [{ id: "el-1", value: "A", meta: true }],
			},
		});

		expect(out.intent).toBe("merge-element-session");
		expect(out.session).toEqual({
			id: "item-1",
			data: [{ id: "el-1", value: "B", meta: true }],
		});
	});

	test("treats unchanged wrapped session with metadata fields as metadata-only", () => {
		const previousSession = {
			id: "item-1",
			data: [{ id: "choice", value: "A" }],
		};
		const out = normalizeItemSessionChange({
			itemId: "item-1",
			sessionDetail: {
				session: previousSession,
				complete: false,
				component: "multiple-choice",
			},
			previousItemSession: previousSession,
		});
		expect(out.intent).toBe("metadata-only");
		expect(out.session).toBeNull();
	});

	test("treats blank-id renderer session snapshots with unchanged data as metadata-only", () => {
		const previousSession = {
			id: "metadata-session-item",
			data: [
				{
					id: "metadata-choice",
					element: "metadata-session-fixture--version-1-0-0",
					value: ["A"],
				},
			],
		};
		const out = normalizeItemSessionChange({
			itemId: "metadata-session-item",
			sessionDetail: {
				session: {
					id: "",
					data: [
						{
							id: "metadata-choice",
							element: "metadata-session-fixture--version-1-0-0",
							value: ["A"],
						},
					],
				},
				complete: true,
				component: "metadata-session-fixture--version-1-0-0",
			},
			previousItemSession: previousSession,
		});

		expect(out.intent).toBe("metadata-only");
		expect(out.session).toBeNull();
		expect(out.complete).toBe(true);
		expect(out.component).toBe("metadata-session-fixture--version-1-0-0");
	});

	test("treats wrapped identity-only element session echoes as metadata-only", () => {
		const previousSession = {
			id: "item-1",
			data: [
				{
					id: "choice",
					element: "multiple-choice--version-1-0-0",
					value: ["A"],
				},
			],
		};
		const out = normalizeItemSessionChange({
			itemId: "item-1",
			sessionDetail: {
				session: {
					id: "item-1",
					data: [{ id: "choice", element: "multiple-choice--version-1-0-0" }],
				},
				complete: false,
				component: "multiple-choice--version-1-0-0",
			},
			previousItemSession: previousSession,
		});

		expect(out.intent).toBe("metadata-only");
		expect(out.session).toBeNull();
		expect(out.component).toBe("multiple-choice--version-1-0-0");
	});

	test("treats identity-only element session echoes as metadata-only", () => {
		const previousSession = {
			id: "item-1",
			data: [{ id: "choice", value: ["A"] }],
		};
		const out = normalizeItemSessionChange({
			itemId: "item-1",
			sessionDetail: {
				session: {
					id: "choice",
					element: "multiple-choice--version-1-0-0",
					complete: true,
					component: "choice",
					timestamp: 123,
				},
			},
			previousItemSession: previousSession,
		});

		expect(out.intent).toBe("metadata-only");
		expect(out.session).toBeNull();
		expect(out.complete).toBe(true);
		expect(out.component).toBe("choice");
	});

	test("keeps raw explicit clears as element-session data changes", () => {
		const out = normalizeItemSessionChange({
			itemId: "item-1",
			sessionDetail: {
				session: {
					id: "choice",
					element: "multiple-choice--version-1-0-0",
					value: [],
				},
			},
			previousItemSession: {
				id: "item-1",
				data: [{ id: "choice", value: ["A"] }],
			},
		});

		expect(out.intent).toBe("merge-element-session");
		expect(out.session).toEqual({
			id: "item-1",
			data: [
				{
					id: "choice",
					element: "multiple-choice--version-1-0-0",
					value: [],
				},
			],
		});
	});

	test("keeps raw empty-string clears as element-session data changes", () => {
		const out = normalizeItemSessionChange({
			itemId: "item-1",
			sessionDetail: {
				session: {
					id: "text-entry",
					element: "text-entry--version-1-0-0",
					value: "",
				},
			},
			previousItemSession: {
				id: "item-1",
				data: [{ id: "text-entry", value: "typed answer" }],
			},
		});

		expect(out.intent).toBe("merge-element-session");
		expect(out.session).toEqual({
			id: "item-1",
			data: [
				{
					id: "text-entry",
					element: "text-entry--version-1-0-0",
					value: "",
				},
			],
		});
	});

	test("keeps derived element state as element-session data changes", () => {
		const out = normalizeItemSessionChange({
			itemId: "item-1",
			sessionDetail: {
				session: {
					id: "choice",
					element: "ebsr--version-1-0-0",
					shuffledValues: { partA: ["b", "a"] },
				},
			},
			previousItemSession: {
				id: "item-1",
				data: [{ id: "choice", value: ["A"] }],
			},
		});

		expect(out.intent).toBe("merge-element-session");
		expect(out.session).toEqual({
			id: "item-1",
			data: [
				{
					id: "choice",
					value: ["A"],
					element: "ebsr--version-1-0-0",
					shuffledValues: { partA: ["b", "a"] },
				},
			],
		});
	});
});

describe("hasResponseValue", () => {
	test("detects nested response values", () => {
		expect(
			hasResponseValue({
				data: [{ id: "el", response: { value: ["A"] } }],
			}),
		).toBe(true);
		expect(hasResponseValue({ data: [{ id: "el", meta: "x" }] })).toBe(false);
	});
});

/**
 * Real session shapes, taken from the element controllers. The commit sweep's
 * fallback discriminant turns on these, so a shape reading the wrong way is
 * either a lost response or an announcement of one that never happened.
 */
describe("hasLearnerResponse", () => {
	const answered: Array<[string, unknown]> = [
		["multiple-choice", { id: "1", element: "multiple-choice", value: ["A"] }],
		[
			"extended-text-entry",
			{ id: "1", element: "extended-text-entry", value: "<p>hi</p>" },
		],
		["math-inline", { id: "1", element: "math-inline", response: "\\frac{1}{2}" }],
		["math-inline complete", { id: "1", element: "math-inline", completeAnswer: "x=1" }],
		[
			"math-templated",
			{ id: "1", element: "math-templated", answers: { r1: { value: "2" } } },
		],
		[
			"select-text",
			{ id: "1", element: "select-text", selectedTokens: [{ start: 0, end: 4 }] },
		],
		["hotspot", { id: "1", element: "hotspot", answers: [{ id: "h2" }] }],
		[
			"categorize",
			{ id: "1", element: "categorize", answers: [{ category: "c1", choices: ["a"] }] },
		],
		["match", { id: "1", element: "match", answers: { row1: [true, false] } }],
		[
			"number-line",
			{ id: "1", element: "number-line", answer: [{ type: "point", domainPosition: 3 }] },
		],
		[
			"graphing",
			{ id: "1", element: "graphing", answer: { marks: [{ type: "point", x: 1, y: 2 }] } },
		],
		[
			"drawing-response",
			{ id: "1", element: "drawing-response", drawables: [{ t: "line" }], texts: [] },
		],
		[
			"image-cloze-association",
			{ id: "1", element: "image-cloze-association", answers: ["a", "b"] },
		],
		[
			"explicit-constructed-response",
			{ id: "1", element: "explicit-constructed-response", value: { "0": "cat" } },
		],
		[
			"ebsr with one part answered",
			{
				id: "1",
				element: "ebsr",
				shuffledValues: { partA: ["1", "2"] },
				value: { partA: { id: "partA", value: ["1"] }, partB: { id: "partB" } },
			},
		],
		["charting", { id: "1", element: "charting", answer: [{ label: "a", value: 3 }] }],
	];

	const untouched: Array<[string, unknown]> = [
		["identity only", { id: "1", element: "multiple-choice" }],
		[
			"identity and dispatch metadata",
			{ id: "1", element: "multiple-choice", complete: false, component: "multiple-choice" },
		],
		[
			"controller-written shuffle order",
			{ id: "1", element: "multiple-choice", shuffledValues: ["c", "a", "b"] },
		],
		[
			"ebsr part structure with no answer",
			{
				id: "1",
				element: "ebsr",
				shuffledValues: { partA: ["1", "2"] },
				value: { partA: { id: "partA" }, partB: { id: "partB" } },
			},
		],
		["deselected choice", { id: "1", element: "multiple-choice", value: [] }],
		["cleared text", { id: "1", element: "extended-text-entry", value: "" }],
		["whitespace text", { id: "1", element: "extended-text-entry", value: "   " }],
		["emptied marks", { id: "1", element: "graphing", answer: {} }],
		[
			"blank constructed-response parts",
			{ id: "1", element: "explicit-constructed-response", value: { "0": "", "1": "" } },
		],
		["emptied answers", { id: "1", element: "hotspot", answers: [] }],
		["not a session", null],
	];

	for (const [name, session] of answered) {
		test(`answered: ${name}`, () => {
			expect(hasLearnerResponse(session)).toBe(true);
		});
	}
	for (const [name, session] of untouched) {
		test(`untouched: ${name}`, () => {
			expect(hasLearnerResponse(session)).toBe(false);
		});
	}
});

describe("hasResponseField", () => {
	test("detects explicit response key even when value is empty", () => {
		expect(hasResponseField({ data: [{ id: "el", value: [] }] })).toBe(true);
		expect(hasResponseField({ data: [{ id: "el", value: "" }] })).toBe(true);
		expect(hasResponseField({ data: [{ id: "el", meta: "x" }] })).toBe(false);
	});
});
