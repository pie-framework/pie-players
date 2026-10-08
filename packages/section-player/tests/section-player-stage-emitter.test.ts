/**
 * Stage emitter — kernel invariants.
 *
 * `SectionPlayerLayoutKernel.svelte` constructs the section player's one
 * `SectionRuntimeEngine`, the only emitter of `pie-stage-change` and
 * `pie-loading-complete`. The toolkit's `framework-error` passes through the
 * kernel untouched: it bubbles on to the layout host and the document, and the
 * kernel only latches readiness from it. The section-player package has no
 * Svelte mount harness in its unit suite, so this mirrors the source-level
 * guardrail pattern.
 *
 * Behavioral coverage of the engine and its DOM bridge is in
 * `section-player-runtime-callbacks.test.ts` and
 * `packages/assessment-toolkit/tests/runtime/SectionRuntimeEngine.test.ts`.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { SectionRuntimeEngine } from "@pie-players/pie-assessment-toolkit/runtime/engine";

const KERNEL_PATH = resolve(
	__dirname,
	"../src/components/shared/SectionPlayerLayoutKernel.svelte",
);

const SCAFFOLD_PATH = resolve(
	__dirname,
	"../src/components/shared/SectionPlayerLayoutScaffold.svelte",
);

function functionSource(source: string, signature: string): string {
	const start = source.indexOf(signature);
	const end = source.indexOf("\n\t}\n", start);
	return start < 0 ? "" : source.slice(start, end);
}

function handleFrameworkErrorSource(source: string): string {
	return functionSource(source, "function handleFrameworkError(");
}

describe("section-player stage emitter — kernel invariants", () => {
	test("constructs exactly one SectionRuntimeEngine", () => {
		const source = readFileSync(KERNEL_PATH, "utf8");
		const constructions = source.match(/new\s+SectionRuntimeEngine\s*\(/g);
		expect(constructions?.length).toBe(1);
	});

	test("lets the toolkit's framework-error propagate and re-emits nothing", () => {
		const handler = handleFrameworkErrorSource(
			readFileSync(KERNEL_PATH, "utf8"),
		);
		expect(handler.length).toBeGreaterThan(0);
		expect(handler).not.toContain("stopPropagation");
		expect(handler).not.toContain("dispatchInput");
		expect(handler).not.toContain("dispatchEvent");
	});

	test("keys its stage cohort on the id the toolkit runs the section under", () => {
		const source = readFileSync(KERNEL_PATH, "utf8");
		expect(source).toContain("resolveSectionId({");
		expect(source).toContain("makeCohort({ sectionId: cohortSectionId, attemptId })");
	});

	test("reads the section controller without advancing the stage chain", () => {
		const source = readFileSync(KERNEL_PATH, "utf8");
		for (const signature of [
			"export function getSectionController(",
			"export async function waitForSectionController(",
		]) {
			const accessor = functionSource(source, signature);
			expect(accessor.length).toBeGreaterThan(0);
			expect(accessor).not.toContain("notifySectionControllerResolved");
			expect(accessor).not.toContain("sectionControllerReadyDispatched");
		}
	});

	test("the scaffold announces navigation through a subscription that follows the section", () => {
		const source = readFileSync(SCAFFOLD_PATH, "utf8");
		expect(source).toContain("coordinator.subscribeSectionEvents({");
		expect(source).not.toContain("controller.subscribe(");
	});

	test("SectionRuntimeEngine exposes the stage-chain surface only", () => {
		const engine = new SectionRuntimeEngine();
		expect(typeof engine.attachHost).toBe("function");
		expect(typeof engine.dispatchInput).toBe("function");
		expect(typeof engine.subscribe).toBe("function");
		expect(typeof engine.getState).toBe("function");
		expect(typeof engine.dispose).toBe("function");
		expect("initialize" in engine).toBe(false);
		expect("register" in engine).toBe(false);
	});
});
