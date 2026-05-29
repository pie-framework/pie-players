# Test Suite Audit

This document tracks the current test and verification surface, known flakiness
risks, and cleanup candidates. It is intended to be updated as tests are split,
stabilized, moved, or removed.

## Current Command Matrix

| Gate | Commands | Notes |
| --- | --- | --- |
| Pre-commit | `bun run check`, `bun run check:deps`, `bun run check:package-metadata`, `bun run check:svelte-runtime-deps` | Runs in parallel via `lefthook.yml`. `bun run check` is `turbo check`. |
| Pre-push | `check:changeset-patch-only`, `check:local-pr-gate`, `verify:ci-lint-typecheck`, `test:e2e:section-player:critical`, `test:e2e:item-player:multiple-choice`, `test:e2e:assessment-player`, `check:consumer-boundaries` | Browser tests run locally and require Playwright outside the default sandbox. `verify:ci-lint-typecheck` is the same package/build/type-publish gate used by PR CI. |
| PR CI: Lint & Typecheck | `verify:ci-lint-typecheck` | Shared with pre-push so local and CI coverage do not drift. Includes dependency/metadata/export/CE checks, `bun run build`, `check:publint`, `check:types-publish`, `check:pack-exports`, `check:pack-smoke`, runtime/import checks, and `bun run lint:all`. |
| PR CI: Build | dependency/metadata/export/CE checks, `bun run build`, `bun run test`, runtime/import checks, artifact upload | `bun run test` is unit/package tests only, not Playwright. |
| PR CI: Isolated Linker | isolated install, dependency/metadata/export/CE checks, `bun run build`, runtime/import checks | Validates package graph under Bun isolated linker. |
| PR CI: A11y Critical E2E | echo-only stub | The actual `bun run test:e2e:a11y:critical` suite is local-only today. |
| Release / publish | `release:with-version`, `verify:publish`, `bun run test`, `release` | `verify:publish` repeats a build and many static checks. |
| Manual | `test:e2e:section-player`, `test:e2e:item-player`, `test:e2e:backend-demo`, `test:e2e:assessment-player`, `test:e2e:all`, `test:local-esm-cdn` | Full browser coverage and app-only tests are manual/local unless included in hooks. |

## Script Inventory

Root verification entrypoints:

- `build`
- `test`
- `test:e2e:section-player`
- `test:e2e:section-player:tts-ssml`
- `test:e2e:section-player:critical`
- `test:e2e:item-player`
- `test:e2e:item-player:multiple-choice`
- `test:e2e:backend-demo`
- `test:e2e:assessment-player`
- `test:e2e:a11y:critical`
- `test:e2e:all`
- `test:local-esm-cdn`
- `typecheck`
- `check`
- `lint:all`
- `verify:publish`

Root `scripts/check-*.mjs` entrypoints:

- `scripts/check-attw.mjs`
- `scripts/check-bundle-safety.mjs`
- `scripts/check-ce-consumer-contract.mjs`
- `scripts/check-ce-define-safety.mjs`
- `scripts/check-changeset-patch-only.mjs`
- `scripts/check-consumer-boundaries.mjs`
- `scripts/check-custom-elements.mjs`
- `scripts/check-deps.mjs`
- `scripts/check-engine-core-purity.mjs`
- `scripts/check-fixed-versioning.mjs`
- `scripts/check-math-rendering-version.mjs`
- `scripts/check-node-consumer-imports.mjs`
- `scripts/check-npm-auth.mjs`
- `scripts/check-pack-exports.mjs`
- `scripts/check-pack-smoke.mjs`
- `scripts/check-package-metadata.mjs`
- `scripts/check-published-closure.mjs`
- `scripts/check-publint.mjs`
- `scripts/check-runtime-compat.mjs`
- `scripts/check-source-exports.mjs`
- `scripts/check-svelte-runtime-deps.mjs`

Package-level script coverage:

- Packages/apps with package-level `test`: `apps/local-esm-cdn`,
  `packages/assessment-toolkit`, `packages/item-player`,
  `packages/pie-context`, `packages/players-shared`, `packages/print-player`,
  `packages/section-player`, `packages/section-player-tools-pnp-debugger`,
  `packages/theme`, `packages/theme-daisyui`,
  `packages/tool-calculator-desmos`, `packages/tool-graph`,
  `packages/tts-client-server`, `packages/tts-server-core`,
  `packages/tts-server-google`, `packages/tts-server-polly`,
  `packages/tts-server-sc`.
