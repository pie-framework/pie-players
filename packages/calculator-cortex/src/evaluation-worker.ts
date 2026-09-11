import { CortexCalculatorError, asCortexError } from "./errors.js";
import { evaluateLatex, sampleLatex } from "./evaluation-engine.js";
import {
	CORTEX_WORKER_PROTOCOL_VERSION,
	type SerializedCortexError,
	type WorkerRequest,
	type WorkerResponse,
} from "./worker-protocol.js";

const workerScope = globalThis as unknown as {
	onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
	postMessage(message: WorkerResponse): void;
};

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

workerScope.onmessage = (event) => {
	const request = event.data;
	if (request.protocolVersion !== CORTEX_WORKER_PROTOCOL_VERSION) {
		const error = new CortexCalculatorError(
			"worker-unavailable",
			"Calculator worker protocol does not match this package.",
			{ recoverable: false },
		);
		workerScope.postMessage({
			...request,
			kind: "error",
			error: serializeError(error),
		});
		return;
	}
	try {
		const response: WorkerResponse = request.kind === "evaluate"
			? {
					...request,
					kind: "result",
					result: evaluateLatex(request.type, request.latex, request.settings),
				}
			: {
					...request,
					kind: "series",
					series: sampleLatex(
						request.expressions,
						request.viewport,
						request.pixelWidth,
						request.settings,
					),
				};
		workerScope.postMessage(response);
	} catch (error) {
		workerScope.postMessage({
			...request,
			kind: "error",
			error: serializeError(error),
		});
	}
};
