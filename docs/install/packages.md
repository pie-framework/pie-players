# Packages and entry points

This page is for hosts choosing what to install. It lists every published
`@pie-players/*` package by job, says which entry points run in Node.js, which
load raw in a browser and which need a bundler, and gives the Node.js and
TypeScript settings the packages require.
[Versioning and stability](./versioning.md) covers versions and pinning.

## Requirements

- **Node.js 20 or later.** Every package declares `engines.node` `>=20.0.0`.
- **TypeScript `moduleResolution` `bundler`, `node16` or `nodenext`**, for a
  host that type-checks against the published declarations (see
  [TypeScript](#typescript)).
- **One exact version** for every `@pie-players/*` package
  ([pinning](./versioning.md#pinning)).

Hosts install no Svelte. The players and tools bundle their UI runtime
(Svelte 5; Lit for the print player), no package declares a peer dependency,
and no published declaration imports `svelte`.

## Choosing packages

| Job | Install |
| --- | --- |
| Render one item | `@pie-players/pie-item-player` |
| Render a section with passages, toolbars and the packaged tools | `@pie-players/pie-section-player`, which depends on the item player, the assessment toolkit and the default tool loaders |
| Print an item | `@pie-players/pie-print-player` |
| Theme the players | `@pie-players/pie-theme` |
| Synthesize text-to-speech on the host's server | one `tts-server-*` provider, in the server; the browser side, `@pie-players/tts-client-server`, comes with the default tool loaders ([TTS architecture](../accessibility/tts-architecture.md)) |
| Offer the sign-language accommodation | `@pie-players/pie-tool-sign-language`, which the packaged tool set leaves out |
| Put a calculator button in item headers | `@pie-players/pie-tool-calculator-inline-desmos`, which the packaged tool set leaves out |

## Package catalog

Each package name links to its README.
`@pie-players/pie-preloaded-player` is published separately, outside the
lockstep set ([preloaded player](../preloaded-player/readme.md)).

### Players

| Package | Custom elements | Purpose |
| --- | --- | --- |
| [`@pie-players/pie-item-player`](../../packages/item-player/README.md) | `<pie-item-player>` | Renders one item, loading its PIE elements by the `iife`, `esm` or `preloaded` strategy ([loading strategies](../item-player/loading-strategies.md)) |
| [`@pie-players/pie-section-player`](../../packages/section-player/README.md) | `<pie-section-player-splitpane>`, `<pie-section-player-vertical>`, `<pie-section-player-tabbed>`, `<pie-section-player-kernel-host>` | Renders a QTI 3.0 assessment section with its passages, items and toolbars, in one of three layouts or in a host's own ([custom layouts](../section-player/custom-layouts.md)) |
| [`@pie-players/pie-assessment-player`](../../packages/assessment-player/README.md) | `<pie-assessment-player-default>` | Reference assembly that runs an assessment's sections in a section player |
| [`@pie-players/pie-print-player`](../../packages/print-player/README.md) | `<pie-print>` | Renders the print views of an item's elements |

### Toolkit and shared runtime

| Package | Purpose |
| --- | --- |
| [`@pie-players/pie-assessment-toolkit`](../../packages/assessment-toolkit/README.md) | Tool coordination, accessibility catalogs, text-to-speech and policy services, with the `<pie-assessment-toolkit>`, `<pie-item-scope>`, `<pie-item-toolbar>` and `<pie-section-toolbar>` elements |
| [`@pie-players/pie-default-tool-loaders`](../../packages/default-tool-loaders/README.md) | The packaged tool set: registrations, tag map, placement preset, universal and empty profiles, and lazy module loaders |
| [`@pie-players/pie-players-shared`](../../packages/players-shared/README.md) | Element loaders, the markup sanitizer, i18n, shared types and UI utilities |
| [`@pie-players/pie-context`](../../packages/pie-context/README.md) | Context Protocol helpers through which the custom elements share runtime services |
| [`@pie-players/pie-theme`](../../packages/theme/README.md) | Theme tokens, CSS variables and the `<pie-theme>` element ([theming](../theming/how-theming-works.md)) |

### Tools

Each tool package registers one custom element. The tool id is the name a tool
configuration and a toolbar placement use.

| Package | Tool id | Custom element | Purpose |
| --- | --- | --- | --- |
| [`@pie-players/pie-tool-annotation-toolbar`](../../packages/tool-annotation-toolbar/README.md) | `annotationToolbar` | `<pie-tool-annotation-toolbar>` | Highlighting and underlining of selected text |
| [`@pie-players/pie-tool-answer-eliminator`](../../packages/tool-answer-eliminator/README.md) | `answerEliminator` | `<pie-tool-answer-eliminator>` | Strikes out answer choices |
| [`@pie-players/pie-tool-calculator-shared`](../../packages/tool-calculator-shared/README.md) | `calculator` | `<pie-tool-calculator>` | The calculator element, shared by every calculator provider |
| [`@pie-players/pie-tool-calculator-desmos`](../../packages/tool-calculator-desmos/README.md) | `calculator` | `<pie-tool-calculator>` | Registers the shared calculator element, which the packaged tool set already loads from `pie-tool-calculator-shared` |
| [`@pie-players/pie-tool-calculator-inline-desmos`](../../packages/tool-calculator-inline-desmos/README.md) | — | `<pie-tool-calculator-inline>` | Button in an item header that opens the item toolbar's calculator |
| [`@pie-players/pie-tool-dictionary`](../../packages/tool-dictionary/README.md) | `dictionary`, `dictionarySpanish` | `<pie-tool-dictionary>` | Dictionary lookup |
| [`@pie-players/pie-tool-picture-dictionary`](../../packages/tool-picture-dictionary/README.md) | `pictureDictionary`, `pictureDictionarySpanish` | `<pie-tool-picture-dictionary>` | Picture dictionary lookup |
| [`@pie-players/pie-tool-graph`](../../packages/tool-graph/README.md) | `graph` | `<pie-tool-graph>` | Coordinate-grid graphing |
| [`@pie-players/pie-tool-line-reader`](../../packages/tool-line-reader/README.md) | `lineReader` | `<pie-tool-line-reader>` | Reading-guide overlay |
| [`@pie-players/pie-tool-periodic-table`](../../packages/tool-periodic-table/README.md) | `periodicTable` | `<pie-tool-periodic-table>` | Periodic table reference |
| [`@pie-players/pie-tool-protractor`](../../packages/tool-protractor/README.md) | `protractor` | `<pie-tool-protractor>` | Draggable, rotatable protractor |
| [`@pie-players/pie-tool-ruler`](../../packages/tool-ruler/README.md) | `ruler` | `<pie-tool-ruler>` | Ruler |
| [`@pie-players/pie-tool-sign-language`](../../packages/tool-sign-language/README.md) | `signLanguage` | `<pie-tool-sign-language>` | Signed translation of an item, docked beside its content |
| [`@pie-players/pie-tool-theme`](../../packages/tool-color-scheme/README.md) | `theme` | `<pie-tool-theme>` | The color-scheme tool (`theme`): learner-selected color schemes |
| [`@pie-players/pie-tool-tts-inline`](../../packages/tool-tts-inline/README.md) | `textToSpeech` | `<pie-tool-tts-inline>` | Read-aloud control in item and passage headers |

### Calculator providers

| Package | Purpose |
| --- | --- |
| [`@pie-players/pie-calculator`](../../packages/calculator/README.md) | Provider interfaces and types, with no UI |
| [`@pie-players/pie-calculator-cortex`](../../packages/calculator-cortex/README.md) | Bundled open-source provider |
| [`@pie-players/pie-calculator-desmos`](../../packages/calculator-desmos/README.md) | Desmos provider; the Desmos API needs an API key |
| [`@pie-players/pie-calculator-geogebra`](../../packages/calculator-geogebra/README.md) | GeoGebra provider |

### Text-to-speech

| Package | Runs in | Purpose |
| --- | --- | --- |
| [`@pie-players/pie-tts`](../../packages/tts/README.md) | Browser or server | TTS interfaces and types, with no UI |
| [`@pie-players/tts-client-server`](../../packages/tts-client-server/README.md) | Browser | Provider that calls the host's TTS server for synthesis |
| [`@pie-players/tts-server-core`](../../packages/tts-server-core/README.md) | Server | Interfaces and types for server-side providers |
| [`@pie-players/tts-server-google`](../../packages/tts-server-google/README.md) | Server | Google Cloud Text-to-Speech provider, with speech marks |
| [`@pie-players/tts-server-polly`](../../packages/tts-server-polly/README.md) | Server | AWS Polly provider, with speech marks |
| [`@pie-players/tts-server-sc`](../../packages/tts-server-sc/README.md) | Server | SC-backed provider, with speech marks |

### Development panels

These panels inspect a running player during development.

| Package | Custom element | Shows |
| --- | --- | --- |
| [`@pie-players/pie-section-player-tools-event-debugger`](../../packages/section-player-tools-event-debugger/README.md) | `<pie-section-player-tools-event-debugger>` | Section-player session broadcasts |
| [`@pie-players/pie-section-player-tools-instrumentation-debugger`](../../packages/section-player-tools-instrumentation-debugger/README.md) | `<pie-section-player-tools-instrumentation-debugger>` | Instrumentation records |
| [`@pie-players/pie-section-player-tools-pnp-debugger`](../../packages/section-player-tools-pnp-debugger/README.md) | `<pie-section-player-tools-pnp-debugger>` | Personal Needs and Preferences (PNP) inputs and tool visibility decisions |
| [`@pie-players/pie-section-player-tools-session-debugger`](../../packages/section-player-tools-session-debugger/README.md) | `<pie-section-player-tools-session-debugger>` | Section sessions |
| [`@pie-players/pie-section-player-tools-tts-settings`](../../packages/section-player-tools-tts-settings/README.md) | `<pie-section-player-tools-tts-settings>` | TTS settings |
| [`@pie-players/pie-section-player-tools-shared`](../../packages/section-player-tools-shared/README.md) | — | UI and helpers the panels share |

The item player's `./components/item-session-debugger-element` entry registers
`<pie-item-player-session-debugger>`, the item-level session panel.

## Entry points

A package's entry points are the subpaths in its `exports` map
([public surface](./versioning.md#public-surface)). Each falls in one of three
classes.

### Node-safe

These import in Node.js without a DOM, for example in a server or during
server-side rendering. A release gate imports each one in plain Node.js from
the packed tarball.

| Package | Entry points |
| --- | --- |
| `@pie-players/pie-assessment-toolkit` | `.`, `./runtime/engine` |
| `@pie-players/pie-section-player` | `./contracts/runtime-host-contract`, `./contracts/host-hooks`, `./policies`, `./item-section` |
| `@pie-players/pie-default-tool-loaders` | `.` |
| `@pie-players/pie-players-shared` | `.` |
| `@pie-players/pie-context` | `.` |
| `@pie-players/pie-calculator`, `@pie-players/pie-calculator-cortex`, `@pie-players/pie-calculator-desmos` | `.` |
| `@pie-players/pie-tts`, `@pie-players/tts-client-server`, `@pie-players/tts-server-core`, `@pie-players/tts-server-google`, `@pie-players/tts-server-polly` | `.` |

`@pie-players/tts-server-sc` imports in Node.js as well, but the gate does not
test it. Treat every entry point outside this table as browser code.

### Browser, raw from a CDN

These import no bare specifier, so a page loads them through
`<script type="module">` with no bundler and no import map.
[Loading from a CDN](./cdn.md) covers loading them; a bundler loads them
too.

| Entry point | File |
| --- | --- |
| `@pie-players/pie-item-player` | `dist/pie-item-player.js` |
| `@pie-players/pie-section-player/browser` | `dist/browser/pie-section-player.js` |
| `@pie-players/pie-print-player` | `dist/print-player.js` |

### Browser, through a bundler

Every other entry point loads in a browser through a bundler, for example
`import "@pie-players/pie-section-player";`. These entries import their
`@pie-players/*` siblings and `speech-rule-engine` by bare specifier, and the
toolkit's text-to-speech service loads the engine's JSON locale tables with an
`import()` that carries no import attributes. A browser resolves neither
without a bundler, and both Node.js and browsers refuse a JSON module imported
without `with { type: "json" }`. The class includes:

- the section player's root, its npm build;
- the assessment player;
- the toolkit's custom-element entries (`./components/*`);
- every tool package.

The release gate confirms that the item player's and section player's roots
fail to import in Node.js on a browser global.

A CDN URL without a file path serves the file a package's `unpkg` and
`jsdelivr` fields name. For the section player that file is the npm build, so
a page names `dist/browser/pie-section-player.js` in full.

## Third-party dependencies

Beyond their `@pie-players/*` siblings, the packages install:

| Dependency | Installed by |
| --- | --- |
| `speech-rule-engine`, pinned to `5.0.0-rc.4` | the assessment toolkit, the section player, the TTS settings panel |
| `@pie-element/shared-utils`, `@pie-lib/math-rendering-module`, `dompurify`, `semver` | `@pie-players/pie-players-shared` |
| `lit` | the print player |
| `@google-cloud/text-to-speech` | `@pie-players/tts-server-google` |
| `@aws-sdk/client-polly` | `@pie-players/tts-server-polly` |
| `jose`, `tldts` | `@pie-players/tts-server-sc` |

The section player's npm build leaves `speech-rule-engine` external, so every
PIE bundle a host loads shares the one copy in the host's `node_modules`.

## TypeScript

Each JavaScript entry point ships its declarations in `dist`, named by the
`types` condition of its `exports` entry. TypeScript resolves them with
`moduleResolution` `bundler`, `node16` or `nodenext`.

`node10`, spelled `node` in a tsconfig, is unsupported. It ignores `exports`,
through which the packages publish their subpaths, so a declaration that
imports a subpath fails with TS2307 under `skipLibCheck: false`. TypeScript 6.0
deprecates `node10` and 7.0 removes it, so the packages carry no
`typesVersions` fallback for it.
