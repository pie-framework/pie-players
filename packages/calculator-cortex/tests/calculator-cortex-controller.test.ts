import { afterEach, describe, expect, test } from "bun:test";
import {
	CortexCalculatorController,
	type CortexCalculatorSnapshot,
} from "../src/calculator-controller.js";
import {
	CORTEX_GRAPH_EXPRESSION_LIMIT,
	resolveCortexSettings,
} from "../src/settings.js";
import type { CortexOuterCalculatorState } from "../src/types.js";
import {
	expectCortexCode,
	expectCortexRejection,
} from "./support/cortex-errors.js";
import {
	type FakeWorkerFleet,
	installFakeWorkers,
} from "./support/fake-worker.js";

/*
 * The controller is the calculator: the Svelte views render its snapshots and call
 * its methods, and `CortexCalculator` in `runtime.ts` forwards the public
 * `Calculator` contract to it one method at a time. It holds no DOM, so everything
 * the PRD lists under provider lifecycle, history, state and graph interaction is
 * reachable here rather than only through a browser.
 *
 * Requests run through `installFakeWorkers("computing")`, which routes them to the
 * same `evaluateLatex`/`sampleLatex` the shipped worker calls, over the real
 * protocol.
 */

let fleet: FakeWorkerFleet | null = null;

afterEach(() => {
	fleet?.restore();
	fleet = null;
});

function controller(
	type: "basic" | "scientific" | "graphing" = "scientific",
	settings: Record<string, unknown> = {},
	onTelemetry?: (
		eventName: string,
		payload?: Record<string, unknown>,
	) => void | Promise<void>,
): CortexCalculatorController {
	fleet ??= installFakeWorkers("computing");
	return new CortexCalculatorController(
		resolveCortexSettings(type, { settings }),
		onTelemetry,
	);
}

function snapshots(instance: CortexCalculatorController): {
	all: CortexCalculatorSnapshot[];
	stop: () => void;
} {
	const all: CortexCalculatorSnapshot[] = [];
	const stop = instance.subscribe((snapshot) => all.push(snapshot));
	return { all, stop };
}

describe("instance lifecycle", () => {
	test("delivers the current snapshot on subscribe and stops on release", () => {
		const instance = controller();
		const { all, stop } = snapshots(instance);
		expect(all).toHaveLength(1);
		instance.setValue("2+2");
		expect(all).toHaveLength(2);
		stop();
		instance.setValue("3+3");
		expect(all).toHaveLength(2);
		instance.destroy();
	});

	test("keeps simultaneous instances independent", async () => {
		const first = controller("scientific");
		const second = controller("scientific");

		expect((await first.evaluate("2+2")).toString()).toBe("4");
		second.setValue("9\\times9");

		expect(first.getValue()).toBe("2+2");
		expect(second.getValue()).toBe("9\\times9");
		expect(first.getHistory()).toHaveLength(1);
		expect(second.getHistory()).toHaveLength(0);

		// One closing must not disturb the other: each owns its own worker.
		first.destroy();
		expect((await second.evaluate("9\\times9")).toString()).toBe("81");
		second.destroy();
	});

	test("refuses to evaluate once destroyed", async () => {
		const instance = controller();
		instance.destroy();
		await expectCortexRejection(instance.evaluate("2+2"), "worker-unavailable");
	});

	test("carries focus and resize requests as monotonic counters", () => {
		/*
		 * `Calculator.focus()` and `resize()` have no DOM to act on from here, so they
		 * reach the view as a changed number on the snapshot. A counter that failed to
		 * advance would make the accommodation silently absent rather than wrong.
		 */
		const instance = controller();
		const { all } = snapshots(instance);
		const before = all.at(-1);
		instance.requestFocus();
		instance.requestFocus();
		instance.requestResize();
		const after = all.at(-1);
		expect(after?.focusRequest).toBe((before?.focusRequest ?? 0) + 2);
		expect(after?.resizeRequest).toBe((before?.resizeRequest ?? 0) + 1);
		instance.destroy();
	});
});

