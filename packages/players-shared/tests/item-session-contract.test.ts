import { describe, expect, test } from "bun:test";
import {
	ensureHostSessionEntries,
	hasLearnerResponse,
	hasResponseField,
	hasResponseValue,
	normalizeItemSessionChange,
	projectSessionIntoHostContainer,
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

describe("ensureHostSessionEntries", () => {
	test("creates the entry a legacy host indexed before any answer", () => {
		const host = { id: "s1", data: [] as unknown[] };
		expect(ensureHostSessionEntries(host, ["1", "2"])).toBe(true);
		expect(host.data).toEqual([{ id: "1" }, { id: "2" }]);
	});

	test("leaves an existing entry and its content alone", () => {
		const entry = { id: "1", value: "A" };
		const host = { id: "s1", data: [entry] as unknown[] };
		expect(ensureHostSessionEntries(host, ["1"])).toBe(false);
		expect(host.data[0]).toBe(entry);
	});

	test("creates the array when the container has none", () => {
		const host: { id: string; data?: unknown[] } = { id: "s1" };
		expect(ensureHostSessionEntries(host, ["1"])).toBe(true);
		expect(host.data).toEqual([{ id: "1" }]);
	});

	test("ignores a container that is not an object", () => {
		expect(ensureHostSessionEntries("{}", ["1"])).toBe(false);
		expect(ensureHostSessionEntries(null, ["1"])).toBe(false);
	});
});

describe("projectSessionIntoHostContainer", () => {
	test("writes the response into the host's own entry object", () => {
		const entry = { id: "1" };
		const host = { id: "s1", data: [entry] as unknown[] };
		const wrote = projectSessionIntoHostContainer(host, {
			id: "s1",
			data: [{ id: "1", element: "pie-mc", value: ["A"] }],
		});
		expect(wrote).toBe(true);
		// Identity holds: a host that kept a reference to data[0] sees the value.
		expect(host.data[0]).toBe(entry);
		expect(entry).toEqual({ id: "1", element: "pie-mc", value: ["A"] });
	});

	test("keeps the array identity when it adds an entry", () => {
		const data: unknown[] = [];
		const host = { id: "s1", data };
		projectSessionIntoHostContainer(host, {
			id: "s1",
			data: [{ id: "2", value: "B" }],
		});
		expect(host.data).toBe(data);
		expect(data).toEqual([{ id: "2", value: "B" }]);
	});

	test("drops a key the live entry no longer carries", () => {
		const host = {
			id: "s1",
			data: [{ id: "1", value: "A", stale: 1 }] as unknown[],
		};
		projectSessionIntoHostContainer(host, {
			id: "s1",
			data: [{ id: "1", value: "A" }],
		});
		expect(host.data[0]).toEqual({ id: "1", value: "A" });
	});

	test("leaves entries this player did not produce", () => {
		const other = { id: "other-item", value: "kept" };
		const host = { id: "s1", data: [other] as unknown[] };
		projectSessionIntoHostContainer(host, {
			id: "s1",
			data: [{ id: "1", value: "A" }],
		});
		expect(host.data).toEqual([other, { id: "1", value: "A" }]);
	});

	test("fills the container id only when there is none", () => {
		const empty: { id?: string; data: unknown[] } = { data: [] };
		projectSessionIntoHostContainer(empty, { id: "live", data: [] });
		expect(empty.id).toBe("live");
		const owned = { id: "host-chose-this", data: [] as unknown[] };
		projectSessionIntoHostContainer(owned, { id: "live", data: [] });
		expect(owned.id).toBe("host-chose-this");
	});

	test("reports nothing written when the session is already mirrored", () => {
		const host = { id: "s1", data: [{ id: "1", value: "A" }] as unknown[] };
		expect(
			projectSessionIntoHostContainer(host, {
				id: "s1",
				data: [{ id: "1", value: "A" }],
			}),
		).toBe(false);
	});

	test("ignores a session attribute passed as a string", () => {
		expect(
			projectSessionIntoHostContainer('{"id":"s1","data":[]}', {
				id: "s1",
				data: [],
			}),
		).toBe(false);
	});
	test("refuses a frozen container, and a frozen data array", () => {
		const frozenContainer = Object.freeze({ id: "s1", data: [] as unknown[] });
		expect(
			projectSessionIntoHostContainer(frozenContainer, {
				id: "s1",
				data: [{ id: "1", value: "A" }],
			}),
		).toBe(false);
		expect(frozenContainer.data).toEqual([]);
		expect(ensureHostSessionEntries(frozenContainer, ["1"])).toBe(false);

		const frozenEntries = { id: "s1", data: Object.freeze([]) as unknown[] };
		expect(
			projectSessionIntoHostContainer(frozenEntries, {
				id: "s1",
				data: [{ id: "1", value: "A" }],
			}),
		).toBe(false);
		expect(ensureHostSessionEntries(frozenEntries, ["1"])).toBe(false);
	});

});
