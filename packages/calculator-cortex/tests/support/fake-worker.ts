import { asCortexError } from "../../src/errors.js";
import { evaluateLatex, sampleLatex } from "../../src/evaluation-engine.js";
import {
	CORTEX_WORKER_PROTOCOL_VERSION,
	type SerializedCortexError,
	type WorkerRequest,
	type WorkerResponse,
} from "../../src/worker-protocol.js";

/*
 * A `Worker` stand-in that speaks the real protocol in-process.
 *
 * `EvaluationClient` constructs `new Worker(new URL("./evaluation-worker.ts", …))`,
 * which under Bun would either compile the module graph per test or, in `computing`
 * mode, put every answer behind a real thread — and neither can be driven. The
 * failure modes the client exists to handle are all *absences*: a reply that never
 * comes, a reply that arrives after the input moved on, a worker that dies. Those
 * are only reachable from a fake that owns the reply.
 *
 * `computing` mode routes requests through the same `evaluateLatex`/`sampleLatex`
 * the shipped worker calls, and serializes a throw the same way, so a controller
 * test exercises real arithmetic across a real protocol boundary.
 */

type MessageListener = (event: { data: WorkerResponse }) => void;

export interface FakeWorkerHandle {
	/** Every request posted to this worker, in order. */
	readonly requests: readonly WorkerRequest[];
	readonly terminated: boolean;
	/** Deliver an arbitrary response, envelope included. */
	respond(response: WorkerResponse): void;
	/** Deliver a successful result echoing a request's envelope. */
	respondWithResult(request: WorkerRequest, formatted: string): void;
	/** Fire the `error` event a dying worker fires. */
	emitError(): void;
}

export interface FakeWorkerFleet {
	/** Handles in construction order; a restart appends. */
	readonly created: readonly FakeWorkerHandle[];
	readonly last: FakeWorkerHandle;
	restore(): void;
}

function serializeError(error: unknown): SerializedCortexError {
	const cortexError = asCortexError(
		error,
		"invalid-expression",
		"The calculation could not be completed.",
	);
	return {
		code: cortexError.code,
		message: cortexError.message,
		recoverable: cortexError.recoverable,
	};
}

/** The shipped worker's dispatch, minus the `postMessage` scope. */
function computeResponse(request: WorkerRequest): WorkerResponse {
	try {
		if (request.kind === "evaluate") {
			return {
				...request,
				kind: "result",
				result: evaluateLatex(request.type, request.latex, request.settings),
			};
		}
		return {
			...request,
			kind: "series",
			series: sampleLatex(
				request.expressions,
				request.viewport,
				request.pixelWidth,
				request.settings,
			),
		};
	} catch (error) {
		return { ...request, kind: "error", error: serializeError(error) };
	}
}

class FakeWorker implements FakeWorkerHandle {
	readonly requests: WorkerRequest[] = [];
	terminated = false;
	private readonly messageListeners = new Set<MessageListener>();
	private readonly errorListeners = new Set<() => void>();

	constructor(private readonly autoRespond: boolean) {}

	addEventListener(
		kind: string,
		listener: MessageListener | (() => void),
	): void {
		if (kind === "message")
			this.messageListeners.add(listener as MessageListener);
		if (kind === "error") this.errorListeners.add(listener as () => void);
	}

	removeEventListener(
		kind: string,
		listener: MessageListener | (() => void),
	): void {
		if (kind === "message")
			this.messageListeners.delete(listener as MessageListener);
		if (kind === "error") this.errorListeners.delete(listener as () => void);
	}

	postMessage(request: WorkerRequest): void {
		this.requests.push(request);
		if (!this.autoRespond) return;
		// A macrotask, not a microtask: the client must survive a reply that lands
		// after the caller has already awaited something else.
		setTimeout(() => this.respond(computeResponse(request)), 0);
	}

	terminate(): void {
		this.terminated = true;
	}

	respond(response: WorkerResponse): void {
		if (this.terminated) return;
		for (const listener of [...this.messageListeners])
			listener({ data: response });
	}

	respondWithResult(request: WorkerRequest, formatted: string): void {
		this.respond({
			...request,
			kind: "result",
			result: { formatted, numericValue: Number(formatted) },
		});
	}

	emitError(): void {
		for (const listener of [...this.errorListeners]) listener();
	}
}

export function installFakeWorkers(
	mode: "manual" | "computing" = "manual",
): FakeWorkerFleet {
	const created: FakeWorker[] = [];
	const descriptor = Object.getOwnPropertyDescriptor(globalThis, "Worker");
	Object.defineProperty(globalThis, "Worker", {
		configurable: true,
		writable: true,
		value: class extends FakeWorker {
			constructor() {
				super(mode === "computing");
				created.push(this);
			}
		},
	});
	return {
		created,
		get last() {
			const worker = created.at(-1);
			if (!worker) throw new Error("No fake worker has been constructed yet.");
			return worker;
		},
		restore() {
			if (descriptor) Object.defineProperty(globalThis, "Worker", descriptor);
			else Reflect.deleteProperty(globalThis, "Worker");
		},
	};
}

export { CORTEX_WORKER_PROTOCOL_VERSION };
