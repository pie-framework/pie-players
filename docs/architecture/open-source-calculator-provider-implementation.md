# Open-Source Calculator Provider Implementation Specification

Status: Implemented

Related PRD:
[`../prds/open-source-calculator-provider.md`](../prds/open-source-calculator-provider.md)

## Purpose

This document turns the open-source calculator PRD into implementation slices
that can begin after the GeoGebra calculator integration is complete. It fixes
the module boundaries, runtime ownership, worker protocol, state flow, and
verification evidence while leaving the existing provider-neutral calculator
contract intact.

The implementation is a deep provider module. Hosts see the existing
`CalculatorProvider`/`Calculator` seam plus typed Cortex configuration and state.
MathLive, Compute Engine, JSXGraph, worker scheduling, graph sampling, and global
keyboard coordination remain internal details.

## Architectural Constraints

- Desmos remains the default. Cortex is selected explicitly with
  `provider.id: "calculator-cortex"`.
- The runtime is fully bundled and self-hosted. No calculator operation may
  create a network request or require an API key.
- `@pie-players/pie-calculator` remains provider-neutral and names no vendor or
  implementation.
- `@pie-players/pie-assessment-toolkit` remains capability-neutral; it owns a
  provider adapter but not packaged provider-selection policy.
- `@pie-players/pie-default-tool-loaders` remains the composition layer that
  names the packaged provider IDs.
- The existing generic calculator custom element remains stable. Direct Cortex
  custom elements are additive.
- No learner input is executed as JavaScript. Do not use `eval`, `Function`,
  Compute Engine `compile()`, or JSXGraph function-graph APIs with learner
  expressions.
- Every async response is associated with an instance and request generation;
  stale results cannot mutate a newer calculator state.
- Evaluation and graph sampling happen in a module Web Worker. Browser-global
  MathLive resources have explicit ownership and cleanup.

## Package Topology

```text
@pie-players/pie-calculator
    provider-neutral types
             ^
             |
@pie-players/pie-calculator-cortex
    MathLive + Compute Engine + JSXGraph implementation
             ^
             |
@pie-players/pie-assessment-toolkit
    CortexToolProvider registration adapter
             ^
             |
@pie-players/pie-default-tool-loaders
    calculator-cortex composition and lazy loading

@pie-players/pie-tool-calculator-shared
    generic shell, inline shell, neutral generic-element registration
             ^                         ^
             |                         |
pie-tool-calculator-cortex   pie-tool-calculator-inline-cortex
    direct provider tags         direct inline provider tag
```

### Public packages

1. `@pie-players/pie-calculator-cortex`
   - Owns the provider implementation and all Cortex-specific public types.
   - Bundles the three runtime dependencies and worker entry.
   - Exposes no internal library object in its public API.
2. `@pie-players/pie-tool-calculator-cortex`
   - Registers `<pie-tool-calculator-cortex>`.
   - Supplies `providerId = "calculator-cortex"` to the shared shell.
3. `@pie-players/pie-tool-calculator-inline-cortex`
   - Registers `<pie-tool-calculator-inline-cortex>`.
   - Supplies the same provider ID to the shared inline shell.

All three packages join the fixed Changesets release block.

### Existing packages changed

- `@pie-players/pie-assessment-toolkit` adds `CortexToolProvider`, following the
  final GeoGebra adapter shape and lazy-importing
  `@pie-players/pie-calculator-cortex`.
- `@pie-players/pie-default-tool-loaders` recognizes
  `"calculator-cortex"`, maps it to the Cortex adapter, and preserves
  `"calculator-desmos"` as the omission default.
- `@pie-players/pie-tool-calculator-shared` gains a provider-neutral
  registration entry for the generic `<pie-tool-calculator>` element.
- The packaged calculator module loader imports that neutral registration entry
  instead of importing the Desmos-named direct tool package merely to define
  the generic tag.

The final GeoGebra implementation is the baseline for filenames, Svelte custom
element wrappers, exports, and tests. If its landed structure differs, change
this topology once in the PRD/spec before implementation.

## Provider Module Design

Proposed source layout for `packages/calculator-cortex/src/`:

```text
index.ts
cortex-provider.ts
settings.ts
function-policy.ts
state-codec.ts
evaluation-client.ts
evaluation-worker.ts
worker-protocol.ts
calculator-view.svelte
graph-view.svelte
graph-series.ts
mathlive-runtime.ts
errors.ts
```

