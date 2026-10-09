/**
 * Readiness gating in `runtime/core/engine-readiness.ts`.
 */

import { describe, expect, test } from "bun:test";
import {
	type EngineReadinessSignals,
	resolveReadinessGates,
} from "../../../src/runtime/core/engine-readiness.js";

const signals = (
	overrides: Partial<EngineReadinessSignals>,
): EngineReadinessSignals => ({
	sectionReady: false,
	interactionReady: false,
	allLoadingComplete: false,
	runtimeError: false,
	...overrides,
});

describe("engine-readiness: progressive mode", () => {
	test("opens interaction before loading completes", () => {
		expect(
			resolveReadinessGates(
				"progressive",
				signals({ sectionReady: true, interactionReady: true }),
			),
		).toEqual({ interactionReady: true, allLoadingComplete: false });
	});

	test("gates loading-complete on section-ready", () => {
		expect(
			resolveReadinessGates(
				"progressive",
				signals({ interactionReady: true, allLoadingComplete: true }),
			).allLoadingComplete,
		).toBe(false);
		expect(
			resolveReadinessGates(
				"progressive",
				signals({
					sectionReady: true,
					interactionReady: true,
					allLoadingComplete: true,
				}),
			),
		).toEqual({ interactionReady: true, allLoadingComplete: true });
	});
});

describe("engine-readiness: strict mode", () => {
	test("holds interaction until all loading completes", () => {
		expect(
			resolveReadinessGates(
				"strict",
				signals({ sectionReady: true, interactionReady: true }),
			),
		).toEqual({ interactionReady: false, allLoadingComplete: false });
		expect(
			resolveReadinessGates(
				"strict",
				signals({
					sectionReady: true,
					interactionReady: true,
					allLoadingComplete: true,
				}),
			),
		).toEqual({ interactionReady: true, allLoadingComplete: true });
	});
});
