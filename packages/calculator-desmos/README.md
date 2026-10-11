# @pie-players/pie-calculator-desmos

The calculator adapter for the Desmos Four Function, Scientific and Graphing
Calculator APIs. It implements the provider contract from
[`@pie-players/pie-calculator`](../calculator/README.md) and is the toolkit's
calculator when no `provider.id` is set; toolkit hosts supply the key as
[Calculator with host auth](../../docs/tools-and-accomodations/tool_provider_system.md#calculator-with-host-auth)
describes. Hosts that mount a calculator themselves use
`DesmosCalculatorProvider` directly. The [Cortex](../calculator-cortex/README.md)
adapter needs no key, and the [GeoGebra](../calculator-geogebra/README.md)
adapter implements the same contract.

The package contains only PIE-authored adapter code. It does not bundle,
redistribute, cache or self-host Desmos's `calculator.js` or other Desmos assets;
unless the host has already loaded a build, the provider loads the v1.12 script
from `www.desmos.com`.

## Installation

```bash
bun add @pie-players/pie-calculator-desmos
```

## Desmos license and API key

Desmos is separately licensed and is not covered by this package's MIT license.
Obtain a key for the application at [Desmos My API](https://www.desmos.com/my-api)
and follow the [Desmos API Terms](https://www.desmos.com/api-terms):

- the free Trial Tier is limited to personal non-commercial use or a 90-day
  internal evaluation for prospective commercial use;
- production use by end users and internal business use require the Commercial
  Tier unless a separate written agreement applies;
- the key identifies the licensed application and must not be committed to the
  repository or shared between unrelated applications; and
- self-hosting is a Desmos partner option, available only under such an
  agreement.

Desmos's documented browser integration requires the key in the `calculator.js`
URL, so a browser user can observe it in the network request. Fetching the key at
runtime keeps it out of source and static bundles; it remains visible to the
browser. The deploying host is responsible for obtaining the rights its
application requires. Assessment restrictions and the API tier are separate: a
restricted calculator still needs a key licensed for the application.

## Usage

`initialize()` loads Desmos with an `apiKey`, a `proxyEndpoint` that returns one,
or an already-loaded `window.Desmos`, and throws
`[DesmosProvider] An apiKey or proxyEndpoint is required to load Desmos.` with
none of them. It also throws outside a browser.

```typescript
import { DesmosCalculatorProvider } from "@pie-players/pie-calculator-desmos";

const provider = new DesmosCalculatorProvider();
await provider.initialize({
  apiKey: runtimeConfig.desmosApiKey,
});

const calculator = await provider.createCalculator(
  "graphing",
  document.getElementById("calculator-container")!,
  {
    settings: {
      zoomButtons: true,
      plotInequalities: true,
    },
  },
);
```

With an `apiKey` the provider loads:

```text
https://www.desmos.com/api/v1.12/calculator.js?apiKey=<application-key>
```

`proxyEndpoint` names an authenticated, same-origin endpoint: `initialize()`
fetches it with a GET and reads `{ apiKey }` from the JSON body. Limit that
endpoint to authorized users, rate-limit it as appropriate, and return it with
`Cache-Control: private, no-store`. The key still reaches those users' browsers,
as the Desmos API requires.

A host whose Desmos agreement permits preloading or self-hosting loads that build
first and initializes without a key:

```typescript
import { DesmosCalculatorProvider } from "@pie-players/pie-calculator-desmos";

if (!window.Desmos) throw new Error("Authorized Desmos API build was not loaded");

const provider = new DesmosCalculatorProvider();
await provider.initialize();
```

The package has no script-proxy or self-hosting option. Copying or proxying
`calculator.js` needs a Desmos agreement that grants that right.

`createCalculator()` initializes the provider on first use. `destroy()` on the
provider destroys every calculator it created and clears the key.

## Configuration

`initialize()` takes the shared `CalculatorProviderInit` whole, since this is the
adapter that needs a credential: `apiKey`, `proxyEndpoint` and `onTelemetry`.

`createCalculator()` takes `DesmosCalculatorProviderConfig`, the provider-neutral
config with `settings` typed as `DesmosCalculatorSettings`. The settings pass to
the Desmos constructor as Desmos API options; `apiKey` and `proxyEndpoint` are
stripped from them, since credentials are provider-level and Desmos rejects
unknown options. `locale` and `theme` are not applied to Desmos.

| Type | Desmos constructor |
| --- | --- |
| `basic` | `Desmos.FourFunctionCalculator` |
| `scientific` | `Desmos.ScientificCalculator` |
| `graphing` | `Desmos.GraphingCalculator` |

The adapter's defaults, which `settings` overrides:

| Option | Default |
| --- | --- |
| `degreeMode` | `true` |
| `qwertyKeyboard` | `false` |
| `settingsMenu`, `notes`, `folders`, `sliders`, `tables` | `true` for `graphing`, otherwise `false` |

`DesmosCalculatorSettings` types the documented options, among them
`expressions`, `expressionsTopbar`, `settingsMenu`, `zoomButtons`, `degreeMode`,
`border`, `links`, `restrictedFunctions`, `lockViewport` and
`additionalFunctions`; see the
[Desmos API v1.12 documentation](https://www.desmos.com/api/v1.12/docs/index.html)
for each option's meaning.

### Restricted mode

```typescript
import { DesmosCalculatorProvider } from "@pie-players/pie-calculator-desmos";

const provider = new DesmosCalculatorProvider();
const calculator = await provider.createCalculator("graphing", container, {
  restrictedMode: true,
  settings: {
    restrictedFunctions: true,
  },
});
```

`restrictedMode: true` sets `expressionsTopbar`, `settingsMenu`, `zoomButtons`
and `links` to `false` after `settings` is applied, so a host cannot relax it. It
leaves the expression list on, because on a graphing calculator the list is the
only way to enter a function. A host that wants the list gone passes
`settings: { expressions: false }`.

## Calculator behavior

Desmos exposes values and state on the graphing calculator only:

| Method | `graphing` | `basic`, `scientific` |
| --- | --- | --- |
| `getValue()` | The Desmos graph state as JSON. | `""` |
| `setValue(value)` | Parses JSON and sets the graph state. | No effect |
| `evaluate(latex)` | The numeric value of a temporary helper expression, read after 100 ms; the input itself when Desmos gives none. | The input unchanged |
| `exportState()` | `providerState` is the Desmos graph state. | `value: ""`, `providerState: {}` |

`clear()`, `resize()`, `focus()` and `destroy()` work on every type; `focus()`
moves to the first expression on a graphing calculator. Desmos exposes no
history, so the capabilities report `supportsHistory: false`, with a
`maxPrecision` of 15.

## State

`exportState()` returns `CalculatorState` with `provider: "desmos"`.
`importState()` throws for any other provider; it applies `providerState` when
present and otherwise falls back to `value`. A basic or scientific calculator
therefore restores nothing. The toolkit's `<pie-tool-calculator>` does not
persist state, so saving and restoring belong to hosts that drive the adapter
directly.

```typescript
import type { CalculatorState } from "@pie-players/pie-calculator";

const state = calculator.exportState();
localStorage.setItem("calculator-state", JSON.stringify(state));

const savedState: CalculatorState = JSON.parse(localStorage.getItem("calculator-state")!);
calculator.importState(savedState);
```

## Telemetry

`onTelemetry` receives start, success and error events for the two backend
operations, each with `toolId: "calculator"`, `backend: "desmos"`, `operation`,
and `duration` on completion:

| Events | `operation` | Error `errorType` |
| --- | --- | --- |
| `pie-tool-backend-call-start`, `-success`, `-error` | `proxy-auth-fetch` | `CalculatorProxyAuthError` |
| `pie-tool-library-load-start`, `-success`, `-error` | `desmos-script-load` | `ToolLibraryLoadError` |

Error events also carry the error `message`. A failing callback is logged and
does not affect the calculator.

## Exports

| Export | Kind |
| --- | --- |
| `DesmosCalculatorProvider` | The `CalculatorProvider` implementation (`providerId: "desmos"`). |
| `DesmosCalculatorProviderConfig` | Type: per-calculator config. |
| `DesmosCalculatorSettings` | Type: the Desmos API options `settings` accepts. |

## Links

- [Desmos API v1.12 documentation](https://www.desmos.com/api/v1.12/docs/index.html)
- [Desmos API Terms](https://www.desmos.com/api-terms)
- [Desmos My API](https://www.desmos.com/my-api)
