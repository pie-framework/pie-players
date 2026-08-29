import { expect } from "bun:test";
import { CortexCalculatorError } from "../../src/errors.js";
import type { CortexCalculatorErrorCode } from "../../src/errors.js";

/** Asserts a synchronous throw carries a specific `CortexCalculatorErrorCode`. */
export function expectCortexCode(
	operation: () => unknown,
	code: CortexCalculatorErrorCode,
): CortexCalculatorError {
	try {
		operation();
	} catch (error) {
		expect(error).toBeInstanceOf(CortexCalculatorError);
		expect((error as CortexCalculatorError).code).toBe(code);
		return error as CortexCalculatorError;
	}
	throw new Error(
		`Expected a ${code} CortexCalculatorError, but nothing threw.`,
	);
}

/** The awaited form: a rejected promise carrying a specific code. */
export async function expectCortexRejection(
	operation: Promise<unknown>,
	code: CortexCalculatorErrorCode,
): Promise<CortexCalculatorError> {
	try {
		await operation;
	} catch (error) {
		expect(error).toBeInstanceOf(CortexCalculatorError);
		expect((error as CortexCalculatorError).code).toBe(code);
		return error as CortexCalculatorError;
	}
	throw new Error(`Expected a ${code} CortexCalculatorError, but it resolved.`);
}
