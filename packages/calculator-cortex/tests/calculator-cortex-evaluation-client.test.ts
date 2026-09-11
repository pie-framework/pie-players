import { afterEach, describe, expect, test } from "bun:test";
import { EvaluationClient } from "../src/evaluation-client.js";
import { resolveCortexSettings } from "../src/settings.js";
import type { WorkerResponse } from "../src/worker-protocol.js";
import { expectCortexRejection } from "./support/cortex-errors.js";
import {
	CORTEX_WORKER_PROTOCOL_VERSION,
	type FakeWorkerFleet,
	installFakeWorkers,
} from "./support/fake-worker.js";

/*
 * `EvaluationClient` is the boundary this package owns between the calculator and
 * the worker that computes. What it must get right is everything the worker does
 * *not* do: bound a reply that never arrives, survive a worker that dies, drop a
 * reply the input has already moved past, and ignore traffic addressed elsewhere.
 * None of that is reachable through a real worker, which always answers.
 */

let fleet: FakeWorkerFleet | null = null;

afterEach(() => {
	fleet?.restore();
	fleet = null;
});

/** The floor of the accepted range, so the timeout path costs 250ms, not 1.15s. */
const settings = (overrides: Record<string, unknown> = {}) =>
	resolveCortexSettings("scientific", {
		settings: { evaluationTimeLimitMs: 100, ...overrides },
	});

/** Resolves to `"pending"` if the promise has not settled within a beat. */
async function settlement(promise: Promise<unknown>): Promise<string> {
	const pending = Symbol("pending");
	const raced = await Promise.race([
		promise.then(
			() => "resolved",
			() => "rejected",
		),
		new Promise((resolve) => setTimeout(() => resolve(pending), 25)),
	]);
	return raced === pending ? "pending" : (raced as string);
}

describe("a reply that never arrives", () => {
	test("fails as a timeout and terminates the worker", async () => {
		fleet = installFakeWorkers();
		const client = new EvaluationClient(settings());

		const error = await expectCortexRejection(
			client.evaluate("2+2"),
			"evaluation-timeout",
		);
		expect(error.recoverable).toBe(true);
		expect(fleet.created).toHaveLength(1);
		expect(fleet.created[0]?.terminated).toBe(true);
	});

	test("restarts on the next request rather than staying dead", async () => {
		fleet = installFakeWorkers();
		const client = new EvaluationClient(settings());
		await expectCortexRejection(client.evaluate("2+2"), "evaluation-timeout");

		const pending = client.evaluate("3+3");
		expect(fleet.created).toHaveLength(2);
		const request = fleet.last.requests[0];
		if (!request) throw new Error("The restarted worker received no request.");
		fleet.last.respondWithResult(request, "6");
		expect((await pending).formatted).toBe("6");
	});
});

describe("a worker that dies", () => {
	test("fails in flight as unrecoverable and restarts on the next request", async () => {
		fleet = installFakeWorkers();
		const client = new EvaluationClient(settings());
		const inFlight = client.evaluate("2+2");
		fleet.last.emitError();

		const error = await expectCortexRejection(inFlight, "worker-unavailable");
		expect(error.recoverable).toBe(false);
		expect(fleet.created[0]?.terminated).toBe(true);

		const pending = client.evaluate("2+2");
		expect(fleet.created).toHaveLength(2);
		const request = fleet.last.requests[0];
		if (!request) throw new Error("The restarted worker received no request.");
		fleet.last.respondWithResult(request, "4");
		expect((await pending).formatted).toBe("4");
	});

	test("refuses to start a new one after the client is destroyed", async () => {
		fleet = installFakeWorkers();
		const client = new EvaluationClient(settings());
		client.destroy();

		const error = await expectCortexRejection(
			client.evaluate("2+2"),
			"worker-unavailable",
		);
		expect(error.recoverable).toBe(false);
		expect(fleet.created).toHaveLength(0);
	});

	test("fails everything in flight when the client is destroyed", async () => {
		fleet = installFakeWorkers();
		const client = new EvaluationClient(settings());
		const inFlight = client.evaluate("2+2");
		client.destroy();
		await expectCortexRejection(inFlight, "worker-unavailable");
		expect(fleet.created[0]?.terminated).toBe(true);
	});
});