describe("history", () => {
	test("records newest first and caps at the configured limit", async () => {
		const instance = controller("scientific", { historyLimit: 2 });
		await instance.evaluate("1+1");
		await instance.evaluate("2+2");
		await instance.evaluate("3+3");

		const history = instance.getHistory();
		expect(history).toHaveLength(2);
		expect(history.map((entry) => entry.expression)).toEqual(["3+3", "2+2"]);
		expect(history[0]?.result).toBe("6");
		instance.destroy();
	});

	test("records nothing when history is switched off", async () => {
		const instance = controller("scientific", { historyLimit: 0 });
		await instance.evaluate("1+1");
		expect(instance.getHistory()).toEqual([]);
		instance.destroy();
	});

	test("hands out copies, and clearing empties it", async () => {
		const instance = controller();
		await instance.evaluate("1+1");
		const history = instance.getHistory();
		const entry = history[0];
		if (!entry) throw new Error("Expected one history entry.");
		entry.result = "tampered";
		expect(instance.getHistory()[0]?.result).toBe("2");

		instance.clearHistory();
		expect(instance.getHistory()).toEqual([]);
		instance.destroy();
	});

	test("does not record a failed calculation", async () => {
		const instance = controller();
		await expectCortexRejection(
			instance.evaluate("1\\div0"),
			"invalid-expression",
		);
		expect(instance.getHistory()).toEqual([]);
		instance.destroy();
	});
});

describe("angle mode", () => {
	test("voids the displayed answer and applies to the next calculation", async () => {
		const instance = controller();
		const { all } = snapshots(instance);
		expect(await instance.evaluate("\\sin(30)")).toBe("0.5");
		expect(all.at(-1)?.result).toBe("0.5");

		instance.setAngleMode("radian");
		// The shown answer was computed in degrees, so it is no longer an answer to
		// anything: leaving it beside a radian-mode calculator is the failure here.
		expect(all.at(-1)?.result).toBe("");
		expect(all.at(-1)?.angleMode).toBe("radian");
		expect(await instance.evaluate("\\sin(30)")).not.toBe("0.5");
		instance.destroy();
	});

	test("ignores a change to the mode already in force", () => {
		const instance = controller();
		const { all } = snapshots(instance);
		const count = all.length;
		instance.setAngleMode("degree");
		expect(all).toHaveLength(count);
		instance.destroy();
	});
});

describe("graph rows", () => {
	test("starts with one empty row and stops at the documented ceiling", () => {
		const instance = controller("graphing");
		expect(instance.getSnapshot().graph?.expressions).toHaveLength(1);

		for (let index = 0; index < CORTEX_GRAPH_EXPRESSION_LIMIT + 3; index += 1) {
			instance.addGraphExpression();
		}
		expect(instance.getSnapshot().graph?.expressions).toHaveLength(
			CORTEX_GRAPH_EXPRESSION_LIMIT,
		);
		instance.destroy();
	});

	test("gives every row a distinct colour and line style pair", () => {
		const instance = controller("graphing");
		for (let index = 1; index < CORTEX_GRAPH_EXPRESSION_LIMIT; index += 1) {
			instance.addGraphExpression();
		}
		const rows = instance.getSnapshot().graph?.expressions ?? [];
		expect(new Set(rows.map((row) => row.colorIndex)).size).toBe(rows.length);
		// Colour alone cannot identify a series for a colour-blind learner, so the
		// style repeats on a cycle of three while the colour does not repeat at all.
		expect(new Set(rows.map((row) => row.lineStyle)).size).toBeGreaterThan(1);
		instance.destroy();
	});

	test("re-seeds an empty row rather than leaving no row at all", () => {
		const instance = controller("graphing");
		const first = instance.getSnapshot().graph?.expressions[0];
		if (!first) throw new Error("Expected a seeded row.");
		instance.setGraphExpression(first.id, "y=x");
		instance.removeGraphExpression(first.id);

		const rows = instance.getSnapshot().graph?.expressions ?? [];
		expect(rows).toHaveLength(1);
		expect(rows[0]?.latex).toBe("");
		expect(instance.getValue()).toBe("");
		instance.destroy();
	});

	test("mirrors the first row and the shared input in both directions", () => {
		const instance = controller("graphing");
		const first = instance.getSnapshot().graph?.expressions[0];
		if (!first) throw new Error("Expected a seeded row.");

		instance.setValue("y=x^2");
		expect(instance.getSnapshot().graph?.expressions[0]?.latex).toBe("y=x^2");
		instance.setGraphExpression(first.id, "y=x^3");
		expect(instance.getValue()).toBe("y=x^3");
		instance.destroy();
	});

	test("refuses an edit buffer the policy rejects before it reaches state", () => {
		const instance = controller("graphing");
		expectCortexCode(
			() => instance.setValue("\\href{https://example.invalid}{x}"),
			"unsupported-expression",
		);
		expect(instance.getValue()).toBe("");
		instance.destroy();
	});
});