### `cortex-provider.ts`

Owns `CortexCalculatorProvider` and the concrete `Calculator` implementation.
It coordinates lifecycle and delegates all specialized work:

- `initialize()` verifies browser support and dependency assets without
  mounting UI.
- `createCalculator()` validates settings, creates one instance owner, mounts
  the Svelte view, starts its evaluation client, and returns only after the
  primary input is ready.
- `destroy()` prevents new instances and releases provider-level resources. An
  instance has its own idempotent `destroy()` for view, board, worker, event,
  observer, and keyboard cleanup.
- `getCapabilities()` reports history, expressions, graphing, export, and
  keyboard/mouse/touch support with a maximum precision of 21.

The provider uses `providerId = "cortex"`. Toolkit and loader selection use the
separate registration ID `"calculator-cortex"`.

### `settings.ts`

Owns a single normalization function:

```ts
function resolveCortexSettings(
  type: CalculatorType,
  config?: CalculatorProviderConfig,
): ResolvedCortexSettings;
```

It applies defaults, rejects invalid known values, ignores unknown values, and
intersects `allowedFunctions` with the fixed mode policy. `restrictedMode` is
applied last so no setting can re-enable clipboard or disallowed menu actions.
Locale resolution creates one immutable package-owned localization module used
by every view. It selects the English or Dutch catalog by primary language,
merges typed per-instance message overrides, derives or applies writing
direction, configures locale-aware graph-number formatting, and maps the generic
locale to MathLive labels and virtual-keyboard decimal-separator behavior while
retaining locale-independent canonical numbers. The rest of the implementation
consumes only immutable `ResolvedCortexSettings`.

### `function-policy.ts`

Owns canonical AST validation, not UI buttons. Its entrypoints distinguish a
bounded edit buffer from an evaluable expression:

```ts
function inspectEditBuffer(latex: string): EditBufferInspection;

function validateExpression(
  expression: MathJsonExpression,
  policy: ResolvedFunctionPolicy,
): ValidatedExpression;
```

`inspectEditBuffer()` applies the 1,024-character limit and rejects dangerous
or unsupported command forms while allowing a temporarily incomplete learner
edit. An incomplete edit can be displayed and serialized but cannot enter
history, evaluation, or graph sampling.

`validateExpression()` walks canonical MathJSON iteratively, counts at most 256
nodes, tracks maximum depth 32, rejects unknown dictionaries and free symbols,
and accepts only the operator/function set for the selected mode. The validator
runs for every completed expression regardless of whether it originated from a
virtual key, physical key, paste, `setValue()`, imported state, history recall,
or graph row.

The UI layout and `allowedFunctions` settings may hide or remove keys, but they
do not replace AST validation.

### `state-codec.ts`

Owns `CortexCalculatorStateV1` decoding and encoding. Decode builds a new
validated model and returns it only after every field succeeds. The live
calculator swaps models atomically; decode never mutates it incrementally.

State rules:

- Require outer `provider === "cortex"` and matching calculator type.
- Require `schema === "pie-calculator-cortex"` and `version === 1`.
- Require outer `value` and `providerState.inputLatex` to match.
- Ignore unknown fields during decode and omit them on the next encode.
- Validate all numbers as finite, all bounds and counts, expression IDs as
  unique opaque strings, styles against fixed unions, and expressions through
  the same edit/expression policy used at runtime.
- Reject the entire import on any known-field error or unknown version.
- Do not migrate another provider's state.

The generic outer history remains an array of
`CalculationHistoryEntry`. Decoding enforces the configured maximum and treats
the expression, result, and timestamp fields as untrusted data. A history entry
must have a valid evaluable expression; a result is display text and is never
re-executed.

## Input And Evaluation Flow

```text
MathLive edit / paste / setValue / imported state
                  |
                  v
       bounded edit-buffer inspection
                  |
                  v
       canonical MathJSON parse + policy
                  |
          accepted expression
                  |
                  v
       versioned worker request
                  |
        numeric evaluation result
                  |
                  v
       display + optional history entry
```

MathLive owns mathematical editing and presentation. PIE listens to its input
events, reads LaTeX, and applies the same policy used by public methods. The view
provides mode-specific virtual-keyboard layers and removes general CAS or
transformation actions from the context menu. Physical keyboard access remains
available for every visible operation.

