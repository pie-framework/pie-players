# M8 Pre-Flight Audit — Tool Policy Engine

> **Status:** in progress; informs M8 variant designs.
> **Question:** what is the actual, currently-wired tool-policy surface in the
> repo, and where does authority for "is tool X visible at level L for scope
> S right now?" live today?
> **Posture for M8:** rip-out by default for unused / parallel surfaces; the
> only preserved compatibility surface stays the `pie-item` client contract,
> per `.cursor/rules/legacy-compatibility-boundaries.mdc`.

The audit's purpose is to fix the design vocabulary before sketching M8
variants. M7 absorbed the *runtime* engine (lifecycle, readiness, stage,
framework errors) into one layered engine in `assessment-toolkit`. M8 is the
parallel work for the *tool-policy* engine: today, "what tools are visible?"
is computed by three separate resolvers plus a per-tool relevance hook, with
no single composition rule. This audit catalogs the surface so the variants
can be evaluated against a concrete baseline.

## 1. Authoritative inputs to "is tool visible?"

| Input | Shape | Source | Notes |
|---|---|---|---|
| `tools.placement` | `{ section, item, passage }` arrays of tool IDs | host config (`runtime.tools` ⊕ `tools` ⊕ `enabledTools` shorthand) | After M7, normalized at `engine-resolver.resolveToolsConfig` (`runtime/internal`). |
| `tools.policy` | `{ allowed?: string[], blocked?: string[] }` | host config | Flat allow/block; not level-scoped. |
| `tools.providers[toolId].enabled` | `boolean` | host config | Per-tool veto, evaluated independently of `policy.blocked`. |
| `assessment.personalNeedsProfile` | QTI 3.0 PNP — `supports[]`, `prohibitedSupports[]`, `activateAtInit[]` | optional, host-provided assessment entity | Only consulted when host explicitly passes `pnpResolver` + `assessment` to `<pie-item-toolbar>`. |
| `assessment.settings.districtPolicy` | `{ blockedTools[], requiredTools[] }` | optional QTI assessment.settings | Same gate as PNP: requires `pnpResolver` to be passed in. |
| `assessment.settings.testAdministration.toolOverrides` | `Record<toolId, boolean>` | optional | Same gate as above. |
| `currentItemRef.settings` | `{ requiredTools[], restrictedTools[], toolParameters }` | optional, per-item | Same gate as above. |
| `ToolRegistration.supportedLevels` | `("section" \| "item" \| "passage" \| "rubric" \| "assessment" \| "element")[]` | tool registry (compile-time per package) | Drives validation diagnostics; not policy. |
| `ToolRegistration.pnpSupportIds` | `string[]` | tool registry | Maps QTI/AfA features → tool IDs. |
| `ToolRegistration.isVisibleInContext(context)` | predicate | tool registry | "Pass 2" relevance check (e.g. calculator only when math content present). |
| `ToolProvider.sanitizeConfig` / `validateConfig` | per-provider | tool registry | Validation only, not policy. |

Two things stand out:

1. **The QTI-side inputs (PNP / district / item-level) are gated behind the
   host opting in.** A host that passes `tools.placement` but not a
   `pnpResolver` instance gets no QTI policy enforcement at all — even if the
   `assessment` entity carries a fully populated `personalNeedsProfile`.
2. **There is no single function that answers "given config + assessment +
   level + scope, what tools are visible right now?"** Each consumer wires
   its own composition.

## 2. Resolvers in the codebase

### 2.1 `resolveToolsForLevel(config, level)` — `tools-config-normalizer.ts`

```242:252:packages/assessment-toolkit/src/services/tools-config-normalizer.ts
export function resolveToolsForLevel(
	config: CanonicalToolsConfig,
	level: ToolPlacementLevel,
): string[] {
	const placement = normalizeToolList(config.placement[level]);
	const allowed = normalizeToolList(config.policy.allowed);
	const blocked = new Set(normalizeToolList(config.policy.blocked));
	const passAllowed =
		allowed.length === 0 ? placement : placement.filter((toolId) => allowed.includes(toolId));
	return passAllowed.filter((toolId) => !blocked.has(toolId));
}
```

- **Composition:** `placement[level] ∩ (allowed ∨ all) − blocked`.
- **Knows about:** `placement`, `policy`, levels.
- **Does not know about:** providers (`enabled: false` is checked
  separately), PNP, district policy, item requirements, tool registry,
  `isVisibleInContext`.
- **Production wiring:**
  - `ItemToolBar.svelte` (`placementAllowedToolIds`).
  - `ToolkitCoordinator.getFloatingTools()`.
  - `PieSectionPlayerBaseElement.svelte`'s
    `annotationToolbarPlacementEnabled` derivation.
