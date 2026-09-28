import { describe, expect, test } from "bun:test";

import {
	createPointerRotateController,
	normalizeDegrees,
} from "../src/ui/pointer-rotate.js";

function makeContainer(): Element & { capturedIds: number[] } {
	const capturedIds: number[] = [];
	return {
		setPointerCapture: (id: number) => {
			capturedIds.push(id);
		},
		capturedIds,
	} as unknown as Element & { capturedIds: number[] };
}

function makeEvent(clientX: number, clientY: number, pointerId = 1): PointerEvent {
	return { clientX, clientY, pointerId } as unknown as PointerEvent;
}

function makeController(initial = 0) {
	let rotation = initial;
	const controller = createPointerRotateController({
		getRotation: () => rotation,
		setRotation: (next) => {
			rotation = next;
		},
	});
	return { controller, rotation: () => rotation };
}

const PIVOT = { x: 100, y: 100 };

describe("normalizeDegrees", () => {
	test("maps any angle into [0, 360)", () => {
		expect(normalizeDegrees(0)).toBe(0);
		expect(normalizeDegrees(360)).toBe(0);
		expect(normalizeDegrees(-90)).toBe(270);
		expect(normalizeDegrees(725)).toBe(5);
	});
});

describe("createPointerRotateController", () => {
	test("captures the pointer and reports rotating", () => {
		const { controller } = makeController();
		const container = makeContainer();
		controller.startRotating(makeEvent(100, 40, 7), container, PIVOT);
		expect(controller.isRotating()).toBe(true);
		expect(container.capturedIds).toEqual([7]);
	});

	test("turns by the angle swept around the pivot", () => {
		const { controller, rotation } = makeController();
		// Start straight above the pivot, the handle's rest position.
		controller.startRotating(makeEvent(100, 40), makeContainer(), PIVOT);
		// A quarter turn clockwise on screen puts the pointer right of the pivot.
		controller.handlePointerMove(makeEvent(160, 100));
		expect(rotation()).toBeCloseTo(90);
		controller.handlePointerMove(makeEvent(100, 160));
		expect(rotation()).toBeCloseTo(180);
		controller.handlePointerMove(makeEvent(40, 100));
		expect(rotation()).toBeCloseTo(270);
	});

	test("adds the sweep to the rotation it started from, without an initial jump", () => {
		const { controller, rotation } = makeController(30);
		// Grabbing off-axis must not snap the rotation to the grab angle.
		controller.startRotating(makeEvent(140, 60), makeContainer(), PIVOT);
		controller.handlePointerMove(makeEvent(140, 60));
		expect(rotation()).toBeCloseTo(30);
	});

	test("normalises a counter-clockwise sweep past zero", () => {
		const { controller, rotation } = makeController(10);
		controller.startRotating(makeEvent(100, 40), makeContainer(), PIVOT);
		controller.handlePointerMove(makeEvent(40, 100));
		expect(rotation()).toBeCloseTo(280);
	});

	test("ignores moves once rotation ends", () => {
		const { controller, rotation } = makeController();
		controller.startRotating(makeEvent(100, 40), makeContainer(), PIVOT);
		controller.endRotating();
		expect(controller.isRotating()).toBe(false);
		controller.handlePointerMove(makeEvent(160, 100));
		expect(rotation()).toBe(0);
	});
});
