import { expect, test } from "bun:test";

const source = await Bun.file(
	new URL("../tool-ruler.svelte", import.meta.url),
).text();

test("keyboard placement is wired to the panel", () => {
	expect(source).toInclude("onkeydown={handleKeyDown}");
});

test("placement runs through the shared controller", () => {
	// Two writers of `style.transform` would let a drag and a nudge disagree
	// about where the ruler is, so the controller is the only one.
	expect(source).toInclude("createOverlayPlacement(");
	expect(source).not.toInclude("style.transform");
	expect(source).toInclude("onpointerdown={placement.startDrag}");
});

test("tap controls and the rotate handle are the shared ones", () => {
	// WCAG 2.5.7: every drag has a single-pointer alternative.
	expect(source).toMatch(/<OverlayPlacementControls\s+controller=\{placement\}/);
	expect(source).toInclude('<OverlayRotateHandle controller={placement} classPrefix="pie-tool-ruler" />');
});

test("the ruler carries no third-party drag library", () => {
	expect(source).not.toInclude("pie-players-shared/moveable");
	expect(source).not.toMatch(/moveable/i);
});

test("touch drags neither scroll the page nor open the iOS callout", () => {
	const rulerRule = source.match(/\.pie-tool-ruler \{[^}]*\}/)?.[0] ?? "";
	expect(rulerRule).toInclude("touch-action: none");
	expect(rulerRule).toInclude("-webkit-touch-callout: none");
	expect(rulerRule).toInclude("-webkit-user-select: none");
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
