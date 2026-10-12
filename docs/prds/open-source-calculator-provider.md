# Open-Source Calculator Provider

Status: Accepted, 2026-08-26

Implementation status: shipped in pie-players as `@pie-players/pie-calculator-cortex`,
selected through the `calculator-cortex` registration in
`@pie-players/pie-default-tool-loaders`.

Owner: PIE Players maintainers

This PRD defines the Cortex calculator provider, a self-hosted basic, scientific
and graphing calculator behind the provider-neutral calculator seam: its
settings, defaults and hard limits, restricted mode, expression capability and
persisted state. It is for maintainers of the package; the
[package README](../../packages/calculator-cortex/README.md) is the host
reference for configuring it. The
[implementation specification](../architecture/open-source-calculator-provider-implementation.md)
owns the module boundaries, the worker protocol and the failure model.

Related architecture:

- [Open-source calculator provider implementation](../architecture/open-source-calculator-provider-implementation.md)
- [Tool provider system](../tools-and-accomodations/tool_provider_system.md)
- [Tool host contract](../tools-and-accomodations/tool_host_contract.md)

Integrator guide: the
[`@pie-players/pie-calculator-cortex` README](../../packages/calculator-cortex/README.md).

## Problem

PIE Players delivered calculators only through vendor-backed providers and owned
no bundled, auditable calculator. Deployments that required offline delivery,
control over assessment restrictions, or an implementation built entirely from
open-source dependencies had to choose a third-party calculator runtime with its
own delivery and licensing constraints.

The Cortex provider is additive and self-hosted, and plugs into the existing
provider-neutral calculator seam. It covers basic, scientific and focused
graphing use cases, without feature parity with Desmos or GeoGebra.

It is built on:

