/**
 * Svelte context key for the tool policy engine (M8 PR 1).
 *
 * Components inside an assessment toolkit subtree consume the engine
 * through Svelte's native `getContext(TOOL_POLICY_ENGINE_KEY)`. The
 * canonical provider is the `ToolkitCoordinator` wiring (M8 PR 2):
 * the toolkit CE constructs a `ToolPolicyEngine`, attaches it to the
 * coordinator, and exposes it to descendants via
 * `setContext(TOOL_POLICY_ENGINE_KEY, engine)`.
 *
 * Mirrors the M7 `SECTION_RUNTIME_ENGINE_KEY` pattern. As with the
 * runtime engine, the key is a `Symbol` so it cannot collide with
 * userland context keys and so descendants are forced to import this
 * module rather than guess a string id.
 *
 * **No cross-CE bridge.** Unlike the runtime engine, there is no
 * `connectToolPolicyEngineHostContext` helper — see M8 design Q8.
 * Every CE in the tree gets its engine from its own coordinator
 * (the toolkit element). This avoids subscription-bridge overhead
 * for a function-style engine that hosts can simply re-call after
 * an input swap.
 *
 * **Stability.** This export is part of the stable `policy/engine`
 * surface; renaming or replacing the symbol is a major breaking
 * change.
 */

import type { ToolPolicyEngine } from "./ToolPolicyEngine.js";

export const TOOL_POLICY_ENGINE_KEY: unique symbol = Symbol(
	"@pie-players/tool-policy-engine",
);

export type ToolPolicyEngineContext = ToolPolicyEngine;
