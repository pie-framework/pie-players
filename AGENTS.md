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

### Playwright / `git push` must run outside the sandbox

The pre-push lefthook runs Playwright e2e suites; running those (or any
`test:e2e:*` script, `bunx playwright …`, or `git push`) inside the default
tool sandbox fails with missing Chromium binaries, dev-server timeouts, or
blocked downloads.

Agents MUST invoke these commands with `required_permissions: ["all"]` so
they execute outside the sandbox and reuse the shared
`~/Library/Caches/ms-playwright/` browser cache.

Rule file: [`.cursor/rules/playwright-sandbox.mdc`](.cursor/rules/playwright-sandbox.mdc).

### Release version alignment (fixed / lockstep versioning)

All publishable `@pie-players/*` packages are released with a **fixed
(lockstep) version**. At any published version, every package in the suite
carries the same version number. This is enforced by Changesets' `fixed`
block in `.changeset/config.json`.

Implications for agent-driven work:

- Always include **all** publishable packages in release/versioning steps.
  Never scope a release bump to "only the packages I changed."
- Every release bumps every publishable package, including ones whose source
  did not change. That is expected, not a bug. Do not try to skip unchanged
  packages.
- **Patch only.** While we are pre-1.0 (`0.x.y` line), every release is a
  `patch` bump — even for breaking changes. Do not author `minor` / `major`
  changesets unless the maintainer explicitly lifts this constraint and
  rewrites the rule. Document breaking changes in the changeset body, but
  ship them under `patch`. A pending `minor` / `major` changeset is a
  release blocker because the highest declared bump wins for the lockstep
  set.
- Local publishing uses **`bun run release:with-version`** (NPM token comes
  from `.env` via `dotenvx`). Do not invoke `bun run release` or
  `npm publish` directly.
- When adding a new publishable package under `packages/*`, add it to the
  `fixed` block in `.changeset/config.json` in the same change set.
- The invariant is checked by `scripts/check-fixed-versioning.mjs` (run via
  `bun run verify:publish`).

Consumer-facing docs: [`docs/setup/publishing.md`](docs/setup/publishing.md)
and the "Versioning Policy" section in [`README.md`](README.md).

Rule file: [`.cursor/rules/release-version-alignment.mdc`](.cursor/rules/release-version-alignment.mdc).

### Ticket comment discipline

When posting to Jira / Confluence / GitHub on the user's behalf, keep
comments brief and scoped to the current work. No sub-ticket asks,
process recommendations, or unsolicited next-steps unless the user
directed it — ask first if you think something is worth raising.

Rule file: [`.cursor/rules/ticket-comment-discipline.mdc`](.cursor/rules/ticket-comment-discipline.mdc).

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