- Packages/apps with package-level `check`: all Svelte apps,
  `packages/assessment-player`, `packages/assessment-toolkit`,
  `packages/item-player`, `packages/players-shared`,
  `packages/section-player`, `packages/theme`, and
  `packages/theme-daisyui`.
- Packages/apps with package-level `typecheck`: most packages/apps except
  `packages/print-player`, `packages/tts-client-server`, and the four
  `packages/tts-server-*` packages currently rely on `build`/Vitest instead of
  a named `typecheck` script.
- Packages/apps with package-level `build`: all package/app workspaces except
  packages that are test/tooling-only should be treated as build participants;
  the root `build` command filters out `apps/*` and `tools/*`.

## Test Inventory

The repo currently has 134 `*.test.*` / `*.spec.*` files.

### Playwright Specs

- `packages/assessment-player/tests/assessment-player-smoke.spec.ts`
- `packages/item-player/tests/backend-demo-delivery.spec.ts`
- `packages/item-player/tests/item-demos-chrome-a11y.spec.ts`
- `packages/item-player/tests/item-player-authoring-contract.spec.ts`
- `packages/item-player/tests/item-player-authoring-media.spec.ts`
- `packages/item-player/tests/item-player-multiple-choice.spec.ts`
- `packages/item-player/tests/item-player-preloaded-static.spec.ts`
- `packages/section-player/tests/section-demos-chrome-a11y.spec.ts`
- `packages/section-player/tests/section-player-contract-parity.spec.ts`
- `packages/section-player/tests/section-player-controller-access.spec.ts`
- `packages/section-player/tests/section-player-event-panel.spec.ts`
- `packages/section-player/tests/section-player-heading-accessibility.spec.ts`
- `packages/section-player/tests/section-player-navigation-contract.spec.ts`
- `packages/section-player/tests/section-player-pie-512-cross-section-events.spec.ts`
- `packages/section-player/tests/section-player-pnp-tools-debugger.spec.ts`
- `packages/section-player/tests/section-player-policy-invariants.spec.ts`
- `packages/section-player/tests/section-player-preloaded.spec.ts`
- `packages/section-player/tests/section-player-readiness-events.spec.ts`
- `packages/section-player/tests/section-player-reflow.spec.ts`
- `packages/section-player/tests/section-player-scrollbar-visibility.spec.ts`
- `packages/section-player/tests/section-player-session-hydrate-db.spec.ts`
- `packages/section-player/tests/section-player-tabbed-layout.spec.ts`
- `packages/section-player/tests/section-player-tool-config-error-surfacing.spec.ts`
- `packages/section-player/tests/section-player-tool-visibility.spec.ts`
- `packages/section-player/tests/section-player-toolkit-observability.spec.ts`
- `packages/section-player/tests/section-player-tts-ssml.spec.ts`
- `packages/section-player/tests/section-player-vertical-passage-layout.spec.ts`
- `packages/section-player/tests/section-swap-element-set-change.spec.ts`
- `packages/section-player/tests/section-theme-color-scheme.spec.ts`
- `packages/section-player/tests/section-toolbar-tools.spec.ts`

### Bun Unit And Contract Tests

