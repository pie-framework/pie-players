# Agent Instructions

This file is consumed by Claude Code, Codex, Cursor (as a supplement to
`.cursor/rules/*.mdc`), and other agent tooling. The authoritative source for
project rules is `.cursor/rules/`; this file surfaces the invariants most
likely to be violated and points at the rule files for detail.

## Critical architectural invariants

### PIE element versioning and the tag / id contract

The Custom Elements spec does not allow redefining an already-registered tag.
PIE works around this by encoding the package version into the tag name
(`--version-<encoded>` suffix, e.g. `pie-multiple-choice--version-latest`).
This lets multiple versions of the same element coexist in one document.

Because the versioned tag name is the only thing that lets two versions
coexist, it is **part of the authored content contract**, not opaque author
markup.

Do not:

- Strip, normalize, trim, or "clean up" the `--version-*` suffix on any
  `pie-*` tag.
- Compare a rendered element against its non-versioned base tag.
- Mutate the `id` attribute on `pie-*` elements. The runtime binds elements
  to models via strict `pieElement.id === config.models[].id` equality
  (`packages/players-shared/src/pie/updates.ts`).
- Prefix / slug / normalize `id`, `model-id`, `session-id`, `pie-*`,
  `model-*`, `session-*`, `config-*`, `context-*`, `data-*`, or `aria-*`
  attributes.
- Enable DOMPurify's `SANITIZE_NAMED_PROPS: true` — it prefixes `id` with
  `user-content-` and silently breaks model lookup. Keep `SANITIZE_DOM: true`
  (that is the real clobbering defense); leave `SANITIZE_NAMED_PROPS` at its
  default `false`.
- Re-`define` an existing PIE custom element tag. If a new version is needed,
  produce a new versioned tag and update the content / config together.

Authoring-mode variants (`pie-*-config`) are versioned the same way and carry
the same guarantees.

Canonical implementation: `packages/players-shared/src/pie/config.ts`
(`makeUniqueTags`).

Rule file: [`.cursor/rules/pie-element-versioning.mdc`](.cursor/rules/pie-element-versioning.mdc).

### Custom Element import boundaries

Consumers import built `dist` entrypoints, never package `src` or
`*.svelte?customElement`. CE build outputs must not contain dangling
`.svelte` imports.

Rule file: [`.cursor/rules/custom-elements-boundaries.mdc`](.cursor/rules/custom-elements-boundaries.mdc).

Guard: `bun run check:custom-elements` (also enforces no `.svelte` imports in
published `dist` JS).

### Legacy compatibility boundaries

The only permitted compatibility surface is the `pie-item` client contract.
Every exception needs an inline `pie-item contract compatibility: <reason>`
comment and a covering test.

Rule file: [`.cursor/rules/legacy-compatibility-boundaries.mdc`](.cursor/rules/legacy-compatibility-boundaries.mdc).

### Svelte subscription safety

`$effect` is wiring-only. Reactive mutations during setup must go through
`untrack(...)`. Subscription setup must be idempotent and compare stable keys
(`sectionId`, `attemptId`), not object identity.

Rule file: [`.cursor/rules/svelte-subscription-safety.mdc`](.cursor/rules/svelte-subscription-safety.mdc).

### Build-before-tests

Custom-element packages are consumed via `dist`. After changing package
source, rebuild that package before validating in a consumer app or running
tests that exercise its CE entrypoint.

Rule file: [`.cursor/rules/build-before-tests.mdc`](.cursor/rules/build-before-tests.mdc).

### Release version alignment

Always include all publishable packages in release/versioning steps so
versions stay globally aligned across the monorepo.

Rule file: [`.cursor/rules/release-version-alignment.mdc`](.cursor/rules/release-version-alignment.mdc).

### Code review workflow

For any substantial change set (multi-file feature, cross-package work,
non-trivial refactor, anything PR-sized), the review step is three
independent code-review subagents merged into one response. Disagreements
that cannot be reconciled with a clear rule stop and ask the maintainer.

Rule file: [`.cursor/rules/code-review-workflow.mdc`](.cursor/rules/code-review-workflow.mdc).

## Required pre-flight commands for CE-touching changes

```sh
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
```

## Verification pipeline for larger changes

```sh
bun install
bun run build
bun run typecheck
bun run test
bun audit
```
