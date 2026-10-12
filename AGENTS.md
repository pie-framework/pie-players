# Agent Instructions

This file is the single project guidance entry point for agent tools: the project
brief, the canonical rules, and the inventory of project skills. Any
harness that needs project rules reads it. One that cannot gets a pointer file,
never a copy in `.cursor/rules`, `.github/copilot-instructions.md`, `GEMINI.md` or
an equivalent, because copies drift silently until two agents give contradictory
answers. `.claude/CLAUDE.md` is that pointer for Claude Code.

## Project Context

PIE Players is a Bun + Svelte 5 monorepo that ships the player framework for PIE
(Portable Interactions and Elements): section, item, assessment and print players;
the assessment toolkit; tools and toolbars; theming; and the TTS server stack. The
publishable packages are consumed as a cohesive `@pie-players/*` custom-element
suite.

Critical requirements:

- WCAG 2.2 Level AA for UI work.
- Bun for repo scripts; do not substitute Node/npm commands.
- Svelte 5 with runes, compiled to native custom elements.
- Mixed `shadow: "open"` and `shadow: "none"` strategy by design.
- Fixed lockstep release versioning for all publishable `@pie-players/*` packages.

Stack: Bun; Svelte 5 with runes; Vite and Turbo; `bun test`, Playwright and
`@axe-core/playwright`; Biome; TypeScript strict and `svelte-check`; Changesets with
a fixed block.