The main thread may use Compute Engine to parse a length-bounded edit for
immediate policy feedback and synchronous `Calculator` methods. It must not
perform numeric evaluation or graph sampling. The worker parses and validates
again before evaluation, which makes the worker boundary defensive rather than
trusting serialized main-thread MathJSON.

`evaluate(expression)` resolves with the formatted result or rejects with a
typed `CortexCalculatorError`. UI-triggered evaluation handles the same result
through the view model. Successful history insertion occurs only after the
request still matches the active input generation.

### Numeric semantics

- Configure Compute Engine numeric precision from `calculationPrecision`, up to
  the hard limit of 21 digits.
- Format, but do not re-evaluate, results at `displayPrecision`.
- Reject complex and non-finite results in version 1 with a recoverable domain
  error.
- Convert trigonometric arguments/results at the policy boundary for the active
  degree/radian mode; state records the chosen mode.
- Treat percent as a canonical division by 100.
- Never depend on locale-formatted result strings for subsequent computation.
  History retains the canonical expression separately from display text.

## Worker Boundary

`evaluation-worker.ts` is emitted as a module worker and resolved with a static
bundler-owned URL. Consumers do not configure a worker CDN. The package artifact
test verifies that the worker and its dependent chunks are present.

### Protocol

```ts
interface WorkerEnvelope {
  protocolVersion: 1;
  instanceId: string;
  requestId: number;
  generation: number;
}

type WorkerRequest =
  | (WorkerEnvelope & {
      kind: "evaluate";
      latex: string;
      type: CalculatorType;
      settings: WorkerEvaluationSettings;
      bindings?: { x: number };
    })
  | (WorkerEnvelope & {
      kind: "sample";
      expressions: Array<{ id: string; latex: string }>;
      viewport: CortexGraphViewport;
      pixelWidth: number;
      settings: WorkerEvaluationSettings;
    });

type WorkerResponse =
  | (WorkerEnvelope & { kind: "result"; result: EvaluationResult })
  | (WorkerEnvelope & { kind: "series"; series: SampledSeries[] })
  | (WorkerEnvelope & { kind: "error"; error: SerializedCortexError });
```

The protocol is internal but versioned so stale chunks fail closed with
`worker-unavailable` instead of being misread.

### Time and cancellation

- Set Compute Engine's evaluation time limit for every request.
- Start a main-thread watchdog for the configured limit plus a small fixed
  message-delivery allowance.
- On watchdog expiry, terminate the worker, reject outstanding requests with
  `evaluation-timeout`, create a fresh worker for later requests, and never
  reuse the timed-out engine.
- Superseded graph requests are logically cancelled by generation. Their
  responses are ignored even if the worker finishes them.
- Destroy rejects pending requests, removes listeners, and terminates the
  instance worker.

The 100-2,000 ms host setting is validated before crossing the worker boundary.
The worker applies the same hard range and does not trust the request.

## Graph Sampling And Rendering

JSXGraph is loaded only when a graphing calculator is created. Basic and
scientific bundles must not initialize it.

`graph-series.ts` converts worker results to JSXGraph point-series data. It does
not construct a callable function from learner input. The graph board receives
numeric `x`/`y` arrays and fixed PIE-owned styling only.

Sampling behavior:

- Clamp effective pixel width to 200-1,200 and sample no more than 1,200 points
  per expression per request.
- Evaluate at finite x coordinates across the visible viewport.
- Split series at non-finite/domain failures and at discontinuity heuristics so
  asymptotes are not connected by a misleading line.
- Return transferable numeric arrays where browser support and the build output
  make that practical.
- Debounce continuous pan/zoom sampling and keep the previous valid series
  visible with a nonblocking updating status.
- Ignore stale generations and preserve the last valid viewport if a new sample
  times out.

`graph-view.svelte` owns the JSXGraph board, resize, controls, expression-to-style
mapping, accessible summary, and trace UI. A `ResizeObserver` schedules board
resize without creating reactive update loops. Board and observer cleanup are
idempotent.

Keyboard trace selects one visible series and moves along its latest sampled
points. It exposes labeled previous/next controls and announces expression, x,
and y. It is an alternative representation, not a claim that JSXGraph's canvas
or SVG output alone is accessible.

## MathLive Global Resource Ownership

MathLive's virtual keyboard is a shared browser resource. Each mounted
calculator receives a unique ownership token. `mathlive-runtime.ts` stores a
lease record on `globalThis` under a PIE-owned `Symbol.for(...)` key so separate
bundled copies still coordinate.

