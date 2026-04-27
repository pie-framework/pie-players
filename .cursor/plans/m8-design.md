# M8 Design — Tool Policy Engine

> **Status:** locked design, pre-implementation.
> **Posture:** rip-out (no compatibility aliases for surfaces this milestone
> removes; the only preserved compatibility surface is the `pie-item` client
> contract per `.cursor/rules/legacy-compatibility-boundaries.mdc`).
> **Variant shape:** one reasoned proposal (no a/b/c alternatives — locked
> with the maintainer up front).

This document is the design counterpart to
[`m7-design-variant-c-layered.md`](./m7-design-variant-c-layered.md). It
locks the architecture; the executable PR sequence lives in
[`m8-implementation-plan.md`](./m8-implementation-plan.md).

The full surface inventory and findings live in
[`m8-pre-flight-audit.md`](./m8-pre-flight-audit.md). This document does
not restate them; it builds the engine on top of those findings.

## 0. Locked decisions (answers to audit § 7)

| # | Question | Answer |
|---|---|---|
| Q1 | Absorb `PnpToolResolver` into the engine vs. plug-in? | **Absorb.** The engine consumes QTI inputs (PNP / districtPolicy / testAdministration / item settings) natively. A `PolicySource` extension point exists for exotic hosts that need to inject custom rules, but the QTI rules ship inside the engine and are not pluggable. |
| Q2 | Can `policy.blocked` veto a QTI `requiredTools` mandate? | **Yes — host wins.** The host's `tools.policy.blocked`, missing-from-`tools.placement[level]`, and `providers[id].enabled === false` are absolute vetoes. QTI `requiredTools` becomes **advisory**: when host config blocks a QTI-required tool, the engine surfaces a `tool-policy.qtiRequiredBlocked` diagnostic and records the conflict in provenance. Documented intent: districts that *want* QTI to be enforceable simply do not configure `policy.blocked` for QTI-required ids. |
| Q3 | Level-scope `policy.allowed/blocked`? | **No — keep flat in M8.** Hosts already have `placement[level]` for level-scoped membership. M8 is consolidation, not schema extension. M9/M10 can level-scope if needed. |
| Q4 | Delete `ToolConfigResolver`? | **Yes.** Deleted in PR 1 along with the docs-site card. No legacy alias. |
| Q5 | Provenance for every Pass-1 decision (not just PNP)? | **Yes.** `PnpResolutionProvenance` is generalized to `ToolPolicyProvenance` and emitted by every Pass-1 decision (placement membership, host policy, provider veto, QTI gates, conflict diagnostics). The shape is structurally compatible with today's PNP provenance. |
| Q6 | Location — under `runtime/` or sibling `policy/`? | **Sibling `policy/`.** M7's `runtime/` owns lifecycle state. M8's engine owns visibility decisions. Separate concerns, separate directory. |
| Q7 | Facade / internal split mirroring M7? | **Yes.** `policy/engine` (narrow, semver-stable facade) and `policy/internal` (wider, evolving). |
| Q8 | Cross-CE bridge for single-engine invariant? | **No.** The policy engine is function-style (pure inputs → outputs + emitted decisions); two callers with the same inputs get the same answer. No subscription state to share, no DOM events to deduplicate. Hosts that want to *react* to policy changes (config updates, PNP swaps) subscribe through `ToolkitCoordinator.onPolicyChange(...)` (M8 PR 4). |
| F2 | Default-on QTI? | **Yes — opt-out, not opt-in.** When the toolkit receives an `assessment` entity that carries any of `personalNeedsProfile`, `settings.districtPolicy`, `settings.testAdministration`, or per-item `settings.requiredTools/restrictedTools/toolParameters`, it constructs a default QTI `PolicySource` automatically. Hosts opt out by setting `runtime.tools.qtiEnforcement: "off"`. |

## 1. Problem (one paragraph)

Today the answer to "is tool X visible at level L for scope S right now?"
is computed in three different places, with no single composition rule:
`resolveToolsForLevel` does flat id-set algebra over
`placement ∩ allowed − blocked`; `PnpToolResolver` does QTI 6-level
precedence over PNP/district/item inputs and is reachable in production
only when the host explicitly opts in (which the section-player chain
never does); `ToolConfigResolver` is dead code shipped under a roughly
parallel name and presented on the docs site as a real primitive. None of
these knows about provider veto (`providers[id].enabled`), level-scoped
QTI gates, or `ToolRegistration.isVisibleInContext`. M8 absorbs them into
one engine with one documented precedence model and one provenance
output, the way M7 absorbed the three runtime helpers into the section
runtime engine.