The building blocks (item player, section player, assessment toolkit, theme, tools,
print player) are production-grade: changes to them preserve accessibility, the
custom-element contract and lockstep release behaviour. The assessment player and
demo apps are reference assemblies
([product scope](docs/architecture/architecture.md#product-scope)): effort goes to
the building blocks, and a gap a custom player would hit is fixed there.

## Canonical Rules

### Design Principles

These govern how a new surface is shaped, and they outrank convenience.

- **Internal consistency first.** Before designing an interface, find where this
  framework already solves the same problem, and match it. Two packages solving one
  problem two ways is a defect even when both work: the calculator contract's
  vendor-config type parameter had to go because `pie-tts` did the same job with
  plain interface extension. Where no precedent exists, the shape you choose becomes
  one, so choose it as a precedent.
- **Tight, non-leaky interfaces.** A contract package exposes what a consumer needs
  to call and nothing about who implements it. Provider knowledge belongs in the
  adapter that owns it: `pie-calculator` names no vendor, and `pie-calculator-desmos`
  owns every Desmos type. A consumer of a contract never has to reach past it to a
  concrete implementation, and a contract's published declarations never drag an
  implementation's package in behind them.
- **Lean and focused.** Prefer the smaller surface. Delete a parameter, an export or
  an abstraction that constrains nothing (an unenforced generic, a re-export nothing
  can import, a mirror type nothing checks) instead of documenting why it is
  harmless. Abstraction earns its place by a need that exists now.
- **A published entry describes what it delivers.** Type entries, `exports` maps and
  declarations are promises to a consumer; a promise the runtime cannot keep is a
  defect even where nothing has called it yet.

### PIE Element Versioning And Tag/ID Contract

Versioned `pie-*--version-*` tag names are authored content contracts. A
`CustomElementRegistry` definition cannot be replaced, so each simultaneously loaded
version registers under its own distinct tag.

- Preserve the `--version-<encoded>` suffix in authored input, registries and logs.
  When a host deliberately substitutes a package version (the preloaded strategy
  selecting its bundled version, for one), update the tag on the cloned runtime config
  only; never mutate the caller's authored config.
- Keep the version encoder stable. Theoretical lossy prerelease-encoding collisions
  are outside the supported scope, so they get no alternate encodings and no content
  migrations.
- Compare rendered PIE elements by the full tag after `makeUniqueTags` in
  `packages/players-shared/src/pie/config.ts`, never against a non-versioned base tag.
- Authoring-mode variants (`pie-*-config`) are versioned the same way.
- `id` on a `pie-*` element is a contract key: `updateSinglePieElement` in
  `packages/players-shared/src/pie/updates.ts` matches
  `config.models[].id === pieElement.id` strictly. Never prefix, slug, case-change or
  otherwise mutate `id`, `model-id`, `session-id`, `slot`, `data-*`, `aria-*`,
  `pie-*`, `config-*` or `context-*`.
- Keep `SANITIZE_DOM: true` for DOM-clobbering defence and `SANITIZE_NAMED_PROPS:
  false`, because named-prop sanitization prefixes IDs and breaks model lookup.
- Sanitize versioned PIE tags and contract attributes with DOMPurify's custom-element
  handling; a generic allow-list drops unknown tags.
- Reject alias maps that collapse versioned tags back to base tags, regex cleanups
  that strip version suffixes, any sanitizer or transformer that mutates contract IDs,
  and any attempt to replace an already registered PIE tag. Load a different version
  by defining its distinct versioned tag.

`bun run check:ce-define-safety` routes every registration through
`defineCustomElementSafely`, which leaves an existing definition in place, and fails
when one literal tag is defined in two files.

### Custom Element Import And Packaging Boundaries

- Consuming apps and packages import custom-element registration entrypoints such as
  `@pie-players/pie-assessment-toolkit/components/item-toolbar-element`. They never
  import workspace source paths (`@pie-players/<pkg>/src/...`) and never use
  `?customElement` in a cross-package import.
- Component DOM hooks and selectors use `pie-*` class names or `data-pie-*` hooks.
  Generic class names such as `header`, `content`, `container`, `card`, `pane`,
  `toolbar`, `body` and `active` stay out of custom-element markup and styles.
- In a light-DOM custom element (`shadow: "none"`), classes are public API, and the
  element depends on no host or global utility class names.
- Package `exports` runtime targets point at built `dist` artifacts unless there is
  an explicit documented exception.
- If a CE registration entry imports `*.svelte?customElement`, ensure the referenced
  `.svelte` files are available from publish/build output paths.
- Consumer imports of package CE entrypoints resolve to built `dist` output. After
  changing package `src`, rebuild the changed package and its direct `dist` consumers
  before validating in a consumer app or an e2e suite; unit tests need no rebuild
  ([Unit Test Resolution](#unit-test-resolution)). When a failure may be
  stale-artifact related, rebuild and rerun once before deeper debugging.
- Split-panel scrolling mirrors
  `packages/section-player/src/components/PieSectionPlayerSplitPaneElement.svelte`
  unless the change is a deliberate redesign: constrained parent layout, constrained
  split grid, scrollable panes with `min-height: 0` and `min-width: 0`, and contained
  vertical overflow.
- `api-report/` lists the exported names of every entry of each published package.
  `bun run check:api-report` fails when an entry's exports change until
  `bun run api-report` regenerates the report, so every surface change is a reviewed
  diff in the report.
- Each published package that registers an element commits a `custom-elements.json`.
  `bun run custom-elements-manifest` regenerates it, and
  `bun run check:custom-elements-manifest` fails on a stale one or on an event, slot
  or part the element's doc comment leaves out (`@fires`, `@slot`, `@csspart`; the
  `ce-package-packaging` skill has the format).

Before finalizing a custom-element packaging or consumer-boundary change, run
`bun run check:source-exports`, `bun run check:consumer-boundaries` and
`bun run check:custom-elements`, then `bun run check:custom-elements:dist` after a
build.

### Decision Records

`docs/adr/` holds one file per decision that is hard to reverse or surprising without
its context. `docs/adr/README.md` sets the bar and the numbering. Records are
append-only: a superseded one keeps its number and gains a `Superseded by` line
instead of being edited into agreement.

Rules from those records bind new code directly. From ADR 0002:

- A public interface takes no type parameter that appears only in argument position.
  TypeScript compares method parameters bivariantly, so such a parameter constrains no
  implementor while every implementor and annotation site has to carry it. An adapter
  extends the contract's config interface and narrows the argument in its own class
  signature, which is where a caller's precision comes from. A parameter in return
  position is checked and stays.
- An optional peer dependency stays out of published declarations. Declaration emit
  preserves `implements` clauses and public return types, so a top-level
  `import type` from an optional peer reaches the published `.d.ts` and makes that
  peer required for any consumer type-checking without `skipLibCheck`. Type the public
  surface with the contract package's own interface and confine the peer to a method
  body.

From ADR 0003, for every host and element:

- An element learns the student's accessibility settings only from the
  `Symbol.for("pie.accessibility")` context, whose key and type
  `@pie-players/pie-context` exports with the first consumer, and never imports
  `@pie-players/pie-assessment-toolkit`. A setting that changes rendering travels
  through that context; `env` keeps the settings that change the model.
- The mapping from a profile to support ids lives in the host, which resolves it
  through the toolkit's policy precedence. An element maps a fixed support id to a
  fixed behavior, because item configs pin element versions and a rule inside an
  element is frozen into each of them.
- The context value only grows: fields are added, never removed or redefined.
  Consumers ignore support ids they do not recognize, and an unanswered request means
  defaults, never a wait for a provider.

From ADR 0004:

- Screen-reader use reaches PIE only as the `screenReader` support id from the profile.
  Nothing detects assistive technology.
- `screenReader` changes only what makes sound: while it is in effect the toolkit
  withholds `textToSpeech` whatever grants it, and the item player sets
  `autoplayAudioEnabled: false` on every model. Markup, math rendering and the
  accessibility tree never branch on it.

### Domain Language

The root `CONTEXT.md` is the shared vocabulary for PIE Players and its runtime hosts:
one tight definition per term, the aliases to avoid, the relationships, and the
resolved ambiguities. Use its terms in code, docs and PRDs.
`docs/architecture/domain-language.md` owns the format and the admission rule: a term
lands when it has been resolved and is worth preserving.

### Downstream Consumer Impact

`docs/integrations/consumer-api-dependencies.md`, the consumer pad, records which
`@pie-players` surfaces real downstream hosts touch, and which of those break
silently. `docs/integrations/consumer-api-dependencies-maintenance.md` owns the
refresh procedure, the redaction rule and the enforcement policy.

- Consult the pad before changing any public surface: custom-element tag names,
  attributes, properties, DOM events and their `bubbles`/`composed` init, event
  payload shapes and emission cardinality, controller and coordinator methods,
  `runtime` / `hooks` config keys, `--pie-*` tokens, package `exports`, or `dist`
  filenames. Its "Change-risk quick reference" is the short version.
- The pad identifies consumers by integration shape only, because this repository is
  public and those hosts are not. Repository and product names, ticket keys,
  endpoints, tenant or customer detail, host config key names and quoted host code
  stay out of the pad and the rest of `docs/`; the maintenance doc's redaction rule
  is the full list.
- The pad is observed usage with a verification date, not a contract. Confirm a row
  against the cited code before relying on it, and change rows only through the
  refresh procedure.
- A listed surface is not frozen. Change it when the design calls for it, and say in
  the changeset and PR description which listed host is affected and how, so the
  coordination is visible before anyone upgrades.
- A surface only the internally-controlled consumer touches is not a constraint at
  all. Change it and fix that consumer in the same push; never narrow a design to
  spare it.
- Refresh, extend or add a consumer only by following the maintenance doc, the
  procedure for every harness and for doing it by hand; never improvise a refresh. It
  asks the developer for any consumer checkout it cannot find instead of auditing a
  silent subset, and owns the rules for rewriting the risk groups. The Claude Code
  skill and command of the same name are thin wrappers over it; copy the procedure
  into no harness-specific file.
- `bun run check:consumer-pad`, in `verify:ci-lint-typecheck`, fails when a curated
  surface-defining file changed against the merge-base with `origin/develop` and the
  pad did not. Satisfy it by updating the pad, or with the
  `Consumer-pad: rows unchanged, <what you checked>` commit trailer the maintenance
  doc defines. A trigger file whose change is provably semantically null (JSON that
  parses identically, source with the same normal form under biome's formatter) is
  discounted and named in the output; every case it cannot prove counts as a change.
  Reaching for the trailer routinely means the trigger list in
  `scripts/check-consumer-pad.mjs` is too wide: narrow it there.
  `PIE_CONSUMER_PAD_OVERRIDE="<reason>"` is for a one-off local run and never
  substitutes for the trailer.

### Theme Token Admission and Stability

`docs/architecture/pie-727-theme-token-inventory.md` owns the full rule under
**Registry admission** and **Token stability**. `bun run check:theme-tokens` fails on
a `--pie-*` name in package source that is neither registered nor allowlisted. The
binding parts:

- A `--pie-*` name earns a `packages/theme/src/token-registry.json` entry when a host
  sets it, or when package documentation tells a host to set it. Every other name gets
  an allowlist line in `scripts/check-theme-tokens.mjs` and nothing else. Existing in
  source is not the test: applied that way, it published seventeen entries on
  2026-08-02 and withdrew sixteen the next day.
- A README that names a token states which side of that line it falls on. Offering a
  token to hosts while leaving it unregistered is the same defect from the other end:
  register it or withdraw the offer.
- Registered names are not renamed or dropped. Reclassifying one narrows a promise a
  host may hold, so it takes the same consumer-pad check as a rename.
- A rendered value changes on a diagnosed accessibility failure or a host-visible
  defect, named in the changeset with the relationship it repairs.
  `packages/theme/tests/theme-definition-contract.test.ts` asserts every base theme
  and all ten schemes come back contrast-clean, so a palette edit that repairs no
  diagnosed failure is changing certified output.
- Prefer an existing canonical token or `--pie-button-*` chain over a new hook. Where
  a component needs one, it matches the nearest in-framework precedent: its fallback
  shape, its scope and its scheme participation.

### Legacy Compatibility Boundaries

Legacy and backward-compatibility shims exist only to preserve externally consumed
`pie-item` client contract behaviour. By default that rules out alias maps for old
IDs, dual event names, deprecated config bridges, fallback payload normalizers and
duplicate dispatch paths kept only for older consumers.

- Every allowed exception carries an inline
  `pie-item contract compatibility: <reason>` comment and covering tests.
- A compatibility layer for an internal toolkit, telemetry, config or demo-only API
  needs an explicit maintainer-approved exception documented in the same change.
- Prefer the canonical single-path implementation wherever compatibility can be
  removed without breaking the `pie-item` client contract. If uncertain, remove the
  legacy behaviour, and ask the maintainer only about potential `pie-item` contract
  impact.

### Svelte Subscription Safety

- Treat `$effect` as wiring-only: set up and tear down subscriptions and observers,
  and do not mutate reactive UI state directly inside tracked effect bodies.
- If setup must call logic that reads or writes reactive state, wrap it in
  `untrack(() => { ... })`.
- Make subscription setup idempotent: if the `sectionId`/`attemptId` target did not
  change and a subscription exists, return early.
- Compare stable keys (`sectionId`, `attemptId`) instead of object identity when
  deciding whether to resubscribe.
- Queue a lifecycle-triggered resubscribe with `queueMicrotask`, which prevents
  synchronous re-entrant update chains.
- On a `"disposed"` lifecycle event, detach the current subscriptions explicitly
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

All publishable `@pie-players/*` packages release at one fixed lockstep version: at
any published version, every package in the suite carries the same version. The
`fixed` block in `.changeset/config.json` is the source of truth, and
`docs/setup/publishing.md` owns the release procedure and its recovery paths.

- Every release is a `patch` bump until the maintainer explicitly changes this policy,
  even for breaking changes, on `0.x` and from 1.0 on alike. Author every changeset entry as
  `patch`; a pending `minor` or `major` changeset is a release blocker.
  `bun run check:changeset-patch-only` enforces this in `verify:pre-commit`,
  `verify:local-pr` and `release:with-version`. The one exception is the `major`
  changeset that opens the 1.0 prerelease line
  ([Prerelease lines](docs/setup/publishing.md#prerelease-lines)).
- Release and versioning steps cover all publishable packages; never scope a bump to
  the packages you changed. `bun run check:fixed-versioning` fails on version drift in
  `verify:publish` and the release workflow.
- A publishable package added under `packages/*` joins the Changesets `fixed` block in
  the same change, and no package leaves the block to unblock a release.
- Publish locally with `bun run release:with-version`, never `npm publish` or
  `bun run release` directly. It publishes from the current checkout and branch
  unless the user explicitly asks to switch or use a workflow, so confirm
  `git branch --show-current` and `git status --short` first. It loads npm auth from
  `.env` through `dotenvx`, so a valid token there needs no `npm login`.
- If a release fails after `bun run version` has mutated package files, do not rerun
  `release:with-version`; follow
  [Retrying a failed local release](docs/setup/publishing.md#retrying-a-failed-local-release).
- Release verification can trigger Playwright, so a local publish runs outside the
  agent sandbox ([Playwright And Sandboxed Execution](#playwright-and-sandboxed-execution)).

### Documentation-Only Changes

A change made only of documentation gets no Jira ticket and no branch or pull request
of its own. `scripts/lib/change-scope.mjs` defines documentation: Markdown and images
under `docs/` and `.agents/`, Markdown at the root, and `.claude/`. Package READMEs and
changesets are not documentation.

- Commit it to `develop` and push. The pre-push gate runs only `check:docs` for such a
  push. `develop` requires status checks, so a direct push needs a maintainer who can
  bypass them; anyone else uses the next option.
- When a pull request is wanted (for review, or for lack of a bypass), collect the
  pending documentation in one `docs/` branch and merge it as one pull request. CI
  runs only `Docs` for it and reports the other required checks as skipped.
- A documentation edit that belongs to a code change stays in that change's branch.

### Playwright And Sandboxed Execution

Playwright cannot reliably install browsers, spawn dev servers or launch Chromium
inside a default agent tool sandbox. Run any command that may invoke Playwright
outside the sandbox, where it can reuse the shared browser cache; in Cursor that is
`required_permissions: ["all"]`. This applies to:

- any `bun run test:e2e:*` script;
- `bunx playwright ...` and `bun playwright ...`;
- Playwright helper scripts, screenshot capture and ad-hoc DOM verification;
- `bun run verify:local-pr`, which runs the full local lint/typecheck gate plus the
  critical Playwright e2e suites.

`bun test` needs no exemption. The two runners stay out of each other's files in both
directions, because Bun discovers `*.spec.ts` and `*.test.ts` and so does Playwright's
default `testMatch`:

- **Bun loads no Playwright spec.** A `bunfig.toml` carrying
  `pathIgnorePatterns = ["**/*.spec.ts"]` keeps them out; `@playwright/test`'s
  `test()` would otherwise throw on the missing worker fixtures. Bun reads that file
  from the current working directory only, with no walk up to the workspace root and
  no `extends`, so the root has one and every package holding Playwright specs carries
  the glob in its own copy beside the source preload. The rationale stays in the root
  file.
- **Playwright loads no bun test.** Every `playwright.config.ts` sets
  `testMatch: /.*\.spec\.ts/`. A `*.test.ts` inside `testDir` imports `bun:test`,
  Playwright's Node loader rejects the `bun:` protocol, and discovery collapses to
  **zero tests for the entire config**, so the suite reports nothing instead of
  failing; `item-player` ran that way until 2026-08-30. Scoping `testDir` to a
  spec-only directory hides the hazard without removing it, so set `testMatch` there
  too.

Where two configs share one `testDir`, the narrower one owns its files by `testMatch`
and the broader one excludes them by `testIgnore`: `packages/item-player`'s
backend-demo specs need the `backend-demos` server and belong to
`playwright.backend.config.ts`, so the main config ignores them.

The item-player and section-player configs run Firefox and WebKit projects beside
Chromium, so a local run needs all three:
`bunx playwright install chromium firefox webkit`.

### Unit Test Resolution

Unit tests resolve every `@pie-players/*` workspace sibling to its source, so a suite
runs against the sibling's current code whether its `dist` is stale, missing or
fresh. `test-support/workspace-sources.ts` maps each export to the file its build
starts from. Bun loads the map through `test-support/bun-workspace-sources.ts`, which
also compiles each `.svelte` file that source reaches with the options the package
builds use; the root and every package running `bun test` preload it from their
`bunfig.toml`. A Vitest package with tests and a workspace sibling sets
`workspaceSourcesVitePlugin()` in its `vitest.config.ts`. A test of a built artifact
builds its own package in its `test` script, as `tool-color-scheme` and
`tool-calculator-shared` do, so `turbo test` and CI run no build before unit tests.

`scripts/tests/workspace-sources.test.mjs`, run by `bun run check:scripts`, fails on a
package missing the preload, the spec ignore glob or the Vite adapter, and on a unit
test importing `../dist/` whose `test` script does not build.

### Lint And Type Checking

Lint catches errors, not style. `biome.json` runs `preset: "none"` with only the
`correctness` and `suspicious` groups on recommended and no `style` group. Do not add
`style`, `complexity`, `performance`, or naming and filename conventions, and do not
gate `biome format`: most code here is agent-written, so cosmetic uniformity costs
review attention without buying correctness. A rule that fires only on false
positives is turned off instead of suppressed site by site; `noTemplateCurlyInString`
is off because `${{…}}` is PIE math template syntax in content fixtures.

- Type-only imports are the compiler's job: with `verbatimModuleSyntax` set, a
  type-only import emitted as a runtime import is a typecheck error. `isolatedModules`
  does not cover this, so both are set. It lives in `tsconfig.json`,
  `tsconfig.base.json`, and the five package configs that extend neither
  (`calculator`, `calculator-desmos`, `tts`, `tts-client-server`, `tts-server-core`). A
  new tsconfig that extends neither root config needs it too; no single file reaches
  everything. The SvelteKit apps need nothing: SvelteKit generates it into
  `node_modules/$app/tsconfig.json`, which each app's `tsconfig.json` extends as
  `$app/tsconfig`.
- A package's bun tests typecheck through the `tsconfig.tests.json` beside its
  `tsconfig.json`, which its `typecheck` script runs after the source typecheck. A
  package that adds bun tests adds one. `scripts/tests/workspace-sources.test.mjs`
  holds the packages not yet covered in a pending list that only shrinks: a package
  leaves it in the change that gives it a `tsconfig.tests.json`.
- `bun run check:docs:examples` typechecks each TypeScript fence in the docs that
  imports from `@pie-players/*` against the packages' sources. An example that names a
  removed export or calls a changed signature fails it; fix the example in the change
  that made it stale.

### Local PR Gate

The pre-push hook runs `bun run verify:pre-push`, which is `verify:local-pr`: the full
local lint/typecheck gate plus the critical Playwright e2e suites through
`test:e2e:local-gate` (`scripts/run-local-e2e.mjs`). That runner runs each suite's
`build:e2e:*` script once, in turn, then every suite's `:prebuilt` run concurrently,
printing each suite's output as one block when it finishes. The builds go first
because concurrent turbo runs race on restoring the same `dist`, and section-demos
reloads the page when a workspace `dist` changes under a running test.
`PIE_E2E_CONCURRENCY` caps how many suites run at once (default: half the cores, at
most one per suite); `PIE_E2E_CONCURRENCY=1` runs them serially, which separates a
failure that only appears under load.

- A suite joins the gate in `scripts/lib/local-e2e-suites.mjs`, and its
  `test:e2e:<suite>` script, which CI runs, stays
  `bun run build:e2e:<name> && bun run test:e2e:<suite>:prebuilt`.
  `bun run check:local-pr-gate` enforces both.
- `scripts/pre-push-gate.mjs` skips the gate when the push carries no new commits
  (creating a branch at a commit already on the remote, or deleting a ref, transfers
  nothing to validate), and runs only `check:docs` when the new commits change
  documentation only ([Documentation-Only Changes](#documentation-only-changes)).
  Every uncertain case still runs the gate, so this only removes provably wasted
  work. Do not reach for `--no-verify` when a push seems like it should have been
  skipped: report the case, because a skip the wrapper misses is a bug in
  `scripts/lib/push-scope.mjs`.
- The gate is the lefthook script job `fast-local-gate`. Lefthook gives a `run:`
  command a push-file check derived from the current branch instead of the refs
  being pushed, keeping only files that still exist, so as a `run:` command the gate
  was skipped for a push whose commits only deleted files or were empty.
  `bun run check:local-pr-gate` rejects the gate as a command, and
  `scripts/tests/pre-push-hook.test.mjs` pushes both cases through lefthook.

### Git Worktrees

A fresh worktree needs `bun install` before the gates pass. Unit tests,
`bun run check:cli` included, resolve workspace siblings to source and need no build.
`bun run check` and `bun run typecheck` build the packages they resolve first
(`dependsOn: ["^build"]` in `turbo.json`), and turbo caches both against those builds,
so a commit or push that leaves a package and its dependencies unchanged replays that
package's result.

A worktree under `.claude/worktrees/` sits inside the main checkout, so whatever it
does not install itself comes from the main checkout's install: Bun, Node and
TypeScript look a bare specifier up in every ancestor `node_modules`, and `bun run`
puts every ancestor's `node_modules/.bin` on `PATH`. Before its own `bun install` a
worktree runs the main checkout's binaries against the main checkout's packages, and a
gate can pass that way: `bun run lint:biome` does, with the main checkout's biome.
After it, a package the worktree does not install, whether an undeclared import or a
dependency its branch removed, still resolves from the main checkout's root
`node_modules`, and a workspace package found there is the main checkout's
`packages/*/dist`, built from whichever branch it has checked out. A worktree test,
build or typecheck can then pass where CI's fresh checkout fails. `bun run check:deps`
reads manifests and imports without resolving them, so it is the evidence for a
dependency change.

The main checkout's root `node_modules` also keeps packages its manifest no longer
declares. Bun's isolated linker leaves a root link in place when a dependency leaves
the root manifest, `bun install --force` included (bun 1.3.14): links for root
dependencies added and removed on 2026-05-04 still resolved from worktrees on
2026-09-25. Removing those entries from the main checkout's `node_modules` clears
them; every session shares that directory, so ask before touching it.

`bun run check:resolution-boundary`, in both local gates, fails while a `node_modules`
above the checkout holds entries its own manifest does not declare, or while the
checkout has no install of its own. Dependencies the main checkout declares and the
worktree does not install are listed without failing, because two branches can
declare different root dependencies.

A worktree path must not contain a path segment named `node_modules`, `build`, `dist`,
`.turbo`, `.svelte-kit`, `playwright-report` or `test-results`. Those are the
unanchored `!**/…` entries in `biome.json`'s `files.includes`, and biome matches them
against the absolute path, so they also match every ancestor of the project root. A
worktree under such a segment excludes itself: `biome lint .` reports "these paths
were provided but ignored: ." and **exits 0**, so `bun run verify:pre-commit` passes
having linted nothing. `.claude` is absent from that list because its entry is
anchored (`!.claude`), which keeps `.claude/worktrees/<name>`, where agent tooling
creates worktrees by default, lintable. Keep it anchored. The rationale cannot live in
`biome.json`: biome rejects comments in a config named `.json` and falls back to
defaults with no error, reproducing the same zero-files failure.

A `bun install` in a worktree rewrites the shared `.git/hooks`. `lefthook install`
bakes an absolute path to the `node_modules` it ran from into the generated scripts,
so the hooks every checkout shares end up pointing into a directory that is about to
be deleted. Two things run it: the `prepare` lifecycle script, and the `lefthook` npm
package's own `postinstall`, which runs `lefthook install` on every install outside CI
and cannot be configured off from here. `scripts/install-git-hooks.mjs` is the
`prepare` entry point and skips any linked worktree; lefthook's `postinstall` still
fires, so treat the shared hooks as something any worktree install may have touched.

`.lefthookrc` makes the rewrite harmless. It resolves `LEFTHOOK_BIN` from
`--git-common-dir`, the main checkout and the one guaranteed to have `node_modules`,
and the generated hook consults `LEFTHOOK_BIN` before the baked path, so the stale
path is never reached. The protection holds only while the hooks carry the
`rc: ./.lefthookrc` line, so it does not survive an install from a branch predating
`.lefthookrc` (a8ab15a0). Repair after one with `bun run prepare` from the main
checkout, which is also what to run after editing `.lefthookrc` or `lefthook.yml`.

## Skills

Canonical project skills live in `.agents/skills/`; each `.claude/skills/<name>/SKILL.md`
carries only the frontmatter Claude Code discovers it by and a pointer to the record. Do
not copy them into other harnesses' files or replace them with symlinks. A procedure
that a person or a harness without skills would also need belongs in `docs/`, with the
skill as a thin wrapper over it; `consumer-dependency-audit` is the pattern.

- `accessibility-reviewer-assessments` — WCAG 2.2 AA and assessment-specific
  accessibility review of test-taking interfaces.
- `api-design-reviewer` — review of public APIs, package exports, custom-element
  properties/events/slots and cross-package contracts.
- `ce-package-packaging` — adding or modifying a custom-element package: registration
  entrypoints, package `exports`, build artifacts and pre-flight checks.
- `consumer-dependency-audit` — refreshes the consumer pad, or checks a proposed
  public-surface change against it; a wrapper over
  `docs/integrations/consumer-api-dependencies-maintenance.md`, which owns the
  procedure. In Claude Code,
  `/consumer-dependency-audit [consumer-label | surface | "add <shape>"]` scopes the
  run to one consumer, one surface, or adding a consumer.
- `releases-and-changesets` — changesets and release preparation under fixed
  lockstep versioning.

## Monorepo Map

- `packages/section-player` - multi-item section delivery.
- `packages/item-player` - single-item delivery.
- `packages/assessment-player` - reference multi-section player assembled from the
  public building blocks; hosts build their own production players. Changes freely,
  without compatibility work or host-evidence gates.
- `packages/print-player` - item-level print rendering.
- `packages/assessment-toolkit` - shared assessment services and components. Generic
  core: it knows `featureId`, placement levels, activation kinds and precedence, and
  names no capability. `bun run check:capability-neutrality` enforces that, and
  `bun run check:player-tool-boundaries` keeps the toolkit and section player off
  concrete tool and calculator packages; run both for a change to the toolkit core,
  the policy engine or a player.
- `packages/default-tool-loaders` - composition layer: which capabilities a deployment
  has, their tag map, placement presets, universal supports and lazy module loaders.
  The only place a packaged capability set is named.
- `packages/players-shared` - shared utilities, sanitizer, and PIE config.
- `packages/pie-context` - shared runtime context.
- `packages/theme` - theme token contract, `<pie-theme>`, color schemes, and the
  DaisyUI provider adapter.
- `packages/calculator` - calculator provider contract; `packages/calculator-cortex`,
  `calculator-desmos` and `calculator-geogebra` are its providers.
- `packages/tool-*` and `packages/section-player-tools-*` - runtime tools.
- `packages/tts*` - TTS client and server packages.
- `apps/*-demos`, `apps/docs`, `apps/local-esm-cdn` - local hosts and docs;
  `apps/demo-ui` is the private UI the demo apps share.
- `tools/cli` - oclif-based CLI.

## Local PIE Elements

`bun run dev:section:cdn` and `packages/section-player/playwright.local-esm-cdn.config.ts`
serve PIE elements from a local `pie-elements-ng` checkout through
`apps/local-esm-cdn`: the one `PIE_ELEMENTS_NG_PATH` names, otherwise the sibling
`../pie-elements-ng`. Both fail when that checkout is missing; neither falls back to
the remote ESM CDN.
