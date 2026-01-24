import { describe, expect, test } from "bun:test";
import { TypedEventBus } from "../src/core/TypedEventBus";

// Bun provides EventTarget/Event in most environments; CustomEvent can be missing depending on runtime.
if (typeof (globalThis as any).CustomEvent === "undefined") {
	class CustomEvent<T = any> extends Event {
		detail: T;
		constructor(type: string, init?: CustomEventInit<T>) {
			super(type, init);
			this.detail = (init?.detail ?? null) as T;
		}
	}
	(globalThis as any).CustomEvent = CustomEvent;
}

type Events = {
	foo: { x: number };
	bar: { y: string };
};

describe("TypedEventBus", () => {
	test("emit delivers typed CustomEvent.detail to listeners", () => {
		const bus = new TypedEventBus<Events>();

		let got: number | null = null;
		bus.on("foo", (e) => {
			got = e.detail.x;
		});

		const ok = bus.emit("foo", { x: 123 });
		expect(ok).toBe(true);
		expect(got).toBe(123);
	});

	test("off removes listeners", () => {
		const bus = new TypedEventBus<Events>();
		let count = 0;
		const fn = () => {
			count++;
		};

		bus.on("bar", fn as any);
		bus.emit("bar", { y: "a" });

		bus.off("bar", fn as any);
		bus.emit("bar", { y: "b" });

		expect(count).toBe(1);
	});

	test("once only fires a single time", () => {
		const bus = new TypedEventBus<Events>();
		let count = 0;
		bus.once("foo", () => {
			count++;
		});

		bus.emit("foo", { x: 1 });
		bus.emit("foo", { x: 2 });

		expect(count).toBe(1);
	});
});
