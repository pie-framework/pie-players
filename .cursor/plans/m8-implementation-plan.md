# M8 Implementation Plan — Tool Policy Engine

> **Status:** locked design, pre-implementation.
> **Variant:** locked single-variant proposal (no a/b/c alternatives).
> **Posture:** rip-out (no compatibility aliases for surfaces this milestone
> removes; the only preserved compatibility surface is the `pie-item` client
> contract).
> **Optimization:** common host (single coordinator, default-on QTI when an
> assessment carries PNP / district policy / item settings).
> **Release:** lockstep minor across every publishable `@pie-players/*`
> package per `.cursor/rules/release-version-alignment.mdc`. Bumps to
> *major* only if the audit (PR 0) finds a "requires-dual-emit-window"
> downstream consumer that cannot migrate within the same release window.

## 0. Source of truth

The full M8 design rationale, API signatures, and locked decisions live at:

- [`m8-design.md`](./m8-design.md)
- [`m8-pre-flight-audit.md`](./m8-pre-flight-audit.md)

This implementation plan does NOT restate the design. It captures the
locked delta on top of that design and the executable migration sequence.

## 1. Locked decisions (one-line summaries; full rationale in `m8-design.md` § 0)

- **Q1**: absorb (single engine; QTI logic moves into `QtiPolicySource`).
- **Q2**: host wins (`policy.blocked`, missing-from-`placement[level]`, and
  `providers[id].enabled === false` are absolute vetoes; QTI required is
  advisory and surfaces a `tool-policy.qtiRequiredBlocked` diagnostic).
- **Q3**: `policy` stays flat in M8.
- **Q4**: delete `ToolConfigResolver` and its docs-site card.
- **Q5**: provenance for every Pass-1 decision (generalize
  `PnpResolutionProvenance` → `ToolPolicyProvenance`).
- **Q6**: `packages/assessment-toolkit/src/policy/` (sibling of `runtime/`).
- **Q7**: facade/internal split mirroring M7
  (`@pie-players/pie-assessment-toolkit/policy/engine` and `/policy/internal`).
- **Q8**: no cross-CE bridge — engine is per-coordinator and pure given
  inputs; `onPolicyChange` is the host subscription channel.
- **F2**: default-on QTI when assessment carries any QTI inputs; opt-out
  via `runtime.tools.qtiEnforcement: "off"`.

## 2. Migration sequence (executable)

Each step is one logical PR that ships green at HEAD. Build order from
`.cursor/rules/build-before-tests.mdc` applies between each PR.

### PR 0 — Pre-flight audit (docs-only)

Adjustment-pattern parallel to M7 PR 0. Runs the audit grep before
behavioural PRs land, captures the rip-out / requires-migration /
requires-dual-emit-window verdict per surface, and lands the audit doc
under `.cursor/plans/m8-pre-flight-audit-downstream.md`.

**Method:**

For each of the four downstream surfaces previously audited under M7 PR 0:

- `apps/section-demos/src/routes/(demos)/**/*.svelte`
- `apps/assessment-demos/src/routes/(demos)/**/*.svelte`
- `apps/item-demos/src/routes/**/*.svelte`
- `../element-QuizEngineFixedFormPlayer/`,
  `../element-QuizEngineFixedPlayer/`,
  `../../kds/pie-api-aws/containers/pieoneer/`

…run two ripgrep passes:

1. Symbol-level: `resolveToolsForLevel`, `PnpToolResolver`,
   `ToolConfigResolver`, `getAllowedToolIds`, `pnpResolver=`,
   `pnpResolver:`, `assessment={`, `itemRef={` against the toolbar CEs.
2. Tag-level: `<pie-item-toolbar` and `<pie-section-toolbar` to find every
   instantiation that passes the to-be-removed props.

**Categorization** mirrors M7's vocabulary:

| Category | Meaning | M8 implication |
|---|---|---|
| **rip-out-safe** | No direct import of removed symbols; consumer talks only to the toolkit element / coordinator API. | none |
| **requires-migration** | Direct import or toolbar prop usage. Will break in PR 3 (toolbar prop removal) or PR 5 (engine landing). | listed in M8 changeset under "Breaking changes — surface migration"; consumer migrates within the same release window |
| **requires-dual-emit-window** | Same as above but cannot migrate in the same release window. | escalate to maintainer; PR 3 blocks until migration plan is on file |