## 2. Engine shape

```
        ┌──────────────────── Inputs ────────────────────┐
        │ ToolPolicyEngineInput                          │
        │   tools: CanonicalToolsConfig                  │  host config
        │   assessment?: AssessmentEntity                │  optional QTI
        │   currentItemRef?: AssessmentItemRef           │  optional QTI
        │   toolRegistry: ToolRegistry                   │  registrations
        │   qtiEnforcement: "on" | "off"                 │  default "on" if QTI inputs present
        │   sources?: PolicySource[]                     │  custom extensions (rare)
        │                                                │
        │ ToolPolicyDecisionRequest                      │
        │   level: ToolPlacementLevel                    │  "section" | "item" | "passage"
        │   scope: ToolScope                             │  { level, scopeId, contentKind }
        │   context?: ToolContext                        │  Pass-2 input (item/section data)
        │                                                │
        └────────────────────────┬───────────────────────┘
                                 │
                  ┌──────────────┴──────────────┐
                  │   ToolPolicyEngine.decide   │
                  └──────────────┬──────────────┘
                                 │
        ┌────────────────────────┴───────────────────────┐
        │                  Outputs                       │
        │ ToolPolicyDecision                             │
        │   visibleTools: ToolPolicyEntry[]              │  level-scoped, ordered
        │   diagnostics: ToolPolicyDiagnostic[]          │  conflicts (e.g. qtiRequiredBlocked)
        │   provenance: ToolPolicyProvenance             │  per-tool decision trail
        │                                                │
        │ ToolPolicyEntry                                │
        │   toolId: string                               │
        │   required: boolean                            │  IEP/504-grade requirement (advisory if blocked)
        │   alwaysAvailable: boolean                     │  PNP support (cannot be toggled off by host UI)
        │   settings?: unknown                           │  resolved tool-specific settings
        │   sources: PolicySourceTag[]                   │  contributors (placement, policy, provider, qti.*, custom)
        └────────────────────────────────────────────────┘
```

`ToolPolicyEngine` is a class (not a function) for two reasons:

1. It carries cached registry lookups and per-source state (e.g. the QTI
   `PolicySource` instance) across `decide(...)` calls within a coordinator
   lifetime.
2. It owns the `onPolicyChange` subscription surface (PR 4), so hosts can
   react when input config or assessment swaps.

The class itself is small (~150 LOC); the QTI logic moves into a
`QtiPolicySource` class that is structurally a refactor of today's
`PnpToolResolver` body.

### Why a function-style API would not fit

A pure function `decide(...)` is an option, but the cached
registry lookups (`getToolsByPNPSupport`, `normalizeToolIds`,
`isVisibleInContext` short-circuits) are non-trivial; recomputing them on
every render would regress performance. The class wraps the cache
without exposing it.

## 3. Composition rule (precedence)

Pass-1 produces a candidate set per call to `decide(level, scope)`:

```
1. Membership filter:
     candidates = tools.placement[level]                           (host scoping)

2. Provider veto:
     candidates = candidates.filter(id =>
       tools.providers[id].enabled !== false)                       (host per-tool veto)

3. Host whitelist (if non-empty):
     if tools.policy.allowed.length > 0:
       candidates = candidates.filter(id => tools.policy.allowed.includes(id))

4. Host blocklist (absolute):
     candidates = candidates.filter(id => !tools.policy.blocked.includes(id))

5. QTI gates (only if qtiEnforcement === "on" AND assessment provided):
     for id in candidates:
       apply QTI 6-level precedence (audit § 2.3 / Q2 lock)
       record decision in provenance
       if QTI says "block": remove
       if QTI says "enable" (required / always-available): mark, keep
     for id in QTI-required IDs not in candidates:
       record "qtiRequiredBlocked" diagnostic
       (advisory only; host blocks win per Q2)

6. Custom PolicySources (if any):
     for source in sources:
       source.refine(candidates, decisionContext) → may further narrow
       (cannot widen — sources are filters, not generators)
```

