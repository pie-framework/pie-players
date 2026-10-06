# 0003 — Elements read accessibility settings from a host-neutral context

Status: Accepted, 2026-10-02. The math accessibility modes and what selects them are open
until the accessibility review of 2026-10-05; **Math accessibility modes** lists the options.

Owner: PIE Players maintainers

## Decision

An element, or a module running inside one such as the MathJax adapter
`@pie-element/shared-math-rendering-mathjax`, learns the accessibility settings in effect for the
student from a context it requests with the Web Components `context-request` protocol. A host
answers as an ancestor provider. The assessment toolkit is one such host; any other host provides
the same context without the toolkit, and no element imports `@pie-players/pie-assessment-toolkit`.

- **Key and type.** `@pie-players/pie-context` exports the key, `Symbol.for("pie.accessibility")`,
  and the value type. The key names no host.
- **Value.** `{ supports: readonly string[]; language?: string }`. `supports` lists the ids in
  effect after the host has applied its policy, in AfA PNP 3.0 vocabulary where AfA has a term and
  as PIE ids where it has none.
- **Subscription.** A consumer requests with `subscribe: true`, so a profile change mid-session
  reaches it.
- **No answer.** An unanswered request means the host provides no accessibility context. The
  consumer uses its own defaults and does not wait.
- **Evolution.** Consumers ignore ids they do not recognize. Fields are added, never removed or
  redefined.

Math accessibility is the first consumer. The math adapter offers named modes, each with its own
support id, and maps a fixed id to a fixed MathJax configuration.

## Constraint

Item configs name element versions and preloaded builds fix them, so an element version that reads
this context stays in delivery, reading the shape it shipped with, long after providers change. A
rule inside an element that maps a profile to behaviour is frozen into every pinned version of it.
The mapping therefore lives with the host, beside the policy it depends on, and the value only
grows.

Every element bundles its own copy of shared modules, so the key must be equal across copies.
`Symbol.for` returns the registered symbol for its name, and `ContextProvider` matches a request by
`event.context === key` without checking the event's class (`packages/pie-context/src/provider.ts:80`),
so a request from any copy matches.

## Supporting reasons

The toolkit shares its runtime with its own components this way. `assessment-toolkit-context.ts`
defines four contexts keyed `Symbol.for("pie.assessmentToolkit.*")`, provided by
`PieAssessmentToolkit` and the section player's item shells, each beside a `ContextRoot` that
replays subscribing requests to a provider connecting after its consumer. `pie-context` follows the
semantics of Lit's `@lit/context`, and its events are `bubbles` and `composed`, so requests cross
the shadow roots elements render into.

The toolkit already resolves capabilities that have no toolbar placement.
`ToolkitCoordinator.decideFeaturePolicy(featureId)` runs one id through the host gates
(`policy.allowed`, `policy.blocked`) and the six-level precedence: district block,
test-administration override, item restriction, item requirement, district requirement, then PNP
support or prohibition. The provider computes `supports` through it, so a math mode is granted,
required or blocked by the same rules as every other support.

## Rejected alternatives

- **PIE `env`.** `env` is controller input; `number-line`'s controller reads
  `env.accessibility.colorContrast` (pie-elements-ng
  `packages/elements-react/number-line/src/controller/index.ts:369`). It shapes the model, never
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
`screen-reader` or `computer-read-aloud`. A parameterized preference becomes one id per value, as
the toolkit's vocabulary already has `nemeth` beside `braille` (`pnp-standard-features.ts`).
Language preferences are parameterized by language, which is why `language` is a field of its own.

## Math accessibility modes

MathJax 4's accessibility settings are document-wide, so a math mode applies to the whole page.
The adapter configures MathJax at load from the answer to its first request and applies a later
answer through MathJax's settings-and-rerender path, the one its menu uses. With no answer it uses
`mathml`, today's configuration (`assistiveMml: true`, `enrich: false`, `inTabOrder: false`).

| Mode | What assistive technology receives | In MathJax 4.1.3 |
| --- | --- | --- |
| `mathml` | Hidden MathML in `mjx-assistive-mml`, which the student's own software interprets: the JAWS math viewer, NVDA with MathCAT | Shipping default |
| `speech` | A speech string MathJax generates with ClearSpeak or MathSpeak rules; the MathML is hidden from assistive technology | Available |
| `speech` with braille | Speech plus a generated braille label | Nemeth only; UEB is an open PR, [mathjax/MathJax-src#1512](https://github.com/mathjax/MathJax-src/pull/1512) |
| `explore` | Speech plus keyboard navigation through the expression's structure; the math joins the tab order | Available; menu-settings `inTabOrder` is ignored with speech on, so the adapter sets `options.a11y.inTabOrder` |

Options for the review:

1. **Offered modes and the default.** Any subset of the four. `mathml` stays the default unless
   the review changes it.
2. **What activates a mode.** A mode's id can be listed in a student's PNP and required or blocked
   by district policy or test administration, like any support. The toolkit's configuration can
   also derive mode ids from AfA terms, such as the `screen-reader` reading type or `nemeth` math
   braille, so the derivation changes without an element release. Modes by explicit id only, with
   no derivation, is also an option.
3. **Student override.** MathJax's accessibility menu is enabled, and a choice made there persists
   in `localStorage`. A stored choice beats the adapter's configuration at startup today, except
   hidden MathML, which the configuration sets on every load. The review decides whether a stored
   choice also beats the host's mode, or whether the adapter reapplies the host's mode after
   startup.
4. **Speech rules.** ClearSpeak or MathSpeak for `speech`, voiced in the context's `language`, and
   whether they follow the toolkit's read-aloud, which uses ClearSpeak for English and MathSpeak
   elsewhere (`math-speech.ts`), so a screen reader and read-aloud voice an expression alike.
5. **Per-item suppression.** Item-level policy resolves per item while the mode is page-wide.
   Whether an item must be able to suppress generated math speech, as `data-tts-suppress`
   suppresses read-aloud where reading is the construct, decides whether the adapter strips speech
   from individual containers.

Preconditions for any mode beyond `mathml`:

- **Read-aloud.** The toolkit's read-aloud takes MathML from the container's `mjx-assistive-mml`
  (`findCanonicalMathML` in `math-aware-text-processing.ts`) and voices it with
  speech-rule-engine. Each mode changes what MathJax leaves there, so read-aloud of math is tested
  under each mode.
- **Speech worker.** Enrichment starts a speech web worker, and a page security policy that blocks
  it stalls every later typeset. [mathjax/MathJax-src#1538](https://github.com/mathjax/MathJax-src/pull/1538),
  merged to develop after 4.1.3, handles two causes; a blocked `new Worker` for a `blob:` URL
  remains. The adapter probes for the worker before it enables enrichment.
- **Cost.** Enrichment raised typeset time about twentyfold, from 71 ms to 1486 ms, in the MathJax
  4 audit of 2026-10-02.

## Consequences

- `@pie-players/pie-context` exports the key and value type. An element may depend on
  `pie-context`, which has no dependencies, and never depends on the toolkit.
- The toolkit provides the context from `PieAssessmentToolkit`, beside its runtime contexts, and
  republishes it on `updateAssessment` and `updateCurrentItemRef`. With no assessment bound,
  `decideFeaturePolicy` declines every capability, so `supports` is empty and consumers use their
  defaults.
- The math adapter requests the context from the element it renders.
- The provider and its first consumer ship together, after the review. If the review keeps
  `mathml` for every student, this record stands and no code ships.
- `AGENTS.md` in pie-players and pie-elements-ng states the element-side rules: no toolkit import,
  host settings through this context, unknown ids ignored, and no answer means defaults.
