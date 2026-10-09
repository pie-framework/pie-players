import { describe, expect, test } from "bun:test";

import {
	announceToolkitCoordinator,
	CLEAR_FRAMEWORK_ERROR_LATCH,
	isFrameworkErrorLatched,
	latchFrameworkError,
	rollFrameworkErrorLatch,
} from "../src/components/shared/framework-error-latch.js";

const coordinator = { id: "first" };

describe("framework error latch", () => {
	test("a cohort-scoped error fails its section and clears when the cohort rolls", () => {
		const latched = latchFrameworkError(
			CLEAR_FRAMEWORK_ERROR_LATCH,
			{ kind: "section-controller-init", recoverable: false, scope: "cohort" },
			coordinator,
		);
		expect(isFrameworkErrorLatched(latched)).toBe(true);
		expect(isFrameworkErrorLatched(rollFrameworkErrorLatch(latched))).toBe(false);
	});

	test("a runtime-scoped error stays latched across cohorts and coordinators", () => {
		const latched = latchFrameworkError(
			CLEAR_FRAMEWORK_ERROR_LATCH,
			{ kind: "tts-init", recoverable: false, scope: "runtime" },
			coordinator,
		);
		const next = announceToolkitCoordinator(
			rollFrameworkErrorLatch(rollFrameworkErrorLatch(latched)),
			{ id: "second" },
		);
		expect(isFrameworkErrorLatched(next)).toBe(true);
	});

	test("a bootstrap failure clears when the toolkit announces another coordinator", () => {
		for (const kind of ["coordinator-init", "runtime-init", "tool-config"] as const) {
			const latched = latchFrameworkError(
				CLEAR_FRAMEWORK_ERROR_LATCH,
				{ kind, recoverable: false, scope: "runtime" },
				coordinator,
			);
			const rolled = rollFrameworkErrorLatch(latched);
			expect(isFrameworkErrorLatched(rolled)).toBe(true);
			expect(
				isFrameworkErrorLatched(announceToolkitCoordinator(rolled, coordinator)),
			).toBe(true);
			expect(
				isFrameworkErrorLatched(announceToolkitCoordinator(rolled, { id: "second" })),
			).toBe(false);
		}
	});

	test("a bootstrap failure before any coordinator clears on the first one", () => {
		const latched = latchFrameworkError(
			CLEAR_FRAMEWORK_ERROR_LATCH,
			{ kind: "coordinator-init", recoverable: false, scope: "runtime" },
			null,
		);
		expect(isFrameworkErrorLatched(announceToolkitCoordinator(latched, coordinator))).toBe(
			false,
		);
	});

	test("recoverable errors and element-preload latch nothing", () => {
		for (const scope of ["cohort", "runtime"] as const) {
			expect(
				latchFrameworkError(
					CLEAR_FRAMEWORK_ERROR_LATCH,
					{ kind: "tts-init", recoverable: true, scope },
					coordinator,
				),
			).toBe(CLEAR_FRAMEWORK_ERROR_LATCH);
			expect(
				latchFrameworkError(
					CLEAR_FRAMEWORK_ERROR_LATCH,
					{ kind: "element-preload", recoverable: false, scope },
					coordinator,
				),
			).toBe(CLEAR_FRAMEWORK_ERROR_LATCH);
		}
	});
});
