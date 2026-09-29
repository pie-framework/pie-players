import { describe, expect, test } from "bun:test";

import {
	createOverlayPlacement,
	OVERLAY_PLACEMENT_ROTATIONS,
	type OverlayPlacementOptions,
} from "../src/ui/overlay-placement.js";

type Listener = (event: PointerEvent) => void;

function makeElement(width = 200, height = 100) {
	const listeners = new Map<string, Set<Listener>>();
	let focused = 0;
	const element = {
		offsetWidth: width,
		offsetHeight: height,
		style: { transform: "" },
		focus: () => {
			focused += 1;
		},
		getBoundingClientRect: () => ({ left: 10, top: 20, width, height }),
		addEventListener(type: string, listener: Listener) {
			if (!listeners.has(type)) listeners.set(type, new Set());
			listeners.get(type)?.add(listener);
		},
		removeEventListener(type: string, listener: Listener) {
			listeners.get(type)?.delete(listener);
		},
		setPointerCapture: () => {},
		hasPointerCapture: () => false,
		releasePointerCapture: () => {},
		dispatch(type: string, event: PointerEvent) {
			for (const listener of listeners.get(type) ?? []) listener(event);
		},
		focusCount: () => focused,
	};
	return element as unknown as HTMLElement & typeof element;
}

function pointer(x: number, y: number) {
	let stopped = false;
	const event = {
		pointerId: 1,
		button: 0,
		clientX: x,
		clientY: y,
		preventDefault: () => {},
		stopPropagation: () => {
			stopped = true;
		},
	} as unknown as PointerEvent;
	return { event, stopped: () => stopped };
}

function key(name: string, shiftKey = false) {
	let prevented = false;
	const event = {
		key: name,
		shiftKey,
		preventDefault: () => {
			prevented = true;
		},
	} as unknown as KeyboardEvent;
	return { event, prevented: () => prevented };
}

function setup(overrides: Partial<OverlayPlacementOptions> = {}) {
	const element = makeElement();
	const controls = makeElement(120, 40);
	const announced: Array<[string, Record<string, number>]> = [];
	const raised: HTMLElement[] = [];
	const controller = createOverlayPlacement({
		getElement: () => element,
		getControls: () => controls,
		bringToFront: (el) => raised.push(el),
		announce: (key, params) => announced.push([key, params]),
		...overrides,
	});
	return { controller, element, controls, announced, raised };
}

describe("createOverlayPlacement", () => {
	test("apply writes the tool's transform and docks the controls", () => {
		const { controller, element, controls } = setup();
		controller.apply({ x: 30, y: -10, rotation: 90 });
		expect(element.style.transform).toBe(
			"translate(-50%, -50%) translate(30px, -10px) rotate(90deg)",
		);
		// Counter-rotated so the arrows stay level on screen.
		expect(controls.style.transform).toEndWith("rotate(-90deg)");
	});

	test("an arrow nudges one step and announces the new position", () => {
		const { controller, announced } = setup();
		const right = key("ArrowRight");
		expect(controller.handleKeyDown(right.event)).toBe(true);
		expect(right.prevented()).toBe(true);
		expect(controller.placement).toEqual({ x: 10, y: 0, rotation: 0 });
		controller.nudge("up");
		expect(controller.placement).toEqual({ x: 10, y: -10, rotation: 0 });
		expect(announced).toEqual([
			["toolkit.announce.movedRight", { position: 10 }],
			["toolkit.announce.movedUp", { position: -10 }],
		]);
	});

	test("Shift+arrows turn 5°, Page Up/Down 1°, wrapping to 0–359", () => {
		const { controller, announced } = setup();
		controller.handleKeyDown(key("ArrowLeft", true).event);
		expect(controller.placement.rotation).toBe(355);
		controller.handleKeyDown(key("PageDown").event);
		expect(controller.placement.rotation).toBe(356);
		controller.handleKeyDown(key("ArrowDown", true).event);
		expect(controller.placement.rotation).toBe(1);
		controller.handleKeyDown(key("PageUp").event);
		expect(controller.placement.rotation).toBe(0);
		expect(announced.at(-1)).toEqual([
			"toolkit.announce.rotatedTo",
			{ degrees: 0 },
		]);
	});

	test("an unrelated key is left to the tool", () => {
		const { controller } = setup();
		const u = key("u");
		expect(controller.handleKeyDown(u.event)).toBe(false);
		expect(u.prevented()).toBe(false);
	});

	test("the tap rotations are the keyboard's steps", () => {
		expect([...OVERLAY_PLACEMENT_ROTATIONS]).toEqual([-5, -1, 1, 5]);
	});

	test("an off-centre pivot keeps the turned tool's offset where it was", () => {
		// Without a containing block nothing clamps, so the shift the pivot adds
		// to the bounded centre comes back off the stored offset.
		const { controller } = setup({
			pivot: (size) => ({ x: size.width / 2, y: size.height - 10 }),
		});
		controller.apply({ x: 5, y: 7, rotation: 45 });
		expect(controller.placement.x).toBeCloseTo(5);
		expect(controller.placement.y).toBeCloseTo(7);
	});

	test("a drag starts on the tool, raises and focuses it", () => {
		const { controller, element, raised } = setup();
		controller.startDrag(pointer(0, 0).event);
		expect(raised).toEqual([element]);
		expect(element.focusCount()).toBe(1);
		element.dispatch("pointermove", pointer(15, 25).event);
		expect(controller.placement).toEqual({ x: 15, y: 25, rotation: 0 });
	});

	test("a turn stops the press reaching the drag, and declines without a pivot", () => {
		const handle = makeElement(44, 44);
		const declined = setup({ getScreenPivot: () => undefined });
		const press = pointer(0, 0);
		declined.controller.startRotate(press.event, handle);
		expect(press.stopped()).toBe(true);
		expect(declined.raised).toEqual([]);

		const { controller, raised, element } = setup();
		controller.startRotate(pointer(110, 0).event, handle);
		expect(raised).toEqual([element]);
	});

	test("reset ends the gesture and returns to centred and upright", () => {
		const { controller, element } = setup();
		controller.startDrag(pointer(0, 0).event);
		controller.reset();
		expect(controller.placement).toEqual({ x: 0, y: 0, rotation: 0 });
		element.dispatch("pointermove", pointer(50, 50).event);
		expect(controller.placement).toEqual({ x: 0, y: 0, rotation: 0 });
	});

	test("show raises the tool and re-applies its placement", () => {
		const { controller, element, raised } = setup();
		controller.nudge("down");
		element.style.transform = "";
		controller.show();
		expect(raised).toEqual([element]);
		expect(element.style.transform).toInclude("translate(0px, 10px)");
	});
});
