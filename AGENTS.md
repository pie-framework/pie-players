# Agent Instructions

Use this file as the single project guidance entry point for agent tools.
This file contains the repo's project brief, canonical rules, and the inventory
of project skills and commands. Do not duplicate this guidance into Cursor
rules, Cursor skills, or Cursor commands.

## Project Context

PIE Players is a Bun + Svelte 5 monorepo that ships the player framework for
PIE (Portable Interactions and Elements): section, item, assessment, and print
players; the assessment toolkit; tools and toolbars; theming; and the TTS
server stack. The publishable packages are consumed as a cohesive
`@pie-players/*` custom-element suite.

Critical requirements:

- WCAG 2.2 Level AA for UI work.
- Bun for repo scripts; do not substitute Node/npm commands.
- Svelte 5 runes and native custom elements.
- Mixed `shadow: "open"` and `shadow: "none"` strategy by design.
- Fixed lockstep release versioning for all publishable `@pie-players/*`
  packages.

## Canonical Rules

### PIE Element Versioning And Tag/ID Contract

Versioned `pie-*--version-*` tag names are authored content contracts. They are
an effective per-version namespace in the browser: a `CustomElementRegistry`
definition cannot be replaced, so each simultaneously loaded version must be
registered under its own distinct tag.

- Preserve the `--version-<encoded>` suffix in authored input, registries, and
  logs. When a host deliberately substitutes a package version (for example,
  the preloaded strategy selecting its bundled version), update the tag only on
  the cloned runtime config; never mutate the caller's authored config.
- Keep the existing version encoder stable. Do not add alternate encodings or
  content migrations for theoretical lossy prerelease-encoding collisions;
  those collisions are intentionally outside the supported practical scope.
- Do not compare rendered PIE elements against a non-versioned base tag. Compare
  the full tag after `makeUniqueTags` in
  `packages/players-shared/src/pie/config.ts`.
- Authoring-mode variants (`pie-*-config`) are versioned the same way.
- Treat `id` on `pie-*` elements as a contract key. `updateSinglePieElement` in
  `packages/players-shared/src/pie/updates.ts` uses strict
  `config.models[].id === pieElement.id` matching.
- Do not prefix, slug, case-change, or otherwise mutate `id`, `model-id`,
  `session-id`, `slot`, `data-*`, `aria-*`, `pie-*`, `config-*`, or
  `context-*`.
- Keep `SANITIZE_DOM: true` for DOM-clobbering defense and keep
  `SANITIZE_NAMED_PROPS: false`; enabling named-prop sanitization prefixes IDs
  and breaks model lookup.
- Use DOMPurify custom-element handling for versioned PIE tags and contract
  attributes. Do not fall back to generic allow-lists that drop unknown tags.
- Reject alias maps that collapse versioned tags back to base tags, regex
  cleanups that strip version suffixes, any sanitizer/transformer that mutates
  contract IDs, and attempts to replace an already registered PIE tag. Load a
  different version by defining its distinct versioned tag instead.

### Custom Element Import And Packaging Boundaries

- In consuming apps/packages, import custom-element registration entrypoints
  such as `@pie-players/pie-assessment-toolkit/components/item-toolbar-element`.
- Do not import workspace package source paths from consumers
  (`@pie-players/<pkg>/src/...`).
- Do not use `?customElement` in cross-package imports.
- Use `pie-*` class names or `data-pie-*` hooks for component DOM hooks and
  selectors. Avoid generic class names like `header`, `content`, `container`,
  `card`, `pane`, `toolbar`, `body`, and `active` in custom-element
  markup/styles.
- For light-DOM custom elements (`shadow: "none"`), treat classes as public API
  and avoid dependencies on host/global utility class names.
- Keep package `exports` runtime targets on built `dist` artifacts unless there
  is an explicit documented exception.
- If a CE registration entry imports `*.svelte?customElement`, ensure the
  referenced `.svelte` files are available from publish/build output paths.
- Consumer imports of package CE entrypoints resolve to built `dist` output.
  After changing package `src`, rebuild the changed package and direct `dist`
  consumers before validating in a consumer app or tests.
- If a failure may be stale-artifact related, rebuild and rerun once before
  deeper debugging.
- For split-panel scrolling behavior, mirror
  `packages/section-player/src/components/layouts/SplitPanelLayout.svelte`
  unless intentionally redesigning: constrained parent layout, constrained split
  grid, scrollable panes with `min-height: 0`, `min-width: 0`, and contained
  vertical overflow.
- Before finalizing CE-related changes, run:
  `bun run check:source-exports`, `bun run check:consumer-boundaries`, and
  `bun run check:custom-elements`.

### Legacy Compatibility Boundaries

- Do not add legacy/backward-compatibility shims outside the `pie-item` client
  contract surface.
- Disallow alias maps for old IDs, dual event names, deprecated config bridges,
  fallback payload normalizers, and duplicate dispatch paths kept only for older
  consumers by default.
- The only allowed exception is preserving externally consumed `pie-item` client
  contract behavior.
- Every allowed exception needs an inline
  `pie-item contract compatibility: <reason>` comment and covering tests.
- Do not add compatibility layers for internal toolkit, telemetry, config, or
  demo-only APIs without an explicit maintainer-approved exception documented in
  the same change.
- Prefer canonical single-path implementations when compatibility can be removed
  without breaking the `pie-item` client contract.
- If uncertain, default to removing legacy behavior and request maintainer
  clarification only for potential `pie-item` contract impact.

### Svelte Subscription Safety

