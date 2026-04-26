---
'@pie-players/pie-section-player': major
'@pie-players/pie-assessment-toolkit': major
'@pie-players/pie-players-shared': major
---

Introduce the **canonical readiness vocabulary** across the section
player and the assessment toolkit (M6 of the Coherent Options Surface
track, with the post-cumulative-review retro to four stages).
Replaces a heterogeneous set of legacy ready/loaded events with a
single typed transition stream that hosts can subscribe to once and
correlate across wrapper depths.

## What's new

### Stage vocabulary

A single ordered set of four stages, fired exactly once per cohort
(`(sectionId, attemptId)`):

```
composed → engine-ready → interactive → disposed
```

The vocabulary is identical for the layout CEs and the toolkit CE.
`disposed` fires on cohort change (the old cohort) and on unmount.

The original M6 plan included `attached`, `runtime-bound`, and
`ui-rendered` stages. Those three were removed in the M6 retro after
the cumulative review confirmed zero internal or external consumers —
they only added noise to the canonical stream.

### `StageTracker` primitive (`@pie-players/pie-players-shared/pie`)

- Enforces monotonic ordering — a stage is silently dropped if it
  arrives out of order.
- Resets on cohort change so the next attempt re-traverses the stage
  set cleanly.
- Catches handler exceptions at the emit point so a faulty consumer
  cannot break the stage pipeline.
- The `applicableStages(sourceCe)` indirection is kept (returns the
  full list for both shapes today) so a future shape-specific stage
  can opt out without rewriting callers.

### Canonical DOM events

- `pie-stage-change` — every stage transition. Detail =
  `StageChangeDetail { stage, sourceCe, sourceCeShape, sectionId,
  attemptId, ... }`.
- `pie-loading-complete` — kernel-only, fires once per cohort when
  every item has loaded. Detail = `LoadingCompleteDetail`.

Legacy `ready`, `interaction-ready`, and `readiness-change` events are
kept dual-emitting through the M6 deprecation window so existing hosts
continue to work.

### Callback prop mirrors

Following the M5 strict mirror rule (kebab-attribute ↔ camelCaseProp
↔ `runtime.<sameKey>`):

- `onStageChange` is exposed on every kernel-backed layout CE
  (`<pie-section-player-splitpane>`, `<pie-section-player-vertical>`,
  `<pie-section-player-tabbed>`, `<pie-section-player-kernel-host>`),
  on `<pie-section-player-base>`, and on `<pie-assessment-toolkit>`.
  The kernel and the toolkit invoke the resolved handler at the same
  emit point as `pie-stage-change`, so callback and event stay in
  lockstep across cohort changes.
- `onLoadingComplete` is exposed on the kernel-backed layout CEs only.
  The toolkit and the base CE do not own a `pie-loading-complete`
  emit point and intentionally omit the prop.

`runtime.onStageChange` wins over the top-level `onStageChange` prop;
same for `runtime.onLoadingComplete`. Resolved through the shared
per-key `pick(...)` slot in `resolveRuntime` — no per-feature
special-casing.

## Why

Before M6 the readiness story was a patchwork: layout kernels emitted
`ready`, the toolkit emitted `interaction-ready`, the section
controller emitted `section-controller-ready`, and hosts had to
correlate by ad-hoc event listeners across two or three wrapper
levels. Cohort changes did not reliably reset the readiness state, so
the second attempt of a session frequently skipped the events the
first attempt fired. M6 standardizes that surface: one event family,
one tracker primitive, monotonic ordering, deterministic cohort
reset, and a typed callback mirror so consumers can subscribe in one
line.

## Breaking changes (M6 retro)

- The canonical stage list is now `composed → engine-ready →
  interactive → disposed` only. The `attached`, `runtime-bound`, and
  `ui-rendered` stages are no longer emitted on `pie-stage-change`.
  Subscribers that filter by `detail.stage === "attached"`,
  `"runtime-bound"`, or `"ui-rendered"` will never receive an event;
  drop those branches and key off `composed` / `engine-ready` /
  `interactive` instead.
- `Stage` (the canonical type) and `STAGES` (the canonical list)
  exported from `@pie-players/pie-players-shared/pie` no longer
  contain those three values. Code that imports the type and expects
  the full seven-stage union will fail typechecking — update to the
  four-stage union.

## Migration

Both forms work today; the canonical form is preferred:

```ts
el.addEventListener("pie-stage-change", ({ detail }) => {
  if (detail.stage === "interactive") onInteractive();
});
el.addEventListener("pie-loading-complete", ({ detail }) => {
  onAllItemsLoaded(detail);
});

el.runtime = {
  onStageChange: (detail) => { /* ... */ },
  onLoadingComplete: (detail) => { /* ... */ },
};
```

Legacy `ready` / `interaction-ready` listeners continue to fire
through the M6 deprecation window. Cohort-bound state should be reset
on `disposed` (the old cohort) rather than on reading new
`(sectionId, attemptId)` props directly.
