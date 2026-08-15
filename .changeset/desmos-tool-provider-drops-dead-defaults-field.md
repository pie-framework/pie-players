---
"@pie-players/pie-assessment-toolkit": patch
---

Drop `DesmosToolProviderConfig.defaultConfig`, which nothing has ever read.

The field was documented as "default calculator configuration applied to all
instances" and no code path applied it. Per-calculator Desmos options are owned
by the calculator component, which derives them from the calculator type and
hands them to `createCalculator(type, container, config)` itself; the tool
provider only builds and returns the calculator provider, so a host setting
`defaultConfig` got a silent no-op — including for the one option it would most
plausibly be reached for, `invertedColors`, which `DesmosCalculatorConfig` does
not type in the first place.

Removed rather than honoured. Honouring it means a merge layer between the host's
defaults and the seven Desmos keys the component already pins per type, and the
knob's real use — a calculator that follows the colour scheme — is a wider
decision that also has to move the calculator mount's background, which is a
literal white on purpose because Desmos paints a light UI. Adding a partly
effective knob now would make that decision harder, not easier.

A patch under fixed versioning: removing an interface field is a compile break
for anyone who set it, and nobody does. The consumers checked are the quiz engine
players and knowledge-check, none of which touches the field — they configure the
calculator through `providers.calculator.provider.runtime.authFetcher`, which
returns `{ apiKey }`. `createInstance()`'s own unused `config` parameter stays: it
is `ToolProviderApi`'s signature, not this provider's invention.