- `apps/item-demos/src/lib/utils/coercion.test.ts`
- `apps/local-esm-cdn/tests/errors-security.test.ts`
- `apps/local-esm-cdn/tests/health-readiness.test.ts`
- `apps/local-esm-cdn/tests/help-cors.test.ts`
- `apps/local-esm-cdn/tests/package-resolution.test.ts`
- `apps/local-esm-cdn/tests/rewrite-contract.test.ts`
- `packages/assessment-toolkit/tests/PNPToolResolver.test.ts`
- `packages/assessment-toolkit/tests/ToolRegistry.test.ts`
- `packages/assessment-toolkit/tests/calculator-registration.test.ts`
- `packages/assessment-toolkit/tests/framework-error-bus.test.ts`
- `packages/assessment-toolkit/tests/highlight-coordinator-tts-style.test.ts`
- `packages/assessment-toolkit/tests/pie-512-cross-section-event-delivery.test.ts`
- `packages/assessment-toolkit/tests/pie-512-persistent-shell-cohort-handoff.test.ts`
- `packages/assessment-toolkit/tests/pie-512-phase-d-active-cohort-tracking.test.ts`
- `packages/assessment-toolkit/tests/policy/PnpPolicySource.test.ts`
- `packages/assessment-toolkit/tests/policy/ToolPolicyEngine.test.ts`
- `packages/assessment-toolkit/tests/policy/compose-decision.test.ts`
- `packages/assessment-toolkit/tests/policy/coordinator-integration.test.ts`
- `packages/assessment-toolkit/tests/policy/pnp-default-on.test.ts`
- `packages/assessment-toolkit/tests/policy/required-tool-blocked-diagnostic.test.ts`
- `packages/assessment-toolkit/tests/runtime/SectionRuntimeEngine.test.ts`
- `packages/assessment-toolkit/tests/runtime/adapter/coordinator-bridge-cohort-handoff.test.ts`
- `packages/assessment-toolkit/tests/runtime/adapter/coordinator-bridge.test.ts`
- `packages/assessment-toolkit/tests/runtime/adapter/dom-event-bridge.test.ts`
- `packages/assessment-toolkit/tests/runtime/adapter/engine-disposal.test.ts`
- `packages/assessment-toolkit/tests/runtime/core/engine-readiness.test.ts`
- `packages/assessment-toolkit/tests/runtime/core/engine-resolver.test.ts`
- `packages/assessment-toolkit/tests/runtime/core/engine-transition.test.ts`
- `packages/assessment-toolkit/tests/runtime/section-runtime-engine-host-context.test.ts`
- `packages/assessment-toolkit/tests/runtime/stage-emit-gate.test.ts`
- `packages/assessment-toolkit/tests/session-event-emitter-policy.test.ts`
- `packages/assessment-toolkit/tests/ssml-extractor-sanitization.test.ts`
- `packages/assessment-toolkit/tests/test-attempt-session-adapter.test.ts`
- `packages/assessment-toolkit/tests/tool-config-resolver.test.ts`
- `packages/assessment-toolkit/tests/tool-config-validation.test.ts`
- `packages/assessment-toolkit/tests/tool-context-helpers.test.ts`
- `packages/assessment-toolkit/tests/tool-instance-id.test.ts`
- `packages/assessment-toolkit/tests/tool-provider-registry-telemetry.test.ts`
- `packages/assessment-toolkit/tests/tool-tag-map.test.ts`
- `packages/assessment-toolkit/tests/toolbar-items.test.ts`
- `packages/assessment-toolkit/tests/toolkit-coordinator-framework-error.test.ts`
- `packages/assessment-toolkit/tests/toolkit-coordinator-section-events.test.ts`
- `packages/assessment-toolkit/tests/toolkit-coordinator-telemetry.test.ts`
- `packages/assessment-toolkit/tests/toolkit-coordinator-tts-reconfigure.test.ts`
- `packages/assessment-toolkit/tests/tools-config-normalizer.test.ts`
- `packages/assessment-toolkit/tests/tts-browser-segmentation.test.ts`
- `packages/assessment-toolkit/tests/tts-contract-compat.test.ts`
- `packages/assessment-toolkit/tests/tts-runtime-config.test.ts`
- `packages/assessment-toolkit/tests/tts-service-structural-pauses.test.ts`
- `packages/assessment-toolkit/tests/tts-service-telemetry.test.ts`
- `packages/assessment-toolkit/tests/tts-text-processing.test.ts`
- `packages/assessment-toolkit/tests/tts-tool-registration.test.ts`
- `packages/assessment-toolkit/tests/visual-line-ranges.test.ts`
- `packages/item-player/tests/backend-delivery.test.ts`
- `packages/item-player/tests/backend-demo-controller.test.ts`
- `packages/pie-context/test/pie-context.test.ts`
- `packages/players-shared/tests/correct-response-env.test.ts`
- `packages/players-shared/tests/custom-element-define.test.ts`
- `packages/players-shared/tests/element-loader-contract.test.ts`
- `packages/players-shared/tests/element-loader.test.ts`
- `packages/players-shared/tests/element-player-boundary-contract.test.ts`
- `packages/players-shared/tests/first-focusable.test.ts`
- `packages/players-shared/tests/instrumentation-event-bridge.test.ts`
- `packages/players-shared/tests/instrumentation-provider-resolution.test.ts`
- `packages/players-shared/tests/instrumentation-providers.test.ts`
- `packages/players-shared/tests/item-controller.test.ts`
- `packages/players-shared/tests/item-session-contract.test.ts`
- `packages/players-shared/tests/math-rendering.test.ts`
- `packages/players-shared/tests/object.test.ts`
- `packages/players-shared/tests/pie-config.test.ts`
- `packages/players-shared/tests/player-strategy.test.ts`
- `packages/players-shared/tests/resource-monitor-instrumentation.test.ts`
- `packages/players-shared/tests/resource-monitor-retry.test.ts`
- `packages/players-shared/tests/safe-storage.test.ts`
- `packages/players-shared/tests/sanitize-item-markup.test.ts`
- `packages/players-shared/tests/scoring.test.ts`
- `packages/players-shared/tests/tag-names.test.ts`
- `packages/players-shared/tests/validate-style-url.test.ts`
- `packages/players-shared/tests/wrap-overwide-images.test.ts`
- `packages/print-player/tests/tag-names.test.ts`
- `packages/section-player-tools-pnp-debugger/tests/derive-panel-data.test.ts`
- `packages/section-player/tests/component-definitions.test.ts`
- `packages/section-player/tests/m5-mirror-rule.test.ts`
- `packages/section-player/tests/player-action.test.ts`
- `packages/section-player/tests/player-preload.test.ts`
- `packages/section-player/tests/section-content-service.test.ts`
- `packages/section-player/tests/section-controller-pie-512-phase-c.test.ts`
- `packages/section-player/tests/section-controller.test.ts`
- `packages/section-player/tests/section-player-engine-context.test.ts`
- `packages/section-player/tests/section-player-framework-error-dual-emit.test.ts`
- `packages/section-player/tests/section-player-overwide-images.test.ts`
- `packages/section-player/tests/section-player-runtime-callbacks.test.ts`
- `packages/section-player/tests/section-player-runtime.test.ts`
- `packages/section-player/tests/section-player-stage-tracker.test.ts`
- `packages/section-player/tests/section-player-view-state.test.ts`
- `packages/section-player/tests/section-session-service.test.ts`
- `packages/theme/src/theme-element.test.ts`
- `packages/theme-daisyui/tests/mapping-parity.test.mjs`
- `packages/tool-calculator-desmos/tests/tool-calculator.contract.test.ts`
- `packages/tool-graph/tests/tool-graph.contract.test.ts`
- `tools/cli/src/commands/pie-packages/preloaded-player-build-and-test-package.test.ts`
- `tools/cli/src/commands/pie-packages/preloaded-player-build-package.test.ts`
- `tools/cli/src/utils/pie-packages/preloaded-static.test.ts`

