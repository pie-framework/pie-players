# Agent Instructions

Use this file as the single project guidance entry point for agent tools.
This file contains the repo's project brief, canonical rules, and the inventory
of project skills and commands.

Do not duplicate this guidance into harness-specific rule files — no
`.cursor/rules`, `.github/copilot-instructions.md`, `GEMINI.md`, or equivalent.
Anything that needs project rules reads this file; a harness that cannot should
get a pointer to it, never a copy. Copies drift silently and the drift is only
discovered when two agents give contradictory answers.

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

### Downstream Consumer Impact

`docs/integrations/consumer-api-dependencies.md` records which `@pie-players`
surfaces real downstream hosts touch, and which of those break silently.

- Consult it before changing any public surface: custom-element tag names,
  attributes, properties, DOM events and their `bubbles`/`composed` init, event
  payload shapes and emission cardinality, controller and coordinator methods,
  `runtime` / `hooks` config keys, `--pie-*` tokens, package `exports`, or
  `dist` filenames. Its "Change-risk quick reference" is the short version.
- Consumers are identified by integration shape only. This repository is
  public and those hosts are not, so do not add repository names, product
  names, ticket keys, endpoints, tenant or customer detail, host config key
  names, or quoted host code to that file or anywhere else in `docs/`.
- Treat the pad as observed usage with a verification date, not as a contract.
  Confirm a row against the cited code before relying on it, and refresh it
  with the procedure at the end of the file rather than editing rows in place.
- A surface listed there is not frozen. Change it when the design calls for it,
  and say in the changeset and PR description which listed host is affected and
  how, so the coordination is visible instead of discovered on upgrade.
- A surface only the internally-controlled consumer touches is not a constraint
  at all. Change it and fix that consumer in the same push; never narrow a
  design to spare it.
- To refresh, extend, or add a consumer to the pad, follow
  `docs/integrations/consumer-api-dependencies-maintenance.md`. That file is the
  procedure for every harness and for doing it by hand: it carries the redaction
  rule, how to resolve consumer checkout paths — including asking the developer
  for any it cannot find, rather than auditing a silent subset — and the rules
  for rewriting the risk groups. Do not improvise a refresh, and do not copy the
  procedure into a harness-specific file; the Claude Code skill and command of
  the same name are thin wrappers over it.
- `bun run check:consumer-pad` enforces this independently of any agent harness.
  It compares the branch against its merge-base with `origin/develop` and fails
  when a curated set of surface-defining files changed and the pad did not. It
  runs inside `verify:ci-lint-typecheck`, so it reaches the full local PR gate
  and CI. A trigger file whose change is *provably* semantically null — JSON that
  parses identically, source with the same normal form under biome's formatter —
  is discounted and named in the output; every case it cannot prove counts as a
  change. Satisfy it by updating the pad; when the pad genuinely still reads
  true, record why in a commit message trailer instead:

  ```
  Consumer-pad: rows unchanged, <what you checked>
  ```

  Reaching for the trailer routinely means the trigger list in
  `scripts/check-consumer-pad.mjs` is too wide — narrow it there rather than
  normalizing the override. `PIE_CONSUMER_PAD_OVERRIDE="<reason>"` exists for a
  one-off local run and is not a substitute for the trailer.

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
Chromium inside a default agent tool sandbox.

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

It reaches that gate through `scripts/pre-push-gate.mjs`, which skips it when the
push carries no new commits — creating a branch at a commit already on the remote,
or deleting a ref, transfers nothing for the gate to validate. Every uncertain
case still runs the gate, so this only ever removes provably wasted work. Do not
reach for `--no-verify` when a push feels like it should have been skipped: report
the case instead, because a skip the wrapper misses is a bug in
`scripts/lib/push-scope.mjs`.

Note that lefthook's own `push_files` filtering is not a substitute: it is derived
from the current branch against its upstream, not from the refs actually being
pushed, so it runs the gate for a `git push origin <sha>:refs/heads/other` that
introduces nothing.

### Git Worktrees

A fresh worktree needs `bun install` **and** `bun run build` before any gate
passes. Nothing hoists from the main checkout: without `node_modules` every gate
fails on a missing binary, and without build artifacts `bun run check` fails with
`TS2307: Cannot find module '@pie-players/pie-players-shared'` from packages that
resolve a workspace sibling through its published `exports`.

A worktree path must not contain a path segment named `node_modules`, `build`,
`dist`, `.turbo`, `.svelte-kit`, `playwright-report`, or `test-results`. Those
are the unanchored `!**/…` entries in `biome.json`'s `files.includes`, and biome
matches them against the absolute path — so they also match every *ancestor* of
the project root. A worktree under such a segment excludes itself: `biome lint .`
reports "these paths were provided but ignored: ." and **exits 0**, so `bun run
verify:pre-commit` passes having linted nothing.

