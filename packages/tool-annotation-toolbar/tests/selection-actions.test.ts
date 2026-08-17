import { describe, expect, it } from "bun:test";
import type { ToolSelectionAction } from "@pie-players/pie-assessment-toolkit";
import {
	isSelectionActionAvailable,
	isSelectionActionShape,
	MAX_SELECTION_ACTION_LABEL,
	usableSelectionActions,
} from "../selection-actions.js";

function action(overrides: Partial<ToolSelectionAction> = {}): unknown {
	return {
		id: "dictionary",
		label: "Look up selected text in dictionary",
		run: () => {},
		...overrides,
	};
}

describe("isSelectionActionShape", () => {
	it("accepts the minimum an action needs", () => {
		expect(isSelectionActionShape(action())).toBe(true);
	});

	it("accepts the optional fields when well typed", () => {
		expect(
			isSelectionActionShape(
				action({
					iconSvg: "<svg></svg>",
					tooltip: "Look up",
					isAvailable: () => true,
				}),
			),
		).toBe(true);
	});

	it("rejects entries missing an id, label or run", () => {
		expect(isSelectionActionShape(action({ id: undefined }))).toBe(false);
		expect(isSelectionActionShape(action({ label: undefined }))).toBe(false);
		expect(isSelectionActionShape(action({ run: undefined }))).toBe(false);
	});

	it("rejects a blank id or label, which would render an unidentifiable button", () => {
		expect(isSelectionActionShape(action({ id: "   " }))).toBe(false);
		expect(isSelectionActionShape(action({ label: "" }))).toBe(false);
	});

	it("rejects a label long enough to crowd out the highlight swatches", () => {
		const label = "x".repeat(MAX_SELECTION_ACTION_LABEL + 1);
		expect(isSelectionActionShape(action({ label }))).toBe(false);
	});

	it("rejects wrongly typed optional fields", () => {
		expect(
			isSelectionActionShape(action({ iconSvg: 42 as unknown as string })),
		).toBe(false);
		expect(
			isSelectionActionShape(action({ tooltip: {} as unknown as string })),
		).toBe(false);
		expect(
			isSelectionActionShape(
				action({ isAvailable: "yes" as unknown as () => boolean }),
			),
		).toBe(false);
	});

	it("rejects non-objects", () => {
		expect(isSelectionActionShape(null)).toBe(false);
		expect(isSelectionActionShape("dictionary")).toBe(false);
		expect(isSelectionActionShape(undefined)).toBe(false);
	});
});

describe("isSelectionActionAvailable", () => {
	it("treats an action with no predicate as available", () => {
		expect(
			isSelectionActionAvailable(action() as ToolSelectionAction),
		).toBe(true);
	});

	it("honours the predicate in both directions", () => {
		expect(
			isSelectionActionAvailable(
				action({ isAvailable: () => false }) as ToolSelectionAction,
			),
		).toBe(false);
		expect(
			isSelectionActionAvailable(
				action({ isAvailable: () => true }) as ToolSelectionAction,
			),
		).toBe(true);
	});

	// The predicate reaches into policy while the strip is rendering over a live
	// selection. Dropping the one action is what leaves the learner the rest.
	it("treats a throwing predicate as unavailable rather than failing the render", () => {
		expect(
			isSelectionActionAvailable(
				action({
					isAvailable: () => {
						throw new Error("policy read failed");
					},
				}) as ToolSelectionAction,
			),
		).toBe(false);
	});
});

describe("usableSelectionActions", () => {
	it("keeps the order it is given", () => {
		const usable = usableSelectionActions([
			action({ id: "dictionary" }),
			action({ id: "pictureDictionary" }),
		]);
		expect(usable.map((entry) => entry.id)).toEqual([
			"dictionary",
			"pictureDictionary",
		]);
	});

	it("drops a malformed entry without losing the rest", () => {
		const usable = usableSelectionActions([
			{ id: "broken" },
			action({ id: "dictionary" }),
		]);
		expect(usable.map((entry) => entry.id)).toEqual(["dictionary"]);
	});

	it("drops unavailable entries", () => {
		const usable = usableSelectionActions([
			action({ id: "dictionary", isAvailable: () => false }),
			action({ id: "pictureDictionary" }),
		]);
		expect(usable.map((entry) => entry.id)).toEqual(["pictureDictionary"]);
	});

	// Ids are the button keys and land in `data-pie-selection-action`, so two buttons
	// sharing one would be indistinguishable to a test and to a host querying the strip.
	it("drops a duplicate id, keeping the first", () => {
		const first = action({ id: "dictionary", tooltip: "first" });
		const usable = usableSelectionActions([
			first,
			action({ id: "dictionary", tooltip: "second" }),
		]);
		expect(usable).toHaveLength(1);
		expect(usable[0].tooltip).toBe("first");
	});

	it("returns nothing for a non-array, so an absent prop offers no actions", () => {
		expect(usableSelectionActions(undefined)).toEqual([]);
		expect(usableSelectionActions(null)).toEqual([]);
		expect(usableSelectionActions({ id: "dictionary" })).toEqual([]);
	});

	it("returns nothing for an empty array", () => {
		expect(usableSelectionActions([])).toEqual([]);
	});
});
