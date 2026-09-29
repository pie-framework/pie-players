import { expect, test } from "bun:test";

const read = (path: string) => Bun.file(new URL(path, import.meta.url)).text();
const controls = await read(
	"../src/components/overlay-placement/OverlayPlacementControls.svelte",
);
const handle = await read(
	"../src/components/overlay-placement/OverlayRotateHandle.svelte",
);
const controller = await read("../src/ui/overlay-placement.ts");

const ruleFor = (source: string, selector: string) =>
	source.match(
		new RegExp(`${selector.replace(/[.]/g, "\\.")} \\{[^}]*\\}`),
	)?.[0] ?? "";

test("tap controls move and turn the tool without a drag", () => {
	// WCAG 2.5.7: the buttons take the same steps as the keys.
	for (const call of [
		"controller.nudge(direction as OverlayPlacementNudge)",
		"controller.rotateBy(degrees)",
	]) {
		expect(controls).toInclude(`onclick={() => ${call}}`);
	}
	expect(controls).toInclude("OVERLAY_PLACEMENT_ROTATIONS as degrees");
	// A press on a control keeps focus on the tool, which keeps them shown.
	expect(controls).toMatch(/__controls"[\s\S]*?e\.preventDefault\(\)/);
	expect(ruleFor(controls, ".pie-tool-placement__control")).toInclude(
		"min-width: 32px",
	);
});

test("each tool keeps its own control and handle selectors", () => {
	expect(controls).toInclude("{classPrefix}__controls");
	expect(controls).toInclude("{classPrefix}__control");
	expect(handle).toInclude("{classPrefix}__rotate-handle");
	expect(handle).toInclude("{classPrefix}__rotate-line");
});

test("the rotation handle offers a 44px touch target that never scrolls", () => {
	const rule = ruleFor(handle, ".pie-tool-placement__rotate-handle");
	expect(rule).toInclude("width: 44px");
	expect(rule).toInclude("height: 44px");
	expect(rule).toInclude("touch-action: none");
});

test("gestures run through the shared pointer lifecycle", () => {
	// `createPointerGesture` ends a gesture on `pointercancel`, which iPadOS
	// sends when it takes a touch over; hand-rolled listeners could miss it.
	expect(controller).toInclude("createPointerGesture(");
	expect(controller).not.toInclude('addEventListener("pointermove"');
});

test("claiming a gesture focuses the tool without scrolling its pane", () => {
	const focusCalls = controller.match(/\.focus\([^)]*\)/g) ?? [];
	expect(focusCalls.length).toBeGreaterThan(0);
	for (const call of focusCalls) expect(call).toInclude("preventScroll");
});