**Blocking:** PR 0 blocks PR 3 (toolbar-prop removal) and PR 5 (default-on
QTI flip). It does not block PRs 1–2 (additive engine introduction).

### PR 1 — Introduce `ToolPolicyEngine` skeleton (no callers)

**Files added:**
- `packages/assessment-toolkit/src/policy/engine.ts` (facade re-exports)
- `packages/assessment-toolkit/src/policy/internal.ts` (wider re-exports)
- `packages/assessment-toolkit/src/policy/core/ToolPolicyEngine.ts`
- `packages/assessment-toolkit/src/policy/core/PolicySource.ts`
- `packages/assessment-toolkit/src/policy/core/policy-source-tag.ts`
- `packages/assessment-toolkit/src/policy/core/decision-types.ts`
- `packages/assessment-toolkit/src/policy/core/compose-decision.ts`
  (steps 1–6 from `m8-design.md` § 3; pure function, no engine state)
- `packages/assessment-toolkit/src/policy/core/provenance.ts`
  (verbatim absorption of `PnpResolutionProvenance`,
  `FeatureResolutionTrail`, `ResolutionDecision` from
  `pnp-provenance.ts`, plus the expanded
  `ToolPolicyDecisionRule` enum from `m8-design.md` § 4. The original
  `pnp-provenance.ts` still exports its versions; PR 2 routes the QTI
  source to the new module.)
- `packages/assessment-toolkit/src/policy/sources/QtiPolicySource.ts`
  (verbatim absorption of `PnpToolResolver` body, refactored into the
  `PolicySource` shape — `id: "qti"`, `refine(candidates, ctx)`. The
  original `PnpToolResolver` class still lives in `PNPToolResolver.ts`
  and is re-exported by `index.ts`; PR 2 wires the engine, PR 3 deletes
  the legacy class.)
- `packages/assessment-toolkit/tests/policy/core/ToolPolicyEngine.test.ts`
- `packages/assessment-toolkit/tests/policy/core/compose-decision.test.ts`
- `packages/assessment-toolkit/tests/policy/sources/QtiPolicySource.test.ts`

**Files unchanged:** `tools-config-normalizer.ts`,
`tool-config-validation.ts`, `PNPToolResolver.ts`,
`ToolConfigResolver.ts`, `ToolkitCoordinator.ts`, `ItemToolBar.svelte`,
`SectionToolBar.svelte`, `PieSectionPlayerBaseElement.svelte`. PR 1 is
purely additive.

**`package.json` exports added:**
```json
{
  "./policy/engine": "./dist/policy/engine.js",
  "./policy/internal": "./dist/policy/internal.js"
}
```

**`src/index.ts` re-export added:**
- `ToolPolicyEngine`, `TOOL_POLICY_ENGINE_KEY`, the engine input/output
  types from `policy/engine`. The wider internal surface stays
  reachable only via the explicit subpath.

**Acceptance:**
- `bun run build` clean across the workspace.
- `bun run typecheck` clean.
- New unit tests pass; existing tests unchanged (engine has no callers).
- `bun run check:source-exports`, `check:consumer-boundaries`,
  `check:custom-elements` pass.

### PR 2 — Wire `ToolPolicyEngine` into `ToolkitCoordinator` (additive)

**Files changed:**
- `packages/assessment-toolkit/src/services/ToolkitCoordinator.ts`:
  - Construct `policyEngine: ToolPolicyEngine` in the constructor after
    validation runs. QTI inputs (`assessment`, `currentItemRef`) start
    `null`; `qtiEnforcement` defaults to `"on"` only when QTI inputs are
    later supplied.
  - New public methods (additive):
    - `decideToolPolicy(req: ToolPolicyDecisionRequest): ToolPolicyDecision`
    - `onPolicyChange(listener: PolicyChangeListener): () => void`
    - `updateAssessment(assessment: AssessmentEntity | null): void`
    - `updateCurrentItemRef(itemRef: AssessmentItemRef | null): void`
  - Existing `getFloatingTools()` becomes a thin shim over
    `decideToolPolicy({ level: "section", scope: { level: "section", scopeId: "*" } })`.
  - Existing `updateToolConfig`, `setFloatingTools` call
    `policyEngine.updateInputs(...)` after the validated config swap.
