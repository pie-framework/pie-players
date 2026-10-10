/**
 * Stage emitter — kernel invariants.
 *
 * `SectionPlayerLayoutKernel.svelte` constructs the section player's one
 * `SectionRuntimeEngine`, the only emitter of `pie-stage-change` and
 * `pie-loading-complete`.
 *
 * The stage chain a mounted layout runs is covered in
 * `section-player-layout-kernel.test.ts`, the engine and its DOM bridge in
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

describe("section-player stage emitter — kernel invariants", () => {
	test("constructs exactly one SectionRuntimeEngine", () => {
		const source = readFileSync(KERNEL_PATH, "utf8");
		const constructions = source.match(/new\s+SectionRuntimeEngine\s*\(/g);
		expect(constructions?.length).toBe(1);
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
