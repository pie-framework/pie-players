import { describe, expect, test } from "bun:test";

import { createPointerDragController } from "../src/ui/pointer-drag.js";

function makeContainer(): Element {
	const capturedIds: number[] = [];
	return {
		setPointerCapture: (id: number) => {
			capturedIds.push(id);
		},
		releasePointerCapture: () => {},
		__capturedIds: capturedIds,
	} as unknown as Element;
}

function makeEvent(clientX: number, clientY: number, pointerId = 1): PointerEvent {
	return { clientX, clientY, pointerId } as unknown as PointerEvent;
}

describe("createPointerDragController", () => {
	test("is not dragging before a drag starts", () => {
		const controller = createPointerDragController({
			getPosition: () => ({ x: 0, y: 0 }),
			setPosition: () => {},
		});
		expect(controller.isDragging()).toBe(false);
	});

	test("tracks position by the delta from the drag-start offset", () => {
		let position = { x: 100, y: 200 };
		const controller = createPointerDragController({
			getPosition: () => position,
			setPosition: (next) => {
				position = next;
			},
		});

		controller.startDragging(makeEvent(150, 220), makeContainer());
		expect(controller.isDragging()).toBe(true);

		controller.handlePointerMove(makeEvent(160, 225));
		// dragStart offset was (150-100, 220-200) = (50, 20)
		expect(position).toEqual({ x: 110, y: 205 });

		controller.handlePointerMove(makeEvent(200, 300));
		expect(position).toEqual({ x: 150, y: 280 });
	});

	test("ignores pointermove while not dragging", () => {
		let position = { x: 0, y: 0 };
		const controller = createPointerDragController({
			getPosition: () => position,
			setPosition: (next) => {
				position = next;
			},
		});
		controller.handlePointerMove(makeEvent(999, 999));
		expect(position).toEqual({ x: 0, y: 0 });
	});

	test("calls onDragStart once, with the container, when a drag begins", () => {
		const seen: Element[] = [];
		const controller = createPointerDragController({
			getPosition: () => ({ x: 0, y: 0 }),
			setPosition: () => {},
			onDragStart: (container) => seen.push(container),
		});
		const container = makeContainer();
		controller.startDragging(makeEvent(0, 0), container);
		expect(seen).toEqual([container]);
	});

	test("endDragging stops position tracking until the next startDragging", () => {
		let position = { x: 0, y: 0 };
		const controller = createPointerDragController({
			getPosition: () => position,
			setPosition: (next) => {
				position = next;
			},
		});
		controller.startDragging(makeEvent(0, 0), makeContainer());
		controller.endDragging();
		expect(controller.isDragging()).toBe(false);

		controller.handlePointerMove(makeEvent(500, 500));
		expect(position).toEqual({ x: 0, y: 0 });
	});
});
