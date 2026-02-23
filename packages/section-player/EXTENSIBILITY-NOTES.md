# ADR: Section Player Extensibility and CE Boundary Strategy

Date: 2026-02-22
Status: Proposed
Last updated: 2026-02-22
Scope: `@pie-players/pie-section-player` (with related implications for tool packages)

## Context

- PIE web components in this repo are Light DOM by default (`shadow: 'none'` in Svelte custom elements and equivalent no-shadow behavior in `pie-print`).
- `pie-section-player` currently hard-codes both:
  - layout selection (`split-panel` vs `vertical`, plus item mode layout),
  - and concrete player selection deeper in renderers.
- Current flexibility is mostly configuration of built-in choices, which makes custom layout/player injection difficult without forking.

## Decision

Adopt a **headless core + pluggable renderers** architecture for section player extensibility.

- Keep `PieSectionPlayer` focused on orchestration:
  - section parsing/extraction,
  - navigation/session state,
  - toolkit/service coordination,
  - public events/methods.
- Move rendering decisions behind extension points:
  - `LayoutAdapter` (page/item composition),
  - `PlayerAdapter` (item/passage renderer implementation).
- Resolve adapters via keys (registry pattern), with built-ins pre-registered.
- Use a hybrid extension surface:
  - slots + theming for declarative structural/styling customization,
  - registry keys (`layout-key`, `player-key`) for behavior swaps,
  - JS property hooks/controllers for advanced host integration.

## Rationale

- Preserves backwards compatibility while enabling custom layout/player injection.
- Keeps a web-native API style without over-relying on framework-specific patterns.
- Maintains orchestration/rendering separation for long-term maintainability.
- Fits existing Light DOM and theming direction.

## Constraints and assumptions

- Even in Light DOM, native web components still do not provide Svelte-style scoped render props in plain HTML.
- Attributes remain string-based; complex values/functions must use JS properties.
- Repeated dynamic rendering purely via slots is limited and needs additional protocols/templates.
- Public host contract remains properties/attributes/events/methods.

## Context Protocol position

Adopt Context Protocol where useful for internals/plugins, without requiring Lit.

- Use context to reduce prop drilling for shared services (coordinator/theme/session tracker).
- Keep external app integration explicit through CE public API.
- Context complements, not replaces, the host-facing contract.

## Lit vs Svelte position

- Lit offers advantages at the custom-element boundary (explicit CE lifecycle/property semantics).
- Svelte remains preferred for UI-heavy implementation and team productivity.
- No broad migration decision is made at this time.
- If CE boundary issues persist, a hybrid approach is acceptable:
  - Svelte internals,
  - optional Lit (or vanilla CE) boundary shells where needed.

## Consequences

Positive:

- Better extension model for layout and player substitution.
- Cleaner separation of orchestration from rendering concerns.
- Improved path for third-party customization without forks.

Costs/risks:

- Additional abstraction layers (adapter registry + contracts).
- Need to define stability level for extension APIs.
- Potentially more docs and integration test matrix work.

## Bundle size and theming notes

- A Lit rewrite alone is unlikely to produce drastic package-size reductions.
- Size improvements are expected to be incremental unless broader dependency/architecture changes are made.
- DaisyUI remains compatible with Lit, especially in Light DOM.
- If Shadow DOM is introduced later, DaisyUI integration requires explicit style/token bridging.

## Alternatives considered

### A) Slots/render-props style only

Pros:
- very web-native and declarative.

Cons:
- weak for repeated per-item rendering and strongly typed data passing.
- still needs JS bridges for advanced behavior.

### B) Strategy object only (JS property)

Pros:
- very flexible and powerful.

Cons:
- less declarative/discoverable in plain HTML usage.

### C) Full plugin runtime

Pros:
- maximum third-party extensibility.

Cons:
- highest operational complexity (versioning, safety, debugging).

### D) Lit shell + Svelte internals

Pros:
- hardens CE boundary behavior while preserving Svelte implementation velocity.

Cons:
- mixed-framework maintenance complexity.

## Phased implementation plan

1. Introduce adapter registry interfaces and register current defaults.
2. Keep current props (`layout`, `playerType`) as compatibility aliases to registry keys.
3. Add targeted slots for structural override points.
4. Add optional context provider/consumer for shared services.
5. Run a small CE-boundary pilot using one tool component (for example calculator-related) if CE reactivity pain remains high.
6. Expand docs with concrete integration examples:
   - custom layout via registry,
   - custom player adapter,
   - host app property-based integration.

## Open questions

- Which extension points are stable API vs experimental?
- How much custom rendering is allowed while preserving normalized `session-changed` semantics?
- Do we introduce a unified `sectionController` property now or after adapter registry adoption?

## New finding: tool availability is still effectively hardcoded in players

### Problem summary

Even after moving to a generic toolbar surface, `PieSectionPlayer` and `PieAssessmentPlayer` still encode tool availability in player code by:

- importing concrete built-in tool packages directly in the player modules,
- passing fixed comma-separated tool IDs in template attributes,
- coupling player defaults to a specific built-in tool set instead of a host-owned registration/config contract.

This conflicts with the extensibility goal that hosts can provide entirely external tool implementations without changing player internals.

### Why this matters

- A host cannot fully "bring your own tools" without inheriting built-in imports and defaults from player runtime code.
- Each new built-in tool risks requiring player changes, which increases churn and weakens the plugin model.
- The player becomes an opinionated tool distributor instead of a neutral orchestration boundary.

### Solution

#### Host-owned tool contract

Define a single host-supplied contract for tool availability and runtime loading, for both section and assessment players:

- `toolIds`: string[] or comma string (IDs only)
- `toolRegistry`: registry instance (or registration bundle)
- `loadTools?: (toolIds) => Promise<void>` optional loader hook for external packages
- `toolProps?: Record<string, object>` per-tool runtime config

Player responsibility:

- orchestrate context + coordinator wiring,
- render `pie-tools-toolbar` with host-provided IDs/registry,
- never import concrete tool packages directly.

Host responsibility:

- install/load desired tool packages,
- register built-in and/or external tool registrations,
- decide final list and ordering.

### Compatibility policy

Because project policy is pre-1.0 clean break:

- do not keep legacy fallback lists or hidden default hardcoded imports in player code,
- do not introduce compatibility shims for old tool surfaces,
- keep one explicit extensibility contract and document it as the canonical path.

