import { describe, expect, test } from "bun:test";
import {
	NATIVE_MEDIA_CAPABILITIES,
	createMediaElementTimeSource,
	type MediaTimeSourceNotification,
} from "../src/timed-media/index.js";

/**
 * A stand-in for `HTMLMediaElement` that records what the adapter did to it.
 * Written as a plain object rather than a DOM fixture on purpose: if the port can
 * only be exercised in a browser, it is not the seam the contract claims.
 */
function fakeMediaElement() {
	const listeners = new Map<string, Set<() => void>>();
	const calls: string[] = [];
	const element = {
		currentTime: 0,
		duration: 120,
		paused: true,
		seekable: { length: 1, start: () => 0, end: () => 120 },
		play() {
			calls.push("play");
			element.paused = false;
			return Promise.resolve();
		},
		pause() {
			calls.push("pause");
			element.paused = true;
		},
		addEventListener(name: string, handler: () => void) {
			const set = listeners.get(name) ?? new Set();
			set.add(handler);
			listeners.set(name, set);
		},
		removeEventListener(name: string, handler: () => void) {
			listeners.get(name)?.delete(handler);
		},
	};
	return {
		element: element as unknown as HTMLMediaElement,
		calls,
		listenerCount: (name: string) => listeners.get(name)?.size ?? 0,
		emit(name: string) {
			for (const handler of Array.from(listeners.get(name) ?? [])) handler();
		},
	};
}

describe("createMediaElementTimeSource", () => {
	test("a native element satisfies the port with both capabilities", () => {
		const fake = fakeMediaElement();
		const port = createMediaElementTimeSource(fake.element);
		expect(port.capabilities).toEqual(NATIVE_MEDIA_CAPABILITIES);
		expect(port.duration).toBe(120);
		expect(port.paused).toBe(true);
		expect(port.seekable?.end(0)).toBe(120);
	});

	test("a host can declare a capability the wrapped source lacks", () => {
		const fake = fakeMediaElement();
		const port = createMediaElementTimeSource(fake.element, {
			capabilities: { canPause: false },
		});
		expect(port.capabilities).toEqual({
			canPause: false,
			canRestrictSeeking: true,
		});
	});

	test("play, pause and seekTo reach the element", () => {
		const fake = fakeMediaElement();
		const port = createMediaElementTimeSource(fake.element);
		void port.play();
		port.pause();
		port.seekTo(42);
		expect(fake.calls).toEqual(["play", "pause"]);
		expect(fake.element.currentTime).toBe(42);
		expect(port.currentTime).toBe(42);
	});

	test("a nonsense seek target is ignored rather than written", () => {
		const fake = fakeMediaElement();
		const port = createMediaElementTimeSource(fake.element);
		port.seekTo(Number.NaN);
		port.seekTo(-5);
		expect(fake.element.currentTime).toBe(0);
	});

	test("media events arrive as port notifications carrying the position", () => {
		const fake = fakeMediaElement();
		const port = createMediaElementTimeSource(fake.element);
		const seen: MediaTimeSourceNotification[] = [];
		const unsubscribe = port.subscribe((notification) => seen.push(notification));

		fake.element.currentTime = 12;
		fake.emit("timeupdate");
		fake.emit("seeking");
		fake.emit("seeked");
		fake.emit("play");
		fake.emit("pause");
		fake.emit("ended");

		expect(seen.map((entry) => entry.type)).toEqual([
			"time",
			"seek",
			"seek",
			"play",
			"pause",
			"ended",
		]);
		expect(seen.every((entry) => entry.currentTime === 12)).toBe(true);
		unsubscribe();
	});

	test("element listeners are attached on the first subscribe and released on the last", () => {
		const fake = fakeMediaElement();
		const port = createMediaElementTimeSource(fake.element);
		expect(fake.listenerCount("timeupdate")).toBe(0);
		const first = port.subscribe(() => {});
		const second = port.subscribe(() => {});
		expect(fake.listenerCount("timeupdate")).toBe(1);
		first();
		expect(fake.listenerCount("timeupdate")).toBe(1);
		second();
		expect(fake.listenerCount("timeupdate")).toBe(0);
	});

	test("a subscriber that throws does not stop the others", () => {
		const fake = fakeMediaElement();
		const port = createMediaElementTimeSource(fake.element);
		const seen: string[] = [];
		port.subscribe(() => {
			throw new Error("subscriber blew up");
		});
		port.subscribe((notification) => seen.push(notification.type));
		fake.emit("timeupdate");
		expect(seen).toEqual(["time"]);
	});
});