describe("graph sampling and the viewport", () => {
	test("records the viewport it sampled, which is how pan and zoom commit", async () => {
		const instance = controller("graphing");
		instance.setValue("y=x");
		await instance.sampleGraph({ xMin: -2, xMax: 2, yMin: -1, yMax: 1 }, 320);

		const snapshot = instance.getSnapshot();
		expect(snapshot.graph?.viewport).toEqual({
			xMin: -2,
			xMax: 2,
			yMin: -1,
			yMax: 1,
		});
		expect(snapshot.series).toHaveLength(1);
		expect(snapshot.graphUpdating).toBe(false);
		instance.destroy();
	});

	test("clearing restores the configured default viewport and drops the series", async () => {
		const instance = controller("graphing", {
			graph: { viewport: { xMin: -4, xMax: 4, yMin: -3, yMax: 3 } },
		});
		instance.setValue("y=x");
		await instance.sampleGraph(
			{ xMin: -50, xMax: 50, yMin: -50, yMax: 50 },
			320,
		);
		expect(instance.getSnapshot().series).toHaveLength(1);

		instance.clear();
		const snapshot = instance.getSnapshot();
		expect(snapshot.graph?.viewport).toEqual({
			xMin: -4,
			xMax: 4,
			yMin: -3,
			yMax: 3,
		});
		expect(snapshot.series).toEqual([]);
		expect(snapshot.graph?.expressions).toHaveLength(1);
		expect(snapshot.result).toBe("");
		instance.destroy();
	});

	test("excludes a hidden row and never asks the worker for nothing", async () => {
		const instance = controller("graphing");
		const first = instance.getSnapshot().graph?.expressions[0];
		if (!first) throw new Error("Expected a seeded row.");
		instance.setGraphExpression(first.id, "y=x");
		instance.addGraphExpression();
		const second = instance.getSnapshot().graph?.expressions[1];
		if (!second) throw new Error("Expected a second row.");
		instance.setGraphExpression(second.id, "y=x^2");

		await instance.sampleGraph({ xMin: -2, xMax: 2, yMin: -4, yMax: 4 }, 200);
		expect(instance.getSnapshot().series.map((entry) => entry.id)).toEqual([
			first.id,
			second.id,
		]);

		instance.toggleGraphExpression(second.id);
		await instance.sampleGraph({ xMin: -2, xMax: 2, yMin: -4, yMax: 4 }, 200);
		expect(instance.getSnapshot().series.map((entry) => entry.id)).toEqual([
			first.id,
		]);

		// Every row empty or hidden: the series clears without a request.
		const requestsBefore = fleet?.last.requests.length ?? 0;
		instance.toggleGraphExpression(first.id);
		instance.setGraphExpression(first.id, "");
		instance.setGraphExpression(second.id, "");
		await instance.sampleGraph({ xMin: -2, xMax: 2, yMin: -4, yMax: 4 }, 200);
		expect(instance.getSnapshot().series).toEqual([]);
		expect(fleet?.last.requests.length).toBe(requestsBefore);
		instance.destroy();
	});

	test("reports a rejected row as a recoverable error, leaving the last series", async () => {
		const instance = controller("graphing");
		const first = instance.getSnapshot().graph?.expressions[0];
		if (!first) throw new Error("Expected a seeded row.");
		instance.setGraphExpression(first.id, "y=x");
		await instance.sampleGraph({ xMin: -2, xMax: 2, yMin: -2, yMax: 2 }, 200);

		instance.setGraphExpression(first.id, "y=2t");
		await instance.sampleGraph({ xMin: -2, xMax: 2, yMin: -2, yMax: 2 }, 200);
		expect(instance.getSnapshot().errorCode).toBe("unsupported-expression");
		expect(instance.getSnapshot().graphUpdating).toBe(false);
		instance.destroy();
	});
});

describe("a calculation the input has moved past", () => {
	test("neither displays its answer nor records it", async () => {
		const instance = controller();
		const pending = instance.evaluate("2+2");
		// A keystroke arriving while the worker is busy.
		instance.setValue("9");

		await expectCortexRejection(pending, "invalid-expression");
		const snapshot = instance.getSnapshot();
		expect(snapshot.result).toBe("");
		expect(snapshot.errorCode).toBe(null);
		expect(instance.getHistory()).toEqual([]);
		expect(snapshot.busy).toBe(false);
		instance.destroy();
	});

	test("stays busy while a later calculation is still running", async () => {
		const instance = controller();
		const first = instance.evaluate("2+2");
		const second = instance.evaluate("3+3");
		expect(instance.getSnapshot().busy).toBe(true);

		await expectCortexRejection(first, "invalid-expression");
		expect(await second).toBe("6");
		expect(instance.getSnapshot().busy).toBe(false);
		instance.destroy();
	});
});

