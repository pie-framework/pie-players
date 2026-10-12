# Formative Delivery

This guide is for hosts that deliver a section as practice: the learner checks an
answer, sees feedback and tries again. It covers the policy an author sets, what
the section player renders, the controller methods and events a host drives it
with, and how the state persists. The
[formative delivery contract](../prds/formative-delivery-contract.md) holds the
full specification and its QTI 3 mapping, the
[glossary](../../CONTEXT.md#formative-delivery-language) defines the terms, and
the [section player README](../../packages/section-player/README.md) lists the
player's inputs, methods and events.

Formative delivery runs in the section layer. A **Try** is one check of one
item's response, and its **Try Outcome** records a **Correctness** of correct,
partial, incorrect or unknown. A **Feedback Reveal** shows the result through the
env projection: the section switches that one item to evaluate mode, and the
element draws the feedback. PIE renders no feedback of its own.

## Formative policy

An author sets the policy on the section, and an item ref changes it field by
field:

```ts
import type { AssessmentSection } from "@pie-players/pie-players-shared/types";

const section: AssessmentSection = {
  identifier: "practice-set",
  formative: { enabled: true, maxTries: 3, feedback: "correctness" },
  assessmentItemRefs: [
    // The section's policy: three Tries, correctness after each.
    { identifier: "q1", item: fractionsItem },
    // One Try, then the solution.
    { identifier: "q2", item: decimalsItem, formative: { maxTries: 1, feedback: "solution" } },
    // Three Tries, feedback only after the third.
    { identifier: "q3", item: ratiosItem, formative: { revealOn: "on-final-try" } },
    // No check control.
    { identifier: "q4", item: reflectionItem, formative: { enabled: false } },
  ],
};
```

| Field | Values | Default | Effect |
| --- | --- | --- | --- |
| `enabled` | `true`, `false` | `false` | Whether the item delivers formatively |
| `maxTries` | an integer of 1 or more, or `"unlimited"` | `1` | Tries the learner may spend on the item |
| `feedback` | `"none"`, `"correctness"`, `"solution"` | `"correctness"` | What a reveal shows ([Feedback Reveal](#feedback-reveal)) |
| `revealOn` | `"on-try"`, `"on-final-try"` | `"on-try"` | Reveal after every Try, or once the last Try is spent |

Each field resolves on its own: the item ref's value, else the section's, else
the default. An invalid value falls through to the layer beneath, so a typo
costs only that field. `maxTries` truncates a fraction and ignores 0 and
negatives; unlimited is spelled `"unlimited"`, and an adapter translates QTI's
`max-attempts="0"`. Under unlimited Tries `"on-final-try"` resolves to
`"on-try"`, because there is no final Try to reveal on.

A section is formative when at least one item resolves to `enabled: true`, so an
item ref can enable one item in an otherwise ordinary section. A section in which
none does delivers as if the field were absent: no control, no formative state,
no env projection, and no `formative` key in `getSession()`.

## Player requirements

The section player scores a Try in the browser through the item player's
`provideScore()`, which runs each element controller's `outcome()`. Formative
delivery therefore needs an unhosted item player, one that loads element
controllers. A player is hosted when `runtime.player.hosted` is `true`, or when
`hosted` is unset and `runtime.player.backend.delivery` is enabled. A hosted
player loads no controllers, and every Try records `unknown`.

- The `iife` strategy loads the controllers of an unhosted player, and so does
  `esm` unless `runtime.player.loaderOptions.loadControllers` is `false`.
- Under `preloaded`, register each element with its `controller` module
  ([Registering elements from npm](../item-player/loading-strategies.md#registering-elements-from-npm)).
  `@pie-players/pie-preloaded-player` builds register their elements without
  controllers, so they cannot score a Try.

## Check control

An item with formative enabled gets a status line and a button in its card
footer (`data-region="footer"`):

- **Check answer** calls the item player's `provideScore()` and records one Try
  from the outcomes it returns. An item with no models to score
  (`provideScore()` returns `false`) records a Try whose Correctness is
  `unknown`. When `provideScore()` throws, or the player has none, the status
  reads "This question could not be checked. Try again." and no Try is spent.
- **Try again** replaces it while the item is revealed with Tries left. It
  withdraws the reveal and makes the item editable again.
- Once the Tries are spent the button is removed: a disabled control left in the
  tab order would explain nothing. During a check the button carries
  `aria-busy="true"` and keeps focus, and a second click spends no Try.

The status line is a polite live region (`aria-live="polite"`), present before it
has text so the first announcement is not lost. It states Correctness in words,
and only once feedback is revealed: "Correct.", "Partly correct.", "Not
correct.", or "Answer recorded. This question is not scored automatically." for
`unknown`. A Try that reveals nothing reads "Answer recorded.", so a policy that
withholds feedback does not leak it. While the learner can try again, the
remaining Tries follow ("2 tries left."). The strings are the
`player.formative.*` interface messages, localized like the rest of the player's
interface.

The Try Outcome derives Correctness from the outcomes `provideScore()` returns,
one per element model. One scored element gives its `score` over its `max` (1
when absent); several give the mean of their normalized scores over 1. Full
credit is `correct`, zero `incorrect`, anything between `partial`, and an item
with no scored element is `unknown`. A model with no element or controller, such
as a rubric, leaves an empty slot that counts toward `totalElementCount` and not
toward `scoredElementCount`. `elementOutcomes` keeps the per-element outcomes
for a host that renders its own feedback.

## Feedback reveal

While an item is revealed, the section projects an env over the section env for
that item alone:

| `feedback` | Projected env | What the element renders |
| --- | --- | --- |
| `"none"` | none | Nothing; the Try is recorded and not revealed |
| `"correctness"` | `mode: "evaluate"`, `role: "student"` | Its correctness feedback |
| `"solution"` | `mode: "evaluate"`, `role: "instructor"` | Its correctness feedback and the authored correct response |

PIE guarantees the projected mode and role; the element decides what to draw in
them. Evaluate mode makes the revealed item read-only while its neighbors stay
editable. The projection reaches the mounted item player as a property change,
so the item keeps its session across a reveal and across the retry that
withdraws it.

`env.role` selects a rendering and authorizes nothing. The policy decides
whether a learner may see solutions: PIE projects `role: "instructor"` only under
`feedback: "solution"` or a Forced Reveal at that level.

## Host controls

The section controller handle carries the formative methods. A host gets it from
the section player element:

```ts
import type { SectionPlayerRuntimeHostContract } from "@pie-players/pie-section-player";

const player = document.querySelector<HTMLElement & SectionPlayerRuntimeHostContract>(
  "pie-section-player-splitpane",
);
const controller = await player?.waitForSectionController(5000);

// A teacher shows the answer, then takes it back.
controller?.revealFormativeItem?.({ itemId: "decimals-item", feedback: "solution" });
controller?.hideFormativeItem?.({ itemId: "decimals-item" });
```

| Method | Effect |
| --- | --- |
| `recordFormativeTry({ itemId, outcomes })` | Records one Try from `provideScore()` outcomes, as Check answer does. Ignored while the item is revealed or out of Tries |
| `retryFormativeItem({ itemId })` | Withdraws the reveal of an item with Tries left, as Try again does |
| `revealFormativeItem({ itemId, feedback })` | A **Forced Reveal** at `"correctness"` or `"solution"`: spends no Try, ignores the Try budget and `revealOn`, and works before the first Try |
| `hideFormativeItem({ itemId })` | Withdraws any reveal, whatever the Try budget |
| `getFormativeProjection()` | The resolved `policies`, the per-item `states` and the `mastery` rollup; `null` for a section that is not formative |

The four actions do nothing for an item whose policy is not enabled. `itemId` is
the item's `item.id`; the item ref's `identifier` works too. The projection keys
`policies` and `states` by item ref `identifier`, and every `composition-changed`
event carries it as `detail.composition.formative`.

A Forced Reveal states its level because the policy's could be `"none"`, which
would project nothing. The level holds until the reveal is withdrawn: a learner
retry or `hideFormativeItem` clears it, so the next earned reveal is back at the
policy's level.

## Events

The controller emits three formative events, each with `timestamp` and
`currentItemIndex`:

| Event | Payload | Emitted when |
| --- | --- | --- |
| `formative-try-recorded` | `itemId`, `canonicalItemId`, `tryCount`, `outcome`, `revealed` | A Try is recorded, including any reveal it causes |
| `formative-reveal-changed` | `itemId`, `canonicalItemId`, `revealed`, `feedback` (the Forced Reveal level), `tryCount`, `source` (`"learner"` or `"host"`) | A retry, Forced Reveal or hide changes the reveal |
| `section-mastery-changed` | `mastery` | A Try changes the rollup; reveals never do |

`canonicalItemId` is the item ref `identifier`. The handle's `subscribe()`
delivers every controller event and ends with its controller. The coordinator's
`subscribeSectionEvents({ listener, eventTypes })` follows the active cohort, the
`(sectionId, attemptId)` pair, across section changes. Its
`subscribeItemEvents()` and `subscribeSectionLifecycleEvents()` helpers leave
the formative events out of their defaults.

```ts
const unsubscribe = controller?.subscribe?.((event) => {
  if (event.type === "formative-try-recorded") {
    reportTry(event.canonicalItemId, event.tryCount, event.outcome.correctness);
  }
});
```

## Mastery

`mastery`, in the projection and in `section-mastery-changed`, rolls the
section's Try Outcomes up:

| Field | Meaning |
| --- | --- |
| `totalItems` | Items in the section |
| `triedItems` | Items with at least one Try |
| `scorableItems` | `totalItems` minus the items whose last Try was `unknown` |
| `masteredItems` | Items that reached full credit on some Try, a later wrong Try notwithstanding |
| `averageTriesToMastery` | The mean Try on which mastered items first reached full credit |
| `complete` | `true` when at least one item is scorable and every scorable item is mastered |

An item whose Correctness is unknown, such as one holding a rubric element,
leaves the denominator instead of counting as wrong. An untried item stays in
it, so one correct answer does not complete a section. `totalItems` counts every
item in the section, including those with `enabled: false`, which are never
tried, so a section that mixes formative and non-formative items does not reach
`complete: true`.

## Persistence

Formative state persists with the section session. `getSession()` carries
`formative: { version: 1, items }`, keyed by item ref `identifier`, and
`applySession()` and `hydrate()` restore it, including whether feedback was on
screen. A `replace` whose slice the controller cannot read (another version, no
`items`) clears formative state, so Tries restart, and still applies the item
sessions; a `merge` keeps the current state. Entries for identifiers outside the
section are dropped. Each Try Outcome keeps the
per-element outcomes the elements returned, some with a scoring trace, so a
snapshot grows with every Try.

## Demo

The `/formative-delivery` route of `apps/section-demos` delivers a section with
the four policies of the example above
([content](../../apps/section-demos/src/lib/content/demo-formative-delivery.ts)).
