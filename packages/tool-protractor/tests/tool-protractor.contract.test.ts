import { expect, test } from "bun:test";

const source = await Bun.file(
	new URL("../tool-protractor.svelte", import.meta.url),
).text();

const ruleFor = (selector: string) =>
	source.match(new RegExp(`${selector.replace(/[.]/g, "\\.")} \\{[^}]*\\}`))?.[0] ?? "";

test("keyboard placement is wired to the panel", () => {
	expect(source).toInclude("onkeydown={placement.handleKeyDown}");
});

test("placement runs through the shared controller", () => {
	// Two writers of `style.transform` would let a drag and a nudge disagree
	// about where the protractor is, so the controller is the only one.
	expect(source).toInclude("createOverlayPlacement(");
	expect(source).not.toInclude("style.transform");
	expect(source).toInclude("onpointerdown={placement.startDrag}");
});

test("tap controls and the rotate handle are the shared ones", () => {
	// WCAG 2.5.7: every drag has a single-pointer alternative.
	expect(source).toMatch(/<OverlayPlacementControls\s+controller=\{placement\}/);
	expect(source).toInclude('<OverlayRotateHandle controller={placement} classPrefix="pie-tool-protractor" />');
});

test("the protractor carries no third-party drag library", () => {
	expect(source).not.toMatch(/moveable/i);
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
});

test("revealing the tool cannot scroll its pane", () => {
	const focusCalls = source.match(/\.focus\([^)]*\)/g) ?? [];
	expect(focusCalls.length).toBeGreaterThan(0);
	for (const call of focusCalls) {
		expect(call).toInclude("preventScroll");
	}
});
