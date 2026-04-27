# M8 Pre-Flight Audit — Downstream Consumer Audit (PR 0)

> **Status:** complete; rip-out posture cleared for PRs 3, 4, and 5.
> **Scope:** the four downstream surfaces named in `m8-implementation-plan.md` § 2 PR 0.
> **Question:** does any consumer
>
> 1. import `resolveToolsForLevel`, `PnpToolResolver`, `ToolConfigResolver`,
>    or any of their re-exports directly from
>    `@pie-players/pie-assessment-toolkit`, **or**
> 2. instantiate `<pie-item-toolbar>` / `<pie-section-toolbar>` directly
>    (i.e. the toolbar CEs nested under their own host markup), and pass
>    `pnpResolver`, `assessment`, or `itemRef` props on those tags?
>
> A "yes" on either branch makes the consumer **requires-migration**
> (PR 3 removes the toolbar props; PR 5 removes the symbol re-exports).
> A "yes" on (1) without a same-release-window migration plan blocks the
> rip-out posture and forces a `requires-dual-emit-window` escalation.

This audit complements [`m8-pre-flight-audit.md`](./m8-pre-flight-audit.md)
(which inventoried the *internal* surface) by inventorying the *downstream*
surface that M8 will actually rip out.

## Audit method

Two ripgrep passes, run from repo root with the sibling repos checked out
at the paths listed below.

### 1. Symbol-level scan

```sh
rg -n 'resolveToolsForLevel|PnpToolResolver|ToolConfigResolver|getAllowedToolIds|pnpResolver=|pnpResolver:|<pie-item-toolbar|<pie-section-toolbar' \
   apps/{section-demos,assessment-demos,item-demos,docs}/src \
   ../element-QuizEngineFixedPlayer \
   ../element-QuizEngineFixedFormPlayer \
   ../function-QuizEngineFixedPlayerBff \
   ../../kds/pie-api-aws/containers/pieoneer/src
```

### 2. Tag-level scan with prop diff

```sh
rg -n -C 5 '<pie-item-toolbar|<pie-section-toolbar' \
   apps/{section-demos,assessment-demos,item-demos,docs}/src \
   ../element-QuizEngineFixedPlayer \
   ../element-QuizEngineFixedFormPlayer \
   ../function-QuizEngineFixedPlayerBff \
   ../../kds/pie-api-aws/containers/pieoneer/src
```

A consumer is flagged only if a hit lands on a real source path — `dist/`,
`build/`, `.svelte-kit/`, and `node_modules/` matches are bundled
toolkit output and not consumer code.

## Categorization

| Category | Meaning | M8 implication |
|---|---|---|
| **rip-out-safe** | No direct import of removed symbols; no toolbar CE instantiated outside the toolkit's own internal use. PRs 3 / 5 cannot regress it. | none |
| **requires-migration** | Imports a removed symbol or instantiates a toolbar CE with `pnpResolver` / `assessment` / `itemRef` props. Will break in PR 3 (toolbar prop removal) or PR 5 (symbol delete). | listed in M8 changeset under "Breaking changes — surface migration"; consumer migrates within the same release window |
| **requires-dual-emit-window** | Same as above but cannot migrate in the same release window. | escalate to maintainer; PR 3 blocks until migration plan is on file |

## Findings

### `apps/section-demos/src/routes/(demos)/**/*.svelte`

**Verdict:** rip-out-safe.

- Symbol-level scan against `apps/section-demos` returned zero hits for
  `resolveToolsForLevel`, `PnpToolResolver`, `ToolConfigResolver`,
  `getAllowedToolIds`, or `pnpResolver`.
- Tag-level scan returned zero hits for `<pie-item-toolbar>` /
  `<pie-section-toolbar>`. The section-demos surface drives toolbars only
  through the outer layout CEs (`<pie-section-player-splitpane>` /
  `-vertical` / `-tabbed`) which mount the toolbar CEs internally inside
  the toolkit shadow root.

### `apps/assessment-demos/src/routes/(demos)/**/*.svelte`

**Verdict:** rip-out-safe.

- Both passes returned zero hits.
- Demos embed `<pie-assessment-player-default>` plus
  section-player-tools debugger CEs only.

### `apps/item-demos/src/routes/**/*.svelte`

**Verdict:** rip-out-safe.

- Both passes returned zero hits.
- The surface only hosts `<pie-item-player-*>` CEs — no toolbar / toolkit
  / PNP wiring.

### `apps/docs/src/routes/+page.svelte`

**Verdict:** rip-out-safe (one stale docs-card in scope for PR 5 deletion).