### Vitest Tests

- `packages/tts-client-server/ServerTTSProvider.test.ts`

### Potential Wiring Gaps

- `packages/tool-graph/tests/tool-graph.contract.test.ts`: now wired through
  the package-level `test` script.
- `packages/tool-calculator-desmos/tests/tool-calculator.contract.test.ts`: now
  wired through the package-level `test` script.
- `packages/assessment-player/tests/assessment-player-smoke.spec.ts`: executed
  by root Playwright commands, but the package itself has no package-level
  `test` script.
- `apps/item-demos/src/lib/utils/coercion.test.ts`: app workspace is excluded
  from root `turbo test`, and `apps/item-demos` has no package-level `test`
  script.
- `tools/cli/src/**/*.test.ts`: tools workspace is excluded from root
  `turbo test`, and `tools/cli` has no package-level `test` script.

## Flakiness Risk Signals

| Signal | Risk | Why it matters | First places to inspect |
| --- | --- | --- | --- |
| Playwright demo tests | High | They combine browser rendering, dev servers, custom elements, generated `dist`, storage, and timing. | `packages/section-player/tests/*.spec.ts`, `packages/item-player/tests/*.spec.ts`, `packages/assessment-player/tests/*.spec.ts` |
| `waitUntil: "networkidle"` | Medium | SPA/dev-server background activity can make this slower or misleading. Prefer route-specific readiness assertions. | 96 references across 25 Playwright files. |
| `page.waitForTimeout(...)` | High | Fixed sleeps pass or fail depending on runner load. Prefer `expect.poll`, visible state transitions, or app events. | 10 references across 4 Playwright files. |
| Clipboard/editor input | High | Clipboard permissions and rich editors can race with reactive state. Use deterministic keyboard insertion or direct app APIs when the editor itself is not under test. | No remaining test references after the multiple-choice editor fix. |
| TTS/audio/browser APIs | High | Browser speech, audio playback, and server fallback paths need deterministic mocks. | `section-player-tts-ssml.spec.ts`, assessment smoke tests |
| Desmos/MUI internals | Medium | Third-party DOM can produce nondeterministic focus/a11y details and noisy console output. | calculator-related item/section specs |
| Shared storage / attempt IDs | High | Persisted debug panel state, local/session storage, and attempt IDs can leak between tests. | Demo route Playwright suites |
| Bun `mock.module` state | Medium | Module mocks can leak across Bun test files in a process if mocks are incomplete. | section/player runtime tests and toolkit engine tests |
| Subprocess JSON/output parsing | Medium | ATTW, pack, and smoke checks can fail opaquely if child output is truncated or malformed. | `scripts/check-attw.mjs`, pack scripts |

