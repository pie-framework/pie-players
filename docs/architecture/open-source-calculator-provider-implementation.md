# Open-Source Calculator Provider Implementation Specification

Status: Implemented

Related PRD:
[`../prds/open-source-calculator-provider.md`](../prds/open-source-calculator-provider.md)

## Purpose

This document records the module boundaries, runtime ownership, worker
protocol and state flow of the Cortex provider behind the provider-neutral
calculator contract.

The implementation is a deep provider module. Hosts see the existing
`CalculatorProvider`/`Calculator` seam plus typed Cortex configuration and state.
MathLive, Compute Engine, JSXGraph, worker scheduling, graph sampling, and the
MathLive settings lease remain internal details.

## Architectural Constraints

- Desmos remains the default. Cortex is selected explicitly with
  `provider.id: "calculator-cortex"`.
- The runtime is fully bundled and self-hosted. No calculator operation may
  create a network request or require an API key.
- `@pie-players/pie-calculator` remains provider-neutral and names no vendor or
  implementation.
- `@pie-players/pie-assessment-toolkit` remains capability-neutral and holds no
  calculator adapter or provider-selection policy.
- `@pie-players/pie-default-tool-loaders` remains the composition layer that
  names the packaged provider IDs and holds the calculator adapters, which
  lazy-import their engines.
- The generic `<pie-tool-calculator>` element mounts every provider; Cortex adds
  no element.
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
@pie-players/pie-default-tool-loaders
    CortexToolProvider registration adapter and lazy loading

@pie-players/pie-tool-calculator-shared
    generic shell and inline shell, registered as <pie-tool-calculator> and
    <pie-tool-calculator-inline> for every provider
```

### Public packages

`@pie-players/pie-calculator-cortex` owns the provider implementation and all
Cortex-specific public types, bundles the three runtime dependencies and the
worker entry, and exposes no internal library object in its public API. It
joins the fixed Changesets release block.

Cortex has no element of its own. `provider.id = "calculator-cortex"` in
`tools.providers.calculator` selects it, and the generic element mounts it under
the `calculator` tool id. Provider-specific wrapper packages were removed: they
differed from the generic element only in tag name.

### Existing packages changed

- `@pie-players/pie-default-tool-loaders` adds `CortexToolProvider`, following
  the final GeoGebra adapter shape and lazy-importing
  `@pie-players/pie-calculator-cortex`, which it declares as a dependency. It
  recognizes `"calculator-cortex"`, maps it to the Cortex adapter, and preserves
  `"calculator-desmos"` as the omission default.
- `@pie-players/pie-tool-calculator-shared` gains a provider-neutral
  registration entry for the generic `<pie-tool-calculator>` element.
- The packaged calculator module loader imports that neutral registration entry
  instead of importing the Desmos-named direct tool package merely to define
  the generic tag.

## Provider Module Design

Source layout of `packages/calculator-cortex/src/`:

```text
index.ts
cortex-provider.ts
runtime.ts
calculator-controller.ts
settings.ts
localization.ts
function-policy.ts
state-codec.ts
errors.ts
types.ts
evaluation-client.ts
evaluation-engine.ts
evaluation-worker.ts
module-worker.ts
worker-protocol.ts
mathlive-runtime.ts
mathlive-browser.d.ts
CalculatorView.svelte
MathFieldInput.svelte
Keypad.svelte
keypad-layouts.ts
GraphView.svelte
Icon.svelte
icons.ts
```

### `cortex-provider.ts`

Owns `CortexCalculatorProvider`; the concrete `Calculator` is in `runtime.ts`,
which the provider loads on the first `createCalculator()`. The provider
coordinates lifecycle and delegates all specialized work:

- `initialize()` verifies browser and module-worker support without mounting
  UI.
- `createCalculator()` validates settings, creates one instance owner, mounts
  the Svelte view, starts its evaluation client, and returns only after the
  primary input is ready.
- `destroy()` prevents new instances and releases provider-level resources. An
  instance has its own idempotent `destroy()` for view, board, worker, event,
  observer, and MathLive settings-lease cleanup.
- `getCapabilities()` reports history, expressions, graphing, export, and
  keyboard/mouse/touch support with a maximum precision of 21.

The provider uses `providerId = "cortex"`. Loader selection uses the separate
registration ID `"calculator-cortex"`.

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
locale to MathLive's locale and decimal separator, which the keypad's decimal key
shares, while retaining locale-independent canonical numbers. The rest of the
implementation consumes only immutable `ResolvedCortexSettings`.

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
renders its own mode-specific keypad (`Keypad.svelte`, with layouts in
`keypad-layouts.ts`) as real buttons, empties MathLive's context menu, and hides
MathLive's menu and keyboard toggles. MathLive's virtual keyboard stays off: it
contains no focusable element, so keyboard and switch users could not operate
it. Physical keyboard access remains available for every visible operation.

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
bundler-owned URL. Consumers do not configure a worker CDN. A worker script on
another origin, such as a CDN, starts from a page-origin `blob:` module that
imports it (`module-worker.ts`). The package artifact test verifies that the
worker and its dependent chunks are present.

The provider creates the worker when it creates a calculator, so fetching,
compiling and running the worker's module overlaps the learner's first edit. The
worker posts `ready` once its module has run.

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

// Posted once, after the worker's module has run.
interface WorkerReadyMessage {
  protocolVersion: 1;
  kind: "ready";
}
```

