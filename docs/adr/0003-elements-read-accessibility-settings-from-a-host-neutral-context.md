# 0003 — Elements read accessibility settings from a host-neutral context

Status: Accepted, 2026-10-02

An accessibility review on 2026-10-05 kept `mathml` for every student, so the context has no
consumer yet and no code ships. **Decision** is the contract the first consumer ships with; **Math
accessibility** records the review's outcome.

Owner: PIE Players maintainers

Read with: [Update, 2026-10-09](#update-2026-10-09), which corrects the precedence count, the
answer with no assessment bound, and the value shape the first consumer ships.

## Decision

An element, or a module running inside one such as the MathJax adapter
`@pie-element/shared-math-rendering-mathjax`, learns the accessibility settings in effect for the
student from a context it requests with the Web Components `context-request` protocol. A host
answers as an ancestor provider. The assessment toolkit is one such host; any other host provides
the same context without the toolkit, and no element imports `@pie-players/pie-assessment-toolkit`.

- **Key and type.** `@pie-players/pie-context` exports the key, `Symbol.for("pie.accessibility")`,
  and the value type, from the release that carries the first consumer. The key names no host.
- **Value.** `{ supports: readonly string[]; language?: string }`. `supports` lists the support
  ids in effect after the host has applied its policy. A support id is a tool id, which takes the
  AfA PNP 3.0 term, camelCased, where AfA names the capability
  ([Support ids](../../packages/assessment-toolkit/docs/TOOL_REGISTRY.md#support-ids)).
- **Subscription.** A consumer requests with `subscribe: true`, so a profile change mid-session
  reaches it.
- **No answer.** An unanswered request means the host provides no accessibility context. The
  consumer uses its own defaults and does not wait.
- **Evolution.** Consumers ignore ids they do not recognize. Fields are added, never removed or
  redefined.

Math accessibility is the consumer this record was written for. A math mode would be a support id
the adapter maps to a fixed MathJax configuration; the review shipped none, so the adapter offers
one configuration and requests nothing.

## Constraint

Item configs name element versions and preloaded builds fix them, so an element version that reads
this context stays in delivery, reading the shape it shipped with, long after providers change. A
rule inside an element that maps a profile to behavior is frozen into every pinned version of it.
The mapping therefore lives with the host, beside the policy it depends on, and the value only
grows.

Every element bundles its own copy of shared modules, so the key must be equal across copies.
`Symbol.for` returns the registered symbol for its name, and `ContextProvider` matches a request by
`event.context === key` without checking the event's class (`handleContextRequest` and
`handleContextProvider` in `packages/pie-context/src/provider.ts`), so a request from any copy
matches.

## Supporting reasons

The toolkit shares its runtime with its own components this way. `assessment-toolkit-context.ts`
defines four contexts keyed `Symbol.for("pie.assessmentToolkit.*")`. `PieAssessmentToolkit`
provides the runtime and host-runtime contexts; the shell scopes of `<pie-item-scope>` and the
section player's `<pie-passage-shell>` provide the shell and region-scope contexts. One
`ContextRoot` per document, which the first subscribing consumer installs
(`ensureDocumentContextRoot`), replays subscribing requests to a provider connecting after its
consumer. `pie-context` follows the semantics of Lit's `@lit/context`, and its events are `bubbles`
and `composed`, so requests cross the shadow roots elements render into.

The toolkit already resolves capabilities that have no toolbar placement.
`ToolkitCoordinator.decideFeaturePolicy(featureId, scope?)` runs one id through the host gates
(`policy.allowed`, `policy.blocked`) and the six-level precedence: district block,
test-administration override, item restriction, item requirement, district requirement, then PNP
support or prohibition. The provider computes `supports` through it, so an id in `supports` is
granted, required or blocked by the same rules as every other support.

## Rejected alternatives

- **PIE `env`.** `env` is controller input; the pie-elements-ng `number-line` controller's
  `model()` reads `env.accessibility.colorContrast`. It shapes the model, never
  reaches DOM-side modules such as math rendering, and a change re-runs every controller. A
  setting that changes the model stays on `env`; a setting that changes rendering comes from this
  context.
- **Page globals.** `window["@pie-lib/math-rendering"]` and `setMathRenderer` are page-wide, the
  last writer wins, and nothing is notified of a change. They remain the IIFE mechanism.
- **The raw `PersonalNeedsProfile`.** Every consumer would re-implement the six-level precedence
  and drift from it.
- **A field per consumer**, such as `math: { mode }`. The type would grow with each consumer's
  needs, and every field is one more shape that pinned element versions keep reading. A new id in
  `supports` changes no type.

## Trade-off

A deliberate trade: AfA PNP 3.0 parameterizes some preferences, and a flat id list carries no
parameters. `braille.math-type` takes `nemeth` or `ueb`, and `spoken.reading-type` takes
`screen-reader` or `computer-read-aloud`. A parameterized preference becomes one id per value, such as
`nemeth` beside `braille`.
Language preferences are parameterized by language, which is why `language` is a field of its own.

## Math accessibility

This section records decisions. The current behavior is in the item player's
[Math rendering](../item-player/math-rendering.md), the adapter side in pie-elements-ng's
[Math Rendering](https://github.com/pie-framework/pie-elements-ng/blob/develop/docs/MATH-RENDERING.md#accessibility),
and the speech worker's page-policy needs in the
[Content-Security-Policy](../security/readme.md#content-security-policy) notes.

MathJax's accessibility settings belong to one MathJax instance, and a page runs several. The
adapter's browser build (the `pie-browser-esm` condition) bundles a private MathJax 4.1.3 into each
element build ([pie-elements-ng#277](https://github.com/pie-framework/pie-elements-ng/pull/277)),
shared by every instance of that element on the page. The item player holds one more for markup
math when the page installed no renderer
([pie-players#568](https://github.com/pie-framework/pie-players/pull/568),
[#573](https://github.com/pie-framework/pie-players/pull/573)). The adapter's npm build runs on the page's `window.MathJax`, which it
loads once per page or takes as the page configured it. Math the adapter delegates to a page
renderer, the IIFE player's MathJax 3 or one a host installs with `setMathRenderer`, renders under
that renderer's settings.

| Mode | What assistive technology receives | In MathJax 4.1.3 |
| --- | --- | --- |
| `mathml` | Hidden MathML in `mjx-assistive-mml`, which the student's own software interprets: the JAWS math viewer, NVDA with MathCAT | The adapter's configuration |
| `speech` | A speech string MathJax generates with ClearSpeak or MathSpeak rules; the MathML is hidden from assistive technology | From the student's menu |
| `speech` with braille | Speech plus a generated braille label | From the student's menu, Nemeth only; UEB is an open PR, [mathjax/MathJax-src#1512](https://github.com/mathjax/MathJax-src/pull/1512) |
| `explore` | Speech plus keyboard navigation through the expression's structure | From the student's menu; menu-settings `inTabOrder` is ignored with speech on, so the adapter sets `options.a11y.inTabOrder: false` and the math stays out of the tab order |

The review decided:

1. **Modes and the default.** `mathml` is the only mode and the default. The adapter's menu
   settings are `assistiveMml: true`, `enrich: false` and `inTabOrder: false`, so no speech web
   worker starts until a student turns speech on.
2. **Activation.** No host selects a mode. There are no mode ids, and nothing derives one from AfA
   terms such as the `screen-reader` reading type or `nemeth` math braille.
3. **Student override.** The adapter enables MathJax's accessibility menu while its
   `accessibility` option is on, the default. A choice made there, speech, braille and the explorer
   included, persists in `localStorage` under the adapter's own key, `PIE-MathJax-Menu-Settings`,
   and beats the configuration at startup. The adapter drops two stored values at load: a stored
   `assistiveMml`, so the configuration sets hidden MathML on every load, and a speech locale the
   menu does not list, which cannot load.
4. **Speech rules.** No host selects speech rules or a speech language. Generated speech starts
   only from the student's menu, in the adapter's default speech locale: English, or the first
   listed locale when English is not listed. The toolkit's read-aloud keeps its own rules,
   ClearSpeak for English and MathSpeak elsewhere (`math-speech.ts`).
5. **Per-item suppression.** None. The adapter strips no speech from containers;
   `data-tts-suppress` governs read-aloud only.

A future mode reaches every copy the adapter starts. Each copy's adapter requests the context from
the element it renders, and the item player's copy from the markup root it typesets. A copy
configures MathJax at load from the answer to its first request and applies a later answer through
MathJax's settings-and-rerender path, the one its menu uses; with no answer it keeps `mathml`. A
copy serves every instance of its element across items, and each instance's request reaches its
own item's provider, so the mode that ships settles which answer a copy applies when its items'
answers differ. A page renderer, and a MathJax the page configured, stay outside the context with
the page globals.

Preconditions for any mode beyond `mathml`:

- **Read-aloud.** The toolkit's read-aloud takes MathML from the container's `mjx-assistive-mml`
  (`findCanonicalMathML` in `math-aware-text-processing.ts`) and voices it with
  speech-rule-engine. Each mode changes what MathJax leaves there, so read-aloud of math is tested
  under each mode.
- **Speech worker.** Enrichment starts a speech web worker, and a page security policy that blocks
  it stalls every later typeset. [mathjax/MathJax-src#1538](https://github.com/mathjax/MathJax-src/pull/1538),
  merged to develop after 4.1.3, handles two causes; a blocked `new Worker` for a `blob:` URL
  remains. The adapter ends speech, braille and the explorer for a document whose worker fails to
  start, so math goes on rendering without them (`speech-worker.ts`); a mode that enables
  enrichment inherits that fallback.
- **Cost.** Enrichment raised typeset time about twentyfold, from 71 ms to 1486 ms, in the MathJax
  4 audit.

## Consequences

- No code ships with this record: `@pie-players/pie-context` exports no accessibility key, and
  neither the toolkit, an element nor the math adapter provides or requests the context.
- The provider and its first consumer ship together. An element may depend on `pie-context`,
  which has no dependencies, and never depends on the toolkit.
- The toolkit provides the context from `PieAssessmentToolkit`, beside its runtime contexts, and
  republishes it on a policy change. A provider in an item's `<pie-item-scope>` decides with the
  item's scope, so the item's settings apply to its content. With no assessment bound,
  `decideFeaturePolicy` declines every capability, so `supports` is empty and consumers use their
  defaults.
- A math mode, when one ships, is requested by the adapter from the element it renders. One
  MathJax copy serves every item that renders its element, so that consumer settles how items
  whose answers differ share one copy.
- `AGENTS.md` in pie-players and pie-elements-ng states the element-side rules: no toolkit import,
  host settings through this context, unknown ids ignored, and no answer means defaults.

## Update, 2026-10-09

The precedence `decideFeaturePolicy` applies has eight levels, which **Supporting reasons** and
**Rejected alternatives** call six: district block, test-administration override set to `false`,
item restriction, profile prohibition, override set to `true`, item requirement, district
requirement, profile support. A prohibition outranks both requirements.

With no assessment bound, `decideFeaturePolicy` still grants a capability the item's registered
settings require, where **Consequences** says it declines every capability. A provider in an
item's scope answers `supports` with that item's required ids.

`language` in the value has no source: `PersonalNeedsProfile` carries no language field. The
first consumer ships `{ supports }`, and **Evolution** admits `language` once a source exists.