Pass-2 (`isVisibleInContext`) runs per render at the toolbar boundary,
not inside the engine. The engine returns the Pass-1 decision; the
toolbar applies the per-tool `ToolRegistration.isVisibleInContext(context)`
predicate. Pass-2 is documented as "relevance" (e.g. calculator only when
math content present) and is intentionally distinct from Pass-1
("availability"). M7 separated lifecycle from rendering; M8 separates
availability from relevance.

### Step 5 detail (QTI precedence under host-wins)

The QTI source applies the same 6-level precedence as today's
`PnpToolResolver` but its outputs are fed into the candidate set produced
by steps 1–4 instead of starting from PNP supports:

| QTI level | Action under host-wins |
|---|---|
| district `blockedTools` | Removes from candidates. Diagnostic-free — districts and host policy agree on block. |
| testAdmin `toolOverrides[id] === false` | Removes from candidates. Diagnostic-free. |
| item `restrictedTools` | Removes from candidates *for the current item scope only*. Diagnostic-free. |
| item `requiredTools` | Marks `required: true`. If id was already removed by host policy (steps 2–4), emits `tool-policy.qtiRequiredBlocked` and **stays removed**. |
| district `requiredTools` | Same as above. |
| PNP `supports` | Marks `alwaysAvailable: true`. Same conflict rule as above. PNP `prohibitedSupports` removes. |

