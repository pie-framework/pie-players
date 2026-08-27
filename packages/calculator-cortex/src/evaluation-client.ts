import { CortexCalculatorError } from "./errors.js";
import type { ResolvedCortexSettings } from "./settings.js";
import type { CortexGraphViewport } from "./types.js";
import {
	CORTEX_WORKER_PROTOCOL_VERSION,
	type EvaluationResult,
	type SampledSeries,
	type WorkerEvaluationSettings,
	type WorkerRequest,
	type WorkerResponse,
} from "./worker-protocol.js";

interface PendingRequest {
	resolve(value: EvaluationResult | SampledSeries[]): void;
	reject(error: unknown): void;
	timer: ReturnType<typeof setTimeout>;
}

type WithoutWorkerEnvelope<T> = T extends WorkerRequest
	? Omit<T, "protocolVersion" | "instanceId" | "requestId" | "generation">
	: never;
type WorkerRequestBody = WithoutWorkerEnvelope<WorkerRequest>;

let nextInstanceId = 0;

function createInstanceId(): string {
	if (
		typeof crypto !== "undefined" &&
		typeof crypto.randomUUID === "function"
	) {
		return crypto.randomUUID();
	}
	nextInstanceId += 1;
	return `cortex-${Date.now()}-${nextInstanceId}`;
}

export class EvaluationClient {
	private worker: Worker | null = null;
	private readonly pending = new Map<number, PendingRequest>();
	private readonly instanceId = createInstanceId();
	private nextRequestId = 0;
	private generation = 0;
	private destroyed = false;

	constructor(private settings: ResolvedCortexSettings) {}

	/*
	 * Settings travel with every request and the worker is stateless — it reads
	 * `request.settings` per message — so a settings change needs no new worker.
	 * The client only used to be replaced because it captured them in its
	 * constructor, which made an angle-mode switch terminate the worker and throw
	 * away a warm Compute Engine for nothing.
	 */
	updateSettings(settings: ResolvedCortexSettings): void {
		this.settings = settings;
	}

	private workerSettings(): WorkerEvaluationSettings {
		return {
			angleMode: this.settings.angleMode,
			calculationPrecision: this.settings.calculationPrecision,
			displayPrecision: this.settings.displayPrecision,
			evaluationTimeLimitMs: this.settings.evaluationTimeLimitMs,
			allowedFunctions: [...this.settings.allowedFunctions],
		};
	}

	private ensureWorker(): Worker {
		if (this.destroyed) {
			throw new CortexCalculatorError(
				"worker-unavailable",
				"This calculator has been destroyed.",
				{ recoverable: false },
			);
		}
		if (this.worker) return this.worker;
		if (typeof Worker === "undefined") {
			throw new CortexCalculatorError(
				"worker-unavailable",
				"This browser does not support calculator workers.",
				{ recoverable: false },
			);
		}
		try {
			const worker = new Worker(
				new URL("./evaluation-worker.ts", import.meta.url),
				{
					type: "module",
					name: "pie-calculator-cortex",
				},
			);
			worker.addEventListener("message", this.handleMessage);
			worker.addEventListener("error", this.handleWorkerError);
			this.worker = worker;
			return worker;
		} catch (error) {
			throw new CortexCalculatorError(
				"worker-unavailable",
				"The calculator worker could not be started.",
				{ cause: error, recoverable: false },
			);
		}
	}

	private readonly handleMessage = (
		event: MessageEvent<WorkerResponse>,
	): void => {
		const response = event.data;
		if (
			response.protocolVersion !== CORTEX_WORKER_PROTOCOL_VERSION ||
			response.instanceId !== this.instanceId
		) {
			return;
		}
		const pending = this.pending.get(response.requestId);
		if (!pending) return;
		this.pending.delete(response.requestId);
		clearTimeout(pending.timer);
		if (response.generation !== this.generation) {
			pending.reject(
				new CortexCalculatorError(
					"invalid-expression",
					"The calculation was superseded by newer input.",
				),
			);
			return;
		}
		if (response.kind === "error") {
			pending.reject(
				new CortexCalculatorError(response.error.code, response.error.message, {
					recoverable: response.error.recoverable,
				}),
			);
		} else if (response.kind === "result") {
			pending.resolve(response.result);
		} else {
			pending.resolve(response.series);
		}
	};

	private readonly handleWorkerError = (): void => {
		this.resetWorker(
			new CortexCalculatorError(
				"worker-unavailable",
				"The calculator worker stopped unexpectedly.",
				{ recoverable: false },
			),
		);
	};

	private resetWorker(error: CortexCalculatorError): void {
		const worker = this.worker;
		this.worker = null;
		worker?.removeEventListener("message", this.handleMessage);
		worker?.removeEventListener("error", this.handleWorkerError);
		worker?.terminate();
		for (const pending of this.pending.values()) {
			clearTimeout(pending.timer);
			pending.reject(error);
		}
		this.pending.clear();
	}

	private request(
		request: WorkerRequestBody,
	): Promise<EvaluationResult | SampledSeries[]> {
		const worker = this.ensureWorker();
		const requestId = ++this.nextRequestId;
		const generation = this.generation;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.resetWorker(
					new CortexCalculatorError(
						"evaluation-timeout",
						"The calculation took too long and was stopped.",
					),
				);
			}, this.settings.evaluationTimeLimitMs + 150);
			this.pending.set(requestId, { resolve, reject, timer });
			const message = {
				...request,
				protocolVersion: CORTEX_WORKER_PROTOCOL_VERSION,
				instanceId: this.instanceId,
				requestId,
				generation,
			} as WorkerRequest;
			worker.postMessage(message);
		});
	}

	async evaluate(latex: string): Promise<EvaluationResult> {
		this.generation += 1;
		return this.request({
			kind: "evaluate",
			latex,
			type: this.settings.type,
			settings: this.workerSettings(),
		}) as Promise<EvaluationResult>;
	}

	async sample(
		expressions: Array<{ id: string; latex: string }>,
		viewport: CortexGraphViewport,
		pixelWidth: number,
	): Promise<SampledSeries[]> {
		this.generation += 1;
		return this.request({
			kind: "sample",
			expressions,
			viewport,
			pixelWidth,
			type: "graphing",
			settings: this.workerSettings(),
		}) as Promise<SampledSeries[]>;
	}

	destroy(): void {
		if (this.destroyed) return;
		this.destroyed = true;
		this.resetWorker(
			new CortexCalculatorError(
				"worker-unavailable",
				"The calculator was closed.",
				{ recoverable: false },
			),
		);
	}
}