The protocol is internal but versioned so stale chunks fail closed with
`worker-unavailable` instead of being misread.

### Time and cancellation

- Set Compute Engine's evaluation time limit for every request.
- Start a main-thread watchdog for the configured limit plus a small fixed
  message-delivery allowance. It runs from the worker's `ready`, so a request
  made while the worker starts waits for it and the start is never charged to a
  calculation.
- On watchdog expiry, terminate the worker, reject outstanding requests with
  `evaluation-timeout`, create a fresh worker for later requests, and never
  reuse the timed-out engine.
- Allow a new worker 20 s to post `ready`. Past that, terminate it and reject
  outstanding requests with `worker-unavailable`; the next request creates a
  fresh worker.
- Superseded graph requests are logically cancelled by generation. Their
  responses are ignored even if the worker finishes them.
- Destroy rejects pending requests, removes listeners, and terminates the
  instance worker.

The 100-2,000 ms host setting is validated before crossing the worker boundary.
The worker applies the same hard range and does not trust the request.

## Graph Sampling And Rendering

JSXGraph is loaded only when a graphing calculator is created. Basic and
scientific bundles must not initialize it.

`GraphView.svelte` turns worker results into JSXGraph curves built from numeric
`x`/`y` arrays. It does not construct a callable function from learner input.
The graph board receives those arrays and fixed PIE-owned styling only.

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

`GraphView.svelte` owns the JSXGraph board, resize, controls, expression-to-style
mapping, accessible summary, and trace UI. A `ResizeObserver` schedules board
resize without creating reactive update loops. Board and observer cleanup are
idempotent.

Keyboard trace selects one visible series and moves along its latest sampled
points. It exposes labeled previous/next controls and announces expression, x,
and y. It is an alternative representation, not a claim that JSXGraph's canvas
or SVG output alone is accessible.

## MathLive Settings Ownership

`MathfieldElement.locale` and `MathfieldElement.decimalSeparator` are static
properties, shared with every other mathfield on the page. Each mounted math
field holds its own ownership token. `mathlive-runtime.ts` stores a lease record
on `globalThis` under a PIE-owned `Symbol.for(...)` key so separate bundled
copies still coordinate.

On its first focus, a field acquires the lease:

1. The first acquirer captures the page's locale and decimal separator; a later
   acquirer takes ownership and keeps that capture.
2. The lease records the field's token as current owner.
3. The calculator's locale and decimal separator are applied.

On unmount, a field's release restores the captured settings only if the lease
still names its token, so a former owner's release is inert. A static property
holds one locale, so two calculators open at different locales share whichever
acquired last.

MathLive's virtual keyboard is never shown: every field sets
`mathVirtualKeyboardPolicy = "manual"`. Unit tests in
`calculator-cortex-mathlive-keyboard.test.ts` cover the restoration, a second
owner making the first release inert, and re-acquisition keeping the captured
page settings.

MathLive fonts, sounds used by the chosen UI, and other required assets are
packaged locally. Unsupported optional assets are disabled rather than fetched
from a default CDN.

## UI And Accessibility Structure

`CalculatorView.svelte` uses Svelte 5 runes and PIE-specific class/data hooks.
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
| Worker not ready within 20 s | `worker-unavailable` | Tool-level error state | Next request starts a fresh worker |

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