- `packages/assessment-toolkit/src/components/PieAssessmentToolkit.svelte`:
  - New props (additive): `assessment`, `currentItemRef`,
    `qtiEnforcement` mirrored under `runtime.<key>` per the M5 strict
    mirror rule.
  - On change, call `coordinator.updateAssessment(...)` /
    `updateCurrentItemRef(...)`. M5 mirror test (PR 1 of M8) covers the
    precedence.

**Files unchanged:** `tools-config-normalizer.ts` (still exports
`resolveToolsForLevel`), `PNPToolResolver.ts` (still exported),
`ItemToolBar.svelte`, `SectionToolBar.svelte`,
`PieSectionPlayerBaseElement.svelte`. The toolbar still uses today's
`pnpResolver` prop chain. PR 2 introduces an *unused* engine API on the
coordinator side.

**Acceptance:**
- New coordinator unit tests
  (`tests/policy/coordinator-integration.test.ts`) cover:
  - `decideToolPolicy` returns level-scoped decisions consistent with
    `getFloatingTools()`.
  - `onPolicyChange` fires once per applicable level on
    `updateAssessment` / `updateCurrentItemRef` / `updateToolConfig`.
  - `qtiEnforcement: "off"` short-circuits the QTI source.
- Existing toolkit / section-player tests pass unchanged (no consumer
  has switched onto the engine yet).
- All `check:*` + typecheck + e2e pass.

### PR 3 — Switch toolbar CEs onto the engine; remove parallel props

**Files changed:**
- `packages/assessment-toolkit/src/components/ItemToolBar.svelte`:
  - Drop `pnpResolver`, `assessment`, `itemRef` props.
  - Replace `placementAllowedToolIds` / `allowedToolIds` derivations with
    a single `decision = $derived(coordinator.decideToolPolicy({...}))`,
    fed by `level`, `scope`, and the `toolContext` Pass-2 input.
  - Pass-2 (`isVisibleInContext`) stays at the toolbar boundary,
    filtering `decision.visibleTools` per render.
- `packages/assessment-toolkit/src/components/SectionToolBar.svelte`:
  - Drop the same three props from its `customElement` props block.
- `packages/section-player/src/components/PieSectionPlayerBaseElement.svelte`:
  - Replace `annotationToolbarPlacementEnabled` / `resolveToolsForLevel`
    derivation with `coordinator.decideToolPolicy({...})` calls; assert
    visibility via the engine.

**Tests updated:**
- `packages/section-player/tests/section-player-tool-config-error-surfacing.spec.ts`
- `packages/section-player/tests/section-player-runtime-callbacks.test.ts`
  (assert engine onPolicyChange round-trips through the canonical
  callback channel).
- `packages/assessment-toolkit/tests/runtime/...` — any test that imported
  `pnpResolver` directly switches to `coordinator.updateAssessment(...)`.
- `packages/section-player-tools-pnp-debugger/PnpPanel.svelte`: switches
  to `coordinator.decideToolPolicy(...).provenance` (instead of
  `new PnpToolResolver(...).resolveToolsWithProvenance(...)`).

**Files unchanged in PR 3:** `tools-config-normalizer.ts` (still exports
`resolveToolsForLevel`), `PNPToolResolver.ts` (still exported); they are
deleted in PR 4.

**Acceptance:**
- All M8 unit + e2e suites green.
- Boundary checks pass.
- The pre-flight audit's `requires-migration` consumers are updated in
  the same PR (or, if external, listed in the changeset with the
  recommended migration). `requires-dual-emit-window` consumers, if any,
  block this PR.
- 3-agent code review per `.cursor/rules/code-review-workflow.mdc`.

### PR 4 — Default-on QTI flip + `qtiEnforcement` opt-out

**Files changed:**
- `packages/assessment-toolkit/src/policy/core/ToolPolicyEngine.ts`:
  - Default `qtiEnforcement` resolves to `"on"` when *any* of
    `assessment.personalNeedsProfile`,
    `assessment.settings.districtPolicy`,
    `assessment.settings.testAdministration`, or
    `currentItemRef.settings.requiredTools/restrictedTools/toolParameters`
    is non-empty; otherwise `"off"`.
  - Hosts opt out by setting `qtiEnforcement: "off"` explicitly.