- **Public surface:** exported from `@pie-players/pie-assessment-toolkit`
  (top-level `index.ts`).

### 2.2 `normalizeAndValidateToolsConfig(...)` — `tool-config-validation.ts`

- **Role:** input validation — emits diagnostics for unknown tool IDs,
  unsupported placement levels, deprecated/unknown provider keys, and
  per-provider sanitize/validate failures. Honours
  `toolConfigStrictness: "off" | "warn" | "error"`.
- **Composition with policy:** none. Diagnostics are fed to the framework
  error bus (`frameworkErrorFromToolConfigValidation`); they do not gate
  visibility.
- **Production wiring:**
  - `ToolkitCoordinator.constructor` (and `updateToolConfig`,
    `setFloatingTools`).
- **Public surface:** validation helpers + diagnostic types are exported
  from `index.ts`.

### 2.3 `PnpToolResolver` — `PNPToolResolver.ts`

- **Composition (highest → lowest precedence):**
  1. district `blockedTools` (absolute veto)
  2. testAdministration `toolOverrides[id] === false`
  3. item `restrictedTools`
  4. item `requiredTools` (forces enable, marks `required: true`)
  5. district `requiredTools` (forces enable, marks `required: true`)
  6. PNP `supports` (enable; mark `alwaysAvailable: true`); `prohibitedSupports` blocks here
- **Public surface API the toolkit uses today:**
  - `getAllowedToolIds(assessment, itemRef)` — emits the union of "enabled"
    tools.
  - `getAutoActivateTools(assessment)` — derives initially-active set from
    `pnp.activateAtInit`.
  - `getRequiredTools(...)`, `isToolEnabled(...)`, `isToolRequired(...)`,
    `getToolSettings(...)` — convenience wrappers.
  - `resolveToolsWithProvenance(...)` — full provenance trail (used by the
    PNP debugger CE).
- **Knows about:** PNP, district policy, test administration, item-level
  settings, tool registry (for `pnpSupportIds` mapping).
- **Does not know about:** `tools.placement`, `tools.policy.allowed/blocked`,
  `tools.providers[id].enabled`, levels (its result is flat, not
  level-scoped), `isVisibleInContext`.
- **Production wiring:**
  - `<pie-item-toolbar>` accepts `pnpResolver` + `assessment` + `itemRef`
    props; if all three are supplied, `getAllowedToolIds(...)` is
    intersected with the placement-derived tool set in
    `ItemToolBar.allowedToolIds`. If any is missing, PNP is silently
    bypassed.
  - `<pie-section-toolbar>` forwards the same props through to
    `<pie-item-toolbar>`.
  - `<pie-section-player-tools-pnp-debugger>` (separate published package)
    constructs its own `PnpToolResolver` for QA UI.
- **Public surface:** `PnpToolResolver` exported from `index.ts`. Provenance
  types exported alongside.

### 2.4 `ToolConfigResolver` — `ToolConfigResolver.ts`

- **Composition:** flat 3-tier: item > roster (`"0"`/`"1"` allowance) > student
  accommodations.
- **Production wiring:** **none.** Cited only by:
  - `tests/tool-config-resolver.test.ts` (own unit tests),
  - `apps/docs/src/routes/+page.svelte` (a card on the docs landing page).
- **Public surface:** the class itself is **not** exported from the package
  root (`packages/assessment-toolkit/src/index.ts` does not re-export it),
  but the file lives next to genuine services and the docs site presents it
  as if it were a real toolkit primitive. **Dead code** for M8 purposes.

### 2.5 `ToolRegistration.isVisibleInContext` — per-tool

- **Role:** Pass-2 relevance gate. Evaluated per-render by `<pie-item-toolbar>`
  after the Pass-1 allowed set is computed.
- **Examples:** calculator's `hasMathContent(context)`, ruler/protractor
  measurement-content gates.
- **Composition:** purely additive — a Pass-1-allowed tool can still be
  hidden by Pass-2; Pass-2 cannot enable a Pass-1-blocked tool.
- **Public surface:** part of the `ToolRegistration` shape exposed by every
  tool package.

## 3. Composition pipeline as wired today

The end-to-end "is tool X visible at level L for scope S?" pipeline is
threaded through `<pie-item-toolbar>` (`ItemToolBar.svelte`):

1. Host-provided `tools` config arrives at the toolkit element →
   `resolveToolsConfig` (M7 engine resolver) folds in the
   `enabledTools` shorthand and the deprecated
   `item-toolbar-tools` / `passage-toolbar-tools` attributes.
2. `ToolkitCoordinator.constructor` runs
   `normalizeAndValidateToolsConfig(...)`; diagnostics dispatched via the
   framework error bus, validated config stored.
