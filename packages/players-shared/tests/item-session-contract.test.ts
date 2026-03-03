import { describe, expect, test } from "bun:test";
import {
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