- `packages/assessment-toolkit/src/runtime/core/engine-resolver.ts`:
  - Surface `runtime.tools.qtiEnforcement` as a M5-mirrored runtime key.
  - Add `qtiEnforcement` test row to
    `packages/section-player/tests/m5-mirror-rule.test.ts`.
- `apps/section-demos/...`, `apps/assessment-demos/...`: smoke fixture
  for default-on QTI behaviour (one demo route added under
  `(demos)/qti-default-on`).

**Tests added:**
- `packages/assessment-toolkit/tests/policy/qti-default-on.test.ts`:
  asserts the engine activates QTI when the assessment carries any
  QTI input, and stays off when the host explicitly sets
  `qtiEnforcement: "off"`.
- `packages/assessment-toolkit/tests/policy/qti-required-blocked-diagnostic.test.ts`:
  asserts the `tool-policy.qtiRequiredBlocked` diagnostic fires when
  host `policy.blocked` and QTI `requiredTools` collide, with provenance
  showing both decisions.

**Acceptance:**
- All M8 unit + e2e suites green.
- The default-on flip is visible in PNP debugger output (asserts
  provenance shape).
- 3-agent code review.

### PR 5 — Delete legacy modules, complete the rip-out

**Files deleted:**
- `packages/assessment-toolkit/src/services/PNPToolResolver.ts`
- `packages/assessment-toolkit/src/services/ToolConfigResolver.ts`
- `packages/assessment-toolkit/tests/tool-config-resolver.test.ts`
- `packages/assessment-toolkit/src/services/pnp-provenance.ts` (the
  generalized version lives in `policy/core/provenance.ts`; the legacy
  file is removed once `index.ts` switches to re-export the policy
  module's types).

**Files changed:**
- `packages/assessment-toolkit/src/services/tools-config-normalizer.ts`:
  - Remove `resolveToolsForLevel` export (used to be canonical Pass-1).
  - Keep `normalizeToolsConfig`, `parseToolList`, `normalizeToolList`,
    `normalizeToolAlias` (still used by the engine and validation).
- `packages/assessment-toolkit/src/index.ts`:
  - Remove `resolveToolsForLevel`, `PnpToolResolver`,
    `PnpResolutionProvenance`, `FeatureResolutionTrail`,
    `ResolutionDecision` re-exports.
  - Add `ToolPolicyProvenance`, `ToolPolicyDecision`, `ToolPolicyEntry`,
    `ToolPolicyDiagnostic`, `ToolPolicyDecisionRule` from
    `policy/engine`.
- `apps/docs/src/routes/+page.svelte`:
  - Remove the "ToolConfigResolver" card.
  - Add "ToolPolicyEngine" + "QtiPolicySource" cards (or update the
    existing "PnpToolResolver" card to reflect the rename).

**Acceptance:**
- All `check:*` pass after deletes (publint, source-exports,
  consumer-boundaries, custom-elements).
- `verify:publish` fixed-versioning check passes.
- Workspace-wide typecheck clean.
- Section-player critical e2e + assessment-player e2e + item-player
  multiple-choice e2e (the pre-push subset) all green.
- 3-agent code review.

### PR 6 — Docs + changeset across the fixed block

**Files changed:**
- `packages/assessment-toolkit/README.md`:
  - New "Tool Policy Engine" section parallel to the existing "Section
    Runtime Engine" section. Documents the two import paths
    (`policy/engine`, `policy/internal`), the precedence model
    (`m8-design.md` § 3), the host-wins QTI posture, and a wiring
    example that mirrors the runtime engine example.
  - Update the existing "Tool configuration" section to remove
    references to `pnpResolver` toolbar props and to point at
    `coordinator.updateAssessment(...)`.
- `packages/section-player/README.md`:
  - Update the "Tool configuration" / "PNP" subsections to reflect
    default-on QTI and the `qtiEnforcement` opt-out.
  - Update the API summary to drop `pnpResolver`.
- `packages/section-player/ARCHITECTURE.md`:
  - Mirror the M7 "Layered runtime engine" section with a "Tool Policy
    Engine" subsection summarizing the precedence and pointing at
    `m8-design.md` for the full rationale.
- `docs/section-player/client-architecture-tutorial.md`:
  - Update the "Tools" section: drop manual `pnpResolver` wiring;
    replace with `assessment` / `currentItemRef` on the toolkit element.
- `docs/tools-and-accomodations/architecture.md`:
  - Update the "Three-Tier Configuration" section to reflect the
    canonical M8 precedence rule and the host-wins QTI posture.
- `docs/architecture/types-and-utilities-contract.md`:
  - Update the `PnpToolResolver` row to point at `QtiPolicySource` /
    `ToolPolicyEngine`.

**Changeset:**
- `.changeset/m8-tool-policy-engine.md` with a `minor` bump across every
  package in the `fixed` block per
  `.cursor/rules/release-version-alignment.mdc`. (Promotes to `major` if
  PR 0 surfaced a `requires-dual-emit-window` finding.)
- The changeset documents:
  - The two new public entry points
    (`@pie-players/pie-assessment-toolkit/policy/engine` and
    `/policy/internal`).
  - The deleted legacy surface (`resolveToolsForLevel`,
    `PnpToolResolver`, `ToolConfigResolver`,
    `pnpResolver`/`assessment`/`itemRef` toolbar props,
    `pnp-provenance.ts`).
  - The default-on QTI behaviour change with `qtiEnforcement: "off"` opt-out.
  - The host-wins precedence rule and the
    `tool-policy.qtiRequiredBlocked` diagnostic.

**Acceptance:**
- `bun run verify:publish` passes (fixed-versioning check + publint).
- `markdownlint` warnings only on pre-existing surface unaffected by M8.
- 3-agent code review on the changeset content (R1: doc-vs-code accuracy,
  R2: changeset correctness + versioning policy compliance, R3:
  host-engineer clarity + usability — same R1/R2/R3 split as M7 PR 8).

## 3. Out of scope for M8

- M9 (single floating-tool stack) and M10 (naming hygiene) — sequenced
  after M8 per the umbrella plan.
- Level-scoped `policy.allowed/blocked` keys — captured as a future M9/M10
  candidate.
- The four pre-existing `effect_update_depth_exceeded` errors in the
  assessment-player flow.

## 4. Roll-back posture

If a single PR (3, 4, or 5) needs to roll back after merge:

- **PR 0** is docs-only; rolling back has no behavioural effect.
- **PRs 1–2** are fully additive: rolling back any single one requires
  only reverting that PR. The engine code (PR 1) stays in tree but is
  unused if PR 2 reverts.
- **PR 3** (toolbar prop removal) is the riskiest. Rollback path: revert
  PR 3 — the toolbar reverts to today's `pnpResolver` chain; the engine
  on the coordinator side is still present (additive from PR 2) but no
  longer driving toolbar visibility.
- **PR 4** (default-on QTI flip) is its own PR for exactly this reason:
  if any host depended on the silent-bypass default, reverting PR 4
  restores the legacy behaviour without touching the engine plumbing.
- **PR 5** (delete legacy modules) is the only PR that removes from the
  package. If a downstream consumer surfaces a dependency on the deleted
  re-exports, rollback path: re-introduce the deleted file as a
  thin re-export shim that delegates to the engine, while leaving the
  engine as the source of truth.

The lockstep release should land after the full M8 chain is in `develop`
and a passing CI sweep, not incrementally per PR.

## 5. Verification pipeline (post-merge sweep)

```sh
bun install
bun run build
bun run typecheck
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
bun run test
bun run test:e2e:section-player:critical
bun run test:e2e:item-player:multiple-choice
bun run test:e2e:assessment-player
bun run verify:publish
bun audit
```

The Playwright suites and `git push` run with
`required_permissions: ["all"]` per
`.cursor/rules/playwright-sandbox.mdc`.

## 6. Hand-off to M9

M9 starts from a clean Pass-1 surface: one engine, one provenance, one
precedence rule. M9 ("single floating-tool stack") then layers on top —
how the engine's `level: "section"` decision is rendered into a
deduplicated floating-tool host, how z-index is owned, and how
multi-section assessments coordinate. M8 does not touch the floating-tool
rendering pipeline beyond what `coordinator.getFloatingTools()`
re-implementation requires.
