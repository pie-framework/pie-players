import { afterEach, describe, expect, test } from "bun:test";
import { CortexCalculatorController } from "../src/calculator-controller.js";
import { resolveCortexSettings } from "../src/settings.js";
import { expectCortexRejection } from "./support/cortex-errors.js";
import {
	type FakeWorkerFleet,
	installFakeWorkers,
} from "./support/fake-worker.js";

/*
 * Journeys, not single calls: the sequences a learner actually performs, where
 * what matters is the state left behind between the steps.
 *
 * Every case in the feature matrix is one expression evaluated once. The defects
 * that survive that kind of coverage are the ones that need a second step to
 * appear — an error that never clears, a result still on screen under a changed
 * angle mode, a history that keeps a calculation that failed, a resumed session
 * that answers differently from the one it resumed.
 *
 * Requests run through `installFakeWorkers("computing")`, which routes them to the
 * same evaluator the shipped worker calls, over the real protocol.
 */

let fleet: FakeWorkerFleet | null = null;

afterEach(() => {
	fleet?.restore();
	fleet = null;
});

function calculator(
	type: "basic" | "scientific" | "graphing" = "scientific",
	settings: Record<string, unknown> = {},
): CortexCalculatorController {
	fleet ??= installFakeWorkers("computing");
	return new CortexCalculatorController(
		resolveCortexSettings(type, { settings }),
	);
}

describe("working through a problem", () => {
	test("each calculation replaces the answer and joins the history", async () => {
		const instance = calculator();
		expect(await instance.evaluate("12\\times12")).toBe("144");
		expect(instance.getSnapshot().result).toBe("144");

		// Starting the next expression clears the previous answer rather than leaving
		// it beside input it no longer belongs to.
		instance.setValue("144\\div12");
		expect(instance.getSnapshot().result).toBe("");
		expect(await instance.evaluate()).toBe("12");

		expect(instance.getHistory().map((entry) => entry.expression)).toEqual([
			"144\\div12",
			"12\\times12",
		]);
		instance.destroy();
	});

	test("a mistyped expression is recoverable in place", async () => {
		const instance = calculator();
		await expectCortexRejection(
			instance.evaluate("\\sqrt{-9}"),
			"invalid-expression",
		);
		const failed = instance.getSnapshot();
		expect(failed.errorCode).toBe("invalid-expression");
		expect(failed.result).toBe("");
		// The edit buffer survives the error: correcting it is one keystroke, not a
		// retype.
		expect(instance.getValue()).toBe("\\sqrt{-9}");

		instance.setValue("\\sqrt{9}");
		expect(instance.getSnapshot().errorCode).toBe(null);
		expect(await instance.evaluate()).toBe("3");
		expect(instance.getSnapshot().errorCode).toBe(null);
		// And the failure left no trace in the history.
		expect(instance.getHistory()).toHaveLength(1);
		instance.destroy();
	});

	test("switching the angle mode mid-problem voids the stale answer", async () => {
		const instance = calculator();
		expect(await instance.evaluate("\\sin(30)")).toBe("0.5");

		instance.setAngleMode("radian");
		expect(instance.getSnapshot().result).toBe("");
		expect(await instance.evaluate("\\sin(30)")).toBe("-0.9880316241");

		instance.setAngleMode("degree");
		expect(instance.getSnapshot().result).toBe("");
		expect(await instance.evaluate("\\sin(30)")).toBe("0.5");
		instance.destroy();
	});

	test("a long session keeps the newest calculations and drops the oldest", async () => {
		const instance = calculator("scientific", { historyLimit: 20 });
		for (let value = 1; value <= 25; value += 1) {
			await instance.evaluate(`${value}+0`);
		}
		const history = instance.getHistory();
		expect(history).toHaveLength(20);
		expect(history[0]?.expression).toBe("25+0");
		expect(history.at(-1)?.expression).toBe("6+0");
		instance.destroy();
	});

	test("clearing returns the calculator to how it opened", async () => {
		const instance = calculator();
		await instance.evaluate("2+2");
		const focusBefore = instance.getSnapshot().focusRequest;

		instance.clear();
		const cleared = instance.getSnapshot();
		expect(cleared.inputLatex).toBe("");
		expect(cleared.result).toBe("");
		expect(cleared.errorCode).toBe(null);
		// Clearing hands focus back to the input, or the next keystroke goes nowhere.
		expect(cleared.focusRequest).toBeGreaterThan(focusBefore);
		// History is a separate affordance with its own control, so it survives.
		expect(instance.getHistory()).toHaveLength(1);
		instance.destroy();
	});
});