`alwaysAvailable: true` is informational for UI ("user cannot disable in
preferences"); it does not override host blocks.

## 4. Provenance

`ToolPolicyProvenance` is a structural generalization of
`PnpResolutionProvenance`. The shape stays compatible (existing fields
preserved) but the rule vocabulary expands.

```ts
type ToolPolicyDecisionRule =
  | "placement-membership"       // pass / fail at step 1
  | "provider-disabled"          // step 2
  | "host-allowlist"             // step 3
  | "host-blocked"               // step 4
  | "district-block"             // step 5, level 1 (QTI)
  | "test-admin-override"        // step 5, level 2
  | "item-restriction"           // step 5, level 3
  | "item-requirement"           // step 5, level 4
  | "district-requirement"       // step 5, level 5
  | "pnp-support"                // step 5, level 6
  | "pnp-prohibited"             // step 5, level 6 (block branch)
  | "qti-required-blocked"       // diagnostic conflict
  | "custom-source"              // step 6
  | "system-default";            // fallback
```

Every Pass-1 decision emits one entry per tool; the trail captures all
contributors. The PNP debugger CE (today's
`<pie-section-player-tools-pnp-debugger>`) keeps working: it consumes
`ToolPolicyProvenance` (rename: type alias `PnpResolutionProvenance`
remains as a deprecated re-export through PR 4 to avoid touching the
debugger package in the same PR; deprecation aliases for *internal*
debugger consumption fall under "internal" per the legacy-compatibility
rule, not the pie-item contract — they are removed in PR 5 once the
debugger is migrated).

## 5. API surface

### `policy/engine` (narrow facade — semver-stable)

```ts
export class ToolPolicyEngine {
  constructor(args: ToolPolicyEngineArgs);
  decide(request: ToolPolicyDecisionRequest): ToolPolicyDecision;
  updateInputs(partial: Partial<ToolPolicyEngineInput>): void;
  onPolicyChange(listener: PolicyChangeListener): () => void;
  dispose(): void;
}

export type ToolPolicyEngineArgs = ToolPolicyEngineInput & {
  toolRegistry: ToolRegistry;
};

export type ToolPolicyEngineInput = {
  tools: CanonicalToolsConfig;
  assessment?: AssessmentEntity;
  currentItemRef?: AssessmentItemRef;
  qtiEnforcement?: "on" | "off";   // default "on" if QTI inputs present
  sources?: PolicySource[];
};

export type ToolPolicyDecisionRequest = {
  level: ToolPlacementLevel;
  scope: ToolScope;
  context?: ToolContext;
};

export type ToolPolicyDecision = {
  visibleTools: ToolPolicyEntry[];
  diagnostics: ToolPolicyDiagnostic[];
  provenance: ToolPolicyProvenance;
};

export type ToolPolicyEntry = {
  toolId: string;
  required: boolean;
  alwaysAvailable: boolean;
  settings?: unknown;
  sources: PolicySourceTag[];
};

export type PolicyChangeListener = (decision: ToolPolicyDecision) => void;

// Cross-package context key for ToolPolicyEngine (parallels
// SECTION_RUNTIME_ENGINE_KEY from M7's runtime/engine).
export const TOOL_POLICY_ENGINE_KEY: symbol;
```

### `policy/internal` (wider — evolves between minor releases with changeset notes)

```ts
export class QtiPolicySource implements PolicySource;
export type PolicySource = { id: string; refine(candidates, ctx) };
export type PolicySourceTag = "placement" | "policy" | "provider" | `qti.${...}` | `custom.${string}`;
export type ToolPolicyDiagnostic = { code: ToolPolicyDiagnosticCode; level: ToolPlacementLevel; toolId: string; message: string; ... };
export type ToolPolicyDiagnosticCode = "tool-policy.qtiRequiredBlocked" | "tool-policy.placementMissing" | ...;

export type ToolPolicyProvenance = { /* same shape as today's PnpResolutionProvenance */ };
export type FeatureResolutionTrail = ...;
export type ResolutionDecision = ...;

// Adapters for hosts that want to drive the engine from the existing
// CanonicalToolsConfig without going through ToolkitCoordinator:
export function createToolPolicyEngineFromConfig(args: { ... }): ToolPolicyEngine;
```

### Removed (no compatibility aliases)

- `resolveToolsForLevel` from `tools-config-normalizer` —
  internally replaced by the engine; consumers move to
  `engine.decide(level, scope).visibleTools.map(e => e.toolId)`.
- `PnpToolResolver` class and the `PNPToolResolver.ts` file — its body is
  refactored into `policy/internal/QtiPolicySource.ts`. The PNP debugger
  consumes the engine and `QtiPolicySource` directly.
- `ToolConfigResolver` class, file, and own unit tests — dead code.
- The "ToolConfigResolver" card on `apps/docs/src/routes/+page.svelte`.

## 6. ToolkitCoordinator integration

The coordinator owns one `ToolPolicyEngine` instance per coordinator
lifetime. Construction happens in
`ToolkitCoordinator.constructor` after `normalizeAndValidateToolsConfig`
runs, so the engine never sees malformed config.

```ts
class ToolkitCoordinator {
  private policyEngine: ToolPolicyEngine;

  constructor(config) {
    // ... existing validation ...
    this.policyEngine = new ToolPolicyEngine({
      tools: this.config.tools,
      toolRegistry: this.toolRegistry,
      // QTI inputs flow through updateAssessment / updateItemRef:
    });
  }

  // M8 promotes these from ad-hoc props to first-class coordinator surface:
  updateAssessment(assessment: AssessmentEntity | null) { /* engine.updateInputs */ }
  updateCurrentItemRef(itemRef: AssessmentItemRef | null) { /* engine.updateInputs */ }
  updateToolConfig(toolId, updates) { /* engine.updateInputs + emit */ }

  // Public:
  decideToolPolicy(req): ToolPolicyDecision { return this.policyEngine.decide(req); }
  onPolicyChange(listener) { return this.policyEngine.onPolicyChange(listener); }
  getFloatingTools(): string[] {
    return this.policyEngine.decide({ level: "section", scope: { level: "section", scopeId: "*" } })
      .visibleTools.map(e => e.toolId);
  }
}
```

`<pie-item-toolbar>` (`ItemToolBar.svelte`) drops the manual composition
in `allowedToolIds` / `placementAllowedToolIds` / `pnpResolver` interplay:

```svelte
const decision = $derived.by(() =>
  effectiveToolkitCoordinator?.decideToolPolicy({
    level: placementLevel,
    scope: { level: placementLevel, scopeId: effectiveScopeId, contentKind: effectiveContentKind },
    context: toolContext ?? undefined,
  }) ?? null,
);
const allowedToolIds = $derived(
  decision?.visibleTools.filter(e => isVisibleInContext(e.toolId, toolContext)).map(e => e.toolId) ?? [],
);
```

The `pnpResolver` / `assessment` / `itemRef` props on `<pie-item-toolbar>`
and `<pie-section-toolbar>` are removed. Hosts that previously passed
these now pass `assessment` / `currentItemRef` to the toolkit element
itself (`<pie-assessment-toolkit>`), which forwards into the coordinator
via `updateAssessment` / `updateCurrentItemRef`.

`PieSectionPlayerBaseElement.svelte` drops the
`annotationToolbarPlacementEnabled` derivation built on `resolveToolsForLevel`
and instead reads `coordinator.decideToolPolicy({...}).visibleTools` for
each level.

## 7. Module layout

```
packages/assessment-toolkit/src/policy/
├── engine.ts                         (re-exports the public facade)
├── internal.ts                       (re-exports the wider surface)
├── core/
│   ├── ToolPolicyEngine.ts
│   ├── PolicySource.ts
│   ├── policy-source-tag.ts
│   ├── compose-decision.ts           (steps 1–6 from § 3)
│   ├── decision-types.ts             (ToolPolicyDecision, ToolPolicyEntry, ...)
│   └── provenance.ts                 (generalized from pnp-provenance.ts)
├── sources/
│   └── QtiPolicySource.ts            (refactor of today's PnpToolResolver body)
├── adapters/
│   └── coordinator-bridge.ts         (ToolkitCoordinator wiring)
└── tests/                            (in tests/ alongside policy/, mirroring runtime/)
```

`packages/assessment-toolkit/package.json` exports:

```json
{
  "exports": {
    "./policy/engine": "./dist/policy/engine.js",
    "./policy/internal": "./dist/policy/internal.js"
  }
}
```

The top-level `src/index.ts` re-exports the engine facade only; the wider
internal surface is reachable only through the explicit subpath, matching
the M7 split.

## 8. Migration / breaking change surface

This milestone is a **breaking change** for any host that:

1. Imported `resolveToolsForLevel` directly. Replacement: use
   `coordinator.decideToolPolicy({...}).visibleTools.map(e => e.toolId)`.
2. Constructed `PnpToolResolver` by hand. Replacement: pass the
   `assessment` and `currentItemRef` to the toolkit (or to
   `coordinator.updateAssessment` / `updateCurrentItemRef`), or instantiate
   `QtiPolicySource` from `policy/internal` and pass it as a custom source
   to `ToolPolicyEngine`.
3. Imported `ToolConfigResolver`. No replacement — class was unused; if
   genuinely needed, model as a `PolicySource`.
4. Passed `pnpResolver` / `assessment` / `itemRef` to `<pie-item-toolbar>`
   or `<pie-section-toolbar>`. Replacement: pass `assessment` /
   `currentItemRef` to `<pie-assessment-toolkit>`. The two toolbar CEs
   drop these props in PR 3.

The pre-flight audit (PR 0) reuses the M7 audit method against the same
four downstream surfaces: `apps/section-demos`,
`apps/assessment-demos`, `apps/item-demos`, and the FixedForm /
QuizEngineFixed players. The audit grep targets:
`resolveToolsForLevel`, `PnpToolResolver`, `ToolConfigResolver`,
`pnpResolver=`, and `pnpResolver:` — plus `<pie-item-toolbar` and
`<pie-section-toolbar` for prop-shape diff.

A consumer flagged as "requires-migration" lands in the M8 changeset under
"Breaking changes — surface migration" and migrates within the same release
window. "requires-dual-emit-window" findings escalate to maintainer per
M7's pattern.

## 9. Test strategy

Three test surfaces:

### 9.1 Engine unit tests (Bun)

- Step-by-step precedence tests over the six steps in § 3, including
  every QTI conflict path (host blocks QTI required, host allowlist
  excludes PNP support, item restriction overrides PNP support, etc.).
- Provenance shape tests asserting every documented rule emits one
  decision entry per tool.
- `qtiEnforcement: "off"` mode tests asserting QTI inputs are ignored.

### 9.2 Coordinator integration tests (Bun)

- `ToolkitCoordinator.decideToolPolicy(...)` returns level-scoped
  decisions consistent with `getFloatingTools()` for `level: "section"`.
- `updateAssessment` / `updateCurrentItemRef` / `updateToolConfig` each
  emit `onPolicyChange` exactly once per applicable level.
- Pass-2 `isVisibleInContext` filtering happens at the toolbar boundary,
  not inside the engine — proven by a coordinator-level test that asserts
  `decideToolPolicy` ignores the `context.item` body shape.

### 9.3 E2E (Playwright)

- Section-demos: `tools-config-with-policy` fixture exercising
  `policy.allowed`, `policy.blocked`, `placement.section`, and
  `providers[id].enabled` simultaneously.
- Assessment-demos: assessment with `personalNeedsProfile`,
  `districtPolicy`, and item-level `requiredTools` — assert the
  default-on QTI path produces the documented visible set.
- PNP debugger: assessment that triggers a `qtiRequiredBlocked`
  diagnostic; assert the debugger renders both the host block and the
  QTI advisory. (This proves provenance round-trips through the package
  boundary unchanged.)

## 10. Risks and rollback

### Risk 1 — Default-on QTI changes behaviour

Hosts that pass an `assessment` entity carrying PNP / district policy /
item settings but did *not* previously wire `pnpResolver` will now see
QTI gates applied. Mitigation:

- The opt-out is a single runtime flag (`runtime.tools.qtiEnforcement: "off"`).
- The pre-flight audit identifies every host that passes `assessment` to
  the toolkit; the changeset lists each with the recommended action.
- Hosts that *want* QTI behaviour (the explicit goal) get it for free.

Rollback path: PR 4 (default-on flip) is its own PR; reverting it
restores the silent-bypass behaviour without regressing the engine
plumbing in PRs 1–3.

### Risk 2 — Performance regression from per-render `decide(...)`

Today's `<pie-item-toolbar>` runs `resolveToolsForLevel` plus optional
`pnpResolver.getAllowedToolIds` per render. The engine wraps the same
work behind a method call. Mitigation:

- The engine memoizes the last `decide(...)` call keyed by
  `(level, scope.scopeId, version)`; `version` increments on
  `updateInputs`. Hot-path is one map lookup.
- A coordinator-level perf test measures `decide(...)` p99 over a
  10k-call mix.

Rollback path: drop the memo; the engine still works, just at the
single-call cost which matches today's wiring.

### Risk 3 — Provenance type rename breaks downstream debugger

`PnpResolutionProvenance` → `ToolPolicyProvenance`. The debugger CE is
in-monorepo; it migrates in the same PR (PR 4). External consumers (if
any) follow the changeset migration note. Rollback path: keep the
`PnpResolutionProvenance` type alias permanent (cost: name confusion;
benefit: zero-effort downstream migration).

### Risk 4 — Cross-CE policy divergence

The engine is per-coordinator (per toolkit instance). A kernel-wrapped
toolkit and the outer layout CE both compute `annotationToolbarPlacementEnabled`
today; M8 has them both call into the *same* coordinator's engine via the
runtime context the M7 `ContextProvider` already publishes. No new
cross-CE bridge needed. The single-policy-engine invariant follows from
the single-coordinator invariant the toolkit already enforces.

## 11. Out of scope for M8

- M9 (single floating-tool stack): the engine answers visibility, not
  *how* visible tools render or share z-index.
- M10 (naming hygiene): if `policy.allowed/blocked` is renamed (e.g. to
  `policy.allow/deny`), it lands in M10. M8 keeps the existing keys.
- Level-scoped `policy` keys (`policy.section.allowed`, etc.). Captured
  as a future M9/M10 candidate; M8 keeps `policy` flat.
- The four pre-existing `effect_update_depth_exceeded` errors in the
  assessment-player flow (`fix-effect-update-depth`).

## 12. Consequences

After M8 lands:

- One canonical answer to "is tool X visible at level L?" — `engine.decide(...)`.
- One canonical provenance shape — `ToolPolicyProvenance`. Hosts can ask
  the toolkit "why is calculator hidden right now?" and get a structured
  answer regardless of whether QTI is in play.
- Default-on QTI: districts that ship `personalNeedsProfile` or
  `districtPolicy` get IEP/504-grade enforcement automatically. Districts
  that intentionally bypass QTI flip one runtime flag.
- Removed surface: `resolveToolsForLevel` (moved inside engine),
  `PnpToolResolver` (refactored to `QtiPolicySource`),
  `ToolConfigResolver` (deleted). Three resolvers → one engine + one
  named source.
- The toolbar CEs lose three coupling props
  (`pnpResolver`, `assessment`, `itemRef`); the toolkit element gains a
  cleaner `assessment` / `currentItemRef` surface that mirrors how the
  M7 runtime engine consumes its inputs.
