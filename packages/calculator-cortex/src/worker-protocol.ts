import type { CalculatorType } from "@pie-players/pie-calculator";
import type { CortexCalculatorErrorCode } from "./errors.js";
import type {
	CortexAngleMode,
	CortexFunctionId,
	CortexGraphViewport,
} from "./types.js";

export const CORTEX_WORKER_PROTOCOL_VERSION = 1 as const;

export interface WorkerEvaluationSettings {
	angleMode: CortexAngleMode;
	calculationPrecision: number;
	displayPrecision: number;
	evaluationTimeLimitMs: number;
	allowedFunctions: CortexFunctionId[];
}

interface WorkerEnvelope {
	protocolVersion: typeof CORTEX_WORKER_PROTOCOL_VERSION;
	instanceId: string;
	requestId: number;
	generation: number;
}

export type WorkerRequest =
	| (WorkerEnvelope & {
			kind: "evaluate";
			latex: string;
			type: CalculatorType;
			settings: WorkerEvaluationSettings;
	  })
	| (WorkerEnvelope & {
			kind: "sample";
			expressions: Array<{ id: string; latex: string }>;
			viewport: CortexGraphViewport;
			pixelWidth: number;
			type: "graphing";
			settings: WorkerEvaluationSettings;
	  });

export interface EvaluationResult {
	formatted: string;
	numericValue: number;
}

export interface SampledSeries {
	id: string;
	x: number[];
	y: number[];
}

export interface SerializedCortexError {
	code: CortexCalculatorErrorCode;
	message: string;
	recoverable: boolean;
}

export type WorkerResponse =
	| (WorkerEnvelope & { kind: "result"; result: EvaluationResult })
	| (WorkerEnvelope & { kind: "series"; series: SampledSeries[] })
	| (WorkerEnvelope & { kind: "error"; error: SerializedCortexError });
