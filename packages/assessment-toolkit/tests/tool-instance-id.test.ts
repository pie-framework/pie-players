import { describe, expect, test } from "bun:test";
import {
	createScopedToolId,
	getRegisteredToolScopeLevels,
	parseScopedToolId,
	registerToolScopeLevel,
	toOverlayToolId,
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

	test("parses legacy inline ids", () => {
		const id = "calculator:item:item-1:inline";
		expect(parseScopedToolId(id)).toEqual({
			baseToolId: "calculator",
			scopeLevel: "item",
			scopeId: "item-1",
		});
	});

	test("converts inline id to overlay id", () => {
		const inlineId = "calculator:item:item-1:inline";
		expect(toOverlayToolId(inlineId)).toBe("calculator:item:item-1");
	});

	test("supports built-in rubric and assessment scopes", () => {
		expect(createScopedToolId("highlighter", "rubric", "rb-2")).toBe(
			"highlighter:rubric:rb-2",
		);
		expect(createScopedToolId("colorScheme", "assessment", "assess-1")).toBe(
			"colorScheme:assessment:assess-1",
		);
	});

	test("allows registering custom scope levels", () => {
		registerToolScopeLevel("interaction");
		expect(getRegisteredToolScopeLevels()).toContain("interaction");

		const interactionId = createScopedToolId(
			"answerEliminator",
			"interaction",
			"int-11",
		);
		expect(interactionId).toBe("answerEliminator:interaction:int-11");
		expect(parseScopedToolId(interactionId)?.scopeLevel).toBe("interaction");
	});
});