- Treat `$effect` as wiring-only: setup/teardown subscriptions and observers,
  but avoid directly mutating reactive UI state inside tracked effect bodies.
- If setup must call logic that reads/writes reactive state, wrap it in
  `untrack(() => { ... })`.
- Make subscription setup idempotent: if `sectionId`/`attemptId` target did not
  change and a subscription exists, return early.
- Prefer stable key comparison (`sectionId`, `attemptId`) over object identity
  when checking whether to resubscribe.
- For lifecycle-triggered resubscribe, queue with `queueMicrotask` to prevent
  synchronous re-entrant update chains.
- On `"disposed"` lifecycle events, explicitly detach current subscriptions
  before queueing a rebind.

Quick pattern:

```ts
$effect(() => {
  void sectionId;
  void attemptId;
  untrack(() => {
    ensureSubscription();
    setupLifecycleListener();
  });
  return () => teardownAll();
});
```

### Release Version Alignment

All publishable `@pie-players/*` packages are released with a fixed lockstep
version. At any published version, every package in the suite carries the same
version. The source of truth is the `fixed` block in `.changeset/config.json`.

- Every release is a `patch` bump until the maintainer explicitly changes this
  policy, even for breaking changes on the pre-1.0 line.
- Author every changeset entry as `patch`; pending `minor` or `major`
  changesets are release blockers.
- Release/versioning steps cover all publishable packages. Never scope a release
  bump to "only the packages I changed."
- When adding a publishable package under `packages/*`, add it to the
  Changesets `fixed` block in the same change.
- Do not remove packages from the `fixed` block to unblock a release.
- Use `bun run release:with-version` for local publishing. Do not run
  `npm publish` or `bun run release` directly.
- Local publishing uses the current checkout and branch unless the user
  explicitly asks to switch or use a workflow.
- NPM auth is loaded from `.env` via `dotenvx`; no separate `npm login` is
  needed when `.env` contains a valid token.
- If a release fails after `bun run version` mutates package files, do not rerun
  `release:with-version`; follow `docs/setup/publishing.md`.
- Because release verification can trigger Playwright, invoke local publish with
  `required_permissions: ["all"]`.

### Playwright And Sandboxed Execution

Playwright cannot reliably install browsers, spawn dev servers, or launch
Chromium inside the default Cursor tool sandbox.

When running any command that may invoke Playwright, request
`required_permissions: ["all"]` so it runs outside the sandbox and can reuse the
shared browser cache.

This applies to:

- Any `bun run test:e2e:*` script.
- `bunx playwright ...` / `bun playwright ...`.
- Playwright helper scripts, screenshot capture, or ad-hoc DOM verification.
- `bun run test` / `bun test` in packages whose tests include Playwright specs.
- `bun run verify:local-pr`, because it runs the full local lint/typecheck gate
  plus the critical Playwright e2e suites.

The default `git push` pre-push hook runs `bun run verify:pre-push`, which is
expected to run the full local PR gate and critical Playwright e2e suites.

## Skills And Commands

Canonical project skills and commands live in `.claude/skills/` and
`.claude/commands/`. Do not duplicate them into Cursor files or replace them
with symlinks.

Skills:

- `accessibility-reviewer-assessments` — WCAG 2.2 AA and assessment-specific
  accessibility review for player UI.
- `api-design-reviewer` — public API, package export, custom-element, event,
  slot, and cross-package contract review.
- `ce-package-packaging` — custom-element package entrypoints, exports, build
  artifacts, and preflight workflow.
- `grill-with-docs` — opt-in design grilling with terminology/ADR capture.
- `loop-review-agents` — opt-in repeated three-agent review loop with consensus
  thresholds and churn control.
- `prd-author` — draft or update PIE Players PRDs under `docs/prds/`.
- `releases-and-changesets` — lockstep release and changeset workflow.

Commands:

- `grill-with-docs` — invoke the `grill-with-docs` skill with optional plan
  context.
- `loop-review-agents` — invoke the `loop-review-agents` skill with optional
  review target context.

## High-Value Checks

For custom-element packaging or consumer-boundary changes, run:

```sh
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
```

For release work, follow `docs/setup/publishing.md` and the release alignment
rule in this file.

## Technology Stack

- Runtime: Bun
- UI: Svelte 5 with runes, compiled to custom elements
- Build: Vite + Turbo
- Tests: `bun test`, Playwright, `@axe-core/playwright`
- Lint/format: Biome
- Type checking: TypeScript strict + `svelte-check`
- Versioning: Changesets fixed block

## Monorepo Map

- `packages/section-player` - multi-item section delivery.
- `packages/item-player` - single-item delivery.
- `packages/assessment-player` - multi-section assessment delivery.
- `packages/print-player` - item-level print rendering.
- `packages/assessment-toolkit` - shared assessment services and components.
- `packages/players-shared` - shared utilities, sanitizer, and PIE config.
- `packages/pie-context` - shared runtime context.
- `packages/theme*` - theme token contract and bridges.
- `packages/tool-*` and `packages/section-player-tools-*` - runtime tools.
- `packages/tts*` - TTS client and server packages.
- `apps/*-demos`, `apps/docs`, `apps/local-esm-cdn` - local hosts and docs.
- `tools/cli` - oclif-based CLI.

## Local PIE Elements

For local development, this repo can use a sibling `../pie-elements-ng`
checkout. When present, demo apps can load its local ESM CDN adapter; otherwise
they fall back to the remote ESM CDN.

## Current Focus

The framework is production-grade. Preserve accessibility, the custom-element
contract, and lockstep release behavior when shipping changes.
