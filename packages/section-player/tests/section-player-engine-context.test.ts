/**
 * Engine context provider — kernel invariants (M7 PR 5).
 *
 * `SectionPlayerLayoutKernel.svelte` is the *only* point in the
 * section-player tree that constructs a `SectionRuntimeEngine` and
 * exposes it to descendant Svelte components via Svelte's
 * `setContext(SECTION_RUNTIME_ENGINE_KEY, engine)`. PR 6 (toolkit
 * switch) reads this context from the wrapped
 * `<pie-assessment-toolkit>` so the toolkit and the kernel share one
 * engine instance per section mount instead of constructing two
 * unsynchronized engines.
 *
 * If a future refactor drops any of the three lines below, the
 * shared-engine invariant silently breaks and PR 6's lockstep
 * guarantees regress (`pie-stage-change` / `pie-loading-complete` /
 * `framework-error` would fan out twice, once per engine). The
 * reviewer recommended an instance-identity check via a Svelte child
 * component calling `getContext(SECTION_RUNTIME_ENGINE_KEY)`; the
 * section-player package has no Svelte-component mount harness in its
 * unit-test suite, so this test mirrors the established
 * `m5-mirror-rule.test.ts` source-level guardrail pattern instead.
 *
 * Behavioral coverage of the engine + DOM-event bridge layer is in
 * `section-player-runtime-callbacks.test.ts` and
 * `packages/assessment-toolkit/tests/runtime/SectionRuntimeEngine.test.ts`.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
	SECTION_RUNTIME_ENGINE_KEY,
	SectionRuntimeEngine,
} from "@pie-players/pie-assessment-toolkit/runtime/engine";

const KERNEL_PATH = resolve(
	__dirname,
	"../src/components/shared/SectionPlayerLayoutKernel.svelte",
);

describe("section-player engine context provider — kernel invariants", () => {
	test("imports SECTION_RUNTIME_ENGINE_KEY and SectionRuntimeEngine from the toolkit's runtime/engine facade", () => {
		const source = readFileSync(KERNEL_PATH, "utf8");
		expect(source).toMatch(
			/from\s+"@pie-players\/pie-assessment-toolkit\/runtime\/engine"/,
		);
		expect(source).toContain("SECTION_RUNTIME_ENGINE_KEY");
		expect(source).toContain("SectionRuntimeEngine");
	});

	test("constructs exactly one SectionRuntimeEngine at module scope", () => {
		const source = readFileSync(KERNEL_PATH, "utf8");
		const constructions = source.match(/new\s+SectionRuntimeEngine\s*\(/g);
		expect(constructions?.length).toBe(1);
	});

	test("provides the constructed engine via setContext(SECTION_RUNTIME_ENGINE_KEY, engine)", () => {
		const source = readFileSync(KERNEL_PATH, "utf8");
		expect(source).toMatch(
			/setContext\s*\(\s*SECTION_RUNTIME_ENGINE_KEY\s*,\s*engine\s*\)/,
		);
	});
});

describe("section-player engine context provider — toolkit-side surface", () => {
	test("SECTION_RUNTIME_ENGINE_KEY resolves to a unique symbol", () => {
		expect(typeof SECTION_RUNTIME_ENGINE_KEY).toBe("symbol");
	});

	test("SectionRuntimeEngine is a constructable class with the documented surface", () => {
		const engine = new SectionRuntimeEngine();
		expect(typeof engine.attachHost).toBe("function");
		expect(typeof engine.dispatchInput).toBe("function");
		expect(typeof engine.subscribe).toBe("function");
		expect(typeof engine.getState).toBe("function");
		expect(typeof engine.dispose).toBe("function");
	});
});
