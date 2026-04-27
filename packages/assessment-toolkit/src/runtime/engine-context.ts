/**
 * Svelte context key for the section runtime engine (M7 PR 5).
 *
 * Components inside a section player layout consume the engine through
 * Svelte's native `getContext(SECTION_RUNTIME_ENGINE_KEY)`. The kernel
 * (`SectionPlayerLayoutKernel.svelte`) is the canonical provider — it
 * constructs the engine, attaches it to the layout CE host, and exposes
 * it to descendants via `setContext(SECTION_RUNTIME_ENGINE_KEY, engine)`.
 *
 * The contract is one-directional:
 *   - Provider: the component that owns engine lifetime (kernel today;
 *     in M7 PR 6 the toolkit CE will fall back to constructing its own
 *     engine when no upstream provider is present).
 *   - Consumers: any descendant Svelte component that needs to read
 *     state, subscribe to outputs, or feed inputs (e.g. the toolkit CE
 *     reaching the engine through the wrapping kernel).
 *
 * The key is a `Symbol` so it cannot collide with userland context keys
 * and so descendants are forced to import this module rather than
 * guess a string id.
 *
 * **Stability.** This export is part of the stable runtime/engine
 * surface; renaming or replacing the symbol is a major breaking
 * change. Adding adjacent context keys (e.g. for dedicated read-only
 * snapshots) is allowed.
 */

import type { SectionRuntimeEngine } from "./SectionRuntimeEngine.js";

/**
 * Svelte context key under which a `SectionRuntimeEngine` instance is
 * provided to descendants.
 */
export const SECTION_RUNTIME_ENGINE_KEY: unique symbol = Symbol(
	"@pie-players/section-runtime-engine",
);

/**
 * Type-level alias for the value stored under
 * `SECTION_RUNTIME_ENGINE_KEY`. Exposed as a separate alias so
 * consumers can spell the type without importing the implementing
 * class directly.
 */
export type SectionRuntimeEngineContext = SectionRuntimeEngine;
