export type CortexCalculatorErrorCode =
	| "invalid-expression"
	| "unsupported-expression"
	| "expression-too-complex"
	| "evaluation-timeout"
	| "invalid-state"
	| "worker-unavailable";

export class CortexCalculatorError extends Error {
	readonly code: CortexCalculatorErrorCode;
	readonly recoverable: boolean;

	constructor(
		code: CortexCalculatorErrorCode,
		message: string,
		options: { recoverable?: boolean; cause?: unknown } = {},
	) {
		super(message, options.cause === undefined ? undefined : { cause: options.cause });
		this.name = "CortexCalculatorError";
		this.code = code;
		this.recoverable = options.recoverable ?? true;
	}
}

export function asCortexError(
	error: unknown,
	fallbackCode: CortexCalculatorErrorCode,
	fallbackMessage: string,
): CortexCalculatorError {
	if (error instanceof CortexCalculatorError) return error;
	return new CortexCalculatorError(fallbackCode, fallbackMessage, {
		cause: error,
		recoverable: fallbackCode !== "worker-unavailable",
	});
}
