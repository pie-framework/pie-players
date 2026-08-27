# @pie-players/pie-calculator-desmos

PIE's provider adapter for the Desmos Graphing, Scientific, and Four Function
Calculator APIs.

This package contains only PIE-authored adapter code. It does not bundle,
redistribute, cache, or self-host Desmos's `calculator.js` or other Desmos
assets. Unless the host has already loaded a build, the provider loads the
stable v1.12 script directly from `www.desmos.com`.

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
- self-hosting is a Desmos partner option, not a general substitute for loading
  the official CDN script.

Desmos's documented browser integration requires the key in the
`calculator.js` URL. A browser user can therefore observe it in the network
request. Fetching the key at runtime keeps it out of source and static bundles,
but does not make it a server-only secret.

For backwards compatibility, calling `initialize()` with no key still loads the
historical unkeyed v1.12 URL when `window.Desmos` is absent. Existing clients
therefore continue to work without new configuration. That technical fallback
does not grant or imply a Desmos license; the deploying host remains responsible
for obtaining the rights required for its application.

## Provider loading

Pass the application key when the licensed deployment should load Desmos from
its official CDN:

```typescript
import { DesmosCalculatorProvider } from "@pie-players/pie-calculator-desmos";

const provider = new DesmosCalculatorProvider();
await provider.initialize({
  apiKey: runtimeConfig.desmosApiKey,
});
```

The provider loads:

```text
https://www.desmos.com/api/v1.12/calculator.js?apiKey=<application-key>
```

A host may fetch the key from an authenticated, same-origin endpoint before
calling `initialize()`. That endpoint should be limited to authorized users,
rate-limited as appropriate, and returned with `Cache-Control: private,
no-store`. The key still reaches those users' browsers as required by the
Desmos API.

If a Desmos agreement permits the host to preload or self-host the API, load
that build first and initialize without a key:

```typescript
if (!window.Desmos) throw new Error("Authorized Desmos API build was not loaded");

const provider = new DesmosCalculatorProvider();
await provider.initialize();
```

This package deliberately has no script-proxy or self-hosting option. Do not
copy or proxy `calculator.js` unless the application's Desmos agreement grants
that right.

## Usage

Import the provider and its owner-defined per-instance configuration from this package:

```typescript
import {
  DesmosCalculatorProvider,
  type DesmosCalculatorConfig,
  type DesmosCalculatorProviderConfig,
} from '@pie-players/pie-calculator-desmos';
```

`DesmosCalculatorProviderConfig` extends the provider-neutral calculator configuration and keeps Desmos API options under its `desmos` field. `DesmosCalculatorConfig` is the type of that nested field.

The provider also accepts the same options through the provider-neutral
`settings` object used by the packaged toolkit composition. When both forms are
present, `settings` wins.

### Basic calculator

```typescript
const calculator = await provider.createCalculator(
  "basic",
  document.getElementById("calculator-container")!,
);
```

### Scientific calculator

```typescript
const calculator = await provider.createCalculator(
  "scientific",
  document.getElementById("calculator-container")!,
  {
    settings: {
      degreeMode: true,
      functionDefinition: true,
    },
  },
);
```

### Graphing calculator

```typescript
const calculator = await provider.createCalculator(
  "graphing",
  document.getElementById("calculator-container")!,
  {
    settings: {
      expressions: true,
      settingsMenu: true,
      zoomButtons: true,
      plotInequalities: true,
    },
  },
);
```

### Restricted/test mode

```typescript
const calculator = await provider.createCalculator("graphing", container, {
  restrictedMode: true,
  settings: {
    restrictedFunctions: true,
  },
});
```

Assessment restrictions and the Desmos API tier are separate concerns. A
restricted calculator still requires a key licensed for the application.

See the `DesmosCalculatorConfig` interface exported by `@pie-players/pie-calculator-desmos` for all available options.

Common options:

- `expressions`: Show/hide expression list (graphing)
- `settingsMenu`: Show/hide settings menu
- `zoomButtons`: Show/hide zoom controls
- `degreeMode`: Use degrees instead of radians
- `border`: Show calculator border
- `links`: Enable links to Desmos.com

## State management

Save and restore calculator state:

```typescript
const state = calculator.exportState();
localStorage.setItem("calculator-state", JSON.stringify(state));

const savedState = JSON.parse(localStorage.getItem("calculator-state")!);
calculator.importState(savedState);
```

## Links

- [Desmos API v1.12 documentation](https://www.desmos.com/api/v1.12/docs/index.html)
- [Desmos API Terms](https://www.desmos.com/api-terms)
- [Desmos My API](https://www.desmos.com/my-api)
- [PIE Calculator Base Package](https://www.npmjs.com/package/@pie-players/pie-calculator)