On focus:

1. Capture the keyboard configuration that existed before the lease.
2. Record the calculator token as current owner.
3. Apply the selected mode's PIE keyboard layers and locale options.

On blur, mode change, or destroy, restore the previous configuration only if
the lease record still names that calculator token. A stale instance must never
hide or reconfigure a keyboard now owned by another calculator.

The runtime listens only while an instance is mounted. It removes global
listeners and releases references during idempotent destroy. Contract tests
mount two calculators, alternate focus, destroy them in both orders, and verify
that the surviving owner retains its configuration.

MathLive fonts, sounds used by the chosen UI, and other required assets are
packaged locally. Unsupported optional assets are disabled rather than fetched
from a default CDN.

## UI And Accessibility Structure

`calculator-view.svelte` uses Svelte 5 runes and PIE-specific class/data hooks.
It provides:

- A named primary math input.
- A mode and angle-mode status.
- Explicit evaluate, clear, backspace, history, and graph controls as
  appropriate to the selected type.
- A polite result live region and a separate assertive error only when immediate
  intervention is necessary; the same message is not announced twice.
- Visible focus, target sizes, reflow, contrast, reduced-motion behavior, and
  light/dark theme support through `--pie-*` tokens.
- Package-owned message lookup for every visible label, accessible name, status,
  and recoverable error; no UI component carries English literals.
- `lang`/`dir` on the calculator region and logical CSS properties for RTL.

The theme interface uses canonical semantic tokens for all ordinary surfaces,
text, controls, focus, primary actions, and error feedback. The only
calculator-specific public tokens are the six graph-series colors, because PIE
has no canonical data-series palette. The renderer resolves those values from
computed styles before giving JSXGraph numeric series attributes, keeping the
DOM swatch and plotted curve in sync. `theme: "auto"` follows
`prefers-color-scheme`; explicit light and dark modes install accessible local
defaults.

Graph series use a fixed pair of color and line style. DOM order, accessible
summary order, expression-row order, and trace-selector order remain identical.
Deleting an expression does not silently reassign the styles of surviving
expressions; new expressions receive the next free palette slot.

Focus behavior:

- `focus()` targets the primary MathLive field.
- Clearing returns focus to the input.
- Removing a graph row focuses the next row, previous row, or add-expression
  control in that order.
- Errors do not steal focus; they are associated with the responsible input.
- Opening history or graph trace moves focus deliberately and closing returns
  it to the invoking control.

## Telemetry And Privacy

The provider uses the existing tool lifecycle event vocabulary and adds only
`backend: "cortex"` plus safe operational fields such as operation, duration,
calculator type, error type, and worker restart count.

The telemetry boundary accepts an allowlisted payload assembled by the provider.
It must not accept arbitrary view-model details. Contract tests assert that no
payload key or value contains:

- Expression or result text.
- History entries.
- Exported or imported state.
- Graph expressions, viewport values, trace coordinates, or sampled points.
- Learner or session identifiers.

Telemetry callback failures are contained and never break calculator behavior.

## Failure Model

| Failure | Public error | UI behavior | Recovery |
| --- | --- | --- | --- |
| Incomplete or invalid input | `invalid-expression` | Keep edit, explain locally | Learner edits |
| Function/symbol denied | `unsupported-expression` | Keep edit, identify denied capability | Learner edits or host changes policy |
| Length/node/depth budget exceeded | `expression-too-complex` | Keep safe bounded edit where possible | Learner simplifies |
| Compute Engine limit/watchdog | `evaluation-timeout` | Keep input and prior valid result/graph | Worker recreated |
| Invalid persisted state | `invalid-state` | Preserve live calculator unchanged | Host discards or replaces state |
| Worker creation/protocol failure | `worker-unavailable` | Tool-level error state | Remount or deployment fix |

Dependency exceptions are translated at the package boundary. Hosts do not need
to recognize MathLive, Compute Engine, JSXGraph, or worker-native error shapes.

## Build, Assets, And Licensing

- Pin direct dependency versions through the Bun lockfile and declare them in
  the owning package.
- Bundle browser code, module workers, styles, fonts, and required assets. The
  demo and tests run successfully with outbound requests blocked.
- Preserve upstream copyright and license notices in published artifacts and
  repository attribution documentation.
