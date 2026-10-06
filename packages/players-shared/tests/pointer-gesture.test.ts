import { describe, expect, test } from "bun:test";

import { createPointerGesture } from "../src/ui/pointer-gesture.js";

type Listener = (event: PointerEvent) => void;

function makeTarget() {
	const listeners = new Map<string, Set<Listener>>();
	const captured = new Set<number>();
	const target = {
		addEventListener(type: string, listener: Listener) {
			if (!listeners.has(type)) listeners.set(type, new Set());
			listeners.get(type)?.add(listener);
		},
		removeEventListener(type: string, listener: Listener) {
			listeners.get(type)?.delete(listener);
		},
		setPointerCapture: (id: number) => captured.add(id),
		hasPointerCapture: (id: number) => captured.has(id),
		releasePointerCapture: (id: number) => captured.delete(id),
		dispatch(type: string, event: PointerEvent) {
			for (const listener of listeners.get(type) ?? []) listener(event);
		},
		listenerCount: () =>
			[...listeners.values()].reduce((total, set) => total + set.size, 0),
		captured,
	};
	return target as unknown as HTMLElement & typeof target;
}

function makeEvent(pointerId = 1, button = 0) {
	let prevented = false;
	const event = {
		pointerId,
		button,
		preventDefault: () => {
			prevented = true;
		},
	} as unknown as PointerEvent;
	return { event, prevented: () => prevented };
}

function makeGesture() {
	const moves: number[] = [];
	let ends = 0;
	const gesture = createPointerGesture({
		onMove: (event) => moves.push(event.pointerId),
		onEnd: () => {
			ends += 1;
		},
	});
	return { gesture, moves, ends: () => ends };
}

describe("createPointerGesture", () => {
	test("claims a primary press and prevents its default", () => {
		const { gesture } = makeGesture();
		const press = makeEvent();
		expect(gesture.begin(press.event, makeTarget())).toBe(true);
		expect(gesture.isActive()).toBe(true);
		expect(press.prevented()).toBe(true);
	});

	test("declines a secondary button without preventing its default", () => {
		const { gesture } = makeGesture();
		const press = makeEvent(1, 2);
		expect(gesture.begin(press.event, makeTarget())).toBe(false);
		expect(gesture.isActive()).toBe(false);
		expect(press.prevented()).toBe(false);
	});

	test("ignores a second pointer while one is active", () => {
		const { gesture, moves } = makeGesture();
		const target = makeTarget();
		gesture.begin(makeEvent(1).event, target);
		expect(gesture.begin(makeEvent(2).event, target)).toBe(false);
		target.dispatch("pointermove", makeEvent(2).event);
		target.dispatch("pointerup", makeEvent(2).event);
		target.dispatch("pointermove", makeEvent(1).event);
		expect(moves).toEqual([1]);
		expect(gesture.isActive()).toBe(true);
	});

	for (const ending of ["pointerup", "pointercancel", "lostpointercapture"]) {
		test(`ends on ${ending}, detaching its listeners`, () => {
			const { gesture, moves, ends } = makeGesture();
			const target = makeTarget();
			gesture.begin(makeEvent().event, target);
			target.dispatch(ending, makeEvent().event);
			expect(gesture.isActive()).toBe(false);
			expect(ends()).toBe(1);
			expect(target.listenerCount()).toBe(0);
			target.dispatch("pointermove", makeEvent().event);
			expect(moves).toEqual([]);
		});
	}

	test("release gives up the pointer capture and ends only once", () => {
		const { gesture, ends } = makeGesture();
		const target = makeTarget();
		gesture.begin(makeEvent(5).event, target);
		target.setPointerCapture(5);
		gesture.release();
		gesture.release();
		expect(target.captured.has(5)).toBe(false);
		expect(ends()).toBe(1);
	});
});