- [MathLive](https://github.com/arnog/mathlive) for accessible mathematical
  input; the mode-specific keypad is the package's own.
- [CortexJS Compute Engine](https://github.com/cortex-js/compute-engine) for
  parsing, canonical MathJSON, validation, and numeric evaluation.
- [JSXGraph](https://jsxgraph.org/home/) for the graph viewport and rendered
  series.

PIE bundles all three, so no runtime API key, vendor service, CDN or network
connection is required. The package's `package.json` pins them and its
`LICENSE.md` carries their notices.

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
- Consuming package: `@pie-players/pie-default-tool-loaders`, whose
  `CortexToolProvider` adapter lazy-imports the provider.
- Runtime environment: browser-only provider with module Web Workers; the public
  types remain safe to import in TypeScript without creating browser globals.

The package root owns and exports:

- `CortexCalculatorProvider`
- `CortexCalculatorProviderInit`
- `CortexCalculatorProviderConfig`
- `CortexCalculatorSettings`
- `CortexCalculatorMessages`, `CortexCalculatorMessageKey`, and
  `CortexCalculatorMessageOverrides`
- `cortexEnglishMessages` and `cortexDutchMessages`, the shipped catalogs
- `localeDirection(locale)`, the writing direction a locale resolves to
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

The public types below are the shipped contract. The owning package factors
them into internal modules, but the names and semantics are reviewed as one root
export surface.

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
  | "log-base-n"
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
provider-state convention. The calculator registration in
`@pie-players/pie-default-tool-loaders` accepts `"calculator-cortex"` as
`provider.id`, matching `"calculator-desmos"` and `"calculator-geogebra"`.

```ts
{
  tools: {
    providers: {
      calculator: {
        provider: { id: "calculator-cortex" },
      },
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
| Worker start | n/a | 20 s |
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

`CalculatorProviderConfig.locale` configures visible labels, the MathLive
locale, the keypad's and MathLive's decimal separator, locale-aware graph
numbers, the decimal separator in a displayed answer and in the history tape, and
the default writing direction. One resolver serves all of them, so a tapped key,
a typed character and an answer read back agree: an `nl-NL` calculator whose
keypad writes `1,5` answers `1,5`.

- **Catalogs.** The package ships complete English and Dutch catalogs, selects
  one by primary language, and falls back to English for other locales.
  `settings.messages` is a typed partial override for every visible label,
  accessible name, status and recoverable error; omitted keys keep the selected
  catalog value.
- **Direction.** `settings.direction` overrides the automatic `ltr`/`rtl`
  resolution for host policy.
- **Canonical numbers.** Validation, serialized state, `getResult` and the
  history entries a host reads use a locale-independent canonical numeric
  representation, so changing locale does not reinterpret persisted
  calculations. The locale separator is applied at the display boundary only, as
  a separator swap rather than a reformat, so a host's `displayPrecision` and the
  exponential form of a large or small answer survive it.

### Expression capability

All modes support finite numeric literals, addition, subtraction,
multiplication, division, unary negation, and parentheses.

Basic mode additionally supports square root and percent. Percent is evaluated
as division by 100; it is not a separate percentage-of or financial operation.

Scientific mode adds powers and roots, exponential and logarithmic functions,
trigonometric and inverse-trigonometric functions, absolute value, factorial,
the constants `pi` and `e`, and scientific notation. Trigonometric input and
results honor the configured angle mode.

Logarithms are three capabilities: `natural-log` is base e, `common-log` is
base 10, and `log-base-n` is every other base, base 2 included. An arbitrary
base is its own capability so that a host granting base 10 can refuse it: the
Compute Engine parses `\log_{3}(9)` as the same `Log` operator that carries base
10, and spells base 2 as `Lb`. All three are in the default scientific and
graphing sets, matching the reference implementations; basic mode has none of
them.

The factorial is the Gamma continuation off the integers: `2.5!` answers
`3.32335097`, where a handheld raises a domain error. Desmos answers the same,
and Desmos is the reference. It remains a domain error at the negative integers,
where Gamma has poles.

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

The provider is additive and defines no custom element. It does not change PIE
element content contracts, versioned `pie-*--version-*` tags, contract
identifiers, player session state, assessment submission, or `pie-item-player`
methods and events.

- Preserve the generic `calculator` tool ID and its externally observed
  `calculator:<scope>` runtime prefix.
- Preserve the generic `<pie-tool-calculator>` element and inline calculator
  behavior.
- Select Cortex through `tools.providers.calculator` in the generic
  `<pie-tool-calculator>` and `<pie-tool-calculator-inline>` elements, with no
  provider-specific tag.
- Keep existing Desmos and GeoGebra registration IDs, settings, and state
  behavior unchanged.
- Do not strip or normalize versioned PIE tag names.
- Do not synthesize, prefix, slug, or otherwise mutate contract identifiers.
- Do not add a compatibility shim or a cross-provider state bridge.

Provider selection and the scoped calculator ID are externally observed
surfaces, recorded in
[consumer API dependencies](../integrations/consumer-api-dependencies.md).

## Data Ownership And Host Responsibilities

PIE owns:

- Calculator rendering, input, evaluation, history UI, graph sampling, and
  accessible interaction.
- Validation and enforcement of calculator type, expression capability,
  restriction settings, precision, complexity, and time limits.
- Versioned provider-state serialization and atomic import validation.
- Safe lifecycle management for MathLive and its page-wide settings, Compute
  Engine workers, and JSXGraph boards.
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
- No focus trap in the keypad or the JSXGraph board.
- No required animation; any optional transition honors reduced-motion
  preferences.
- Usable layouts at 200% browser zoom and 320 CSS-pixel width.

The color theme comes from the generic `CalculatorProviderConfig.theme`:
`"light"`, `"dark"` or `"auto"`, the default, which follows the operating
system's `prefers-color-scheme`. The package's light and dark defaults are
fallbacks beneath canonical PIE semantic tokens, so a host theme or a PIE color
scheme overrides them. Hosts may override the six graph colors,
`--pie-calculator-series-1` to `--pie-calculator-series-6`; line style remains
the redundant non-color cue, and custom colors carry the host's contrast
obligation. RTL uses the same DOM and logical CSS properties rather than a
separate layout.

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
- MathLive settings-lease ownership (locale and decimal separator) and cleanup
  with multiple calculator instances.
- Privacy contract tests proving telemetry omits expressions, results, state,
  history, and coordinates.
- Existing Desmos and GeoGebra provider-selection tests as regression coverage.
- Custom-element registration, direct imports, published exports, and package
  artifact contents including fonts, workers, styles, and third-party notices.
- Automated accessibility checks and manual evidence for keyboard-only and
  screen-reader flows in all three modes.

Commands:

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

- Changeset: changes to the public settings, error or state types carry one.
- Migration notes: none. Provider selection is additive and Desmos remains the
  default.
- Documentation: the package README covers the isolated demos, localization,
  the keypad, panel fitting and theming. Settings, defaults and hard limits,
  restricted mode and the state schema are documented in this PRD only.
- Release risk: medium. The provider is additive, but brings three bundled
  browser libraries, a worker boundary, a lease over MathLive's page-wide
  settings, and a persisted provider-state schema.

## Open Questions

None.