3. `<pie-item-toolbar>` reads the validated config from the runtime
   context, picks `placementLevel` from `level` + `contentKind`, calls
   `resolveToolsForLevel(config, level)` → `placementAllowedToolIds`.
4. `placementAllowedToolIds` is filtered by per-tool
   `providers[toolId].enabled !== false`.
5. If `pnpResolver + assessment + itemRef` are all supplied,
   `pnpResolver.getAllowedToolIds(assessment, itemRef)` is intersected with
   the provider-enabled set; otherwise the provider-enabled set passes
   through unchanged. **PNP is silently absent if any of the three props
   is missing.**
6. The Pass-1 allowed set is iterated; for each tool the per-render
   `ToolContext` is built and `ToolRegistration.isVisibleInContext(context)`
   gates Pass-2 visibility.
7. Surviving tools are emitted as toolbar items.

## 4. Findings

### F1. Three resolvers; one canonical, one parallel-but-active, one dead

- `resolveToolsForLevel` is the canonical Pass-1 path. Every production
  surface goes through it.
- `PnpToolResolver` is active only when the host passes the resolver
  instance plus a QTI assessment + item ref. The toolkit does not construct
  a default one, and the `<pie-section-player-*>` layout CEs do not forward
  PNP-related props to the inner toolkit — so most hosts never get QTI
  policy enforcement.
- `ToolConfigResolver` has no production caller and no `index.ts` export.
  Its only public exposure is a card on the docs landing page that
  describes it as if it were live. Candidate for deletion in M8 PR 1.

### F2. PNP is silently optional, not silently default

The `<pie-section-player-*>` chain does not pass a `pnpResolver` to
`<pie-assessment-toolkit>`, and the toolkit does not synthesize one from
the assessment entity it already receives. Hosts that opt in (the PNP
debugger) get the QTI resolution; hosts that do not (every section-demo,
`<pie-assessment-player-default>`, `element-QuizEngineFixedFormPlayer`)
silently bypass PNP rules.

This means today's product de facto runs on `placement` ∩ `policy.allowed/blocked` ∩
`providers[id].enabled` only, with no IEP/504-grade enforcement. The
sophisticated 6-level precedence inside `PnpToolResolver` is reachable
only from QA UI in practice.

### F3. Composition is unspecified

There is no documented rule for what happens when, e.g.:

- `policy.blocked` includes a tool that PNP says is **required**
  (item `requiredTools` or district `requiredTools`).
- `policy.allowed` is non-empty but PNP `supports` references a tool
  outside `allowed`.
- `placement[level]` excludes a tool that PNP `requiredTools` mandates.

`ItemToolBar` happens to compute set intersection (which means
`placement` and `policy.blocked` win over PNP `requiredTools`), but the
QTI/AfA semantics for `requiredTools` is "must be available". The
behaviour is currently a side effect of the wiring, not a documented
precedence model.

### F4. `policy.allowed` / `policy.blocked` are flat; QTI-side gates are level-scoped

- `policy.allowed/blocked` apply to every level identically.
- `district.blockedTools`, `district.requiredTools`,
  `testAdmin.toolOverrides`, item `restrictedTools/requiredTools` apply at
  a specific scope (assessment-wide, session-wide, per-item).
- Today there is no way to express "block calculator at section level but
  allow it at item level" in `tools.policy`. To do that, hosts have to omit
  it from `placement.section`.

### F5. Provider veto is parallel to `policy.blocked`

`providers[toolId].enabled === false` is checked separately in
`ItemToolBar` (and `ToolkitCoordinator.isToolEnabled`). It overlaps with
`policy.blocked` semantically but with subtly different scope (provider veto
is also consulted by the coordinator for non-toolbar surfaces such as
floating tool spawn). M8 should pick one canonical "veto" channel and
document the relation.

### F6. `isVisibleInContext` is the only level/context-aware gate

Pass-2 today is the only place that consults `ToolContext`
(content kind, item shape, scope). Pass-1 is purely id-set algebra. This is
a useful separation worth preserving — Pass-1 is policy, Pass-2 is
relevance — but the engine should make the boundary explicit and testable
instead of implicit in `<pie-item-toolbar>`.

### F7. Provenance exists for PNP only

`PnpToolResolver` produces a rich `PnpResolutionProvenance` trail
(decision log, source attribution, human-readable explanations); the
flat `resolveToolsForLevel` path emits nothing comparable. Hosts cannot
ask the toolkit "why is calculator hidden right now?" unless they
happened to wire the PNP resolver in. M8 should make provenance a
first-class output of the engine, not a PNP-only debug feature.

### F8. Public surface today

Exported from `@pie-players/pie-assessment-toolkit` (`src/index.ts`):

- `resolveToolsForLevel`
- `normalizeToolsConfig`, `parseToolList`, `normalizeToolList`,
  `normalizeToolAlias`
