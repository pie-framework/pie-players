import { describe, expect, spyOn, test } from "bun:test";

import { createToolCoordinatorRegistration } from "../src/runtime/tool-host-contract.js";
import { ToolCoordinator, ZIndexLayer } from "../src/services/ToolCoordinator.js";
import type { ToolCoordinatorApi } from "../src/services/interfaces.js";

function makeCoordinator() {
	const calls: string[] = [];
	const coordinator = {
		registerTool: (id: string, name: string, _el: unknown, layer: unknown) =>
			calls.push(`register ${id} ${name} ${layer}`),
		unregisterTool: (id: string) => calls.push(`unregister ${id}`),
	} as unknown as ToolCoordinatorApi;
	return { coordinator, calls };
}

describe("createToolCoordinatorRegistration", () => {
	test("registers once both are set, and not again while neither changes", () => {
		const { coordinator, calls } = makeCoordinator();
		const registration = createToolCoordinatorRegistration(
			"Ruler",
			ZIndexLayer.TOOL,
		);
		registration.sync(undefined, "ruler");
		registration.sync(coordinator, "");
		registration.sync(coordinator, "ruler");
		registration.sync(coordinator, "ruler");
		expect(calls).toEqual([`register ruler Ruler ${ZIndexLayer.TOOL}`]);
	});

	test("moves to a republished coordinator, leaving the old one", () => {
		const first = makeCoordinator();
		const second = makeCoordinator();
		const registration = createToolCoordinatorRegistration(
			"Theme",
			ZIndexLayer.MODAL,
		);
		registration.sync(first.coordinator, "theme");
		registration.sync(second.coordinator, "theme");
		expect(first.calls).toEqual([
			`register theme Theme ${ZIndexLayer.MODAL}`,
			"unregister theme",
		]);
		expect(second.calls).toEqual([`register theme Theme ${ZIndexLayer.MODAL}`]);
	});

	test("a new id unregisters the old one first", () => {
		const { coordinator, calls } = makeCoordinator();
		const registration = createToolCoordinatorRegistration(
			"Ruler",
			ZIndexLayer.TOOL,
		);
		registration.sync(coordinator, "a");
		registration.sync(coordinator, "b");
		expect(calls).toEqual([
			`register a Ruler ${ZIndexLayer.TOOL}`,
			"unregister a",
			`register b Ruler ${ZIndexLayer.TOOL}`,
		]);
	});

	test("release unregisters from the coordinator it registered with, once", () => {
		const first = makeCoordinator();
		const registration = createToolCoordinatorRegistration(
			"Ruler",
			ZIndexLayer.TOOL,
		);
		registration.sync(first.coordinator, "ruler");
		registration.release();
		registration.release();
		expect(first.calls).toEqual([
			`register ruler Ruler ${ZIndexLayer.TOOL}`,
			"unregister ruler",
		]);
		// A later sync registers afresh, as a remount does.
		registration.sync(first.coordinator, "ruler");
		expect(first.calls).toHaveLength(3);
	});
});

describe("ToolCoordinator listeners", () => {
	test("a throwing listener does not stop later listeners", () => {
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		try {
			const coordinator = new ToolCoordinator();
			const seen: string[] = [];
			coordinator.subscribe(() => {
				throw new Error("boom");
			});
			coordinator.subscribe(() => seen.push("second"));
			coordinator.registerTool("ruler", "Ruler");
			coordinator.showTool("ruler");
			expect(seen).toEqual(["second"]);
			expect(warn).toHaveBeenCalledTimes(1);
		} finally {
			warn.mockRestore();
		}
	});
});