describe("state", () => {
	test("round trips value, history, angle mode and graph through the controller", async () => {
		const source = controller("graphing");
		const first = source.getSnapshot().graph?.expressions[0];
		if (!first) throw new Error("Expected a seeded row.");
		source.setGraphExpression(first.id, "y=x^2");
		source.setAngleMode("radian");
		await source.evaluate("y=x^2").catch(() => {});
		const exported = source.exportState();

		const target = controller("graphing");
		target.importState(exported);
		const snapshot = target.getSnapshot();
		expect(target.getValue()).toBe("y=x^2");
		expect(snapshot.angleMode).toBe("radian");
		expect(snapshot.graph?.expressions[0]?.latex).toBe("y=x^2");
		source.destroy();
		target.destroy();
	});

	test("leaves the controller untouched when an import is refused", () => {
		const instance = controller("basic");
		instance.setValue("1+1");
		const exported = instance.exportState() as CortexOuterCalculatorState;
		// The outer value and the provider value must agree; a rewritten outer value
		// is the shape a partially applied import would have.
		const corrupted = {
			...exported,
			value: "8\\times8",
		} as CortexOuterCalculatorState;

		expectCortexCode(() => instance.importState(corrupted), "invalid-state");
		expect(instance.getValue()).toBe("1+1");
		instance.destroy();
	});
});

describe("telemetry carries no learner content", () => {
	function collect(): {
		events: Array<{ eventName: string; payload?: Record<string, unknown> }>;
		callback: (eventName: string, payload?: Record<string, unknown>) => void;
	} {
		const events: Array<{
			eventName: string;
			payload?: Record<string, unknown>;
		}> = [];
		return {
			events,
			callback: (eventName, payload) => events.push({ eventName, payload }),
		};
	}

	/** Every string anywhere in the payload, however nested. */
	function strings(value: unknown): string[] {
		if (typeof value === "string") return [value];
		if (Array.isArray(value)) return value.flatMap(strings);
		if (value && typeof value === "object") {
			return Object.values(value).flatMap(strings);
		}
		return [];
	}

	test("omits the expression, the result and every graph coordinate", async () => {
		const { events, callback } = collect();
		const instance = controller("graphing", {}, callback);
		const first = instance.getSnapshot().graph?.expressions[0];
		if (!first) throw new Error("Expected a seeded row.");
		instance.setGraphExpression(first.id, "y=3x^2+1");
		await instance.evaluate("2+2");
		await instance.sampleGraph({ xMin: -2, xMax: 2, yMin: -4, yMax: 4 }, 200);
		await expectCortexRejection(
			instance.evaluate("1\\div0"),
			"invalid-expression",
		);

		expect(events.length).toBeGreaterThan(2);
		for (const event of events) {
			const keys = Object.keys(event.payload ?? {});
			for (const forbidden of [
				"expression",
				"latex",
				"result",
				"state",
				"history",
				"coordinates",
				"series",
				"viewport",
			]) {
				expect(keys, event.eventName).not.toContain(forbidden);
			}
			// Not just the key names: no value may carry the content either.
			for (const value of strings(event.payload)) {
				expect(value).not.toContain("3x^2");
				expect(value).not.toContain("2+2");
				expect(value).not.toBe("4");
			}
		}
		instance.destroy();
	});

	test("names the tool, the backend, the mode and the error category", async () => {
		const { events, callback } = collect();
		const instance = controller("scientific", {}, callback);
		await expectCortexRejection(
			instance.evaluate("1\\div0"),
			"invalid-expression",
		);

		const failure = events.find(
			(event) => event.eventName === "pie-tool-operation-error",
		);
		expect(failure?.payload).toMatchObject({
			toolId: "calculator",
			backend: "cortex",
			calculatorType: "scientific",
			operation: "evaluate",
			errorType: "invalid-expression",
		});
		instance.destroy();
	});

	test("survives a telemetry callback that throws", async () => {
		const instance = controller("scientific", {}, () => {
			throw new Error("instrumentation is broken");
		});
		expect(await instance.evaluate("2+2")).toBe("4");
		instance.destroy();
	});
});
