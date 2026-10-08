import { describe, expect, test } from "bun:test";
import { waitForToolkitReady } from "../src/components/shared/toolkit-ready-wait.js";

const ready = (target: EventTarget) =>
	target.dispatchEvent(new CustomEvent("toolkit-ready", { bubbles: true }));

/** A lookup that finds `controller` once `available` is set. */
const lookupOf = (controller: object) => {
	const state = { available: false, calls: 0 };
	const lookup = () => {
		state.calls += 1;
		return state.available ? controller : null;
	};
	return { state, lookup };
};

describe("waitForToolkitReady", () => {
	test("resolves on the first toolkit-ready that finds the controller", async () => {
		const target = new EventTarget();
		const controller = {};
		const { state, lookup } = lookupOf(controller);
		const waiting = waitForToolkitReady(target, lookup, 5_000);

		ready(target);
		state.available = true;
		ready(target);
		expect(await waiting).toBe(controller);

		ready(target);
		expect(state.calls).toBe(2);
	});

	test("looks once more at the timeout and resolves with what it finds", async () => {
		const target = new EventTarget();
		const controller = {};
		const { state, lookup } = lookupOf(controller);
		const missing = await waitForToolkitReady(target, lookup, 10);
		expect(missing).toBeNull();

		const found = waitForToolkitReady(target, lookup, 10);
		state.available = true;
		expect(await found).toBe(controller);
	});

	test("waits for the event alone when the timeout is not finite", async () => {
		const target = new EventTarget();
		const controller = {};
		const { state, lookup } = lookupOf(controller);
		let settled = false;
		const waiting = waitForToolkitReady(
			target,
			lookup,
			Number.POSITIVE_INFINITY,
		).then((value) => {
			settled = true;
			return value;
		});

		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(settled).toBe(false);
		state.available = true;
		ready(target);
		expect(await waiting).toBe(controller);
	});
});
