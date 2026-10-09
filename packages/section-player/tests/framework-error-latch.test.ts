import { describe, expect, test } from "bun:test";

import {
	CLEAR_FRAMEWORK_ERROR_LATCH,
	isFrameworkErrorLatched,
	latchFrameworkError,
	rollFrameworkErrorLatch,
} from "../src/components/shared/framework-error-latch.js";

describe("framework error latch", () => {
	test("a cohort-scoped error fails its section and clears when the cohort rolls", () => {
		const latched = latchFrameworkError(CLEAR_FRAMEWORK_ERROR_LATCH, {
			recoverable: false,
			scope: "cohort",
		});
		expect(isFrameworkErrorLatched(latched)).toBe(true);
		expect(isFrameworkErrorLatched(rollFrameworkErrorLatch(latched))).toBe(false);
	});

	test("a runtime-scoped error stays latched across a cohort change", () => {
		const latched = latchFrameworkError(CLEAR_FRAMEWORK_ERROR_LATCH, {
			recoverable: false,
			scope: "runtime",
		});
		const next = rollFrameworkErrorLatch(rollFrameworkErrorLatch(latched));
		expect(isFrameworkErrorLatched(next)).toBe(true);
	});

	test("a recoverable error latches nothing", () => {
		for (const scope of ["cohort", "runtime"] as const) {
			expect(
				latchFrameworkError(CLEAR_FRAMEWORK_ERROR_LATCH, {
					recoverable: true,
					scope,
				}),
			).toBe(CLEAR_FRAMEWORK_ERROR_LATCH);
		}
	});
});
