# PIE Players — Project Instructions

## Project Context

**PIE Players** is a Bun + Svelte 5 monorepo that ships the player framework for
PIE (Portable Interactions and Elements) — section / item / assessment / print
players, the assessment toolkit, the tool/toolbar set, theming, and the TTS
server stack — as a cohesive `@pie-players/*` suite consumed via custom
elements.

**Critical requirements**:

- **WCAG 2.2 Level AA** — mandatory for all UI components.
- **Bun runtime** — pinned in `package.json` `packageManager` / `engines.bun`.
  Node.js is **not** used for repo scripts.
- **Svelte 5 with runes** — modern reactive patterns required.
- **Mixed shadow strategy** — both `shadow: "open"` and `shadow: "none"`
  custom elements coexist by design.
- **Fixed (lockstep) versioning** — every release bumps every publishable
  `@pie-players/*` package together (see
  [`.cursor/rules/release-version-alignment.mdc`](../.cursor/rules/release-version-alignment.mdc)).

## Authoritative invariants

The authoritative source for project rules is [`AGENTS.md`](../AGENTS.md) and
the always-applied rules in [`.cursor/rules/`](../.cursor/rules/). This file is
a project brief — it does not re-state those invariants. Skim
[`AGENTS.md`](../AGENTS.md) first when starting work.

The high-stakes invariants you are most likely to break, with one-liner and
canonical rule:

- **PIE element/tag/id contract** — never strip `--version-*` suffixes on
  `pie-*` tags, never mutate `id` / `model-id` / `session-id`. See
  [`.cursor/rules/pie-element-versioning.mdc`](../.cursor/rules/pie-element-versioning.mdc).
- **Custom-element import boundaries** — consumers import built `dist`
  registration entrypoints, never `src/...` or `?customElement`. See
  [`.cursor/rules/custom-elements-boundaries.mdc`](../.cursor/rules/custom-elements-boundaries.mdc).
- **Legacy compatibility** — only the `pie-item` client contract is an allowed
  compatibility surface; every exception needs an inline
  `pie-item contract compatibility: <reason>` comment plus a covering test.
  See
  [`.cursor/rules/legacy-compatibility-boundaries.mdc`](../.cursor/rules/legacy-compatibility-boundaries.mdc).
- **Svelte subscription safety** — `$effect` is wiring-only; reactive setup
  goes through `untrack(...)`; subscriptions are idempotent on
  `sectionId`/`attemptId`. See
  [`.cursor/rules/svelte-subscription-safety.mdc`](../.cursor/rules/svelte-subscription-safety.mdc).
- **Build before tests** — rebuild the changed package and direct `dist`
  consumers before running tests that exercise the CE entrypoint. See
  [`.cursor/rules/build-before-tests.mdc`](../.cursor/rules/build-before-tests.mdc).
- **Playwright outside the sandbox** — `git push`, `bun run test:e2e:*`, and
  `bunx playwright …` MUST be invoked with `required_permissions: ["all"]`.
  See
  [`.cursor/rules/playwright-sandbox.mdc`](../.cursor/rules/playwright-sandbox.mdc).
- **Fixed versioning** — release/versioning steps always cover **all**
  publishable packages; never scope a bump to "only the packages I changed".
  See
  [`.cursor/rules/release-version-alignment.mdc`](../.cursor/rules/release-version-alignment.mdc).
- **Code review** — substantial change sets get three independent review
  passes merged into one response; unreconcilable disagreement stops and asks
  the user. See
  [`.cursor/rules/code-review-workflow.mdc`](../.cursor/rules/code-review-workflow.mdc).
- **Ticket comment discipline** — Jira / Confluence / GitHub comments stay
  brief and on-scope. See
  [`.cursor/rules/ticket-comment-discipline.mdc`](../.cursor/rules/ticket-comment-discipline.mdc).

## Skills

Project skills are kept in lockstep across two folders:

- [`./skills/`](./skills/) — Claude Code skills.
- [`../.cursor/skills/`](../.cursor/skills/) — Cursor skills (byte-identical).

When you edit a skill, edit both copies in the same change. Each skill's body
links to its canonical `.cursor/rules/*.mdc` file rather than re-stating the
rule.

## Technology Stack

- **Runtime**: Bun (pinned in root `packageManager`).
- **UI framework**: Svelte 5 with runes (compiled to native custom elements).
- **Build**: Vite 8 + Turbo for monorepo orchestration.
- **Tests**: `bun test` for unit/component, Playwright 1.59+ for e2e (with
  `@axe-core/playwright` for accessibility checks).
- **Lint/format**: Biome 2.x.
- **Type checking**: TypeScript 5.9 strict + `svelte-check`.
- **Versioning**: Changesets with `fixed` block (lockstep).

## Monorepo Structure

