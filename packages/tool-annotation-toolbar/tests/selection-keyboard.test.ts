import { describe, expect, test } from "bun:test";

import {
	clampIndex,
	isPointerGestureActive,
	isRectOffScreen,
	nextControlIndex,
	POINTER_GESTURE_MAX_MS,
	requestsSelectionToolbar,
	toolbarAnchor,
} from "../selection-keyboard.js";

/**
 * The defect these pin: the toolbar was reachable only with a pointer. It listened
 * to `mouseup` and `touchend`, so a selection made with Shift+Arrow never showed it,
 * and highlight, underline and read-aloud-selection had no keyboard path at all —
 * WCAG 2.2 SC 2.1.1. It also declared `role="toolbar"` while making every button its
 * own tab stop, so the arrow keys the role advertises did nothing.
 */

const VIEWPORT = { width: 1000, height: 800 };

/** Component source, for the wiring assertions at the end of this file. */
const component = await Bun.file(
	new URL("../tool-annotation-toolbar.svelte", import.meta.url),
).text();

function rect(
	top: number,
	bottom: number,
	left = 100,
	right = 200,
): { top: number; bottom: number; left: number; right: number } {
	return { top, bottom, left, right };
}

describe("requesting the selection toolbar", () => {
	test("Shift+F10 asks for it", () => {
		expect(requestsSelectionToolbar({ key: "F10", shiftKey: true })).toBe(true);
	});

	test("the Menu key asks for it", () => {
		expect(requestsSelectionToolbar({ key: "ContextMenu" })).toBe(true);
	});

	test("bare F10 does not, because it belongs to the browser's menu bar", () => {
		expect(requestsSelectionToolbar({ key: "F10", shiftKey: false })).toBe(
			false,
		);
		expect(requestsSelectionToolbar({ key: "F10" })).toBe(false);
	});

	test("ordinary selection keys do not", () => {
		// Shift+Arrow is how the selection is made. If it also opened the strip and
		// moved focus, extending a selection would be impossible.
		for (const key of ["ArrowRight", "ArrowLeft", "a", "Enter", " "]) {
			expect(requestsSelectionToolbar({ key, shiftKey: true })).toBe(false);
		}
	});
});

describe("roving tabindex navigation", () => {
	test("arrows step forward and back in a left-to-right strip", () => {
		const args = { activeIndex: 1, count: 4, direction: "ltr" as const };
		expect(nextControlIndex({ ...args, key: "ArrowRight" })).toBe(2);
		expect(nextControlIndex({ ...args, key: "ArrowLeft" })).toBe(0);
	});

	test("arrows are logical, not physical, in a right-to-left strip", () => {
		// The regression this guards: mapping ArrowRight to "next" unconditionally
		// makes the arrow keys run backwards for an Arabic or Hebrew learner, whose
		// first control is on the right. `ar` is a shipped locale.
		const args = { activeIndex: 1, count: 4, direction: "rtl" as const };
		expect(nextControlIndex({ ...args, key: "ArrowLeft" })).toBe(2);
		expect(nextControlIndex({ ...args, key: "ArrowRight" })).toBe(0);
	});

	test("both ends wrap", () => {
		expect(
			nextControlIndex({
				key: "ArrowRight",
				activeIndex: 3,
				count: 4,
				direction: "ltr",
			}),
		).toBe(0);
		expect(
			nextControlIndex({
				key: "ArrowLeft",
				activeIndex: 0,
				count: 4,
				direction: "ltr",
			}),
		).toBe(3);
	});

	test("Home and End jump to the ends regardless of direction", () => {
		for (const direction of ["ltr", "rtl"] as const) {
			expect(
				nextControlIndex({ key: "Home", activeIndex: 2, count: 4, direction }),
			).toBe(0);
			expect(
				nextControlIndex({ key: "End", activeIndex: 2, count: 4, direction }),
			).toBe(3);
		}
	});

	test("keys the widget does not claim are declined, so they still reach the page", () => {
		for (const key of ["ArrowUp", "ArrowDown", "Tab", "Enter", "PageDown"]) {
			expect(
				nextControlIndex({ key, activeIndex: 0, count: 4, direction: "ltr" }),
			).toBeNull();
		}
	});

	test("an empty strip has nowhere to move", () => {
		expect(
			nextControlIndex({
				key: "ArrowRight",
				activeIndex: 0,
				count: 0,
				direction: "ltr",
			}),
		).toBeNull();
	});

	test("a cursor left behind by an unmounted control still moves sensibly", () => {
		// Read-aloud is absent without a TTS service and the remove button only exists
		// over an existing annotation, so the control count shrinks under the cursor.
		expect(
			nextControlIndex({
				key: "ArrowRight",
				activeIndex: 9,
				count: 3,
				direction: "ltr",
			}),
		).toBe(0);
	});
});

