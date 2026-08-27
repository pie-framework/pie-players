# Open-Source Calculator Provider

Status: Implemented

Owner: `@pie-players/pie-calculator-cortex`

Related architecture:

- [`../architecture/open-source-calculator-provider-implementation.md`](../architecture/open-source-calculator-provider-implementation.md)
- [`../tools-and-accomodations/tool_provider_system.md`](../tools-and-accomodations/tool_provider_system.md)
- [`../tools-and-accomodations/tool_host_contract.md`](../tools-and-accomodations/tool_host_contract.md)

## Problem

PIE Players can deliver calculators through vendor-backed providers, but it does
not yet own a fully bundled, auditable calculator implementation. Deployments
that require offline delivery, control over assessment restrictions, or an
implementation composed entirely from open-source dependencies still have to
choose a third-party calculator runtime with its own delivery and licensing
constraints.

PIE needs an additive calculator provider that is self-hosted, works through the
existing provider-neutral calculator seam, and supports basic, scientific, and
focused graphing use cases without attempting immediate feature parity with
Desmos or GeoGebra.

The implementation is based on:

- [MathLive](https://github.com/arnog/mathlive) for accessible mathematical
  input and the mode-specific virtual keyboard.
- [CortexJS Compute Engine](https://github.com/cortex-js/compute-engine) for
  parsing, canonical MathJSON, validation, and numeric evaluation.
- [JSXGraph](https://jsxgraph.org/home/) for the graph viewport and rendered
  series.

These dependencies are bundled by PIE. No runtime API key, vendor service, CDN,
or network connection is required.

## Goals

- Add a fully bundled open-source calculator provider selected with
  `provider.id: "calculator-cortex"`.
- Support the existing `"basic"`, `"scientific"`, and `"graphing"`
  `CalculatorType` values.
- Preserve the existing provider-neutral `CalculatorProvider` and `Calculator`
  contracts rather than exposing MathLive, Compute Engine, or JSXGraph to host
  applications.
- Give hosts typed, monotonic configuration for precision, angle mode, history,
  clipboard behavior, allowed functions, evaluation limits, and graph defaults.
- Enforce the same expression policy for virtual-keyboard input, physical
  keyboard input, paste, programmatic values, and imported state.
- Keep evaluation and graph sampling bounded and responsive when expressions
  are malformed or computationally expensive.
- Meet WCAG 2.2 Level AA, including keyboard-only graph exploration and
  non-color identification of plotted expressions.
- Keep Desmos as the default provider and preserve existing Desmos and GeoGebra
  integrations unchanged.

## Non-Goals

- Full behavioral or visual parity with Desmos or GeoGebra.
- A computer algebra system, symbolic equation solver, or general-purpose
  mathematical programming environment.
- Geometry construction, 3D graphing, implicit relations, inequalities,
  parametric or polar plots, regressions, tables, sliders, statistics
  workspaces, or calculus commands in the first release.
- Executing learner-authored JavaScript or compiling learner expressions to
  JavaScript.
- Cross-provider state migration between Cortex, Desmos, and GeoGebra.
- Replacing Desmos as the default calculator provider in this PRD.
- Claiming QTI/PCI, LTI, xAPI, Caliper, or other standards conformance.

## Package And Export Ownership

- Owning package: `@pie-players/pie-calculator-cortex`.
- Public export path: `@pie-players/pie-calculator-cortex`.
- Consuming packages:
  - `@pie-players/pie-assessment-toolkit`
  - `@pie-players/pie-default-tool-loaders`
  - `@pie-players/pie-tool-calculator-cortex`
  - `@pie-players/pie-tool-calculator-inline-cortex`
  - `@pie-players/pie-tool-calculator-shared`
- Runtime environment: browser-only provider with module Web Workers; the public
  types remain safe to import in TypeScript without creating browser globals.

The package root owns and exports:

- `CortexCalculatorProvider`
- `CortexCalculatorProviderInit`
- `CortexCalculatorProviderConfig`
- `CortexCalculatorSettings`
- `CortexCalculatorMessages`, `CortexCalculatorMessageKey`, and
  `CortexCalculatorMessageOverrides`
- `CortexTextDirection`
- `CortexAngleMode`
- `CortexCalculatorError`
- `CortexCalculatorErrorCode`
- `CortexCalculatorState` and `CortexCalculatorStateV1`
- `CortexFunctionId`
- `CortexGraphSettings`, `CortexGraphState`, `CortexGraphViewport`, and
  `CortexGraphExpressionState`
- `CortexGraphLineStyle`

Hosts import provider-neutral contracts from `@pie-players/pie-calculator` and
these provider-specific configuration and state types only from
`@pie-players/pie-calculator-cortex`. Hosts do not import the three underlying
libraries through PIE package internals.

## Contract Shape

The public types below are the proposed implementation contract. The owning
package may factor them into internal modules, but the names and semantics are
reviewed as one root export surface.

```ts
import type {
  Calculator,
  CalculatorProvider,
  CalculatorProviderCapabilities,
  CalculatorProviderConfig,
  CalculatorType,
} from "@pie-players/pie-calculator";

export type CortexAngleMode = "degree" | "radian";

export type CortexFunctionId =
  | "square-root"
  | "power"
  | "root"
  | "exponential"
  | "natural-log"
  | "common-log"
  | "sine"
  | "cosine"
  | "tangent"
  | "inverse-sine"
  | "inverse-cosine"
  | "inverse-tangent"
  | "absolute-value"
  | "factorial";

export interface CortexGraphViewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface CortexGraphSettings {
  viewport?: CortexGraphViewport;
  showAxes?: boolean;
  showGrid?: boolean;
}

export interface CortexCalculatorSettings extends Record<string, unknown> {
  angleMode?: CortexAngleMode;
  calculationPrecision?: number;
  displayPrecision?: number;
  historyLimit?: number;
  evaluationTimeLimitMs?: number;
  allowedFunctions?: readonly CortexFunctionId[];
  allowClipboard?: boolean;
  messages?: CortexCalculatorMessageOverrides;
  direction?: "ltr" | "rtl" | "auto";
  graph?: CortexGraphSettings;
}

export interface CortexCalculatorProviderInit {
  onTelemetry?: (
    eventName: string,
    payload?: Record<string, unknown>,
  ) => void | Promise<void>;
}

export interface CortexCalculatorProviderConfig
  extends Omit<CalculatorProviderConfig, "settings"> {
  settings?: CortexCalculatorSettings;
}

export type CortexCalculatorErrorCode =
  | "invalid-expression"
  | "unsupported-expression"
  | "expression-too-complex"
  | "evaluation-timeout"
  | "invalid-state"
  | "worker-unavailable";

export class CortexCalculatorError extends Error {
  readonly code: CortexCalculatorErrorCode;
  readonly recoverable: boolean;
}

export class CortexCalculatorProvider implements CalculatorProvider {
  readonly providerId: "cortex";
  readonly providerName: "PIE Open-Source Calculator";
  readonly supportedTypes: CalculatorType[];
  readonly version: string;

  constructor(config?: CortexCalculatorProviderInit);

  initialize(): Promise<void>;
  createCalculator(
    type: CalculatorType,
    container: HTMLElement,
    config?: CortexCalculatorProviderConfig,
  ): Promise<Calculator>;
  supportsType(type: CalculatorType): boolean;
  destroy(): void;
  getCapabilities(): CalculatorProviderCapabilities;
}
```

`CalculatorProviderConfig.settings` is validated as
`CortexCalculatorSettings`. Unknown settings are ignored. Invalid known values
fail calculator creation with a typed `CortexCalculatorError` rather than being
silently clamped, except where the contract explicitly defines a default.

### Provider and registration identifiers

The provider instance uses `providerId: "cortex"`, matching the existing
provider-state convention. The assessment-toolkit registration identifier is
`"calculator-cortex"`, matching `"calculator-desmos"` and
`"calculator-geogebra"`.

```ts
{
  tools: {
    calculator: {
      provider: { id: "calculator-cortex" },
    },
  },
}
```

Omitting `provider.id` continues to select `"calculator-desmos"`.

### Defaults and hard limits

| Concern | Default | Accepted range or hard limit |
| --- | --- | --- |
| Angle mode | `"degree"` | `"degree"` or `"radian"` |
| Calculation precision | 15 digits | 1-21 digits |
| Display precision | 10 digits | 1-12 digits |
| Evaluation time limit | 1,000 ms | 100-2,000 ms |
| Expression input | n/a | 1,024 UTF-16 code units |
| Canonical AST | n/a | 256 nodes, maximum depth 32 |
| History | 20 entries | 0-50 entries |
| Graph expressions | 1 empty row | 6 expressions |
| Initial graph viewport | `[-10, 10]` on both axes | finite ordered bounds |

`restrictedMode: true` is monotonic. It disables clipboard operations and
nonessential MathLive context-menu actions and cannot be relaxed by
`settings.allowClipboard`. `allowedFunctions` can only remove functions from the
allowlist for the selected calculator type; it cannot grant functions that the
type does not support.

`CalculatorProviderConfig.locale` configures visible labels, MathLive locale,
the virtual keyboard's decimal separator, locale-aware graph numbers, and the
default writing direction. The package ships complete English and Dutch
catalogs, selects them by primary language, and falls back to English for other
locales. `settings.messages` is a typed partial override for every visible
label, accessible name, status, and recoverable error; omitted keys retain the
selected catalog value. `settings.direction` may override automatic `ltr`/`rtl`
resolution for host policy. Validation and serialized state use a
locale-independent canonical numeric representation, so changing locale does
not reinterpret persisted calculations.

### Expression capability

All modes support finite numeric literals, addition, subtraction,
multiplication, division, unary negation, and parentheses.

Basic mode additionally supports square root and percent. Percent is evaluated
as division by 100; it is not a separate percentage-of or financial operation.

Scientific mode adds powers and roots, exponential and logarithmic functions,
trigonometric and inverse-trigonometric functions, absolute value, factorial,
the constants `pi` and `e`, and scientific notation. Trigonometric input and
results honor the configured angle mode.

Graphing mode has the scientific capability set plus the single independent
variable `x`. It accepts explicit single-variable functions entered as `f(x)`
or `y=f(x)`. No other free symbols are permitted in the first release.

The implementation maps accepted input to canonical MathJSON and validates
canonical node/function names. It does not trust which UI path produced the
input. A custom virtual keyboard improves discoverability but is not a security
boundary.

### Graph interaction

Graphing mode provides:

- Up to six expression rows.
- Pan, zoom, and reset-to-default-viewport controls.
- A fixed accessible palette where every series has both a color and a line
  style.
- A text summary naming each visible expression and the current viewport.
- Keyboard trace controls that move across a selected series and announce the
  current `x` and `y` coordinates.

JSXGraph renders only sampled point series produced by PIE. Learner input is
never passed to JSXGraph as JavaScript and is never used to create a compiled
function.

### Errors

Recoverable expression errors are shown adjacent to the input without removing
the learner's edit buffer. Provider initialization and worker failures use the
existing calculator-tool error lifecycle. Error messages may identify the error
category and a safe location in the expression, but must not expose stack traces
or dependency internals.

Telemetry uses the existing calculator lifecycle vocabulary with
`backend: "cortex"`. Telemetry payloads never contain expression text, results,
history, serialized state, or graph coordinates entered by a learner.

## Compatibility

This PRD adds a calculator provider and custom elements but does not change PIE
element content contracts, versioned `pie-*--version-*` tags, contract
identifiers, player session state, assessment submission, or `pie-item-player`
methods and events.

- Preserve the generic `calculator` tool ID and its externally observed
  `calculator:<scope>` runtime prefix.
- Preserve the generic `<pie-tool-calculator>` element and inline calculator
  behavior.
- Add `<pie-tool-calculator-cortex>` and
  `<pie-tool-calculator-inline-cortex>` as provider-specific, additive tags.
- Keep existing Desmos and GeoGebra registration IDs, packages, tags, settings,
  and state behavior unchanged.
- Do not strip or normalize versioned PIE tag names.
- Do not synthesize, prefix, slug, or otherwise mutate contract identifiers.
- Do not add a compatibility shim or a cross-provider state bridge.

The implementation must review and, if necessary, refresh
[`../integrations/consumer-api-dependencies.md`](../integrations/consumer-api-dependencies.md)
because provider selection and the scoped calculator ID are externally observed
surfaces.

## Data Ownership And Host Responsibilities

PIE owns:

- Calculator rendering, input, evaluation, history UI, graph sampling, and
  accessible interaction.
- Validation and enforcement of calculator type, expression capability,
  restriction settings, precision, complexity, and time limits.
- Versioned provider-state serialization and atomic import validation.
- Safe lifecycle management for MathLive, the virtual keyboard, Compute Engine
  workers, and JSXGraph boards.
- Provider-specific errors and privacy-preserving lifecycle telemetry.

Hosts own:

- Selecting the provider and calculator mode allowed by product and assessment
  policy.
- Durable persistence and deciding when calculator state is saved or restored.
- Identity and authorization.
- Storage, retention, privacy, and product policy.
- Clipboard policy beyond the provider's enforced restricted-mode behavior.
- Reporting, gradebooks, workflow, and standards certification unless a
  concrete tested adapter PRD says otherwise.
- Reviewing deployment obligations for the bundled dependency licenses and PIE
  release notices.

## Serialization And Versioning

The provider exports its existing outer `CalculatorState` with
`provider: "cortex"`. `providerState` has this discriminated schema:

```ts
export type CortexGraphLineStyle = "solid" | "dashed" | "dotted";

export interface CortexGraphExpressionState {
  id: string;
  latex: string;
  colorIndex: number;
  lineStyle: CortexGraphLineStyle;
  hidden: boolean;
}

export interface CortexGraphState {
  viewport: CortexGraphViewport;
  expressions: CortexGraphExpressionState[];
}

export interface CortexCalculatorStateV1 {
  schema: "pie-calculator-cortex";
  version: 1;
  type: CalculatorType;
  angleMode: CortexAngleMode;
  calculationPrecision: number;
  displayPrecision: number;
  inputLatex: string;
  graph?: CortexGraphState;
}

export type CortexCalculatorState = CortexCalculatorStateV1;
```

The outer `CalculatorState.value` mirrors `providerState.inputLatex`, and its
optional `history` uses the existing provider-neutral
`CalculationHistoryEntry[]`. Exported state contains at most the configured
history limit. An import with conflicting `value` and `inputLatex` is invalid.

The provider package owns validation. Import is atomic: the current calculator
is unchanged unless the entire outer state and provider state validate. Unknown
fields are ignored and are not re-emitted. An unknown provider, schema, or
version is rejected. Numeric bounds, graph-expression counts, expression
budgets, style indices, identifiers, and all persisted expressions are
validated as untrusted input.

Version 1 has no migration or downgrade path. A later schema change must add an
explicit versioned migration with fixtures; it must not reinterpret unknown
versions heuristically. No state is migrated to or from another provider.

Required fixtures cover a basic state, scientific state with history, graphing
state with six styled expressions, unknown fields, invalid limits, mismatched
outer value, unknown versions, and malicious or over-budget expressions.

## Accessibility

The implementation must meet WCAG 2.2 Level AA and provide:

- A programmatically named MathLive input with visible mode and angle-state
  context.
- Full physical-keyboard operation without requiring the virtual keyboard.
- A custom, mode-specific virtual keyboard usable by pointer, touch, and
  keyboard.
- Predictable focus on mount, mode changes, clear, error recovery, and graph
  expression changes.
- Live-region result and error announcements that avoid duplicate speech.
- Package-owned localization for every visible label, accessible name, status,
  and recoverable error, with `lang` and `dir` on the calculator region.
- Graph series distinguished by line style as well as color, with contrast
  checked against PIE light and dark themes.
- A textual graph summary and keyboard trace alternative for information that
  would otherwise be available only visually.
- No focus trap in MathLive's global virtual keyboard or the JSXGraph board.
- No required animation; any optional transition honors reduced-motion
  preferences.
- Usable layouts at 200% browser zoom and 320 CSS-pixel width.

`theme: "auto"` follows the user's color-scheme preference. Light and dark
defaults use canonical PIE semantic tokens. Hosts may override the six
`--pie-calculator-series-*` graph colors; line style remains the redundant
non-color cue and custom colors retain the host's contrast obligation. RTL uses
the same DOM and logical CSS properties rather than a separate layout.

Automated axe coverage is required, but it does not replace manual keyboard and
screen-reader evidence for MathLive input, the virtual keyboard, result
announcements, and graph tracing.

## Standards Or Adapter Impact

This PRD does not add or claim QTI/PCI, LTI, xAPI, or Caliper conformance.
Calculator state is host-facing persistence data, not a standards projection.
A future adapter may consume the provider-neutral calculator lifecycle, but it
must not include learner expressions or results in analytics by default.

## Test Plan

Unit and contract coverage must include:

- Settings defaults, validation, monotonic restrictions, and per-mode function
  allowlists.
- Canonical AST validation for virtual keyboard, physical keyboard, paste,
  `setValue()`, evaluation, graph expressions, and imported state.
- Precision, angle mode, percent, factorial, domain errors, non-finite values,
  AST node/depth budgets, expression length, timeout, and worker restart.
- Provider lifecycle, multiple simultaneous instances, focus, resize, clear,
  history, export/import round trips, and atomic import failure.
- Graph viewport, expression limits, sampling cancellation, discontinuity
  segmentation, stale-response suppression, pan/zoom/reset, and keyboard trace.
- MathLive virtual-keyboard lease ownership and cleanup with multiple calculator
  instances.
- Privacy contract tests proving telemetry omits expressions, results, state,
  history, and coordinates.
- Existing Desmos and GeoGebra provider-selection tests as regression coverage.
- Custom-element registration, direct imports, published exports, and package
  artifact contents including fonts, workers, styles, and third-party notices.
- Automated accessibility checks and manual evidence for keyboard-only and
  screen-reader flows in all three modes.

Implementation gates:

```sh
bun run typecheck
bun run test
bun run check:source-exports
bun run check:consumer-boundaries
bun run check:custom-elements
bun run check:capability-neutrality
bun run check:player-tool-boundaries
bun run check:consumer-pad
```

Playwright-backed tests and the full local PR gate run outside the sandbox.

## Rollout And Release Notes

- Changeset required: yes; every entry is a patch bump under the repository's
  fixed-version policy.
- New publishable packages must be added to the Changesets `fixed` block in the
  same implementation change.
- Migration notes: none. Provider selection is additive and Desmos remains the
  default.
- Documentation updates: calculator setup, provider selection, restrictions,
  state, dependency attribution, direct custom-element entrypoints, and local
  demo coverage.
- Release risk: medium. The provider is additive, but introduces three bundled
  browser libraries, a worker boundary, global MathLive keyboard coordination,
  new custom-element packages, and a persisted provider-state schema.
- Implementation starts only after the GeoGebra calculator work is complete and
  its final package/export shape has been audited against this PRD.

## Open Questions

There are no product-scope questions blocking Draft review. Immediately before
implementation, revalidate:

- The final post-GeoGebra provider, package, and custom-element seams. If they
  differ from this PRD, amend this document rather than layering a second seam.
- Current dependency versions, browser support, licenses, bundled asset paths,
  and published security advisories for MathLive, Compute Engine, and JSXGraph.
- The exact accessible color-and-line-style palette against the current PIE
  theme tokens.