- Before implementation locks versions, re-check the official license file for
  every dependency and transitive asset. Record the exact selected versions and
  license identifiers in the changeset/PR evidence.
- Run a production build and inspect emitted URLs so no dependency default
  points at a CDN.

The open-source claim describes the shipped implementation and its source
dependencies. It does not claim that PIE provides a standards-certified
calculator or that every deployment policy permits every dependency license.

## Implementation Slices

### Slice 1: Post-GeoGebra seam audit

- Finish and land the GeoGebra provider work.
- Compare its final provider adapter, package exports, direct tags, tests, and
  generic shared shell with this document.
- Update this PRD/spec for any final seam difference before adding Cortex code.
- Confirm the consumer dependency pad and fixed-package list implications.

Exit evidence: an approved, provider-neutral package diagram and no need for a
second generic calculator shell.

### Slice 2: Neutral generic-element delivery

- Add the provider-neutral generic `<pie-tool-calculator>` registration entry
  to `@pie-players/pie-tool-calculator-shared`.
- Change packaged composition to import that entry rather than the
  Desmos-named direct package.
- Preserve tag, properties, attributes, loader behavior, and Desmos default.

Exit evidence: custom-element/export checks and unchanged existing calculator
contract tests.

### Slice 3: Cortex foundation

- Create `@pie-players/pie-calculator-cortex` and add it to the fixed release
  block.
- Implement settings, errors, function policy, state codec, worker protocol,
  evaluation client, and provider lifecycle.
- Bundle MathLive and Compute Engine assets locally.
- Add unit/contract tests for limits, restrictions, evaluation, timeout,
  restart, privacy, and state.

Exit evidence: basic provider can initialize offline, evaluate through a worker,
round-trip state, and recover from a forced timeout.

### Slice 4: Basic and scientific UI

- Implement the Svelte/MathLive view and mode-specific keyboard layers.
- Add result, error, history, angle mode, focus, resize, theme, locale, reflow,
  and global-keyboard lease behavior.
- Complete automated and manual accessibility evidence for these modes.

Exit evidence: basic and scientific acceptance tests pass with physical
keyboard, virtual keyboard, touch-sized controls, and screen-reader flows.

### Slice 5: Graphing

- Add lazy JSXGraph loading, worker sampling, numeric-series rendering,
  discontinuity segmentation, viewport controls, and stale-request handling.
- Add six-row expression management, fixed style identity, accessible summary,
  and keyboard trace.
- Test offline production artifacts and graph accessibility.

Exit evidence: explicit `y=f(x)` graphs remain responsive, bounded, and usable
without interpreting the visual graph alone.

### Slice 6: Toolkit and direct integration

- Add `CortexToolProvider` to the assessment toolkit.
- Add provider recognition and lazy composition to default tool loaders.
- Add shelled and inline direct custom-element packages and demos.
- Update calculator, provider-system, package, attribution, and consumer-impact
  documentation.
- Add patch changesets for all publishable changes.

Exit evidence: both configured provider selection and direct custom-element
imports work from built package artifacts.

### Slice 7: Release evidence

- Run targeted unit, contract, accessibility, offline-network, and package
  artifact tests.
- Run all custom-element, export, consumer, capability, and player-tool gates.
- Run the full local PR gate outside the sandbox.
- Verify no regression in Desmos or GeoGebra selection and state behavior.
- Record dependency versions, license review, browser evidence, known scope
  limits, and consumer-pad disposition in the PR.

Exit evidence: every PRD acceptance criterion is linked to an automated test or
named manual artifact.

## Definition Of Done

The implementation is complete when:

- A host can select `{ provider: { id: "calculator-cortex" } }` for basic,
  scientific, and graphing calculators.
- The runtime makes no calculator-related network request and ships no
  proprietary calculator code or service dependency.
- All input paths share one canonical policy, and learner input is never
  executed or compiled as JavaScript.
- Evaluation and graph sampling are worker-bounded, time-limited, cancellable by
  generation, and recover after worker termination.
- Provider state is versioned, validated atomically, and covered by round-trip
  and hostile-input fixtures.
- The UI meets the PRD accessibility requirements, including graph summary and
  keyboard trace.
- Existing Desmos and GeoGebra public behavior remains unchanged and Desmos is
  still the omission default.
- New packages are publishable, fixed-version aligned, documented, attributed,
  and verified from built `dist` artifacts.
- Consumer-impact documentation and every required repository gate pass.