- Symbol-level scan hits one location:

  ```326:332:apps/docs/src/routes/+page.svelte
  			<div class="card bg-base-100 border border-base-300">
  				<div class="card-body">
  					<h4 class="font-bold text-primary mb-2">ToolConfigResolver</h4>
  					<p class="text-sm">
  						Resolves three-tier accommodation configuration (student IEP/504, roster settings, item
  						requirements).
  ```

  This is a stale card pointing at the dead `ToolConfigResolver` class.
  PR 5 deletes both the class and the card together (already listed in
  `m8-implementation-plan.md` § 2 PR 5 — "Remove the 'ToolConfigResolver'
  card; add 'ToolPolicyEngine' / 'QtiPolicySource' cards"). No runtime
  code in `apps/docs` imports the symbol.

### External: `../element-QuizEngineFixedPlayer/`

**Verdict:** rip-out-safe.

- Both passes returned zero hits across the project source.
- Consumes the toolkit only through `<pie-section-player-splitpane>` and
  the coordinator API surfaced via `(toolkit-ready)`. No direct toolbar
  CE usage, no `pnpResolver` / `assessment` / `itemRef` props.

### External: `../element-QuizEngineFixedFormPlayer/`

**Verdict:** rip-out-safe.

- Both passes returned zero hits across the project source on the
  `pie-assessment-toolkit-demo` branch (the branch identified during M7
  PR 0 as the live consumer source).
- Same shape as FixedPlayer: outer-CE consumer using the coordinator API
  for section-controller subscriptions; no toolbar CE wiring, no PNP
  prop chain.

### External: `../function-QuizEngineFixedPlayerBff/`

**Verdict:** rip-out-safe.

- Both passes returned zero hits.
- Backend-for-frontend Lambda surface; no DOM, no CE consumption.

### External: `../../kds/pie-api-aws/containers/pieoneer/`

**Verdict:** rip-out-safe.

- Symbol-level scan against `containers/pieoneer/src` returned zero hits
  for `resolveToolsForLevel`, `PnpToolResolver`, `ToolConfigResolver`,
  `getAllowedToolIds`, `pnpResolver`, `<pie-item-toolbar>`, or
  `<pie-section-toolbar>`.
- The bundled `.svelte-kit/output/server/chunks/tools-config-builder.js`
  and `build/server/chunks/tools-config-builder-*.js` chunks contain
  matches for `resolveToolsForLevel` (the function definition and one
  call site), but those are **bundled outputs of the toolkit itself**
  emitted into the consumer's build cache by Vite tree-shaking — pieoneer
  source (`src/lib/section-demos/runtime/tools-config-builder.ts` and
  every other source file) does not reference any M8 removed symbol.
  Once pieoneer rebuilds against the post-M8 toolkit, those bundled
  chunks will contain the engine's compose logic instead.
- Pieoneer's section-related routes (`(public)/etl/demos/sections/...`,
  `(fullscreen)/section-preview/[...]`) embed only outer layout CEs
  (`<pie-section-player-splitpane>` / `-vertical` /
  `<pie-section-player-tools-pnp-debugger>` plus other debugger CEs).

## Summary table

| Surface | Verdict |
|---|---|
| `apps/section-demos` | rip-out-safe |
| `apps/assessment-demos` | rip-out-safe |
| `apps/item-demos` | rip-out-safe |
| `apps/docs` | rip-out-safe (one stale card scoped for PR 5 deletion) |
| `../element-QuizEngineFixedPlayer/` | rip-out-safe |
| `../element-QuizEngineFixedFormPlayer/` (`pie-assessment-toolkit-demo` branch) | rip-out-safe |
| `../function-QuizEngineFixedPlayerBff/` | rip-out-safe |
| `../../kds/pie-api-aws/containers/pieoneer/` | rip-out-safe |

## Posture decision

Ship M8 PRs 3, 4, and 5 under the **rip-out posture** locked in the
implementation plan. No blockers remain.

No `requires-migration` or `requires-dual-emit-window` consumers were
discovered. The dual-emit window is therefore not required for any
consumer the plan identifies as in scope, and PR 5's deletion of
`PnpToolResolver`, `ToolConfigResolver`, and `resolveToolsForLevel` is
unaffected.

The internal package boundaries — `<pie-section-player-tools-pnp-debugger>`
(`packages/section-player-tools-pnp-debugger/PnpPanel.svelte`) and the
in-package toolbar CE callers (`ItemToolBar.svelte`,
`SectionToolBar.svelte`, `PieSectionPlayerBaseElement.svelte`) — are
in-monorepo and migrate inside their respective PRs (3 for the toolbar
CEs, 3/4 for the debugger).

## Re-run trigger

Re-run the recipes above if any of these surfaces lands a new
`<pie-item-toolbar>` / `<pie-section-toolbar>` instantiation, or starts
importing `PnpToolResolver` / `resolveToolsForLevel` / `ToolConfigResolver`
directly, before M8 PR 3 ships.

If `element-QuizEngineFixedFormPlayer` lands a non-`pie-assessment-toolkit-demo`
production branch before M8 ships, re-run the audit against that branch
to confirm the verdict still holds (same caveat as M7 PR 0).
