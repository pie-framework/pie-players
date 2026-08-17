---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

Add formative delivery: Try state, feedback reveal, and section mastery.

PIE could score an item in the browser and could not deliver a formative one. The
scoring half already shipped — `scorePieItem(...)` calls each element
controller's `outcome(model, session, env)` under `mode: "evaluate"`, and
`pie-item-player.provideScore()` exposes that imperatively. What was missing was
the delivery state around it: how many times a learner may submit one item, when
its feedback becomes visible, and how a section reports how much was mastered.
This adds exactly that and no new evaluation machinery. `provideScore()` is
called, not modified, and keeps its `pie-item contract compatibility` exemption
unchanged.

The vocabulary is **Try** — one submitted-for-checking pass over one item —
deliberately not "attempt". `TestAttemptSession` is the assessment
administration and `TestAttemptItemSession.attemptCount` counts distinct PIE
session ids for an item, so a third "attempt" at the item level would be read as
one of those. Try maps cleanly onto QTI 3's `numAttempts`, and the policy fields
map onto `qti-item-session-control`: `maxTries` ↔ `max-attempts`
(`"unlimited"` ↔ `0`), `feedback` ↔ `show-feedback` / `show-solution`. QTI's
`allow-comment`, `allow-skipping` and `validate-responses` are not represented,
because there is no candidate-comment surface, no skip gate and no
response-validation step to honour them with, and declaring fields PIE ignores is
worse than omitting them. No conformance is claimed; the mapping exists so a
`pie-qti` adapter inherits the vocabulary instead of reinterpreting it.

Authoring is one optional field. `AssessmentSection.formative` sets the section
default and `AssessmentItemRef.formative` overrides it field by field — the order
QTI 3 uses for `qti-item-session-control` on an item ref versus its section.
Absent, or `enabled: false`, and delivery is byte-identical to before: no
control, no state, no env override, and `getSession()` does not even carry the
key.

Feedback reveal is a projection rather than a UI. PIE renders no feedback of its
own; a revealed item gets `mode: "evaluate"` over the section env — with
`role: "instructor"` under `feedback: "solution"`, the element convention for
also showing the authored correct response — and the element draws the rest.
`env.role` has never been an authorization boundary: it selects a rendering, the
host decides whether a learner may see solutions by setting the policy, and PIE
enforces that by not projecting the role otherwise. This is also the per-item
`env` seam the section runtime never had — `PieSectionPlayerBaseElement` derives
one section-wide env and hands the same object to every card, so revealing one
item while its neighbours stay editable was previously impossible. The override
is applied at the single point item params are built, so no layout gains an
env-resolution order, and because `applyPlayerParams` diffs env by signature the
override reaches a mounted player as a property assignment — the item keeps its
session across a reveal and across the retry that withdraws it. A host's
`resolveBackend` callback deliberately keeps seeing the section env: which
delivery backend serves an item is not a function of whether its feedback is on
screen, and passing the override would let a reveal flip a host's backend
selection mid-session.

Correctness is derived, never authored, and has four values. Aggregation follows
the policy the persisted API scoring path already documents — one scored outcome
used directly, several averaged as normalized fractions — so a browser-derived
formative result and a server-derived score do not disagree about what a
multi-element item is worth. The fourth value carries the weight: an item holding
a rubric element, or one whose bundle exposes no `outcome`, is `"unknown"` rather
than `"incorrect"`, and the mastery rollup excludes it from its denominator
instead of reporting a false negative. An *untried* item is not excluded — nothing
yet says it cannot be scored — which is what keeps a section from reading as
mastered after one correct answer.

Runtime ownership follows the existing shape rather than adding a layer.
`SectionController` owns the live state because it already owns the equivalent
aggregate: per-item completion keyed by canonical id, rolled up and emitted on
change. Try state is the same shape with a different predicate, so splitting it
out would put two rollups over one item set in two packages. The pure policy,
aggregation, reducer and rollup live in
`@pie-players/pie-players-shared/formative` — no DOM, no timers, no element
registry — so the contract is testable without a browser and an adapter can
import it without pulling in a player. The projection rides on
`SectionCompositionModel`, which the runtime republishes on every controller
event, so a recorded Try reaches the cards through the channel that already
exists; no new host-facing event channel was added. Three controller events join
the union. `formative-try-recorded` reports a Try; `formative-reveal-changed`
reports every reveal transition a Try did not cause — a learner dismissing
feedback, a host forcing or withdrawing a reveal — with `source` naming which; and
`section-mastery-changed` emits on rollup change exactly as
`section-items-complete-changed` does for completion.