describe("plotting a function", () => {
	test("builds up a list of curves, hides one, and removes one", async () => {
		const instance = calculator("graphing");
		const viewport = { xMin: -5, xMax: 5, yMin: -5, yMax: 25 };
		const rowIds = () =>
			(instance.getSnapshot().graph?.expressions ?? []).map((row) => row.id);
		const seriesIds = () =>
			instance.getSnapshot().series.map((entry) => entry.id);

		const [first] = rowIds();
		if (!first) throw new Error("Expected a seeded row.");
		instance.setGraphExpression(first, "y=x^2");
		await instance.sampleGraph(viewport, 200);
		expect(seriesIds()).toEqual([first]);

		instance.addGraphExpression();
		const [, second] = rowIds();
		if (!second) throw new Error("Expected a second row.");
		instance.setGraphExpression(second, "y=2x");
		await instance.sampleGraph(viewport, 200);
		expect(seriesIds()).toEqual([first, second]);

		// Hiding is not removing: the row stays, so the learner can bring it back.
		instance.toggleGraphExpression(first);
		await instance.sampleGraph(viewport, 200);
		expect(seriesIds()).toEqual([second]);
		expect(rowIds()).toEqual([first, second]);

		instance.toggleGraphExpression(first);
		instance.removeGraphExpression(second);
		await instance.sampleGraph(viewport, 200);
		expect(seriesIds()).toEqual([first]);
		expect(rowIds()).toEqual([first]);
		instance.destroy();
	});

	test("a curve resamples over the window the learner moved to", async () => {
		const instance = calculator("graphing");
		const [row] = (instance.getSnapshot().graph?.expressions ?? []).map(
			(entry) => entry.id,
		);
		if (!row) throw new Error("Expected a seeded row.");
		instance.setGraphExpression(row, "y=x^2");

		await instance.sampleGraph(
			{ xMin: -10, xMax: 10, yMin: -10, yMax: 100 },
			200,
		);
		expect(instance.getSnapshot().series[0]?.x[0]).toBeCloseTo(-10, 6);

		// What pan and zoom commit: a new window, and the curve is recomputed for it
		// rather than being stretched.
		await instance.sampleGraph({ xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, 200);
		const series = instance.getSnapshot().series[0];
		expect(series?.x[0]).toBeCloseTo(0, 6);
		expect(series?.x.at(-1)).toBeCloseTo(1, 6);
		expect(series?.y.at(-1)).toBeCloseTo(1, 6);
		instance.destroy();
	});

	test("one bad row reports an error without discarding the good curves", async () => {
		const instance = calculator("graphing");
		const [row] = (instance.getSnapshot().graph?.expressions ?? []).map(
			(entry) => entry.id,
		);
		if (!row) throw new Error("Expected a seeded row.");
		instance.setGraphExpression(row, "y=x");
		await instance.sampleGraph({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 }, 200);
		expect(instance.getSnapshot().series).toHaveLength(1);

		instance.setGraphExpression(row, "y=2t");
		await instance.sampleGraph({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 }, 200);
		expect(instance.getSnapshot().errorCode).toBe("unsupported-expression");
		instance.destroy();
	});
});

describe("leaving and coming back", () => {
	test("a resumed scientific session answers exactly as the first did", async () => {
		const opened = calculator();
		expect(await opened.evaluate("\\sin(30)")).toBe("0.5");
		opened.setAngleMode("radian");
		opened.setValue("\\sin(30)");
		const saved = opened.exportState();

		const resumed = calculator();
		resumed.importState(saved);
		expect(resumed.getValue()).toBe("\\sin(30)");
		// The angle mode travelled with the state, so the resumed calculator agrees
		// with the one it resumed rather than reverting to the default unit.
		expect(resumed.getSnapshot().angleMode).toBe("radian");
		expect(await resumed.evaluate()).toBe("-0.9880316241");
		opened.destroy();
		resumed.destroy();
	});

	test("a resumed graphing session plots the same rows in the same window", async () => {
		const opened = calculator("graphing");
		const rows = opened.getSnapshot().graph?.expressions ?? [];
		const [first] = rows.map((row) => row.id);
		if (!first) throw new Error("Expected a seeded row.");
		opened.setGraphExpression(first, "y=x^2");
		opened.addGraphExpression();
		const second = opened.getSnapshot().graph?.expressions[1];
		if (!second) throw new Error("Expected a second row.");
		opened.setGraphExpression(second.id, "y=2x");
		await opened.sampleGraph({ xMin: -3, xMax: 3, yMin: -2, yMax: 9 }, 200);
		const saved = opened.exportState();

		const resumed = calculator("graphing");
		resumed.importState(saved);
		const graph = resumed.getSnapshot().graph;
		expect(graph?.expressions.map((row) => row.latex)).toEqual([
			"y=x^2",
			"y=2x",
		]);
		expect(graph?.viewport).toEqual({ xMin: -3, xMax: 3, yMin: -2, yMax: 9 });
		// The series is not persisted; it is recomputed on the first sample.
		expect(resumed.getSnapshot().series).toEqual([]);
		await resumed.sampleGraph(
			graph?.viewport ?? { xMin: -3, xMax: 3, yMin: -2, yMax: 9 },
			200,
		);
		expect(resumed.getSnapshot().series).toHaveLength(2);
		opened.destroy();
		resumed.destroy();
	});

	test("a refused resume leaves the calculator usable", async () => {
		const instance = calculator("basic");
		await instance.evaluate("2+2");
		const corrupted = {
			...instance.exportState(),
			value: "something else",
		};

		expect(() => instance.importState(corrupted)).toThrow();
		// Not a dead calculator: the pre-import state stands and it still computes.
		expect(instance.getValue()).toBe("2+2");
		expect(await instance.evaluate("3+3")).toBe("6");
		instance.destroy();
	});
});

describe("what a restricted deployment gets", () => {
	test("restricted mode holds against a config that tries to relax it", () => {
		const settings = resolveCortexSettings("scientific", {
			restrictedMode: true,
			settings: { allowClipboard: true },
		});
		expect(settings.restrictedMode).toBe(true);
		expect(settings.allowClipboard).toBe(false);
	});

	test("a narrowed calculator still answers everything it kept", async () => {
		// A deployment that allows roots and logs but no trigonometry: the arithmetic
		// a learner does most is untouched.
		const instance = calculator("scientific", {
			allowedFunctions: ["square-root", "power", "natural-log", "common-log"],
		});
		expect(await instance.evaluate("\\sqrt{16}")).toBe("4");
		expect(await instance.evaluate("2^{8}")).toBe("256");
		expect(await instance.evaluate("\\log(100)")).toBe("2");
		await expectCortexRejection(
			instance.evaluate("\\sin(30)"),
			"unsupported-expression",
		);
		// And the refusal did not poison the session.
		expect(await instance.evaluate("1+1")).toBe("2");
		instance.destroy();
	});
});