describe("replies that no longer apply", () => {
	test("drops a reply the input has moved past and honours the current one", async () => {
		fleet = installFakeWorkers();
		const client = new EvaluationClient(settings());

		const first = client.evaluate("2+2");
		const second = client.evaluate("3+3");
		const worker = fleet.last;
		expect(worker.requests).toHaveLength(2);

		// Out of order on purpose: the superseded answer comes back last.
		const [firstRequest, secondRequest] = worker.requests;
		if (!firstRequest || !secondRequest) throw new Error("Missing requests.");
		worker.respondWithResult(secondRequest, "6");
		worker.respondWithResult(firstRequest, "4");

		expect((await second).formatted).toBe("6");
		// A superseded calculation is reported as recoverable: the view clears the
		// stale answer rather than showing it beside a newer expression.
		const error = await expectCortexRejection(first, "invalid-expression");
		expect(error.recoverable).toBe(true);
	});

	test("ignores a reply from another protocol version or another instance", async () => {
		fleet = installFakeWorkers();
		const client = new EvaluationClient(
			settings({ evaluationTimeLimitMs: 2_000 }),
		);
		const pending = client.evaluate("2+2");
		const worker = fleet.last;
		const request = worker.requests[0];
		if (!request) throw new Error("The worker received no request.");

		const result: Omit<WorkerResponse, "kind"> & {
			kind: "result";
			result: { formatted: string; numericValue: number };
		} = {
			...request,
			kind: "result",
			result: { formatted: "999", numericValue: 999 },
		};
		worker.respond({ ...result, protocolVersion: 99 as never });
		worker.respond({ ...result, instanceId: "someone-else" });
		expect(await settlement(pending)).toBe("pending");

		worker.respond(result);
		expect((await pending).formatted).toBe("999");
	});
});

describe("settings that travel with the request", () => {
	test("an angle-mode change reaches the next request without a restart", async () => {
		/*
		 * The worker is stateless and reads `request.settings`, so replacing it on a
		 * settings change would discard a warm Compute Engine for nothing.
		 */
		fleet = installFakeWorkers();
		const client = new EvaluationClient(settings());
		const first = client.evaluate("\\sin(30)");
		const worker = fleet.last;
		const firstRequest = worker.requests[0];
		if (!firstRequest) throw new Error("The worker received no request.");
		worker.respondWithResult(firstRequest, "0.5");
		await first;

		client.updateSettings(settings({ angleMode: "radian" }));
		const second = client.evaluate("\\sin(30)");
		expect(fleet.created).toHaveLength(1);
		const secondRequest = worker.requests[1];
		if (!secondRequest || secondRequest.kind !== "evaluate") {
			throw new Error("Expected a second evaluate request.");
		}
		expect(secondRequest.settings.angleMode).toBe("radian");
		expect(
			firstRequest.kind === "evaluate" && firstRequest.settings.angleMode,
		).toBe("degree");
		worker.respondWithResult(secondRequest, "-0.988");
		await second;
	});

	test("a sample request carries the viewport, width and allowlist", async () => {
		fleet = installFakeWorkers();
		const client = new EvaluationClient(settings());
		const pending = client.sample(
			[{ id: "row-1", latex: "y=x" }],
			{ xMin: -3, xMax: 3, yMin: -2, yMax: 2 },
			480,
		);
		const request = fleet.last.requests[0];
		if (!request || request.kind !== "sample") {
			throw new Error("Expected a sample request.");
		}
		expect(request.viewport).toEqual({ xMin: -3, xMax: 3, yMin: -2, yMax: 2 });
		expect(request.pixelWidth).toBe(480);
		expect(request.settings.allowedFunctions).toContain("sine");
		expect(request.protocolVersion).toBe(CORTEX_WORKER_PROTOCOL_VERSION);

		fleet.last.respond({ ...request, kind: "series", series: [] });
		expect(await pending).toEqual([]);
	});
});
