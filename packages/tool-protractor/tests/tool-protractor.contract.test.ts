import { expect, test } from "bun:test";

const source = await Bun.file(
	new URL("../tool-protractor.svelte", import.meta.url),
).text();

const ruleFor = (selector: string) =>
	source.match(new RegExp(`${selector.replace(/[.]/g, "\\.")} \\{[^}]*\\}`))?.[0] ?? "";

test("keyboard placement is wired to the panel", () => {
	expect(source).toInclude("onkeydown={handleKeyDown}");
});

test("pointer and keyboard placement share one transform writer", () => {
	// Two writers of `style.transform` would let a drag and a nudge disagree
	// about where the protractor is.
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
	expect(ruleFor(`.pie-tool-protractor__control`)).toInclude("min-width: 32px");
});

test("the protractor carries no third-party drag library", () => {
	expect(source).not.toMatch(/moveable/i);
});

test("gestures run through the shared pointer lifecycle", () => {
	// `createPointerGesture` ends a gesture on `pointercancel`, which iPadOS
	// sends when it takes a touch over; hand-rolled listeners could miss it.
	expect(source).toInclude("createPointerGesture(");
	expect(source).not.toInclude("addEventListener('pointermove'");
});

test("the vertex inset agrees across the bound, the pivot and the transform origin", () => {
	expect(source).toInclude("const VERTEX_INSET = 10;");
	expect(ruleFor(".pie-tool-protractor")).toInclude(
		"transform-origin: 50% calc(100% - 10px)",
	);
	expect(ruleFor(".pie-tool-protractor__pivot")).toInclude("bottom: 10px");
});

test("touch drags neither scroll the page nor open the iOS callout", () => {
	const protractorRule = ruleFor(".pie-tool-protractor");
	expect(protractorRule).toInclude("touch-action: none");
	expect(protractorRule).toInclude("-webkit-touch-callout: none");
	expect(protractorRule).toInclude("-webkit-user-select: none");
	expect(ruleFor(".pie-tool-protractor__rotate-handle")).toInclude("touch-action: none");
});

test("the rotation handle offers a 44px touch target", () => {
	const handleRule = ruleFor(".pie-tool-protractor__rotate-handle");
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
