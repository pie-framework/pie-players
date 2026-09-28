import { expect, test } from "bun:test";

const source = await Bun.file(
	new URL("../tool-ruler.svelte", import.meta.url),
).text();

const ruleFor = (selector: string) =>
	source.match(new RegExp(`${selector.replace(/[.]/g, "\\.")} \\{[^}]*\\}`))?.[0] ?? "";

test("keyboard placement is wired to the panel", () => {
	expect(source).toInclude("onkeydown={handleKeyDown}");
});

test("pointer and keyboard placement share one transform writer", () => {
	// Two writers of `style.transform` would let a drag and a nudge disagree
	// about where the ruler is.
	expect(source.match(/containerEl\.style\.transform =/g)?.length).toBe(1);
	expect(source.match(/applyPlacement\(/g)?.length).toBeGreaterThan(1);
});

test("tap controls move and turn the tool without a drag", () => {
	// WCAG 2.5.7: every drag has a single-pointer alternative, and the buttons
	// take the same steps as the keys.
	for (const call of ["nudge(direction as Nudge)", "rotateBy(degrees)"]) {
		expect(source).toInclude(`onclick={() => ${call}}`);
	}
	expect(source).toInclude("const ROTATIONS = [-ROTATE_STEP, -FINE_ROTATE_STEP, FINE_ROTATE_STEP, ROTATE_STEP];");
	// A press on a control keeps focus on the tool, which keeps them shown.
	expect(source).toMatch(/__controls"[\s\S]*?e\.preventDefault\(\)/);
	expect(ruleFor(`.pie-tool-ruler__control`)).toInclude("min-width: 32px");
});

test("the ruler carries no third-party drag library", () => {
	expect(source).not.toInclude("pie-players-shared/moveable");
	expect(source).not.toMatch(/moveable/i);
});

test("gestures run through the shared pointer lifecycle", () => {
	// `createPointerGesture` ends a gesture on `pointercancel`, which iPadOS
	// sends when it takes a touch over; hand-rolled listeners could miss it.
	expect(source).toInclude("createPointerGesture(");
	expect(source).not.toInclude("addEventListener('pointermove'");
});

test("touch drags neither scroll the page nor open the iOS callout", () => {
	const rulerRule = source.match(/\.pie-tool-ruler \{[^}]*\}/)?.[0] ?? "";
	expect(rulerRule).toInclude("touch-action: none");
	expect(rulerRule).toInclude("-webkit-touch-callout: none");
	expect(rulerRule).toInclude("-webkit-user-select: none");
	const handleRule =
		source.match(/\.pie-tool-ruler__rotate-handle \{[^}]*\}/)?.[0] ?? "";
	expect(handleRule).toInclude("touch-action: none");
});

test("the rotation handle offers a 44px touch target", () => {
	const handleRule =
		source.match(/\.pie-tool-ruler__rotate-handle \{[^}]*\}/)?.[0] ?? "";
	expect(handleRule).toInclude("width: 44px");
	expect(handleRule).toInclude("height: 44px");
});

test("revealing the tool cannot scroll its pane", () => {
	const focusCalls = source.match(/\.focus\([^)]*\)/g) ?? [];
	expect(focusCalls.length).toBeGreaterThan(0);
	for (const call of focusCalls) {
		expect(call).toInclude("preventScroll");
	}
});

test("a frameless surface drops the frame line", () => {
	expect(source).toInclude(
		":host([data-pie-tool-surface='frameless']) .pie-tool-ruler__frame",
	);
});
