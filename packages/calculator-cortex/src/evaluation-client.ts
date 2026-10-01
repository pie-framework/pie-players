import { CortexCalculatorError } from "./errors.js";
import { startModuleWorker } from "./module-worker.js";
import type { ResolvedCortexSettings } from "./settings.js";
import type { CortexGraphViewport } from "./types.js";
import {
	CORTEX_WORKER_PROTOCOL_VERSION,
	type EvaluationResult,
	type SampledSeries,
	type WorkerEvaluationSettings,
	type WorkerReadyMessage,
	type WorkerRequest,
	type WorkerResponse,
} from "./worker-protocol.js";

/*
 * How long a worker may take to fetch, compile and run its module. It is 0.7s on a
 * fast machine and several seconds on a slow one, so the calculation's own limit
 * cannot also cover it. The GeoGebra provider allows its applet the same 20s.
 */
const WORKER_STARTUP_LIMIT_MS = 20_000;

interface PendingRequest {
	resolve(value: EvaluationResult | SampledSeries[]): void;
	reject(error: unknown): void;
	/** Armed when the worker is ready; a request made while it starts waits. */
	timer: ReturnType<typeof setTimeout> | null;
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
	private workerReady = false;
	private startupTimer: ReturnType<typeof setTimeout> | null = null;
	private readonly pending = new Map<number, PendingRequest>();
	private readonly instanceId = createInstanceId();
	private nextRequestId = 0;
	private generation = 0;
	private destroyed = false;

	constructor(
		private settings: ResolvedCortexSettings,
		private readonly startupLimitMs = WORKER_STARTUP_LIMIT_MS,
	) {}

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
			const worker = startModuleWorker(
				(Worker) =>
					new Worker(new URL("./evaluation-worker.ts", import.meta.url), {
						type: "module",
						name: "pie-calculator-cortex",
					}),
			);
			worker.addEventListener("message", this.handleMessage);
			worker.addEventListener("error", this.handleWorkerError);
			this.worker = worker;
			this.workerReady = false;
			this.startupTimer = setTimeout(() => {
				this.resetWorker(
					new CortexCalculatorError(
						"worker-unavailable",
						"The calculator worker did not start in time.",
						{ recoverable: false },
					),
				);
			}, this.startupLimitMs);
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
		event: MessageEvent<WorkerResponse | WorkerReadyMessage>,
	): void => {
		const response = event.data;
		if (response.protocolVersion !== CORTEX_WORKER_PROTOCOL_VERSION) return;
		if (response.kind === "ready") {
			this.handleReady();
			return;
		}
		if (response.instanceId !== this.instanceId) return;
		const pending = this.pending.get(response.requestId);
		if (!pending) return;
		this.pending.delete(response.requestId);
		if (pending.timer) clearTimeout(pending.timer);
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

	private handleReady(): void {
		if (this.workerReady) return;
		this.workerReady = true;
		if (this.startupTimer) clearTimeout(this.startupTimer);
		this.startupTimer = null;
		for (const pending of this.pending.values()) {
			pending.timer ??= this.startRequestTimer();
		}
	}

	private startRequestTimer(): ReturnType<typeof setTimeout> {
		return setTimeout(() => {
			this.resetWorker(
				new CortexCalculatorError(
					"evaluation-timeout",
					"The calculation took too long and was stopped.",
				),
			);
		}, this.settings.evaluationTimeLimitMs + 150);
	}

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
		this.workerReady = false;
		if (this.startupTimer) clearTimeout(this.startupTimer);
		this.startupTimer = null;
		worker?.removeEventListener("message", this.handleMessage);
		worker?.removeEventListener("error", this.handleWorkerError);
		worker?.terminate();
		for (const pending of this.pending.values()) {
			if (pending.timer) clearTimeout(pending.timer);
			pending.reject(error);
		}
		this.pending.clear();
	}

	/**
	 * Starts the worker ahead of the first request, so the learner's typing covers
	 * its cold start. A worker that cannot be created is reported by that request.
	 */
	start(): void {
		try {
			this.ensureWorker();
		} catch {
			// `request` calls `ensureWorker` again and rejects with the same error.
		}
	}

	private request(
		request: WorkerRequestBody,
	): Promise<EvaluationResult | SampledSeries[]> {
		const worker = this.ensureWorker();
		const requestId = ++this.nextRequestId;
		const generation = this.generation;
		return new Promise((resolve, reject) => {
			const timer = this.workerReady ? this.startRequestTimer() : null;
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