- `normalizeAndValidateToolsConfig`,
  `frameworkErrorFromToolConfigValidation`,
  `normalizeToolConfigStrictness`
- `PnpToolResolver` (and PNP types / provenance types)
- `CanonicalToolsConfig`, `ToolPolicyConfig`, `ToolPlacementConfig`,
  `ToolPlacementLevel`, `ToolProviderConfig`, `ToolProvidersConfig`,
  `ToolRuntimeProviderBridge`, `ToolRuntimeBackendRequest`,
  `ToolRuntimeProviderConfig`

Also exported via `runtime/internal`:

- `resolveToolsConfig` (the runtime-engine resolver that folds
  `enabledTools` + deprecated kebab attributes into `placement`)

Not exported:

- `ToolConfigResolver` (file present but not re-exported; dead).

## 5. Constraints M8 must preserve

These are non-negotiable for any variant:

1. **`pie-item` contract.** Per
   `.cursor/rules/legacy-compatibility-boundaries.mdc`, the pie-item client
   contract is the only preserved compatibility surface. The tool policy
   engine does not cross that boundary, but M8 must not change the way
   `pie-item` elements receive their model/session/configure inputs.
2. **`runtime.<key>` strict mirror rule (M5).** Anything M8 promotes from
   prop to `runtime.<key>` must follow strict mirror precedence
   (`runtime.<key>` wins, then top-level prop, then attribute) and must
   land an `m5-mirror-rule.test.ts`-style guardrail.
3. **Lockstep release (`fixed` block).** M8 ships under one minor or major
   bump across every publishable `@pie-players/*` package per
   `.cursor/rules/release-version-alignment.mdc`. No per-package version
   drift.
4. **Build-before-tests, custom-element boundaries, Svelte subscription
   safety.** Standard rules apply unchanged.
5. **Public-surface stability where consumers depend on it.** The four
   downstream surfaces audited under M7 PR 5 (`apps/section-demos`,
   `apps/assessment-demos`, `apps/item-demos`, the FixedForm /
   QuizEngineFixed players) are the same surfaces M8 must respect. M8's
   migration audit reuses that list.

## 6. Out of scope for M8

- M9 (single floating-tool stack) — sequencing reform of how floating
  tools register / unregister and share z-index. M8 stays focused on the
  *visibility decision*, not the *orchestration of UI for visible tools*.
- M10 (naming hygiene) — renaming sweep across the surface. M8 picks
  canonical names where it must define new surface, but does not run a
  workspace-wide rename pass.
- The four pre-existing `effect_update_depth_exceeded` errors in the
  assessment-player flow (`fix-effect-update-depth`).

## 7. Open questions for the variant pass

These are the decisions the variant docs need to lock:

- **Q1.** Does M8 absorb `PnpToolResolver` into the same engine, or keep it
  as a pluggable "policy source" that the engine composes with `placement`
  / `policy` / `providers`?
- **Q2.** What is the canonical precedence between
  `policy.blocked`, `placement[level]`, provider `enabled: false`, and
  PNP `requiredTools`? (Specifically: can a host's `policy.blocked` veto an
  IEP/504 `requiredTools` mandate? The QTI semantics suggest no; today's
  intersection wiring says yes.)
- **Q3.** Should `policy.allowed` / `policy.blocked` become level-scoped to
  match the QTI-side gates, or stay flat and let `placement[level]` carry
  level scoping?
- **Q4.** Is `ToolConfigResolver` removed in M8 PR 1, or kept as a dead
  export with a deprecation note? (Default per
  `.cursor/rules/legacy-compatibility-boundaries.mdc`: removed.)
- **Q5.** Does the engine produce provenance for every Pass-1 decision (not
  just PNP-driven ones), or stay PNP-only? If every decision: what is the
  canonical provenance shape — extend `PnpResolutionProvenance` or
  introduce a new `ToolPolicyProvenance` type?
- **Q6.** Where does the engine live — in `assessment-toolkit/src/runtime/`
  alongside the M7 runtime engine, or in a sibling
  `assessment-toolkit/src/policy/`? (M7's `runtime/engine` facade vs.
  `runtime/internal` split is a candidate template.)
- **Q7.** Public surface: does the M8 engine ship under a stable
  `policy/engine` facade and a wider `policy/internal` (parallel to
  M7's `runtime/engine` + `runtime/internal`), or fold under the
  `runtime/*` namespace?
- **Q8.** Cross-CE bridge (single-engine invariant): does the policy engine
  need its own host context (analogous to M7's
  `sectionRuntimeEngineHostContext`) so a kernel-wrapped toolkit and the
  outer layout CE share one engine instance, or is it cheap enough to
  recompute per CE?

Each variant doc answers all eight questions. The locked variant becomes
`m8-implementation-plan.md`.