```text
pie-players/
├── packages/
│   ├── section-player/                  # Section delivery (multi-item)
│   ├── item-player/                     # Single-item delivery
│   ├── assessment-player/               # Multi-section assessment delivery
│   ├── print-player/                    # Item-level print rendering
│   ├── assessment-toolkit/              # Core assessment services + components
│   ├── players-shared/                  # Shared utilities, sanitizer, PIE config
│   ├── pie-context/                     # Shared runtime context
│   ├── theme/                           # Token contract (--pie-* CSS vars)
│   ├── theme-daisyui/                   # DaisyUI theme bridge
│   ├── toolbars/                        # Item / section toolbar shells
│   ├── default-tool-loaders/
│   ├── tool-*                           # 12 tool packages (calculator,
│   │                                    # graph, ruler, protractor, TTS, …)
│   ├── section-player-tools-*           # Debugger / inspector tools
│   ├── tts/                             # TTS client
│   ├── tts-client-server/
│   └── tts-server-{core,google,polly,sc}/
├── apps/
│   ├── docs/                            # Documentation site
│   ├── section-demos/                   # Section demo host (default `dev`)
│   ├── item-demos/
│   ├── assessment-demos/
│   └── local-esm-cdn/                   # Local ESM CDN for sibling pie-elements-ng
└── tools/
    └── cli/                             # oclif-based CLI
```

## Daily commands

```bash
bun install
bun run dev               # turbo dev for section-demos
bun run build             # build all publishable packages (excludes apps/tools)
bun run typecheck
bun run check             # svelte-check across packages
bun run test              # turbo test (unit / component)
bun run lint              # Biome lint + svelte-check
bun run lint:fix          # Biome --write
bun run format            # Biome format --write
```

E2E (always invoke with `required_permissions: ["all"]` so Playwright runs
outside the sandbox):

```bash
bun run test:e2e:section-player
bun run test:e2e:item-player
bun run test:e2e:assessment-player
bun run test:e2e:a11y:critical
```

CE-touching change pre-flight:

```bash
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
```

Larger-change verification pipeline:

```bash
bun install && bun run build && bun run typecheck && bun run test && bun audit
```

Release verify (publish gating):

```bash
bun run verify:publish
```

## Player architecture

Four player packages live under `packages/`:

1. **`section-player`** — multi-item section delivery; the daily-driver player
   for authoring tools and the `dev` script.
2. **`item-player`** — single-item delivery with a thin host shell.
3. **`assessment-player`** — multi-section assessment delivery; coordinates
   sections, attempt state, and tool surfaces.
4. **`print-player`** — item-level print rendering for production use.

A single PIE item can be loaded via several CDN/bundle strategies (IIFE, ESM,
preloaded) — these are deployment surfaces of the players above, not separate
packages.

### Web component patterns

- **Mixed shadow mode** — prefer `shadow: "open"` for encapsulated tool/runtime
  components; use `shadow: "none"` where host/page styles must cascade into
  rendered assessment content (e.g. layout wrappers).
- **Custom elements** are the API: set properties, not attributes. For
  model/session updates, reassign new objects to trigger reactivity.
- **Versioned tag names** are part of the authored content contract; see
  [`.cursor/rules/pie-element-versioning.mdc`](../.cursor/rules/pie-element-versioning.mdc).

### Theming contract

- `--pie-*` CSS variables are the stable theming contract across both
  `shadow: "open"` and `shadow: "none"` CEs.
- Canonical schemes ship from `@pie-players/pie-theme`; consumers use exported
  scheme APIs (e.g. `listPieColorSchemes`) instead of duplicating catalogs.
- Theme merge order: base theme (`light` / `dark` / `auto`) → provider
  variables → color-scheme variables → explicit overrides.

## Sibling repository dependency

This project relies on `pie-elements-ng` being checked out as a sibling
directory for local development and testing.

```text
<parent-directory>/
├── pie-elements-ng/                   # Sibling repo (REQUIRED for dev)
│   └── apps/local-esm-cdn/            # Local ESM CDN server
└── pie-players/                       # This repo
    └── apps/section-demos/            # Auto-detects sibling
```

When `../pie-elements-ng` exists:

- The Vite plugin auto-loads from
  `pie-elements-ng/apps/local-esm-cdn/dist/adapters/vite.js`.
- Start the local ESM CDN with `bun run local-esm-cdn`.
- HMR triggers on `pie-elements-ng/dist` changes.

If the sibling is missing, the demo apps fall back to the remote ESM CDN. The
project still functions — you just can't test against locally edited elements.

References: `apps/section-demos/vite.config.ts`, `docs/cdn_usage.md`.

## Code-quality cycle

After completing each feature or fix:

1. `bun run lint:fix` (Biome auto-fix).
2. `bun run typecheck`.
3. `bun run check` (svelte-check).
4. `bun run test`.
5. For CE-touching work, also run the three pre-flight checks above.

Before any merge:

1. `bun run lint:all` (full lint surface).
2. `bun run test` and the relevant `bun run test:e2e:*` (with
   `required_permissions: ["all"]`).

## Current focus

The framework is production-grade. Maintain WCAG 2.2 AA compliance, the
custom-element contract, and the lockstep release invariant when shipping
changes.
