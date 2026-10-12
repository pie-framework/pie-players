import { describe, expect, test } from "bun:test";
import {
	createScopedToolId,
	parseScopedToolId,
} from "../src/services/tool-instance-id";

describe("tool-instance-id", () => {
	test("creates and parses overlay ids", () => {
		const id = createScopedToolId("calculator", "item", "item-1");
		expect(id).toBe("calculator:item:item-1");
		expect(parseScopedToolId(id)).toEqual({
			baseToolId: "calculator",
			scopeLevel: "item",
			scopeId: "item-1",
		});
	});

	test("rejects non-canonical four-part ids", () => {
		const inlineId = "calculator:item:item-1:inline";
		expect(parseScopedToolId(inlineId)).toBeNull();
	});

	test("supports built-in rubric and assessment scopes", () => {
		expect(createScopedToolId("highlighter", "rubric", "rb-2")).toBe(
			"highlighter:rubric:rb-2",
		);
		expect(createScopedToolId("theme", "assessment", "assess-1")).toBe(
			"theme:assessment:assess-1",
		);
	});
});