`.claude` is absent from that list because its entry is anchored (`!.claude`,
not `!**/.claude`), which is what makes `.claude/worktrees/<name>` — where
agent tooling creates worktrees by default — lintable. Keep it anchored. The
rationale cannot live in `biome.json` itself: biome rejects comments in a config
named `.json` and falls back to defaults with no error, reproducing the same
zero-files failure.

A `bun install` in a worktree rewrites the shared `.git/hooks`. `lefthook
install` bakes an absolute path to the `node_modules` it ran from into the
generated scripts, so the hooks every checkout shares end up pointing into a
directory that is about to be deleted. Two things trigger it, and only one is
ours: the `prepare` lifecycle script, and the `lefthook` npm package's own
`postinstall`, which runs `lefthook install -f` on every install and cannot be
configured off from here.

`.lefthookrc` is what makes the rewrite harmless. It resolves `LEFTHOOK_BIN`
from `--git-common-dir` — the main checkout, the one guaranteed to have
`node_modules` — and the generated hook consults `LEFTHOOK_BIN` before the baked
path, so the stale path is never reached. The protection holds only while the
hooks carry the `rc: ./.lefthookrc` line, which means it does not survive an
install from a branch predating `.lefthookrc` (a8ab15a0). Repair after one:
`bun run prepare` from the main checkout, which is also what to run after
editing `.lefthookrc` or `lefthook.yml`.

`scripts/install-git-hooks.mjs` is the `prepare` entry point and skips any
linked worktree, so `prepare` no longer contributes to the rewrite. It does not
prevent it — lefthook's `postinstall` still fires — so treat the shared hooks as
something any worktree install may have touched.

## Skills And Commands

Canonical project skills and commands live in `.claude/skills/` and
`.claude/commands/`. Do not duplicate them into other harnesses' files or
replace them with symlinks. Where a skill carries a procedure that a person or
another harness would also need, the procedure belongs in `docs/` with the skill
as a thin wrapper over it — `consumer-dependency-audit` is the pattern.

Skills:

- `accessibility-reviewer-assessments` — WCAG 2.2 AA and assessment-specific
  accessibility review for player UI.
- `api-design-reviewer` — public API, package export, custom-element, event,
  slot, and cross-package contract review.
- `ce-package-packaging` — custom-element package entrypoints, exports, build
  artifacts, and preflight workflow.
- `consumer-dependency-audit` — trigger coverage and Claude-side mechanics for
  `docs/integrations/consumer-api-dependencies-maintenance.md`, which owns the
  procedure.
- `grill-with-docs` — opt-in design grilling with terminology/ADR capture.
- `loop-review-agents` — opt-in repeated three-agent review loop with consensus
  thresholds and churn control.
- `prd-author` — draft or update PIE Players PRDs under `docs/prds/`.
- `releases-and-changesets` — lockstep release and changeset workflow.

Commands:

- `consumer-dependency-audit` — invoke the `consumer-dependency-audit` skill,
  optionally scoped to one consumer label or one surface.
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

For changes to the toolkit core, the policy engine or a player, also run:

```sh
bun run check:capability-neutrality
bun run check:player-tool-boundaries
```

For release work, follow `docs/setup/publishing.md` and the release alignment
rule in this file.

Lint catches errors, not style. `biome.json` runs `preset: "none"` with only the
`correctness` and `suspicious` presets on and no `style` group at all. Do not add
`style`, `complexity`, `performance`, or naming and filename conventions, and do
not gate `biome format` — most code here is agent-written, so cosmetic uniformity
costs review attention without buying correctness. A rule that fires only on false
positives gets turned off rather than suppressed site by site;
`noTemplateCurlyInString` is off because `${{…}}` is PIE math template syntax in
content fixtures.

Nothing currently stops a type-only import being emitted as a runtime import:
`useImportType` was the last `style` rule and went with the group, and the
tsconfigs set `isolatedModules` but not `verbatimModuleSyntax`, which does not
cover it. Setting `verbatimModuleSyntax: true` in `tsconfig.base.json` moves the
guard to the compiler, where it is a typecheck error rather than a style rule —
measured at zero violations repo-wide on 2026-08-16, so it is available whenever
the bundling risk is judged worth a hard error.

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
  Generic core: it knows `featureId`, placement levels, activation kinds and
  precedence, and names no capability. `bun run check:capability-neutrality`
  enforces that.
- `packages/default-tool-loaders` - composition layer: which capabilities a
  deployment has, their tag map, placement presets, universal supports and lazy
  module loaders. The only place a packaged capability set is named.
- `packages/players-shared` - shared utilities, sanitizer, and PIE config.
- `packages/pie-context` - shared runtime context.
- `packages/theme` - theme token contract, `<pie-theme>`, colour schemes, and the
  DaisyUI provider adapter.
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