## Coverage And Overlap Notes

- `test:e2e:a11y:critical` chains the same three suites that pre-push already
  runs individually: section TTS SSML, item multiple-choice, and assessment
  smoke. The name suggests an a11y-only gate, but the suites also cover broader
  integration behavior.
- A11y baseline filtering is implemented independently in several specs. That
  helps route-specific debt stay local, but the pattern can drift. A shared
  helper should be considered once the current debt is better classified.
- `lint-and-typecheck` in CI runs named checks, then runs `lint:all`, which
  repeats some of those checks (`check`, `typecheck`, `check:package-metadata`,
  `check:svelte-runtime-deps`, `check:deps`, `check:source-exports`).
- `build`, `lint-and-typecheck`, and `isolated-linker-validation` repeat a
  similar dependency/metadata/source/CE/build preamble. This is understandable
  for isolation, but it increases CI time and operational failure surface.
- Release flows run `build` before `verify:publish`, while `verify:publish`
  itself starts with `build`.

## Recommended Cleanup Waves

### Wave 1: Low-Risk Stabilization

- Harden `scripts/check-attw.mjs` with retry and parse diagnostics.
- Replace clipboard-based Playwright editor writes with deterministic helpers.
- Add small per-suite helpers for storage reset and app-ready assertions.
- Document current coverage and risk in this file.

### Wave 2: Playwright Timing Cleanup

- Replace fixed sleeps with `expect.poll` or visible state changes.
- Replace `networkidle` waits with explicit route-ready assertions.
- Split the longest "does everything" specs into smaller, state-isolated tests
  only where the split reduces shared-state coupling.

### Wave 3: Coverage Rationalization

- Confirm orphan tests are wired into package scripts or remove/relocate them.
- Group overlapping a11y tests by owned contract: demo chrome, player surface,
  heading/focus, and route-specific known debt.
- Decide whether app-local and CLI tests should join root `turbo test` or remain
  manual/package-local.

### Wave 4: Gate Rationalization

- Introduce a narrower CI lint command if `lint:all` is intentionally too broad
  for the existing named CI steps.
- Decide whether browser/a11y critical tests stay pre-push-only, move to CI, or
  become scheduled/nightly.
- Reduce release workflow duplicate build/check work where it does not add
  isolation value.

## Decision Log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-05-18 | Start audit with documentation plus ATTW wrapper hardening. | Recent CI failure was an opaque ATTW JSON parse failure, and the repo has accumulated overlapping gates and browser-test flake signals. |
| 2026-05-18 | Wire package-local Bun tests into package-level `test` scripts. | `packages/tool-graph`, `packages/tool-calculator-desmos`, and `packages/print-player` had tests that root `turbo test` skipped because the packages exposed no `test` task. |