describe("clamping the cursor", () => {
	test("holds the cursor inside a shrinking control set", () => {
		expect(clampIndex(9, 3)).toBe(2);
		expect(clampIndex(1, 3)).toBe(1);
	});

	test("degenerate inputs land on the first control rather than off the end", () => {
		expect(clampIndex(-1, 3)).toBe(0);
		expect(clampIndex(Number.NaN, 3)).toBe(0);
		expect(clampIndex(2, 0)).toBe(0);
	});
});

describe("following the selection through a scroll", () => {
	test("a selection in view keeps the toolbar", () => {
		expect(isRectOffScreen(rect(300, 320), VIEWPORT)).toBe(false);
	});

	test("a selection straddling an edge keeps it, because it is still partly visible", () => {
		// The learner can see what they selected, so withdrawing the affordance would
		// be gratuitous.
		expect(isRectOffScreen(rect(-10, 12), VIEWPORT)).toBe(false);
		expect(isRectOffScreen(rect(790, 812), VIEWPORT)).toBe(false);
	});

	test("a selection scrolled past either edge withdraws it", () => {
		expect(isRectOffScreen(rect(-40, -12), VIEWPORT)).toBe(true);
		expect(isRectOffScreen(rect(900, 940), VIEWPORT)).toBe(true);
	});

	test("horizontal scroll counts too", () => {
		expect(isRectOffScreen(rect(300, 320, -200, -40), VIEWPORT)).toBe(true);
		expect(isRectOffScreen(rect(300, 320, 1200, 1400), VIEWPORT)).toBe(true);
	});
});

describe("suppressing the show during a pointer drag", () => {
	test("no gesture in progress means show immediately", () => {
		// This is the keyboard path: Shift+Arrow never touches the pointer state.
		expect(isPointerGestureActive(null, 5_000)).toBe(false);
	});

	test("a gesture just started still suppresses", () => {
		expect(isPointerGestureActive(5_000, 5_050)).toBe(true);
	});

	test("a gesture that never released stops suppressing", () => {
		// The wedge this prevents: releasing the mouse outside the window fires no
		// `pointerup`, so a boolean latch stayed set and the toolbar never appeared
		// again for the rest of the attempt.
		expect(isPointerGestureActive(5_000, 5_000 + POINTER_GESTURE_MAX_MS)).toBe(
			false,
		);
		expect(isPointerGestureActive(5_000, 60_000)).toBe(false);
	});

	test("a clock that jumps backwards suppresses rather than wedging open", () => {
		expect(isPointerGestureActive(5_000, 4_000)).toBe(true);
	});
});

describe("anchoring the toolbar", () => {
	test("centres over the selection and sits above it", () => {
		expect(toolbarAnchor(rect(300, 320, 100, 200))).toEqual({
			x: 150,
			y: 292,
		});
	});

	test("a collapsed rect still anchors on the caret", () => {
		expect(toolbarAnchor(rect(300, 300, 140, 140))).toEqual({
			x: 140,
			y: 292,
		});
	});
});

/**
 * The wiring itself, which the pure functions above cannot reach. Asserted against
 * source because the component compiles to a custom element and these are questions
 * about which events it subscribes to, not about what it renders.
 */
describe("selection trigger wiring", () => {
	test("the selection itself is the trigger", () => {
		expect(component).toContain(
			"document.addEventListener('selectionchange', scheduleSelectionEvaluation)",
		);
	});

	test("no pointer event shows the toolbar on its own", () => {
		// These two were the whole trigger. Neither can see a keyboard selection, and
		// restoring either as a show path would restore the pointer-only defect.
		expect(component).not.toContain(
			"addEventListener('mouseup', handleSelection",
		);
		expect(component).not.toContain(
			"addEventListener('touchend', handleSelection",
		);
	});

	test("scrolling repositions rather than dismisses", () => {
		expect(component).toContain(
			"window.addEventListener('scroll', handleScroll, true)",
		);
		expect(component).not.toContain("addEventListener('scroll', hideToolbar");
	});

	test("every subscription it adds is removed", () => {
		const added = [
			...component.matchAll(/\.addEventListener\('([a-z]+)'/g),
		].map((match) => match[1]);
		const removed = new Set(
			[...component.matchAll(/\.removeEventListener\('([a-z]+)'/g)].map(
				(match) => match[1],
			),
		);
		expect(added.length).toBeGreaterThan(0);
		for (const event of new Set(added)) {
			expect(removed.has(event), `${event} is added but never removed`).toBe(
				true,
			);
		}
	});

	test("the strip is a single tab stop with arrow navigation", () => {
		expect(component).toContain("onkeydown={handleToolbarKeyDown}");
		expect(component).toContain("onfocusout={handleToolbarFocusOut}");
		// Roving tabindex is applied to the rendered control list rather than bound per
		// button, because the control set is conditional.
		expect(component).toContain("control.tabIndex = index === active ? 0 : -1");
	});

	test("dismissal on outside click survives shadow retargeting", () => {
		// A document-level listener sees the retargeted host element, so `contains`
		// reported false for the strip's own buttons and dismissed it on the click that
		// was activating one.
		expect(component).toContain("composedPath");
	});
});