A host can drive it too, through the handle it already uses for
`getSession`/`applySession`: `revealFormativeItem({ itemId, feedback })` and
`hideFormativeItem({ itemId })` are host authority for a teacher-driven "show the
answer". They spend no Try, ignore the Try budget and `revealOn`, and work on an
item with no Try yet, because none of those bound a decision the host has already
taken; `retryFormativeItem` stays the learner action and keeps respecting the
budget. `feedback` is stated rather than defaulted, because a reveal under
`feedback: "none"` would project nothing, and a learner retry clears it so a
forced solution does not silently upgrade every later reveal on that item. No new
element surface: every layout's `getSectionController()` already returns this
handle, and forwarding four methods through layout → kernel → scaffold → base
would be passthrough for nothing.

`FormativeTryOutcome` retains the raw per-element outcomes as `elementOutcomes`,
for a host rendering its own feedback instead of the element's evaluate-mode
rendering. Empty slots are dropped — every real entry identifies its own model,
and a `null` hole in a persisted array carries nothing a host could use — while
`totalElementCount` still counts them. A trade: these persist inside the session
slice, so a snapshot grows by whatever the elements put in their outcomes, and
some include a scoring trace.

The learner action takes the route `pie-item-session-changed` and
`pie-content-loaded` already take: the item card owns the control because it owns
the item player node, and `provideScore()` is an imperative method on that node.
It reports the outcomes it got rather than interpreting them, over a new internal
`pie-formative-action` event, and the controller derives correctness — one
aggregation policy wherever a Try is recorded. The reducer is a no-op when an item
cannot currently be checked, so a double submit costs nothing on either side.

One thing that republish needed, found only in a browser: the toolkit coalesces
composition emits behind a revision key over section id, current item,
renderables and item sessions. Recording a Try changes none of those, so
formative state joins that key. Without it the controller holds correct state and
the card never learns its feedback was revealed — a failure no unit test can see,
which is why this ships with Playwright coverage of the round trip rather than
three more unit tests.

State persists through `SectionControllerSessionState.formative`, versioned and
hydratable. Existing snapshots stay valid: the slice is optional and its absence
is indistinguishable from a pre-formative save. A slice whose version this build
cannot read is rejected whole and formative state restarts, while item sessions in
the same snapshot are applied untouched — a formative version bump must never cost
a learner their responses.

The control satisfies WCAG 2.2 AA: a native `<button>` in tab order, a polite live
region present in the DOM before it has content so the first announcement is not
lost (4.1.3), focus held on the control rather than moved to the feedback above it,
correctness carried in words and never by colour (1.4.1), the control removed
rather than disabled once Tries are spent so no focusable element is left without
an explanation, and 24×24 minimum target size (2.5.8) painted only from `--pie-*`
chains so it follows every base theme and colour scheme. The control is also
never disabled while a check is in flight — the keyboard test caught that
disabling the focused element drops focus to the document body, leaving a learner
who pressed Enter to tab back to a control whose label had changed under them.
`aria-busy` carries the state instead, and re-entry was already dropped by the
handler and by the reducer.

Consumer impact: audited against both client-facing host checkouts, and neither is
exposed. One imports only `pie-item-player` and `pie-theme`, neither of which this
touches. The other drives `pie-section-player-splitpane` but declares every
`@pie-players` module as `export {}` in its own `typings.d.ts`, so it takes no
types at all and the widened `SectionControllerEvent` union is invisible to its
compile. At runtime it calls `waitForSectionController`, `getSession`, `persist` and
`applySession` with optional-call syntax; `getSession()` returns its base object
unchanged unless a section carries `formative`, so its snapshots stay
byte-identical. Its template binds only `(toolkit-ready)`, so the new internal
`pie-formative-action` event reaches no listener of its own, and its CSS targets
`pie-section-player-item-card` as an element with no positional or `data-region`
selectors — the card's DOM is unchanged when formative is off, since the footer
`<div>` already existed and stays empty. The composition revision key gained a
formative component, but for content with no `formative` policy the added
component is constant, so emission cardinality is unchanged.

Every type member added is optional. `AssessmentSection`, `AssessmentItemRef`,
`SectionControllerSessionState`, `SectionControllerHandle` and
`SectionCompositionModel` gain optional members, and
`@pie-players/pie-players-shared/formative` is a new export path. On
`SectionCompositionModel.formative` absent reads exactly as `null`, so a host
layout, an adapter or a test double assembling that model never has to declare a
feature it does not use — the projection is PIE-produced and PIE-consumed, and
requiring the key bought nothing but a compile error for everyone else. The one
addition no default covers is the widened `SectionControllerEvent` union, where a
host switching exhaustively with no `default` gains three unhandled variants.

Sequencing, and why this came before timed media: a cue's interesting gate
condition is "answered correctly", which needs the per-item evaluation seam this
adds. Building cues first would have forced `responded` as the only expressible
condition and then revised a shipped section slice when correctness arrived.
Recorded as `docs/adr/0001-formative-delivery-before-timed-media.md`; the contract
is `docs/prds/formative-delivery-contract.md`. Branching is explicitly out of
scope — Try state is its prerequisite, and folding it in would have swallowed a
contract that is otherwise three additions to the section layer.
