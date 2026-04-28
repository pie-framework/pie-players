/**
 * Section runtime engine — facade entry point (M7 — Variant C).
 *
 * Narrow, stable public surface for hosts that want to mount, drive,
 * or dispose a section runtime via the layered engine. Re-exports the
 * `SectionRuntimeEngine` facade and its `attachHost` arg shape.
 *
 * **Pairing.** This module is the stable counterpart to
 * `./runtime/internal`, which exposes the wider, evolving surface
 * (core types, adapter bridges, cohort helpers) for advanced hosts and
 * for the engine's own tests / benchmarks. Consumers that only need to
 * mount + drive a section runtime should import from here. Consumers
 * that need to reach past the facade (e.g. construct an adapter
 * manually, inspect FSM state types, build alternate fan-out paths)
 * should import from `./runtime/internal` and accept the documented
 * stability disclaimer there.
 *
 * The package's `exports` map adds `./runtime/engine` in M7 PR 3
 * alongside the facade refactor.
 */

export {
	SectionRuntimeEngine,
	type SectionRuntimeEngineHostArgs,
} from "./SectionRuntimeEngine.js";

export {
	SECTION_RUNTIME_ENGINE_KEY,
	type SectionRuntimeEngineContext,
} from "./engine-context.js";

export {
	sectionRuntimeEngineHostContext,
	connectSectionRuntimeEngineHostContext,
	type SectionRuntimeEngineHostContextValue,
	type SectionRuntimeEngineHostContextListener,
} from "./section-runtime-engine-host-context.js";
