# @pie-players/pie-assessment-toolkit

## 0.3.69

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.69
  - @pie-players/pie-calculator-desmos@0.3.69
  - @pie-players/pie-context@0.3.69
  - @pie-players/pie-players-shared@0.3.69
  - @pie-players/pie-tts@0.3.69
  - @pie-players/tts-client-server@0.3.69

## 0.3.68

### Patch Changes

- 27284f8: Collapse six implementations that existed twice or more, with no public surface
  changes.
  
  **Media fragment enforcement.** `applyMediaFragment` writes a `#t=start,end` URI
  that browsers honour at neither bound reliably, so each consumer enforced the
  range itself — the signing region and recorded read-aloud audio holding two copies
  of the same seek-forward-once and stop-at-end pair, which is how one of them came
  to enforce only the end. `enforceMediaFragment` now owns the arithmetic and each
  consumer supplies what reaching the end means: the signing region pauses, while
  `playRecordedAudio` treats it as the clip finishing so the chunk sequence advances.
  The end bound is now watched on `timeupdate` as well as by poll, so it is checked
  at least as tightly as before in both consumers.
  
  **Tag-name helpers.** `print-player/src/tag-names.ts` was a copy of
  `players-shared/src/pie/tag-names.ts`, itself the exported owner, down to
  `toPrintHashedTag` — which exists in the owner *for print* and has no other caller.
  Both copies carried their own test file. Print now imports from
  `@pie-players/pie-players-shared/pie/tag-names`.
  
  **Backend config cloning.** The assessment player carried an 85-line field-aware
  `BackendConfig` cloner duplicating the section player's, for a type the item player
  owns; a newly nested field would have been cloned by one copy and shared by
  reference in the other. It only ever needed a plain deep clone, and `cloneDeep`
  already existed at `@pie-players/pie-players-shared/object`. The section player's
  field-aware helpers stay: its merge logic consumes the pieces individually.
  
  **Overwide content wrappers.** The image and table wrappers shared an identical
  `isInsidePieCustomElement` and near-identical wrap-and-parse bodies. Both now call
  one engine in `security/wrap-overwide.ts`, declaring only what differs — selector,
  wrapper tag and class, markup probe, and the accessible name, which is the real
  divergence between an `alt` and a `<caption>`.
  
  **Context text extraction.** `extractTextContent` ran three byte-identical
  traversals, one per level, each redeclaring `stripHtml`, the models normalization
  and the model walk. The traversal is now shared and each level declares only which
  fields it reads, so a new place text can hide is added once. Verified
  output-identical against the previous implementation across fifteen context shapes,
  including record-form `models` and every missing-config path.
  
  **Toolbar rendering.** Seven packaged capabilities inlined the same
  `renderToolbar` body, varying only in overlay surface, window geometry and whether
  the coordinator is re-handed on sync. That is why one rule — the shell title
  tracking the interface locale — landed in three different spellings across three
  files. They now call `renderOverlayToolbar`, which derives the catalog keys from
  `toolId` as all seven already did.
  
  **Section-player shells.** The three layout shells plus the kernel host shell each
  carried the same clamp bounds, `resolveConfiguredPx`, host-element walk,
  narrow-breakpoint clamp, content-max-width pair and `matchMedia` watch. All of that
  moves to `components/shared/section-player-shell-layout.svelte.ts`. Two things stay
  duplicated because the compiler requires it, and the module says so: the `props`
  map inside `<svelte:options customElement>` must be a statically analyzable object
  literal, and a component's `export function` declarations are what become
  custom-element methods.
  
  **SSML detection.** Polly sniffed for SSML twice with the same seven tags inline,
  and Google kept a private copy of the standard set. `BaseTTSProvider.detectSSML`
  now owns the standard elements and takes a provider's own vocabulary as an
  argument, which is the part that legitimately differs: `<amazon:effect>` and
  `<aws-*>` mean nothing to Google, and Google's list was missing none of the
  standard tags but Polly's was missing `<say-as>` and `<mark>` — so Polly now
  recognises two standard elements it previously treated as plain text.
  
  Covered by the existing suites plus the reflow, tabbed-layout and
  vertical-passage-layout Playwright specs, which exercise the shared narrow-layout
  watch at 320px and across stacked-collapse strategy switches.
- e94b097: Make the math and science content heuristics able to answer "no", and stop a
  heuristic from withdrawing a granted accommodation.
  
  `hasMathContent` tested `/[+\-*/=<>≤≥∑∫√π]/`, which matches the hyphen in
  "well-known" and the slash in "and/or"; `hasScienceContent` tested
  `/\b[A-Z][a-z]?\d*\b/`, which matches "It", "In", "A" and "No". Both therefore
  answered `true` for essentially all content while gating `isVisibleInContext` for
  the calculator, ruler, graph and periodic table. An operator now needs operands
  around it or no prose reading at all, and an element symbol has to appear as a
  formula does — with a count, or beside another symbol — so a lone "He" or "As" is
  just English.
  
  Two consequences of tightening had to be handled. `hasMathContent`'s MathML
  pattern was unreachable: extraction stripped tags before the predicate ran, so an
  item whose only math signal is `<math>` matched nothing. Extraction now offers
  both views and structural patterns read the markup. And because a tool's Pass-2
  answer can hide a tool Pass 1 allowed, tightening would have let a regex withdraw
  an accommodation a learner is entitled to; entries the policy decision marks
  `required` or `alwaysAvailable` now skip the relevance gate. The one-way veto is
  intact — these ids come from the decision's own surviving entries, so nothing here
  can make a tool visible that Pass 1 removed.
- 67a3d7e: Drop `DesmosToolProviderConfig.defaultConfig`, which nothing has ever read.
  
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
- d68c01b: Add dictionary and picture dictionary tools, and make the shell's focus trap
  shadow-aware so a hosted tool's own controls are reachable by keyboard.
  
  `pie-tool-dictionary` and `pie-tool-picture-dictionary` are floating panels opened from
  the toolbar, each with a term field and a results area. Neither ships an endpoint: the
  corpus behind a dictionary is licensed per programme, so a host supplies one through
  `endpoint` for the built-in POST shaping, or assigns the element's `lookup` property to
  use its own client. With neither, the panel says no service is configured rather than
  offering a field that fails silently.
  
  Neither declares a universal support id. A dictionary is a granted accommodation, and on
  a vocabulary item it is construct-relevant, so handing it to every learner by default
  would change what the item measures.
  
  Both accept a `term` from whatever selection affordance a host offers, and neither
  depends on one. A sighted keyboard-only learner cannot originate a text selection in
  non-editable content — Chromium does not extend one with Shift+Arrow there without caret
  browsing, an OS toggle absent on mobile — so a selection-only dictionary is unreachable
  for them. The panel's field is the keyboard route, which is why it exists.
  
  That route did not work until the focus trap was fixed. `createFocusTrap` collected
  focusables with `querySelectorAll`, which stops at a shadow boundary; every tool in this
  repo renders into `shadow: "open"`, so the trap saw only the shell's own chrome. Tab
  cycled those nine controls and the hosted tool's content was unreachable by keyboard
  entirely — for the calculator, graph, periodic table and theme panels as much as for
  these two. Collection now descends into open shadow roots, and skips `tabindex="-1"`,
  which belongs to programmatic focus rather than the tab order.
  
  A lookup distinguishes "no entry for this word" from "the service did not answer",
  because collapsing them tells a learner their word is not real when the network is down.
  A term longer than four words is refused without a request. Picture URLs that are not
  `https:`, protocol-relative, or same-origin are dropped rather than rendered, and a
  picture's caption becomes its `alt` — the picture is the definition, so it is never
  decorative.
  
  Covered by unit tests over the lookup and focus-collection logic, and by
  `packages/section-player/tests/section-dictionary-tools.spec.ts`, which drives the tool
  from the keyboard alone in a browser.
- 27284f8: Seek recorded read-aloud audio to its media fragment's start, so a recording
  sliced across several nodes plays the slice it was asked for.
  
  `MediaFragmentRange` describes one use of a recording, which is how a single file
  serves several docked nodes. `applyMediaFragment` writes that range onto the
  source URL as a `#t=start,end` Media Fragments URI, but the URI is a hint: the
  shared contract requires the player to enforce both bounds itself, because
  browsers honour neither reliably. `SignLanguageMediaRegion` does, seeking forward
  on `loadedmetadata` and pausing on `timeupdate`. Recorded `spoken` audio enforced
  only the end, on the written belief that the start offset was honoured — the
  reading the contract itself records as corrected. A browser that ignored `#t=`
  therefore played from 0, and read-aloud spoke the wrong node's audio while
  highlighting the right node.
  
  `TTSService.playRecordedAudio` now seeks to `startSeconds` once metadata is
  available, forward only, so a browser that did honour the URI is not rewound.
  Recordings with no fragment, or a fragment starting at 0, behave exactly as
  before. The two false claims about start-offset support — in `playRecordedAudio`
  and in `applyMediaFragment`'s own docblock — are corrected, since the helper's
  comment was the reason the wrong reading spread.
  
  Covered by `tests/tts-recorded-audio.test.ts`, which pins the seek and its
  forward-only guard; the existing test asserted only the URL the fragment
  produced.
- fc71c91: Add formative delivery: Try state, feedback reveal, and section mastery.
  
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
- e94b097: Keep a host-installed TTS highlight target resolver until its disposer runs, so
  a resolver installed once keeps remapping.
  
  `setHighlightTargetResolverProvider` returns a disposer, which says the caller
  owns the registration, but the service also cleared the field in `stop()` and on
  both exits of `restartFromSeekIndex`. A host that installs once — the
  install-before-mount case a late-bound provider exists for — therefore got
  remapping for exactly one playback and then fell back to identity for the rest of
  the service's life, silently. `speak()`'s own end path never did this, so three of
  four playback-termination paths disagreed with the fourth.
  
  The disposer is now the only thing that clears it. Nothing in-repo depended on the
  old behaviour: `tool-tts-inline` reinstalls per playback and disposes at every one
  of its five termination paths. A stale provider cannot paint outside its scope
  either, since targets are validated by containment in `context.scopeElement` and a
  failing one falls back to its native range.
- 00b8a71: Localize player and tool chrome, with Dutch as the first complete locale.
  
  A host sets one attribute — `locale="nl-NL"` on `pie-item-player` or a
  section-player layout element, or `runtime.locale`, which wins — and every string
  the suite renders itself follows it: toolbar labels, tool panels, player status
  and error text, formative controls, live-region announcements, `aria-label`s.
  Unset, the rendered output is byte-identical to before, including every tool
  button's accessible name. The graceful default is `en-US` and never
  `navigator.language`: under fixed lockstep patch-only versioning a
  rendered-string change reaches live delivery on a host's next install with no
  build signal on their side, so a host that opts into nothing must keep exactly
  the chrome it has.
  
  Interface locale is the deployment's fact and no element can know it, so it travels
  as a composition context rather than through `model`: the toolkit publishes the
  resolved locale and one provider on its runtime context, and every capability
  resolves both through `connectToolRuntimeContext`. The change signal is the
  context's own republish, which matters because a catalog is a dynamic import —
  without a reactive read every label would pin the English that rendered a tick
  earlier, the same silent failure `composition-context.md` records twice. A
  component that finds no publisher falls back to an English-only default provider
  rather than rendering raw message keys, which is what keeps tools working in
  `print-player`, in Studio preview and in a bare harness.
  
  Content language is untouched and remains a separate concern on a separate
  channel. QTI 3's implementation guide states the independence directly: a
  candidate may choose an interface language which may or may not also be the
  language of the content. Conflating the two is why classic PIE renders Spanish
  widget chrome for a Spanish item.
  
  `@pie-players/pie-players-shared/i18n` is rebuilt around that. Catalogs are
  TypeScript modules keyed by full BCP-47 tag, replacing JSON keyed by bare
  language: the English catalog's shape now generates the `MessageKey` union, so a
  mistyped key is a compile error instead of a key rendered on screen — a key
  assembled at runtime has to be asserted through `dynamicMessageKey()`, which is
  greppable and pairs with `hasKey()` so a miss falls back to a literal — and `tsc`
  compiling a `.ts` catalog removes the `with { type: "json" }` import-attribute
  hazard that already broke every non-English locale once under Node's ESM loader.
  Requests resolve through RFC 4647 lookup and then primary-subtag widening, so
  POSIX `nl_NL`, bare `nl` and regional `nl-BE` all reach the `nl-NL` catalog;
  `SimpleI18n` gains `plural()` — `Intl.PluralRules` alone, so Arabic's
  `zero`/`two`/`few`/`many` and Polish's `few`/`many` are reachable — plus
  `withLocale()` for two players rendering different locales from one provider, and
  it no longer writes `lang`/`dir` to `document.documentElement`, which an embedded
  player has no business doing. Components stamp their own host instead.
  
  The module split is what keeps this off the wire. `i18n/types` is type-only and
  erases; `i18n/provider` carries the 5 KB English catalog; the dynamic loader map
  lives in `i18n/catalogs`, which players import and tools do not. Since every
  player and tool `vite.config.ts` sets `external: []`, that boundary is the
  difference between one locale chunk and eighteen tool bundles each carrying a
  catalog they will never load.
  
  `ToolRegistration` gains optional `nameKey` and `descriptionKey` beside the
  still-required `name` and `description`. The keys are supplied by
  `default-tool-loaders`, which owns the packaged capability set, and a
  host-authored registration with no keys renders its `name` verbatim.
  
  The English catalog does enumerate a `tools.<capability>` namespace per packaged
  capability, so `default-tool-loaders` is not the only file naming them.
  `check:capability-neutrality` is unaffected: what it protects is core not
  branching on a capability id or granting behaviour from one, and a message key
  does neither — it is inert text, resolved by whoever holds the id. Splitting the
  catalog per capability would satisfy the letter of it and cost both the
  single-reference coverage check and the bundle boundary that keeps locale strings
  out of eighteen tool bundles.
  
  English output is byte-identical. Every English catalog value reproduces the
  literal it replaced exactly, punctuation and inconsistencies included, because
  fixed lockstep patch-only versioning puts a reworded string into a host's live
  delivery on their next install with no signal on their side — and most of what
  this change touches is accessible names and live-region announcements, where a
  host may be asserting exact text. Where the pre-adoption code rendered the same
  concept in two forms, the catalog carries both rather than assembling one by
  interpolation: `tools.ruler` has three forms of each unit name, matching the Title
  Case button label, the lowercase announcement and the raw state token in the
  accessible name. Improving any of these strings is a separate change with its own
  entry.
  
  `en-US` and `nl-NL` are complete at 402 keys, and they are the only locales
  shipped. The pre-adoption `es`/`zh`/`ar` catalogs are deleted rather than
  re-keyed: 76 of their 142 keys named UI this codebase does not render — a
  section-builder, an assessment shell, 25 Desmos internals Desmos localizes
  itself, colour-scheme names the theme registry owns — while the strings actually
  on screen had no keys at all; the published `dist` omitted
  `with { type: "json" }` on exactly the three dynamic locale imports, so none of
  them could load outside a bundler in any version through `0.3.67`; and nothing
  read them, here or in any consumer checkout. Machine-filling the gap would ship
  strings nobody has read, to learners.
  
  `check:i18n-coverage` now runs in the pre-commit and CI gates: a locale declared
  complete must stay at 100%, a locale mid-translation can be listed as carried and
  is reported without gating, and either fails on a key English no longer defines.
  
  The pre-adoption i18n layer is replaced rather than versioned alongside.
  `BUNDLED_TRANSLATIONS`, `loadTranslations`, `SimpleI18n.tn()` and two Svelte
  composables are gone. A grep of all three consumer checkouts finds no call site
  for any of them outside build caches — the layer was published complete and
  unused, which is what made replacement the right move instead of a second
  parallel implementation of the kind that produced `I18nService` as a copy of
  `SimpleI18n`.
- 6e1e053: Match catalog card languages by BCP-47 lookup, and fix lazy locale loading under Node.
  
  Catalog language matching was strict string equality, so a card the Learnosity
  transform emits as POSIX `es_ES` matched no request for BCP-47 `es-ES`. It
  surfaced only through the final no-language-constraint rung, and only when nothing
  else of its type existed — with an English card also present the Spanish one was
  unreachable. `es-MX` likewise never reached a card tagged plain `es`. This is the
  defect the audio-accommodations PRD describes as resolution by accident, and it is
  the shape that passes every test written against one language.
  
  `@pie-players/pie-players-shared/i18n/language-tags` is a new entry point carrying
  `normalizeLanguageTag`, `languageTagsEqual`, `languageTagLookupSequence` and
  `findBestLanguageMatch`. It holds no locale data and touches no DOM, and it is
  deliberately not reachable through `./i18n`, whose index re-exports the loader and
  therefore pulls the eagerly-bundled English catalog — the catalog resolver and TTS
  voice selection both need tag matching and neither wants a message catalog.
  
  `AccessibilityCatalogResolver` now expands each requested tag into its RFC 4647
  lookup sequence, one rung per truncation, preserving the existing most-specific-first
  ordering and the rule that form is preferred within a language rung and never
  across one. A sibling region is still never substituted: `es-ES` is not an answer
  to an `es-MX` request, because offering the wrong locale is worse than offering
  nothing. `getAllAlternatives` keys on the normalized tag, so two syntaxes of one
  language collapse into the single alternate resolution can actually return rather
  than reporting two.
  
  Separately, `loadTranslations` could only ever load English. The static English
  imports carried `with { type: "json" }` and the lazy per-locale imports did not,
  so Node's ESM loader rejected every other locale with
  `ERR_IMPORT_ATTRIBUTE_MISSING` — which the surrounding `catch` reported as
  "Translation files not found", sending readers to look for files that were sitting
  in `dist` the whole time. Bundlers infer the type from the extension and so were
  unaffected, which is why English-only use never showed it, but `players-shared` is
  on the publish policy's `nodeSafe` list. The attributes are now present on every
  import and the failure preserves its `cause` instead of substituting a misleading
  message.
  
  `I18nService` was a near-verbatim second copy of `SimpleI18n` — same fields, same
  lookup chain, same `selectPluralForm` — and is now a delegating wrapper that adds
  only the toolkit's logging and `initialize()`. `detectBrowserLocale` is exported
  from `players-shared` and has one implementation instead of two. Both public entry
  points behave as before.
- 7c9fb28: One canonical section session snapshot
  
  `SectionControllerSessionState` and the four assessment-session shapes now live in
  `@pie-players/pie-players-shared/types`, beside `AssessmentSection` and the
  delivery slices the snapshot carries. `pie-assessment-toolkit` and
  `pie-assessment-player` re-export them, so every existing import specifier keeps
  working.
  
  This replaces five byte-identical copies of a three-field `SectionSessionSnapshot`
  — one in `pie-assessment-player` and one in each of four demo apps — that declared
  `currentItemIndex`, `visitedItemIdentifiers` and `itemSessions` and omitted the
  `formative` and `timedMedia` slices. No data was lost at runtime: both
  `upsertSectionSession` implementations pass the snapshot through by reference. The
  cost was that the assessment layer could not read the slices it was already
  persisting without a cast, so a cross-section mastery rollup had no typed state to
  build on.
- 1d9f2d3: One term-lookup implementation behind both dictionaries, and three defaults that no longer need a host to know about them.
  
  The two dictionaries shipped as near-copies: term normalisation and the headword guard were character-identical, the POST clients differed only in error strings, and each panel carried its own copy of the same state machine. That is now one module, `@pie-players/pie-players-shared/tools/term-lookup`, and each tool supplies only what a result of its own carries — an entry, or a picture. The subtle part, a superseded lookup not overwriting the newer one's state, exists once and is tested once. A lookup result is `{ status, items }` rather than `entries`/`pictures`.
  
  **An endpoint alone is now the whole configuration.** The client sent `credentials: "omit"` and documented `headers` as the way to authorise, but `headers` was unreachable: the element exposed no such property and the factory taking it was never exported. A host that put its dictionary route behind the assessment's own session — which the tool host contract asks for — got a 401 on every lookup and a learner-facing "the dictionary is unavailable (401)". Endpoints are called `same-origin`, so that route answers with nothing further configured; `headers` and `credentials` are now real properties for a host authorising some other way, and neither is required.
  
  **Plain `http:` picture URLs are refused.** The validator accepted `https?:` while its own comment said anything else with a scheme was refused, so `http://cdn.example/cat.png` reached `src` and was mixed-content-blocked on every https deployment — the broken image the guard exists to prevent. Protocol-relative and same-origin paths still pass, and "same-origin" is now checked by resolving rather than by looking for a leading slash: `/\evil.example/x.png` looks like a path and resolves to another host, because a backslash is a path separator for special schemes and a tab is stripped outright. Both still resolve to https, so neither defeated the mixed-content guard — but same-origin is what the function claims.
  
  **A requested term is answered once per request, not once per term.** Params reach a tool through a seam reapplied on every sync, so the term alone cannot distinguish a re-render from a fresh ask. Keyed on the panel's last search, every reopen re-issued the selection that opened it and discarded the word the learner had typed since. Requests now carry a `termRequestId`, which both dictionary panels accept as an optional property; a host assigning `term` directly can leave it unset and gets term identity, enough to stop a re-render re-issuing.
  
  **A tool-open request falls back off section scope.** Requests defaulted to `"section"` and resolved only there, so a host placing a capability at item scope only had the selection action silently vanish: the tool was granted, hosted and visible, with no action on the selection and nothing to say why. Resolution now prefers section scope and falls back to any level that hosts the capability. Naming a level in the request still makes it a constraint, honoured strictly.
  
  Both panels' effects now write their reactive state under `untrack`, matching the rule AGENTS.md sets for effect bodies that read what they write. `check:capability-neutrality` gained `dictionary` and `pictureDictionary`, so its guard covers the packaged set its own comment claims to track.
  
  Also: `requestTool`, `canRequestTool`, `registerToolRequestTarget` and `onToolRequestTargetsChange` are optional on `ToolkitCoordinatorApi`. They were declared required while both call sites duck-typed them away for a host coordinator predating the seam, which made such a coordinator structurally non-conformant for no benefit. Both dictionary packages dropped two declared dependencies that nothing imported.
- e94b097: Reject a media reference whose `version` this build does not implement, instead
  of rendering it on a guess.
  
  `MediaAssetRef.version` is a required literal and the shared contract requires
  unknown-version rejection for runtime rendering, but both card validators cast
  the payload to `Partial<MediaAssetRef>` and never read the field, so a card
  claiming version 2 rendered as though it were version 1 — with whatever the
  fields meant then. `isUnsupportedMediaAssetVersion` now guards both, and the
  toolkit exports it alongside the other media-payload validators a capability
  package needs.
  
  An absent `version` is still accepted. Producers predate the field, and this
  module's posture toward absent fields is to treat them as absent rather than as
  a positive claim of something else — the same rule `media.kind` and
  `matchesRequestedSignLanguage` already follow.
- 27284f8: Remove four duplicated public surfaces. Each was audited against all three
  consumer checkouts first; none of the removed names is consumed by any of them.
  
  **The toolkit's forked `DesmosCalculatorProvider` is gone** from the
  `./tools/client` subpath. `@pie-players/pie-calculator-desmos` owns that class,
  and the toolkit's own runtime path already instantiated *its* copy — the fork was
  reachable only as public API. The two were not interchangeable: the canonical
  provider takes `initialize({ apiKey, proxyEndpoint, onTelemetry })` and documents
  `proxyEndpoint` as the way to keep the key server-side, while the fork accepted
  only `{ apiKey }` and otherwise read `process.env.DESMOS_API_KEY` or
  `window.PIE_DESMOS_API_KEY`. So the published subpath offered the one variant with
  no server-side key path, and a host serving a Desmos proxy endpoint could not use
  it. `tool-calculator-desmos`'s setup docs now point at the canonical package and at
  `proxyEndpoint` rather than at a bare key.
  
  **`TTSToolConfig` is now defined in terms of `TTSRuntimeSettings`** instead of
  redeclaring its 23 fields. They had drifted in both directions, which is how
  `mathTokenHighlighting` came to be honoured at runtime while being unnameable on
  the coordinator's public `ensureTTSReady` except through an index signature. It is
  nameable now, along with `showSingleSpeedOption` — the change is additive on the
  host-facing surface and removes nothing. It is an intersection rather than an
  interface because `ToolConfig.provider` is `unknown` where the runtime settings
  narrow it to the three provider ids, and an interface cannot inherit a member two
  parents type differently.
  
  **`AuthoringValidationResult` is re-exported from `pie-item-player`** rather than
  redeclared there. The local copy widened `validatedModels` to `any[]` while
  `validateModels()` is implemented against `players-shared`'s
  `Array<PieModel & { validation?: unknown }>`, so a consumer typing against this
  package lost the model typing the implementation actually returns. The name still
  exports from here; only its precision changes.
  
  **The `highlighter` capability is removed** from `default-tool-loaders`, along with
  `highlighterToolRegistration`. It mounted `pie-tool-annotation-toolbar` through the
  same loader as `annotationToolbar`, carried the same `"Highlighter"` name and
  `highlighter` icon, and was placed at the same four levels, so an exhaustive host
  rendered two identically-labelled buttons opening the same element. That collision
  was already known: the placement test excluded `highlighter` from one preset by
  hand.
  
  No grant is lost. `annotationToolbarRegistration.pnpSupportIds` already accepted
  all three of the removed capability's ids, and its three `universalSupportIds`
  (`highlighter`, `textHighlight`, `annotation`) moved onto the surviving capability,
  so a profile granted any of them still gets highlighting. What does change is that
  annotation highlighting is now reached only through the selection gateway, not
  additionally through a toolbar toggle. `PACKAGED_TOOL_ORDER` and
  `PACKAGED_TOOL_PLACEMENT` lose the id, and their hand-written tuple casts were
  corrected to match — left alone they would have declared a capability the runtime
  arrays no longer contain.
- f61c7c7: Re-publish the toolkit runtime context on each tool window, so a shelled tool
  resolves the interface locale rather than the English-only default.
  
  A tool window mounts at `document.body`, which is what keeps it clear of the
  player's overflow and stacking contexts. The consequence was that a tool inside
  one sat outside every provider's subtree: its `context-request` bubbled to `body`
  and reached nothing, `resolveInterfaceI18n` fell back to `getDefaultI18n()`, and
  the tool rendered English under a translated toolbar. With `locale="nl-NL"` the
  graph offered "Selector / Point / Line / Delete" beneath a "Grafiek" button, and
  the same held for the theme, periodic-table and calculator panels — every tool
  the toolbar gives a shell. The unshelled overlays, ruler and protractor and line
  reader among them, were never affected: they mount inside the toolbar's own DOM
  and reached the provider all along. The i18n adoption keyed all of these tools at
  once, so the catalog and the call sites were already in place; only the delivery
  path was missing.
  
  `ItemToolBar` now hosts a second `ContextProvider` on the shell element, carrying
  the value it consumes itself and re-setting it on each republish. That restores
  the whole runtime context to a shelled tool, not just `i18n` — the coordinators,
  the TTS service and the catalog resolver were equally unreachable there.
  
  Two smaller faults on the same surface. The window's own controls — move, resize,
  centre, close — are built imperatively, so `t()` ran once with no reactive read to
  invalidate: a shell built before its locale's catalog import resolved kept English
  for the rest of the session, and a locale change never reached it. Their labels
  are now re-read from the catalog whenever the shell updates. And a window's title
  came from `ToolRegistration.name`, the raw English field, rather than through
  `nameKey`; graph, periodic table and theme now resolve it the way the toolbar
  does, and the calculator's window takes the variant name its button already
  carries. `resolveToolRegistrationName` is exported from
  `@pie-players/pie-assessment-toolkit/tools/internal` for that.
  
  Default-English is unchanged: with no `locale` every one of these surfaces renders
  exactly what it rendered before, including the shell controls' accessible names,
  which hosts may be asserting on.
  
  Covered by `packages/section-player/tests/section-player-interface-locale.spec.ts`,
  which opens the graph window under `nl-NL` and asserts the window title, the
  header controls and the tool's own labels.
- 0dc9c96: Selecting a word now offers a dictionary lookup on the annotation strip, and the panel opens already answered.
  
  The mechanism is a capability-agnostic one, because a selection gateway cannot name the tool it opens. `ToolkitCoordinator` gains `requestTool` / `canRequestTool` / `registerToolRequestTarget`: a surface names an unscoped tool id, and the toolbar hosting that tool turns it into a scoped instance, applies the request's params and shows it. Resolution is a claim rather than a broadcast — a broadcast would open a panel in every toolbar whose scope contains the selection, which in a section player is the item card's and the section's both. Params layer over the host's own, so a request carrying a term leaves a configured endpoint in place, and they arrive through `getToolRenderParams`, which means a tool needs nothing new to receive one.
  
  The strip renders host-supplied `selectionActions` and knows nothing about what they do; the pairing to the two dictionaries lives in the composition layer, which is the only layer allowed to name capabilities. A host can contribute an action for a capability PIE does not ship. An action whose tool no toolbar hosts is absent rather than present and inert.
  
  Acting on a selection now latches the strip down for that selection. The selection itself survives on purpose — the learner's place in the text is not ours to clear — and opening a panel moves focus, which fires `selectionchange`: without the latch the strip came straight back over the definition it had just fetched. Escape, focus leaving and an outside click do not latch, and Shift+F10 clears one, so dismissing never costs a learner the strip for good.
  
  The door is a shortcut, not the way in. Chromium will not extend a selection with Shift+Arrow in non-editable content unless caret browsing is on, an OS toggle absent on mobile, so a sighted keyboard-only learner cannot originate a selection at all. Both dictionaries keep their toolbar button and their own term field.
  
  Fixes both dictionary toolbar buttons rendering blank: `book-open` and `photo` had no entry in the toolbar's icon map, so an icon-only button drew nothing. The map moves to `services/tool-icons.ts` and is exported through `tools/internal`, so a gateway button and the toolbar button for one tool draw the same shape.
- cb11691: Deliver timed-media sections: cues that reveal and gate questions against a media
  timeline.
  
  A section that sets `sectionType: "timed-media"` carries a `timedMedia` block with
  a required `stimulusRef`, a cue timeline and a playback policy. The stimulus is a
  passage — a `class: "stimulus"` rubric block whose PIE config mounts the media
  element — so media keeps a Catalog Owner and its captions, transcript and signed
  alternates resolve through the accessibility-catalog rail that already serves them.
  `timedMedia` carries no media payload at all.
  
  The section reaches media only through a **Media Time Source** port shaped after
  `HTMLMediaElement`, never through a library API. `createMediaElementTimeSource`
  adapts a native `<video>`/`<audio>` in a few lines, and a host can register its own
  implementation for a third-party player through the same `pie-media-time-source`
  event the stimulus card uses — so delivering timed media needs no PIE element. The
  port declares `canPause` and `canRestrictSeeking`; where a capability is missing the
  matching policy degrades from enforced to **advisory** — cues still fire, state is
  still recorded, the projection reports `enforcement: "advisory"`, and a recoverable
  framework warning of kind `timed-media` says which policy lost its teeth. A seek
  lock that does not lock must not read as one that does.
  
  Cue gate conditions name the shipped formative vocabulary rather than defining
  their own: `responded` (which reads item completion, so it works in a section that
  does not deliver formatively), `correct`, and `partial-or-better`. A gate on
  correctness must state `onUnknownCorrectness`, because an item no controller can
  score is a real state and neither answer may be assumed. Three authoring mistakes
  are refused loudly rather than delivered silently: a `stimulusRef` that resolves to
  nothing; a correctness gate over an item without unlimited Tries, where a learner
  who spent a finite budget could never release playback again; and a `stimulusRef`
  that resolves to a renderable exposing no time source, which is reported once the
  section's content has loaded and no source has attached — whether a renderable
  mounts media is not knowable from authored data, so that half of the rule is a
  runtime report rather than a validation error. All three deliver the section with
  every item visible; a cue timeline nothing can drive would otherwise leave a pane of
  questions no cue can ever reveal.
  
  New public surface: `@pie-players/pie-players-shared/timed-media` (data types, the
  port, validation, the cue reduction, the session slice and the native adapter),
  `sectionType` / `timedMedia` on `AssessmentSection`, `timedMedia` on the section
  composition model and on the persisted session snapshot,
  `attachMediaTimeSource` / `detachMediaTimeSource` / `getTimedMediaProjection` on
  `SectionControllerHandle` (`attachMediaTimeSource` takes an optional
  `renderableId`, checked against the renderable `stimulusRef` resolved to so a
  second video passage cannot drive the timeline), `pauseMediaForCompetingAudio` on
  the same handle, and four controller events — `timed-media-cue-changed`,
  `timed-media-audio-started`, `timed-media-policy-degraded`, `timed-media-invalid`.
  A host switching exhaustively over `SectionControllerEvent["type"]` with no
  `default` gains four variants; everything else is optional and absent reads as
  `null`.
  
  Cue state joins the toolkit's composition revision key, without the clock: a cue
  firing changes neither the renderables nor the item sessions, so the emit would be
  coalesced away and no card would ever see it — while folding media position in
  would republish four times a second for a change nothing renders.
  
  Read-aloud and media audio never overlap, on a last-action-wins rule: starting
  read-aloud pauses the media, starting media pauses read-aloud, and neither side
  resumes what it silenced. The section supplies the two halves it can — the
  `pauseMediaForCompetingAudio()` method and the `timed-media-audio-started` event —
  and the toolkit arbitrates, because only the toolkit holds both the TTS service and
  the section. A port reporting `canPause: false` cannot yield and read-aloud proceeds
  over it: withholding an accommodation to protect a policy the port already said it
  cannot keep is the worse failure, and that gap is already reported at attach. Media
  carrying no audio still pauses read-aloud, because no portable signal distinguishes
  a silent track from a narrated one.
  
  That rule already existed for the signing region, and now has one statement instead
  of two: `bindTtsAudioHandoff` and `pauseTtsForMediaAudio` are exported from
  `@pie-players/pie-assessment-toolkit`, and `@pie-players/pie-tool-sign-language`
  binds them in place of its own copy. Signing behavior is unchanged — the states that
  count as speaking, the pause-not-stop rule, and the tolerance for a torn-down
  service are the same, and now carry unit coverage neither call site had.
  
  Two things outside timed media change. The section content service now records how
  a `stimulusRef` resolves to a rendered renderable, rather than leaving each caller
  to re-derive it. And the engine's controller subscription isolates the new
  `onControllerEvent` handler it routes events through, so a diagnostic that throws
  cannot abort the listener before the composition republish and stop every
  controller event in the section behind a console warning. That guard is hardening
  around the new route, not a fix for a defect on `develop`: before this the
  subscription took no event and only republished.
  
  `scoringPolicy` accepts `sum-child-outcomes`, `average-child-outcomes` and
  `host-defined`. It is validated, persisted and carried to the host unchanged; PIE
  derives no aggregate from any of them and assigns no default, so a section that omits
  it is not silently given one. `weighted-child-outcomes` is deliberately absent: no
  weight is authorable on a cue, an item ref or the section, so the entry would name a
  capability PIE does not have. A host holding its own weights says `host-defined`.
  
  Existing content is untouched: no `sectionType` means no projection, no session
  slice and no cue behavior, and cue-gated cards are the only cards that ever carry
  `hidden`.
- 4f0cb3f: Move `tool-surface-host` from the section player into the assessment toolkit, so a
  renderer other than the section player can host tool surfaces.
  
  The module resolves a surface name to the tools registered against it and keeps a
  snapshot in step with the registry. Nothing in it is specific to sections, but living
  in `packages/section-player/src/components/shared/` made the section player the only
  renderer that could use it — any other host would have had to depend on the section
  player to render a surface, which inverts the layering.
  
  It is reachable at `@pie-players/pie-assessment-toolkit/tools/internal`. Framework
  errors and console warnings previously hard-coded `pie-section-player` as their
  `source`; the host now passes a `hostLabel`, so a warning names the renderer that
  actually raised it. The section player passes `"pie-section-player"` and behaviour
  there is unchanged.
  
  A pure move with no behavioural change: the 15 existing tests moved with the module
  and pass unaltered apart from the new option. `section-player-default-tool-registry.test.ts`
  dropped four assertions that pinned the module's old path.
- e94b097: Move the calculator's toolbar and shell specifics out of the generic core into the
  composition layer that owns them.
  
  `ItemToolBar` branched on `toolId === "calculator"` in four places — the keyboard
  bridge that lets Tab cross between the page and a shell, the design-system header
  chrome, the close button's display value — mapped the FontAwesome icon from a
  toolId, and defaulted its `tools` prop to
  `calculator,textToSpeech,answerEliminator`. AGENTS.md says this package names no
  capability.
  
  Three declarations replace them: `faIconName` on a toolbar button definition,
  `ndsHeaderControls` and `pageTabOrder` on a tool window's shell config. The
  calculator registration sets all three, which is where a decision about which
  capabilities a deployment renders in the host's design system belongs. The `tools`
  default is now empty; every in-repo mount passes it explicitly, and no consumer
  mounts `pie-item-toolbar` directly.
  
  `check-capability-neutrality` could not see any of this: it read only `.ts` from a
  hand-listed scope. It now covers the three toolbar components too, and its
  comment-stripping is a state-tracking scan rather than ordered regex replaces —
  the old order let a `/*` inside a line comment (`externalizes @pie-players/*`)
  open a phantom block comment and hide the ~700 lines that followed it from the
  check, in `.ts` files as much as in components.
- Updated dependencies [2d8ce6a]
- Updated dependencies [27284f8]
- Updated dependencies [d68c01b]
- Updated dependencies [3f5e968]
- Updated dependencies [67f286c]
- Updated dependencies [55016b5]
- Updated dependencies [fc71c91]
- Updated dependencies [00b8a71]
- Updated dependencies [6e1e053]
- Updated dependencies [e94b097]
- Updated dependencies [7c9fb28]
- Updated dependencies [979e643]
- Updated dependencies [1d9f2d3]
- Updated dependencies [54742db]
- Updated dependencies [cb11691]
  - @pie-players/pie-players-shared@0.3.68
  - @pie-players/tts-client-server@0.3.68
  - @pie-players/pie-calculator@0.3.68
  - @pie-players/pie-calculator-desmos@0.3.68
  - @pie-players/pie-context@0.3.68
  - @pie-players/pie-tts@0.3.68

## 0.3.67

### Patch Changes

- fe9b4f0: `tools.policy.blocked` now decides feature-scoped capabilities too, so a host can
  decline one that renders as its own surface.

  `decideFeature(...)` consulted only the PNP source. The host gates —
  `tools.policy.blocked`, and `tools.policy.allowed` read as an allow-list — were
  applied in `composeDecision(...)`, which serves the placement-scoped path only.
  So the one lever that names capabilities rather than placements was inert for
  exactly the capabilities it was the sole lever for: configuration validation
  rejects a `region` capability from `tools.placement`, and the feature path
  deliberately ignores placement, which left a host with nothing to write.

  That became load-bearing when the audio transcript shipped as a packaged
  capability. It declares `resolvesWithoutGrant`, and an authored
  `visibility: "always"` card resolves without consulting the grant at all, so no
  profile, district policy or test administration could keep it off the page.
  Declining it meant adopting `@pie-players/pie-default-tool-loaders` and composing
  a registry by hand — the programmatic path, for a host that had deliberately
  stayed on the custom-element one.

  A host denial outranks `resolvesWithoutGrant`. The flag says the capability may
  answer from the content when policy granted nobody; a blocklist entry says the
  capability has no place in this delivery, which is not a question the content gets
  to reopen. The gate covers the registration's `toolId` as well as its
  `pnpSupportIds`, because `tools.policy` names capabilities and a host blocking
  `transcript` means the capability whatever support id it resolves through — gate
  only, since a grant still has to come from a declared support id.

  That precedence lives in `resolveContentCapabilities`, which both the section
  player and print resolve through, so the answer cannot differ between the screen
  and paper: policy answers it in three states — `granted`, `silent`, `denied` —
  where two could not tell a host's off switch from an unconfigured feature. Print
  binds no tools config today, so nothing can deny there yet; it reads the same rule
  so that stays true when one does.

  `provider-disabled` and `placement-membership` stay out of the feature path: both
  are statements about a toolbar the capability was never on.

  Two additive surfaces come with it. `FeaturePolicyDecision.rule` widens to
  `FeaturePolicyRule`, adding the `host-blocked` and `host-allowlist` members
  `ToolPolicyDecisionRule` already carried, and `precedence` admits `0` — the same
  values `composeDecision(...)` records, so a policy debugger reads one vocabulary
  for both paths. `isHostDeniedFeature(decision)` is the predicate that tells a host
  gate apart from an absent grant.

- 61d6aa0: Print resolves accessibility catalogs, so an alternate representation reaches paper. `<pie-print>` takes an `accessibility` config carrying the learner's profile.

  Print renders from the item model alone, so an alternate carried as a catalog card reached paper only where some element happened to render it from a legacy model field. With the transcript moved onto a card and rendered by the toolkit, print was the last consumer of `model.audioTranscript` — and braille, simplified-language and extended-description all arrive the same way.

  ```js
  player.config = {
    item,
    options: { role: "student" },
    accessibility: {
      personalNeedsProfile: { supports: ["transcript"] },
      // district blocks and test-administration overrides, when a program has them
      settings,
      // this item's required/restricted supports
      itemSettings,
    },
  };
  ```

  Three things worth knowing about it:

  - **A print job is one learner with one profile, decided once**, so print has no coordinator and nothing to toggle. It asks the same question the section player asks continuously — given this item and this profile, which alternates are in play — through the same policy engine, the same catalog resolver, and the grant-AND-content rule now shared as `resolveContentCapabilities` in `@pie-players/pie-assessment-toolkit/tools/internal`. A second reader for the one-shot case would be two renderers disagreeing about the same card.
  - **Policy answers that rule in three states, not two.** A host gate is not the absence of a grant: `resolvesWithoutGrant` lets a capability answer from the content when nobody was granted anything, so a host that switched the capability off has to be distinguishable from silence or the content would reopen it. The rule owns the scan across a capability's support ids, the gate-only probe of its tool id (a host gate names capabilities, and a block must not double as a grant), and denial's precedence over both a grant and the content exception — so a renderer supplies one `policyFor(featureId)` and cannot drift on any of it.
  - **An alternate the item declares as authored presentation prints with no `accessibility` config at all.** An item family designed to be delivered with its transcript on screen is not an accommodation, and print resolves unconditionally for that reason. An accommodation card with no profile supplied still prints nothing.
  - **Print opens the in-flow host slot and not the docked-media one.** That is a property of paper rather than a preference: a signed alternate is a video, and on paper a video is a blank rectangle. Every alternate that can be read in order reaches print by declaring the slot, with no change in print.

  The capability's accessible name is rendered as a visible label above its content and pointed at with `aria-labelledby`. Paper has no accessibility tree, and an unlabelled block of prose above an item reads as part of the item.

  The default capability set is `CONTENT_ALTERNATE_REGISTRATIONS` from `@pie-players/pie-default-tool-loaders` — the packaged capabilities that carry an authored alternate and render it as a region, pinned against the packaged composition in both directions so an alternate added there cannot quietly fail to reach print. A deployment composing its own set passes `accessibility.registrations`.

- Updated dependencies [b264ab2]
  - @pie-players/pie-players-shared@0.3.67
  - @pie-players/pie-calculator@0.3.67
  - @pie-players/pie-calculator-desmos@0.3.67
  - @pie-players/pie-context@0.3.67
  - @pie-players/pie-tts@0.3.67
  - @pie-players/tts-client-server@0.3.67

## 0.3.66

### Patch Changes

- 556c422: Make Browser API playback reliable by coalescing and serializing rate updates,
  publishing playback state and sentence highlighting from the provider's real
  start event, and rejecting native speech that ends or stalls before starting.
  Keep Chrome's native default voice unassigned while assigning explicitly chosen
  non-default voices. Browser voice identifiers accept an exact voice URI or
  documented name, while newly applied selections persist the unique URI. Server
  fallbacks now carry only portable rate, pitch, and highlighting settings into
  the Browser provider instead of leaking a server-specific voice. Ignore CSS-wide
  custom-element reset declarations when checking for a duplicate PIE content
  stylesheet.
- 2a741c6: Default the calculator button's glyph to the theme instead of the Figma blue.

  `ItemToolBar` remaps the vendored NDS button's `--color-interactive-blue` to
  `--pie-calculator-button-color`, a package-private token nothing sets — so the
  fallback behind it is what every host renders, and it was the literal `#146eb3`.
  A DaisyUI `valentine` toolbar drew a blue calculator icon on a pink surface. The
  accent now resolves through `--pie-button-color` (DaisyUI `base-content`) with
  the literal kept as the no-theme last resort, matching the chain
  `@pie-players/pie-tool-tts-inline` uses for the same NDS remap on its play
  trigger.

  Not `--pie-primary` or `--pie-tertiary`: both are `direct` mappings of DaisyUI
  slots chosen to pair with their own `-content` colour, so a glyph taken from
  either measures 1.37:1 against the page under `pastel`, and 11 of the 35 shipped
  themes fall under SC 1.4.11's 3:1. `base-content` is the one family DaisyUI
  guarantees against the surface. Hosts that want a branded accent keep setting
  `--pie-calculator-button-color` and own the contrast.

- 5e6fcde: Make accessibility catalog ownership one resolver contract.

  Mounted items and passages now register all entity-root, extracted, and model
  catalogs through one owner transaction. Content surfaces observe a bound owner
  view and give capabilities an immutable, deterministic catalog snapshot instead
  of exposing the raw entity, resolver, and separately assembled owner context.
  Signing and transcript capabilities now own only their card interpretation.

  Capability authors should read `ToolContentDependencyContext.catalogs` and no
  longer use the removed catalog-collection exports. Direct resolver clients,
  including inline TTS, retain `getAlternative(...)` and
  `catalogOwnerContextFor(...)`. Existing catalog IDs, card and payload shapes,
  `data-catalog-idref`, scoped lookup precedence, TTS fallback behavior, and
  section-player custom-element contracts are unchanged. Invalid optional catalog
  data remains recoverable: it is warned about and omitted without blocking the
  primary assessment content.

- 2bcd9fa: Bridge the vendored NDS icon button's palette to the PIE token families.

  `nds-icon-button` paints from the NDS design-system names — `--color-new-gray`,
  `--color-primary-white`, `--color-primary-black`, `--color-focus-blue` — and no
  PIE theme sets any of them, so the vendored literals were what every host
  rendered: a `#f3f5f7` tertiary pill and a `#2b87ff` focus ring under every theme.
  Remapping only the glyph made the dark-theme case worse, since a light
  `base-content` glyph then sat on that near-white pill and disappeared. Every host
  that opts into `nds-icons` saw it: the calculator button, the inline-TTS trigger,
  the items-pane scroll-down control and the floating tool shell's window controls.

  The tertiary fill now resolves through `--pie-background-dark`, the on-accent
  glyph through `--pie-white`, the hover ring through `--pie-text` and the focus
  ring through `--pie-button-focus-outline`, each keeping the NDS literal as the
  no-theme last resort. Glyph-on-pill measures 14.3:1 under `dracula`, 16.7:1 under
  `light`, 17.3:1 under `pastel` and 4.9:1 under `valentine`; the light theme is
  visually unchanged, since `--pie-background-dark` resolves to `#ecedf1` against
  the `#f3f5f7` it replaces.

  The bridge is declared at each element that mounts a button rather than in one
  stylesheet: the vendored bundle is a build artifact we do not re-author, and two
  of the mounts sit inside a shadow root a document stylesheet cannot reach. The
  tool shell's window controls are created imperatively, so the shell element
  carries the properties directly — its scoped CSS never matches them.
  `check:theme-tokens` now fails if a mount is added without the bridge or if the
  copies drift.

- 2bcd9fa: Paint the remaining player and tool chrome from the active theme.

  The floating tool shell's header fell back to `#f3f4f6` whenever the host had not
  set `--pie-section-player-card-header-background`, which is the normal case, so
  the shell's themed title text sat on a light grey strip — 2.3:1 under `pastel`,
  worse under the dark themes. It now defaults through `--pie-button-active-bg`,
  the mapping's contrast-tuned one-step-off-the-page fill, whose light value is the
  `#f3f4f6` that was pinned; the title measures 14.7:1 under `dracula`, 16.0:1 under
  `light` and 4.5:1 under `valentine`, and the light theme is unchanged.

  The three scrolling panes defaulted `--pie-scrollbar-thumb`,
  `--pie-scrollbar-track` and `--pie-scrollbar-thumb-hover` to greys, and nothing
  sets those hooks, so a light scrollbar shipped on every dark theme and colour
  scheme. Thumb and hover now default through `--pie-border` and
  `--pie-border-dark`, which the mapping corrects to 3:1 against the surface, and
  the track through `--pie-background-dark`.

  Also routed through tokens: the Desmos calculator frame and its loading/error
  overlay, the inline calculator's focus ring and glyph colours, the toolkit's
  framework-error panel, the item-player build warning, the preview toggle's tabs
  and the tool-settings hover tint, which now mixes from `currentColor` so it
  tracks whatever header it sits on.

  The embedded Desmos canvas stays white by decision: the third-party calculator
  paints its own white UI and a themed mount would only band it. The frame around
  it follows the theme so the shell's header and window controls read against it.

- 5e6fcde: Make section-player tool surfaces share one failure-isolated lifecycle.

  `content-lead`, `content-media`, and `section-overlay` now delegate discovery,
  policy and catalog invalidation, lazy loading, ordered mounting,
  synchronization, and teardown to one internal Tool Surface Host. Existing
  section-player custom-element tags, card placement, DOM hooks, CSS variables,
  surface names, and host setup remain unchanged.

  `ToolRegistry.onRegistryChange(listener)` is an additive synchronous observer
  for successful registration, override, removal, clear, component-override, and
  module-loader changes. Section-player uses it automatically: capabilities can
  appear after mount, overrides remount the affected registration, and removal
  destroys the mounted element without a host-forced rerender.

  Surface lifecycle failures now emit an isolated `tool-surface` framework
  warning with `recoverable: true`. A failing optional capability is omitted or
  keeps its last working element while the assessment and other capabilities
  continue. Recoverable framework warnings remain observable through the existing
  event, hook, and coordinator routes but no longer force section readiness to
  `error`; nonrecoverable errors retain the existing blocking behavior.

- 5f133be: The audio transcript is a packaged capability rendering into a new `content-lead` host surface. No element and no host names a transcript.

  The shipping implementation had `mc-populated-blank` render `model.audioTranscript` and reveal it from an `.rli-with-audio-transcript` class on an ancestor. A DOM class is invisible to policy — no support id is consulted, so district, test-administration and item-level precedence cannot reach it and the PNP debugger cannot explain it. `pie-elements-ng` now renders no transcript at all, the Learnosity import writes a `transcript` catalog card carrying its own visibility, and this is the half that resolves the card and puts the text on the page.

  ## Content without a grant

  `ToolRegistration.resolvesWithoutGrant` says a content-dependent capability must be consulted even when policy granted none of its support ids, and `ToolContentDependencyContext.granted` is how `resolve` learns which case it is in.

  Availability as grant AND content is the right default and stays the default. A transcript is the exception, because the card is authored for one of two different jobs: an item family designed to be delivered with its transcript on screen carries `visibility: "always"` and no student profile grants or revokes it, while a family whose construct a visible transcript would invalidate carries `onGrant` and is the accommodation. Only the content knows which, so the capability has to be able to answer from the content alone — and it still returns null for an `onGrant` card with no grant, which is where fail-closed lives.

  Registration rejects `resolvesWithoutGrant` without `requiresAuthoredContent`: there would be no `resolve` to reach, so the flag would claim a behaviour nothing implements.

  ## The `content-lead` surface

  Full-width, in flow, above the content body. `content-media` is a sticky side column sized to its media's aspect ratio — correct for a signed video, wrong for multiple sentences of prose that should be met on the way into the item.

  Surface names still belong to the host: core defines none, and `CONTENT_LEAD_SURFACE` is section-player's own geometry rather than anything the capability declares.

  ## One resolution path for both surfaces

  `resolveSurfaceCapabilities` decides eligibility and resolves content for every surface, and `SectionCardMediaSplit` now calls it instead of carrying its own copy — the second surface is what made the duplication a fork rather than a coincidence. It tries each `pnpSupportIds` entry, falls back to `toolId`, skips ungranted tools unless they declare `resolvesWithoutGrant`, and treats a resolver that returns null or throws as nothing to show.

  `SectionCardSurfaceStack` mounts what comes back, on both the item and passage cards. It carries over the write-only-when-the-signature-changed guard from the split pane, which is not an optimisation: re-rendering the card re-applies `item`, which re-registers the item's catalogs, which makes the resolver emit again, and one unconditional write per emission is self-sustaining until Svelte aborts at its depth limit with the DOM half-applied.

  ## Reading order instead of a description

  The region is labelled and placed immediately before the element's content. The alternative was preserving the `aria-describedby` from the audio control, which would have required a described-by id channel in the delivery contract so the player could reach a control inside an element it does not own — and a description is announced as a flat string on focus, so pointing one at a multi-sentence transcript is worse to listen to than reading order.

  ## Scope

  The packaged-registration invariant that no default-granted capability declares a content dependency now permits one that declares `resolvesWithoutGrant`, since such a capability reaching a learner is a statement about the item rather than about the grant list.

  Print has no toolkit and renders `model.audioTranscript` directly; print resolving catalogs itself is PIE-904.

- 9a183cf: A feature decision reports whether an assessment was bound, so a host that never bound one is distinguishable from a profile that grants nothing.

  Both produced `Feature "X" not configured at any level`. The first is a wiring gap and the second is a correct denial, and a deployment that forgot to supply a profile therefore looked exactly like a student who was properly declined — which is how it went unnoticed that Quiz Engine's fixed player, which takes a coordinator from `toolkit-ready` and configures tools through it but never calls `updateAssessment`, cannot deliver signing or a transcript at all.

  ## `FeaturePolicyDecision.assessmentBound`

  The engine already held the discriminant and threw it away: `decideFeature` passes the assessment to `PnpPolicySource.resolveFeature` as `undefined` whether the host bound nothing or bound something silent, so the source cannot tell and the engine can. A denial with nothing bound now carries its own reason in place of the six-level one.

  `granted`, `action`, `rule` and `precedence` are unchanged. Fail-closed is the correct behaviour and stays: an accommodation requires a documented need, and an absent profile documents nothing. Naming a seventh rule was the alternative and would have described a precedence level that does not exist — nothing fired, which is the point.

  `assessmentBound: false` is not a synonym for denied. An item ref carrying `requiredTools` mandates a feature at precedence 4 with no assessment in sight, and there the source's own reason survives. Read it alongside `granted`.

  A bound assessment carrying no profile material is deliberately `true`. A test that grants nobody an accommodation is legitimate configuration; never binding one cannot be, since there is nothing to deliver.

  ## One report per coordinator

  `decideFeaturePolicy` warns the first time it is asked about a feature with nothing bound, naming `updateAssessment` and the three fields policy reads. A feature policy is consulted once per capability per card, so a per-decision warning would bury itself; it is never re-armed, because binding an assessment later is the fix rather than a new occurrence.

  ## PNP debugger

  The panel reads the binding from `getPolicyInputs()` — which it previously narrowed to `pnpEnforcement` alone — and shows a card above the determination when nothing is bound, saying that the accommodations below are declined for want of a profile rather than by a verdict. A coordinator that exposes no inputs leaves it unstated: "cannot tell" must not read as "nothing is bound".

- Updated dependencies [556c422]
- Updated dependencies [5e6fcde]
- Updated dependencies [2bcd9fa]
- Updated dependencies [2bcd9fa]
- Updated dependencies [1f29de7]
  - @pie-players/pie-players-shared@0.3.66
  - @pie-players/pie-tts@0.3.66
  - @pie-players/tts-client-server@0.3.66
  - @pie-players/pie-calculator@0.3.66
  - @pie-players/pie-calculator-desmos@0.3.66
  - @pie-players/pie-context@0.3.66

## 0.3.65

### Patch Changes

- 35f1cc9: Deliver the section composition without waiting for the document to paint, so a
  section renders in a context that has no compositor.

  `PieAssessmentToolkit` publishes the composition to the players through exactly
  one path, the `composition-changed` event, and coalesces bursts of updates behind
  a one-shot emit latch. That latch was cleared only by a `requestAnimationFrame`
  callback, and the frame branch was taken whenever `window.requestAnimationFrame`
  merely _existed_ rather than when it was known to fire. Where no frame ever
  arrives the latch never cleared, no `composition-changed` was dispatched, and the
  layout kernel kept its initial empty composition — `section: null`, empty `items`
  and `renderables`. The `queueMicrotask` fallback could not rescue it, because it
  was only reached when rAF was absent entirely.

  The distinguishing symptom was a split between the two halves: the section
  controller held a correct view model with the right item ids while the player's
  `compositionModel` was the empty default. The content was computed and simply
  never delivered, so it did not read as a content, catalog, or bundle problem.

  Frame scheduling now lives in an internal `composition-emit-scheduler`, which
  races the frame against a 100ms deadline timer. Whichever arrives first releases
  the latch and flushes. On a painting document the frame still wins with six
  frames of margin at 60fps, so emits stay paint-aligned and coalescing is
  unchanged — several composition updates within one frame still produce a single
  `composition-changed`. Where frames never arrive the timer takes over and the
  document degrades to a slower render instead of a permanent blank. Svelte's own
  `tick()` races the same two primitives for the same reason.

  The scheduler owns the latch and both handles, so releasing the latch and
  releasing the handles is one operation in one place — a cancelled or superseded
  frame can no longer strand the latch. The toolkit's dispose path cancels through
  it rather than clearing two variables by hand.

  Impact was confined to verification and automation, with no known learner-facing
  scoring or data effect. A background tab recovered on refocus, because its
  pending frame becomes due then, so learner delivery saw at most a delayed first
  render. The permanent failure was in contexts that never paint — headless
  browsers without a compositor, hidden or offscreen tabs, and agent or CI
  automation harnesses — where every `pie-section-player` route rendered no content
  and read as whatever feature was under test being broken.

- c4c3aca: The packaged capability set moves out of the generic toolkit into the composition layer. `@pie-players/pie-assessment-toolkit` now names no capability.

  Eleven concrete registrations, the element tag map and the placement presets lived inside the generic package, so the registry and policy core knew every capability by name and a host could not contribute one without a PR against that package. They are now in `@pie-players/pie-default-tool-loaders`, which already owned the deployment's capability set for module loading.

  ## Moved

  `createPackagedToolRegistry`, `registerPackagedTools`, `PACKAGED_TOOL_REGISTRATIONS`, the six registration modules, `PACKAGED_TOOL_TAG_MAP` (was `DEFAULT_TOOL_TAG_MAP`), `PACKAGED_TOOL_PLACEMENT`, `SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT` and `PACKAGED_TOOL_ORDER` (was `DEFAULT_TOOL_ORDER`). Each registration is also exported individually, for a host composing a subset.

  Import them from `@pie-players/pie-default-tool-loaders` instead of the toolkit. Section-player already depended on that package for `DEFAULT_TOOL_MODULE_LOADERS`, so a host using the section-player elements needs no manifest change.

  ## Kept in the toolkit

  `ToolRegistry`, the registration contract, `createDefaultToolRegistry`, the toolbar button/overlay helpers, `createToolElement` / `resolveToolTag` / `toToolIdFromTag`, and `DEFAULT_TOOL_PLACEMENT`. It knows `featureId`, placement levels, activation kinds and precedence rules, and knows no capability ids.

  Three of those kept the name and changed what they do:

  - **`createDefaultToolRegistry()` builds an empty registry.** Its option bag changed with it: `overrides` (a toolId-keyed map replacing a packaged registration) became `registrations` (the registrations to register); `includePackagedTools` and `toolIds` are gone, because there is no packaged set here to include or filter; and `toolTagMap` no longer merges a built-in map, so a partial map is now the whole map. For the packaged set, call `createPackagedToolRegistry()` from the composition package.
  - **`DEFAULT_TOOL_PLACEMENT` is empty at every level.** A host using it as a starting preset gets no tools and no diagnostic. `PACKAGED_TOOL_PLACEMENT` and `SECTION_PLAYER_PREFERRED_TOOL_PLACEMENT` in the composition package are the populated presets.
  - **`toToolIdFromTag` reads only supplied overrides.** It returns `undefined` for a packaged tag with no installed map, where it previously resolved from the built-in one.

  A new `@pie-players/pie-assessment-toolkit/tools/internal` entry point carries what a package needs to _write_ a registration — the contract types, the context predicates, scoped-id and element helpers, the toolbar helpers, and the two provider descriptors. A separate entry point for the same reason `runtime/internal` and `policy/internal` exist: it serves sibling packages, and widening `.` with two dozen registration-authoring helpers would make each one something a host could expect us to keep. A host writing its own capability package imports from here too — the same mechanism our registrations use.

  ## Migration

  If you call `createToolsConfig` / `normalizeAndValidateToolsConfig`, or construct a `ToolkitCoordinator`, **without** passing a `toolRegistry`, add the composition package and pass one:

  ```ts
  import { createPackagedToolRegistry } from "@pie-players/pie-default-tool-loaders";

  const result = createToolsConfig({
    source,
    tools,
    toolRegistry: createPackagedToolRegistry(),
  });
  ```

  Without it your tool ids, levels and provider keys are no longer validated — see the diagnostic below. Tools still render: a host using the section-player elements gets its registry from the player, which builds one itself.

  ## Consequences

  **No fallback registry anywhere in the toolkit.** `ToolkitCoordinator` and `<pie-item-toolbar>` used to build a packaged registry when the host supplied none; they now use an empty one. A toolbar with no registry renders no buttons, which is the honest answer — with nothing registered there is nothing whose visibility or render contract could be consulted.

  **Tool-id validation reports when it cannot run.** With no registry there is nothing to check ids against, so `normalizeAndValidateToolsConfig` emits one `tools.registryUnavailable` diagnostic at `warning` severity naming the missing registry, and skips the id, level and provider checks. Two deliberate choices there: not throwing, because that would turn an existing working host setup into a construction failure; and not skipping silently, because downgrading "your ids are valid" to "nobody looked" with no signal is how a typo reaches a learner.

  `strictness: "error"` now rejects only `severity: "error"` diagnostics. Every diagnostic was `"error"` before this one, so nothing else changes.

  **`resolveToolTag` has no built-in map.** It reads only the overrides it is handed, which `createPackagedToolRegistry` installs via `setComponentOverrides`. Asking for an unmapped, non-hyphenated tool id throws naming the missing mapping rather than reporting a hyphen rule the caller did not break. `ToolRegistry.renderForSurface(toolId, context)` is new and is how a host should mount a surface capability: it merges the registry's component overrides the way `renderForToolbar` always has, so a capability can resolve its element tag.

  ## Guard

  `bun run check:capability-neutrality` fails when a capability id or `pie-tool-*` tag appears in the generic core — policy, the registry, catalog resolution, tools-config validation, the registry/tag factories. Without it the regression returns with the next capability, which is how these arrived: each reasonable on its own, each a name in a file that should not have had it. Wired into `verify:pre-commit`, `verify:ci-lint-typecheck` and `verify:publish`.

  It carries one reviewable exception: the `providers.tts` → `providers.textToSpeech` migration diagnostic in tools-config validation. That is one capability's rename in generic code and a legacy shim of the kind this repo disallows outside the `pie-item` contract, but deleting it drops a useful migration error and generalising it (a `deprecatedProviderKeys` declaration on the registration) is a design change rather than part of this move.

  `services/tts/**`, `TTSService`, `TTSToolProvider`, `DesmosToolProvider` and `tools/calculators/` stay in the toolkit; moving them is separate, larger work. The `pie-calculator` and `pie-tts` dependencies therefore remain — contrary to what PIE-886 assumed, they never came from the registrations. Both are interface-only packages with no dependencies of their own, imported type-only by `TTSService`, `interfaces.ts` and the provider descriptors.

- 2b015a9: Render docked alternates on the passage card, not only the item card.

  A catalog card docks to a content node, and a passage owns content nodes exactly
  as an item does — so a signed reading of a shared passage is authored once, on the
  passage, under the owner scope `<pie-passage-shell>` already registers. Resolution
  worked; nothing rendered it, because the media region existed only on the item
  card.

  The region moves to `SectionCardMediaSplit`, shared by both cards, so there is one
  implementation of grant-plus-content availability, mount reconciliation and split
  sizing rather than a copy per card kind. The host surface is renamed
  `item-media` → `content-media`, since item cards and passage cards open the same
  slot and a capability should declare it once: `@pie-players/pie-tool-sign-language`
  now exports `CONTENT_MEDIA_SURFACE` in place of `ITEM_MEDIA_SURFACE` and declares
  `supportedLevels: ["item", "passage"]`. A host capability that declared
  `surfaces: ["item-media"]` must declare `"content-media"` to keep mounting.

- 411b2cd: **Breaking.** The core no longer synthesizes a default personal-needs profile. A host that supplied none now has none.

  What this does **not** change is which toolbar tools appear. Toolbar candidates come from `tools.placement`, and `PnpPolicySource` only evaluates support ids that appear somewhere in the bound policy inputs — so an empty profile blocks nothing and mandates nothing, and a placement-driven toolbar renders exactly as before. If your tools come from placement, this entry costs you nothing.

  What does change is `ToolkitCoordinator.decideFeaturePolicy(supportId)`. For the 38 ids the derivation used to produce it answered `granted: true` for every host that supplied no profile, and now answers `granted: false` with reason `Feature "…" not configured`. That is the path capabilities without a toolbar placement are gated on — a host surface capability, and any host code asking "is this granted for this learner" outside a toolbar. Supply a profile if you rely on it; the one-line adoption is below.

  `computeDefaultSupports()` derived the fallback profile from every registered tool's `pnpSupportIds`, which reads _registry membership_ as _eligibility tier_. Registration means a capability is policy-addressable; it does not mean "universal, on by default". So an accommodation-tier capability was granted to every student of every host that supplied no profile. The remedy was `ACCOMMODATION_ONLY_SUPPORT_IDS`, a compile-time array naming `signLanguage` — which worked for the one accommodation shipped in this repo and gave a host contributing its own accommodation nothing to add to.

  Which capabilities a deployment grants by default is a property of the program, not of a capability: TTS is a universal feature in one program and a documented accommodation in another. It belongs in policy configuration, alongside the district and test-administration levels that already live there.

  ## What changed

  `@pie-players/pie-assessment-toolkit` drops `computeDefaultSupports()`, `DEFAULT_PERSONAL_NEEDS_PROFILE`, `ACCOMMODATION_ONLY_SUPPORT_IDS` and `createDefaultPersonalNeedsProfile()`. In their place, `createEmptyPersonalNeedsProfile()` returns a profile granting nothing. No alias for the old name: a function called "default" is what invited a populated default in the first place, and the rename is the signal that the return value changed.

  `@pie-players/pie-default-tool-loaders` gains `UNIVERSAL_SUPPORTS_PRESET` and `createUniversalPersonalNeedsProfile()` — the 38 support ids the old derivation produced, frozen as data. Adopt it, extend it, or replace it. It is pinned by a test rather than recomputed, so a diff there is a deliberate program decision instead of a side-effect of registering a tool. It excludes any capability declaring `requiresAuthoredContent`, asserted against `registry.getContentDependentSupportIds()` rather than against a list of ids — which is what lets a host's own accommodation get the same guarantee.

  `section-player` stops injecting a profile into a section that carries none. `pnpEnforcement` auto-detection engages on any non-empty profile, so the injected default silently turned enforcement on for every host — a gate whose profile granted everything, so it could not deny anything. Enforcement now engages only on real host policy material: a profile, a district policy, a test administration block, or item-level tool settings.

  The PNP debugger no longer labels its fallback "toolkit default profile (derived)". Nothing derives one, and that label over an empty `supports` array read as a broken derivation rather than as an unconfigured section.

  ## Migration

  A host that wants the previous grants adds one line at the point it builds a section or assessment:

  ```ts
  import { createUniversalPersonalNeedsProfile } from "@pie-players/pie-default-tool-loaders";

  const section = {
    ...authoredSection,
    personalNeedsProfile: createUniversalPersonalNeedsProfile(),
  };
  ```

  A host already supplying `personalNeedsProfile` is unaffected. The one case that changes a toolbar: a host that relied on the implicit default _and_ supplies `settings.districtPolicy` or `settings.testAdministration`. Enforcement stays on from that material, and there are now no supports to satisfy a `requiredTools` entry or to survive a `blockedTools` one.

  `@pie-players/pie-item-player` consumers are unaffected — it does not depend on the toolkit.

  This supersedes the statement in the sign-language catalog media region entry, which described `signLanguage` being filtered out of the computed default by id. Both the computation and the filter are gone; signing stays out of a wholesale grant because it declares a content dependency, not because it is named.

- f0d5802: A `ToolkitCoordinator` built without a tool registry no longer throws on every tool-config call.

  Moving the packaged capability set into the composition package removed the coordinator's registry fallback, so a host that supplies no `toolRegistry` now gets an empty one. `assertCanonicalToolId` validated against it and threw `Unknown tool id "…"` for everything — including the ids the coordinator's own default-provider block installs, so `isToolEnabled("textToSpeech")` threw on a coordinator that had just enabled text-to-speech itself. Any host constructing its own coordinator, which is the documented pattern for `element-QuizEngineFixedFormPlayer`, hit it.

  An empty registry means the host supplied none, not that every id is wrong: there is nothing to validate against, so the check is skipped. `normalizeAndValidateToolsConfig` already reports the missing registry once as `tools.registryUnavailable`, with the `createPackagedToolRegistry()` remedy; repeating it as an exception per call was the defect. A supplied registry still rejects ids it does not carry, and the `"tts"` → `"textToSpeech"` migration error still fires either way because it is checked first.

  Found by the assessment-player smoke suite, which builds a coordinator with no registry — the same shape the affected consumer uses.

- f588924: Section-player's section-scoped overlay is registry-driven. It no longer names `annotationToolbar`.

  `PieSectionPlayerBaseElement.svelte` named that tool id in three places — the policy check, the module load and the `<pie-tool-annotation-toolbar>` element — so a host could not contribute a second section-scoped capability without a PR against this repo. The base element now offers a named surface, `section-overlay`, and asks `registry.getToolsBySurface("section-overlay")` what can fill it. Nothing in section-player names a capability, an element tag, or a package.

  `annotationToolbarRegistration` declares `surfaces: ["section-overlay"]` and owns the mounting it used to have done for it: resolving its element tag through the component-override map, setting `enabled`, `ttsService` and `highlightCoordinator`, and returning a `sync` so a policy change reapplies props instead of remounting. Remounting would drop the element's own state and, for a selection gateway, the learner's current selection. It keeps `activation: "selection-gateway"` and its `renderToolbar`, so nothing about the toolbar path changes.

  Three behaviours the generic path has to keep, and does:

  - **Same grant check.** The three-level `decideToolPolicy` sweep over section, item and passage runs per discovered capability against its own `toolId`, with the same scope shape, so a custom `PolicySource` reading `assessmentId` cannot disagree with a toolbar's verdict for the same level.
  - **Same module gating.** A capability stays unmounted until `ensureToolModuleLoaded` resolves and its element is defined, so an optional package that is not installed leaves the surface empty rather than mounting an undefined element. The registration declines by returning `null` if its tag is still unknown.
  - **One instance.** The mount effect reconciles against what is already mounted, so a capability that stays granted is never torn down and remounted, and one that loses its grant is unmounted and destroyed.

  A capability returning `null` from `renderSurface` means "nothing to show", which is a legitimate answer and not an error. One throwing is logged against its tool id and skipped, so a broken capability cannot take the surface down with it.

  The mount point is an always-present `<div data-pie-tool-surface="section-overlay">` inside `<pie-assessment-toolkit>`, so a capability granted mid-session has somewhere to land and the toolkit's context requests still bubble to the provider from a mounted element.

- 3f6e33a: Signing becomes a capability package. New `@pie-players/pie-tool-sign-language`, and no package in the player names signing any more.

  The last capability-specific code in the generic core was signing's: the toolkit validated `sign-language` catalog cards, and section-player's item card knew the `signLanguage` support id, the catalog type, the language-matching rule and the region element by name. So the one accommodation PIE most needs hosts to be able to add was the one thing only we could add.

  ## The new package

  `@pie-players/pie-tool-sign-language` owns `signLanguageRegistration` (`activation: "region"`, `surfaces: ["item-media"]`, `supportedLevels: ["item"]`, `requiresAuthoredContent`), the card validators and language matching that were `services/sign-language-cards.ts` in the toolkit, the content resolver that was the signing half of section-player's `section-item-media.ts`, and `<pie-tool-sign-language>`, which was `SectionItemMediaRegion.svelte`.

  It is authored against `@pie-players/pie-assessment-toolkit/tools/internal` — the same entry point our packaged registrations use — and it is the worked example of a capability contributed from outside the player. A host opts in with two lines:

  ```ts
  import { signLanguageRegistration } from "@pie-players/pie-tool-sign-language";
  registry.register(signLanguageRegistration);
  ```

  Importing the package registers the element, so there is no module-loader entry to add.

  **Deliberately not in `createPackagedToolRegistry` or `DEFAULT_TOOL_MODULE_LOADERS.`** An accommodation with an authored-content dependency is a deployment's decision: a default that granted it would hand signing to every learner whose item happened to carry a card. The `apps/section-demos` `sign-language` route now registers it itself, which is the demonstration that a host can contribute a capability with no id of ours involved.

  ## What section-player kept and what it lost

  `SectionItemCard.svelte` iterates `getToolsBySurface("item-media")`, decides each capability against **its own** `pnpSupportIds`, calls its `requiresAuthoredContent.resolve`, and mounts through `ToolRegistry.renderForSurface`. It names no capability, no support id, no catalog type and no element tag, and it does not depend on the signing package — `check:player-tool-boundaries` forbids even the string.

  The region's own layout stays here, because it is the card's geometry rather than the capability's: `MEDIA_REGION_*`, `clampMediaRegionPercent`, `mediaRegionPercentFromDrag` and `SectionCardSplitDivider`. The three `--pie-section-player-item-media-*` tokens keep their names — hosts set them and PIE-880 is in testing against them — but the registry now records the signing package as their owner.

  Two behaviours the old file documented are preserved and re-keyed generically, because both were load-bearing: the `onCatalogsChange` re-resolve with a resolve-once-on-subscribe, and the write-only-when-the-signature-changed guard. That guard is not an optimisation. Re-rendering the card re-applies `item` on `<pie-item-shell>`, which re-registers the item's catalogs, which makes the resolver emit again; one unconditional write per emission makes the cycle self-sustaining and Svelte aborts at its depth limit with the DOM half-applied.

  ## Contract changes

  `isVisibleInContext` is now optional on `ToolRegistration`, required for the two toolbar activations and rejected only when present and not a function. A region capability has no toolbar presence to be relevant to, and the question it would answer — is there anything to show here — is `requiresAuthoredContent`. A registration that omits it is never returned by `getVisibleTools`. Callers that invoke it on a registration they wrap need `?.` — the one in-repo case was a demo decorator.

  `applyMediaFragment` reached the public surface through `sign-language-cards.js`; it is now exported from `services/catalog-media.js` directly, along with `isSafeMediaSrc`, `normalizeMediaSources`, `normalizeMediaFragment` and `trimmedOrUndefined` — the validators any capability package needs to read a media payload. The signing-specific exports (`SIGN_LANGUAGE_CATALOG_TYPE`, `AMERICAN_SIGN_LANGUAGE`, `describeSignLanguage`, `isSignLanguageCard`, `matchesRequestedSignLanguage`, `resolveSignLanguageMedia`, `SignLanguageMedia`) move to the new package.

  `packages/players-shared`'s `SignLanguageCardPayload` stays. It is authored wire data alongside `CatalogCard`, and a published shape for a standard support id is not a core dependency on a capability — the same argument that exempts `pnp-standard-features.ts`.

  ## Behaviour

  Unchanged, and that is the whole point. PIE-880 is in testing, so the guard is that its specs pass with import-path edits and **no assertion changes**: `section-player-sign-language-region.spec.ts` and `pie881-imported-asl-integration.spec.ts` (14 specs, including the re-registration-loop and keyboard-divider cases), plus the unit tests, now split between `sign-language-content.test.ts` in the new package and the sizing half left behind.

  `check:fixed-versioning` treated a 404 from npm as a failure, so adding any publishable package broke it. A never-published package is now reported and excluded from the version-sequence comparison; a network or auth failure still stops the gate, because "cannot tell" must not read as "fine".

- 3972f16: **Breaking for capability packages.** `ToolSurfaceRenderResult.sync` takes the current render context: `sync?: (context: ToolSurfaceRenderContext) => void`.

  It took no argument, so a registration had nothing to read but the context captured when it rendered. A host reconciles surface capabilities by `toolId` and calls `sync` rather than remounting — a `<video>` recreated mid-playback restarts the recording — so `sync` is the _only_ path a re-resolve has to an element already on screen, and with a captured context it re-applied the values the host already had. Two live consequences: a signed alternate re-resolved to a different recording (a `signLang` parameter change, or a catalog registering after first paint) left the learner watching the previous one, and a host calling `updateAssessment(...)` mid-session left the annotation gateway wired to the previous coordinator. Both were silent.

  Update a registration by reading the parameter instead of the closure:

  ```diff
  -const applyProps = () => {
  -  element.media = context.content;
  +const applyProps = (current: ToolSurfaceRenderContext) => {
  +  element.media = current.content;
   };
  -applyProps();
  +applyProps(context);
   return { element, sync: applyProps };
  ```

  ## Host surfaces a region capability can actually reach

  `section-overlay` gated every capability on `decideToolPolicy`, whose candidates are seeded only from `tools.placement` — and placing an `activation: "region"` capability is a `tools.unplaceableActivation` error at `error` severity. A capability that is only ever a region was therefore unreachable on that surface in both directions, and the mechanism worked for exactly the one capability that motivated it, which also has a toolbar activation. Region capabilities are now gated on `decideFeaturePolicy`, matching the item-media surface; placement-driven ones keep the placement question, which is where their candidacy comes from.

  `item-media` now awaits `ensureToolModuleLoaded` before mounting, so a capability registered through the documented lazy module-loader path renders instead of silently missing its element. This costs a capability that registers its element eagerly one microtask.

  `requiresAuthoredContent` is resolvable only on a surface the host renders per item or per passage. `CatalogOwnerContext` names an item model or a passage and never a section, because a DRD resource pairs with content rather than with a container — so `section-overlay` now declines a capability declaring one, with a console warning, instead of mounting it with `content: undefined`. That is documented on the contract; `resolve` must also be synchronous and return JSON-serializable content, both of which hosts already relied on and neither of which was stated.

  ## Item media region lifecycle

  Three fixes in `SectionItemCard`, all reachable by toggling an accommodation at runtime:

  - **Losing the last grant destroys the region, and the mount effect treated a missing anchor as "nothing to do."** The capability's `destroy()` never ran, so a detached `<video>` kept playing audio, and its entry stayed in the mounted map — so the next grant found an "existing" mount that was no longer in the document and the region stayed blank for the rest of the session. It now tears down, matching what the section-overlay surface already did.
  - **The region and its keyboard-focusable resize divider followed the grant count, not what mounted.** `renderSurface` returning `null` is a legitimate answer — a host that remapped the element tag through `toolTagMap` to one it never defined takes that path — which produced an empty 34% column with a handle dividing nothing. Both now follow the mounted count.
  - **Both surface anchors are `display: contents`.** They were always-present elements generating their own box: the overlay anchor as a permanent flex item shifting `gap` and child-index selectors, the media anchor breaking any `height: 100%` chain between the region and the capability's element.

  ## Guarantee that was asserted but not enforced

  `UNIVERSAL_SUPPORTS_PRESET`'s exclusion of content-dependent accommodations was a hardcoded `not.toContain("signLanguage")`, with a comment deferring the declaration-driven form to the step that has now landed. It reads `registry.getContentDependentSupportIds()`, which had no caller outside its own unit test, and a second assertion covers the other half: no packaged registration declares a content dependency, so a twelfth one could not pass by being invisible to the first check.

  ## PNP debugger

  Region capabilities no longer get per-level placement toggles or an "all available tools" entry. Clicking one wrote config that fails `tools.unplaceableActivation` at `error` severity, and the "visible" marker beside it read a placement-scoped decision a region capability is never in — so it reported "not visible" while the capability was correctly rendering. Rows show `host surface (not placed)` and, for a content-dependent capability, what has to be authored, which is what `contentDependencyDescription` was added for.

- 5183654: `ToolRegistration.requiresAuthoredContent` lets a capability declare the authored content it needs, so nothing in core has to know which accommodation it is resolving.

  Signing needs a catalog card, braille a transcription, authored SSML a `<speak>` in that item. This is the resource half of AfA's PNP/DRD pair, and it is intrinsic to the capability — unlike eligibility tier, which is a property of the program and belongs in policy configuration.

  ```ts
  requiresAuthoredContent: {
    description: 'a sign-language catalog card on the item',
    resolve: ({ catalogResolver, ownerContext, item }) => findSigningCard(...) ?? null,
  },
  ```

  Two independent things follow from declaring it, and both were previously done by naming ids in core.

  **Availability becomes grant AND content.** A host renders only when policy granted the feature _and_ `resolve` returned something. Neither half implies the other and neither is a default, so a learner who has the accommodation still sees nothing on an item that carries no resource — no dead affordance on the overwhelming majority of items. `resolve`'s return value is handed straight back through `ToolSurfaceRenderContext.content`, and the host never inspects it; that is what keeps the host and the resolver from knowing which accommodation is in play.

  **It is never granted wholesale.** `ToolRegistry.getContentDependentSupportIds()` is what a host filters a default grant list on, replacing the compile-time array of ids a host could not extend. A host adding its own accommodation gets the same guarantee by declaring the dependency — no change to our code.

  Registration rejects a content dependency with no `pnpSupportIds` entry. That is what a host filters on, so declaring the dependency with nothing to filter would silently drop the second guarantee.

  `getToolMetadata()` reports `requiresAuthoredContent` and the optional `description`, so a policy debugger can explain why an otherwise-granted capability is absent — the one question the grant trail alone cannot answer.

  Scope note: the composition package still keeps `signLanguage` out of its universal preset by id, because the packaged registrations have not moved there yet. The declaration-driven assertion replaces that id check when they do.

- c59396b: Capabilities can render into a host surface instead of a toolbar: `activation: "region"`, a `surfaces` list, and a `renderSurface` hook on `ToolRegistration`.

  Not every policy-addressable capability is a toolbar surface. A signed alternate renders as its own region beside item content, so a renderer that wants to show one has had to name `signLanguage` and its renderer directly — which is why a host cannot contribute an accommodation without a PR against this repo. The registry now answers "what can fill this slot" so a renderer never has to know.

  ## Contract

  ```ts
  activation: "region"
  surfaces: ["item-media"]
  renderSurface(context: ToolSurfaceRenderContext): ToolSurfaceRenderResult | null
  ```

  `ToolSurfaceRenderContext` carries the granted `featureId`, the policy `parameters`, the resolved content dependency, the surface name, and the same three services a toolbar tool reaches through `ToolbarContext` — coordinator, TTS, catalog resolver — and no more. A capability that needs anything else asks the coordinator. Passing the host's own component or state would make the registration depend on which renderer mounted it. `ToolSurfaceRenderResult` returns the element plus optional `ariaLabel`, `sync()` and `destroy()`.

  Surface names belong to the host. Core defines none and validates only that a region capability claims at least one, so a host can open a new surface without a change here, and a capability can say which of a host's surfaces it fits. Discovery is `registry.getToolsBySurface(surface)`, in registration order — core has no basis for a precedence between two capabilities in one slot.

  A capability can be both. The annotation toolbar is a toolbar button at item and passage level _and_ a section-scoped singleton, so it carries `renderToolbar` and `renderSurface` together; declaring a surface does not remove it from the toolbar path.

  ## Additive, not a migration

  `ToolActivation` gains `"region"` and keeps `"toolbar-toggle"` and `"selection-gateway"`. `icon` and `renderToolbar` become optional on `ToolRegistration` but stay _required for the two toolbar activations_, so every existing registration validates unchanged. A region registration with no `surfaces`, or a `renderSurface` with no surface to be found under, is rejected at registration: a surface renderer nothing can discover silently never renders, which is the failure mode this mechanism exists to remove.

  `ToolToolbarButtonDefinition.icon` is now optional, matching what the renderers already did — `ToolButton.svelte` and `ItemToolBar.svelte` both guard on `button.icon`, and `ToolbarItem.icon` was already optional, so requiring it claimed a guarantee nothing relied on.

  ## Diagnostics

  Naming a region capability in `placement.{section,item,passage}` is a new `tools.unplaceableActivation` error. It would never render there, and reporting it against the config is the difference between a diagnostic and an accommodation that is silently absent. `renderForToolbar` now throws with the activation named rather than failing on a missing method, because the caller's mistake is in placement config, not in the registration.

  `getToolMetadata()` reports `surfaces`, which is the PNP debugger's region-placement column.

- Updated dependencies [c5fbf21]
  - @pie-players/pie-players-shared@0.3.65
  - @pie-players/pie-calculator@0.3.65
  - @pie-players/pie-calculator-desmos@0.3.65
  - @pie-players/pie-context@0.3.65
  - @pie-players/pie-tts@0.3.65
  - @pie-players/tts-client-server@0.3.65

## 0.3.64

### Patch Changes

- 82118ce: Make a script and a recording of it addressable on the same node.

  A `spoken` node can legitimately carry two cards in the same language: the
  reading script, and a recording of it. That is APIP's authoring pattern, and QTI
  3's migration guidance keeps the script when legacy audio moves into catalogs,
  because it is both the source the audio was generated from and the fallback when
  the audio cannot play. PIE could store both and resolve neither reliably: both
  rungs of `findMatchingCard` took the first card matching type and language, and
  `getAllAlternatives` deduped on type and language alone, so whichever card was
  written second was unreachable and enumeration under-reported it — with no
  diagnostic, the same silent-no-op shape as the withdrawn `signLanguage` alias.

  `CatalogLookupOptions` gains `form?: "content" | "payload"`. No new field on the
  card: a card carries exactly one of `content` or `payload`, so the slot it fills
  is already an unambiguous discriminator, and `catalogCardForm(card)` names it.
  `form` is a preference rather than a filter — an absent preferred form still
  returns the other card, so callers check what they got, as they already must for
  a card of an unexpected type. It applies _within_ a language rung and never
  across one, so a Spanish lookup is never answered with English audio in
  preference to Spanish text. Omitting it preserves first-match resolution exactly.

  `getAllAlternatives` now keys on type, language and form, so both cards are
  reported. `TTSService`'s three spoken lookups ask for `form: "content"`
  explicitly, so which card an item lists first cannot change what read-aloud
  speaks.

- 9b2f37d: `CatalogCard.payload` is the only name for a card's structured content; the `signLanguage` alias is removed.

  `pie-elements-ng` (PIE-879) and the `pie-api-aws` Learnosity importer (PIE-881) had both landed with the signing payload under `signLanguage`, so this repo accepted that spelling on input and folded it into `payload` during resolution. That kept imported items rendering, and it introduced a worse failure than the one it prevented: only the resolution path knew about the alias, so an imported card rendered its signing video _and_ reported that the item had no signed alternate to anything that enumerated alternates. One fact under two names means every read path is a place to forget one of them, and the enumeration path forgot.

  Both producers now emit `payload`, on branches that land alongside this one, so the alias has nothing left to accept. It is gone from `CatalogCard`, from `resolveCard`, and from `resolveSignLanguageMedia`.

  `resolveSignLanguageMedia` now warns on _any_ `sign-language` card it cannot resolve, not only one carrying a string in `content`. A card written against the old spelling arrives with no payload at all, and the previous code returned `null` for it in silence — which is the shape of bug that reaches a learner and no one else. The new message names `payload` and says the card needs re-importing.

  Sequencing matters for anyone landing these: a host that ships this player against content built by the older `pie-elements-ng` types or the older importer will see signing cards stop resolving, with that warning as the signal. Re-import, or take all three changes together.

- acee584: `onCatalogsChange` on the catalog resolver and the toolkit coordinator, replacing a timed retry in the item card's signing region.

  A reader that _renders_ a catalog card has to answer "is there content for this item" before the catalogs exist: registration is driven by an item shell's mount event, which lands after a card rendered alongside that item has already computed its first answer. TTS never hit this because it resolves by DOM lookup at the moment it speaks. The signing region did, and it compensated with a bounded retry — 20 attempts, 50 ms apart — after which it stopped for good. No budget is right for that: a second is too short when element bundles load slowly, and running out of it left an eligible learner with no signing video and nothing logged. An accommodation that fails this way is invisible to everyone except the person who needed it.

  `AccessibilityCatalogResolver.onCatalogsChange(listener)` now reports registrations and removals, with `ToolkitCoordinator.onCatalogsChange` delegating to it exactly as `onPolicyChange` delegates to the policy engine. The event names what changed (`scoped-registered`, `scoped-removed`, `item-added`, `item-cleared`) and carries the owner context for the scoped reasons, but no resolved cards: listeners re-query with their own lookup context, which keeps the resolver free of assumptions about who is reading. It fires after the mutation, so re-querying from a listener sees the new state. Subscriber errors are swallowed and dispatch iterates a copy of the listener set, so one bad listener can neither break registration nor cause its neighbours to be skipped.

  `SectionItemCard` holds the resolved alternate in state and rewrites it from that stream **only when the resolved value actually changes**, rather than bumping a version counter a `$derived` reads. The counter is the pattern this file already uses for `onPolicyChange`, and for policy it is fine, but for catalogs it closes a feedback loop. Re-rendering the card re-applies the `item` prop on `<pie-item-shell>`, whose registration effect re-runs and re-registers the item's catalogs, which makes the resolver emit again. One unconditional write per emission is enough to make that cycle self-sustaining: measured 1000 register/unregister rounds per item before Svelte aborted the update at its depth limit — and an aborted update leaves the DOM half-applied, so the media region mounted while the container it lives in never got its side-by-side layout. It was not confined to signing either; any page with the toolkit hit it, including TTS demos with no signing content, because every card subscribes.

  Comparing before writing breaks the cycle at the only point where neither side has to know about the other: a re-registration that changes nothing resolves to the same value and stops there. The comparison is structural, because each resolution builds a fresh object and identity would report a change every time.

  `onCatalogsChange` is required on the coordinator interface rather than optional. It ships with its only consumer, so there are no pre-existing host stubs to stay assignable to, and `AGENTS.md` rules out internal-API compatibility shims without a documented exception.

  Any future region rendering a catalog card — a transcript region, braille, simplified language — subscribes instead of adding a second retry loop, and should guard its writes the same way for the same reason.

  Still latent underneath: `<pie-item-shell>` re-dispatches registration whenever its `item` prop is re-applied, even when the value is unchanged, so any future source of card re-renders will re-register catalogs and re-attach session listeners. Harmless now that nothing feeds it in a cycle, and worth a guard on the shell's side independently.

- 9b2f37d: `AccessibilityCatalogResolver.getAllAlternatives` now projects each card through the same code path as `getAlternative`, so enumeration and resolution cannot describe the same card differently.

  It hand-rolled the projection, and the two drifted the moment one of them gained a rule. The rule was the `signLanguage` payload alias, folded in by `resolveCard` and unknown to `getAllAlternatives`, which read `payload` alone: a card that arrived under the alias rendered its signing video and was simultaneously reported as carrying no payload, so `hasAlternativeType` said the item had no signed alternate and anything driving a learner-facing "alternates available" affordance off that answer would have hidden an accommodation that works. Silent for a sighted developer, and it fails in exactly the direction the sign-language work exists to rule out. The alias itself is gone now — see the accompanying changeset — but the two paths staying in sync is the durable half of the fix, and it is what a test now pins.

  Two smaller consequences of sharing the projection: enumerated `spoken` content is sanitized on the way out, matching resolution, and a card is enumerated once per type-and-language rather than once per occurrence. A second card with the same type and language was already unreachable — `findMatchingCard` returns the first — so reporting it as available promised content no lookup would return.

  `getAllAlternatives` still reports item-level cards ahead of assessment-level ones and treats context-scoped registrations as `item`, which is the precedence `getAlternative` applies.

- 5749bc1: Report unknown catalog types instead of storing them silently.

  `CatalogType` ends in `| string`, so its named literals were documentation only:
  a card authored `"spokn"` was a perfectly valid `CatalogType` that no reader would
  ever ask for, and a lookup for `"brallie"` returned `null` exactly as it would for
  a node with no alternate. Both failed by being invisible, which for an
  accommodation means the only person who notices is the candidate who needed it.

  The type stays open — QTI's support vocabulary is extensible, and catalogs arrive
  as authored JSON rather than through this type, so closing it would reject
  content PIE cannot usefully validate anyway. What changes is the silence.
  `isKnownCatalogType` accepts the types PIE names plus QTI's `ext:`-prefixed
  vendor extensions, which pass without comment. Anything else is still registered
  and still resolvable, but logged once per distinct token: on the card side naming
  the catalog and saying the alternate will never be shown, and on the lookup side
  saying it cannot match any card.

  The card-side check sits in the one funnel every registration path already runs
  through, so the constructor, `addItemCatalogs` and `registerCatalogs` are all
  covered without per-entry-point checks.

  `transcript` joins the named types. The Learnosity importer emits it, so treating
  it as unknown would have warned on ordinary imported audio items — which is the
  failure mode this kind of check invites, and the reason the known set was taken
  from what producers actually emit rather than from the existing union.

- 82edb28: Honour `data-tts-suppress` so content can be shown but never spoken.

  Read-aloud is not universally safe. Where reading _is_ the construct — a decoding
  item ("which word begins with the same sound as _cake_"), a spelling item where
  synthesized speech voices both options identically — speaking the node hands over
  the answer. Nothing in PIE could express that: the learner's
  `PersonalNeedsProfile` carries `prohibitedSupports`, but that is the learner
  saying "not for me", not the item saying "not here, for anyone", and this case has
  to override an entitlement rather than yield to it. The workaround was disabling
  read-aloud for a whole item, which also costs the candidate the directions —
  content that was never the construct.

  `data-tts-suppress` on a content element marks it and its subtree not-to-be-spoken.
  It takes one value: `computer-read-aloud` or `all` suppress PIE's TTS, while
  `screen-reader` targets assistive technology only and stays machine-read aloud.
  An unrecognized or empty value suppresses anyway and logs why — a token that fell
  through on a typo would leak an answer with no visible symptom, whereas
  over-suppressing only withholds speech an author had already marked as withheld.

  Enforced in every path that produces speech, since a filter on one of them is a
  filter a candidate can walk around: the composed catalog path (before card
  resolution, so suppression beats an authored `spoken` card on the same node), the
  generated-speech and visible-text collectors, structural pause boundaries, and
  `speakRange`. That last one mattered most and was the actual hole: the annotation
  toolbar's selection read-aloud is a text-in path that hands `range.toString()`
  straight to the provider, and `Range.toString()` honours no DOM filter at all, so
  selecting a word and pressing read-aloud would have walked around a filter applied
  only to the DOM walk. It now filters the range, and derives the highlight offset
  from the same filtered text so word highlighting stays aligned when suppressed
  content precedes the selection.

  The shape follows QTI 3's `data-qti-suppress-tts` — same vocabulary, same
  placement on the content element rather than on a catalog card — under PIE's own
  `data-tts-*` attribute name. PIE reads one spelling; an importer converting QTI
  content maps the attribute on the way in.

- a5241b9: Render `sign-language` accessibility catalog cards. `sign-language` has been a declared `CatalogType` with no consumer since catalogs landed — only `spoken` was wired, through `TTSService` — so an item carrying an ASL video showed the question and no video. This adds the four pieces that make signed alternates appear, deliberately shaped as a second instance of the spoken/TTS path rather than as new machinery.

  ## Card payload

  `CatalogCard.content` is a flat string, so a signing card could only hold a bare URL — no second source, no MIME type, no poster, no time range, all of which QTI 3 expresses inside `qti-card-entry`. `CatalogCard` gains an optional structured `payload`, and `players-shared` gains the media vocabulary it uses (`MediaAssetRef`, `MediaSource`, `TextTrackRef`, `TranscriptRef`, `MediaFragmentRange`, `SignLanguageCardPayload`).

  A card carries **either** `content` **or** `payload`, never both. QTI gives `qti-card` one content slot and names the type in `@support`, which PIE already models as `CatalogCard.catalog`; so `content` is the string form for types a string can express (SSML for `spoken`), `payload` is the structured form for types it cannot, and `catalog` is the only discriminator. Two consequences, both deliberate:

  - **`content` becomes optional.** A signing card has no string form at all. Nothing is projected or mirrored into `content`, so there is never a second copy of the payload's primary URL to fall out of sync with it — and no precedence rule silently deciding which copy wins. `ResolvedCatalog.content` is optional for the same reason; `TTSService` treats a card with no string form as "no catalog", falling through to generated speech.
  - **The payload carries no `kind` tag.** Restating `catalog` inside the payload would be a second source of truth for the type that can disagree with the first. Consumers select a card by catalog type and then validate the payload structurally, which they must do anyway for authored wire data.

  One media vocabulary rather than two: `MediaAssetRef` is defined against both this consumer and prospective stimulus media, with the required subset resolved per consumer instead of by making every field optional at the type level — a type where nothing is required stops catching anything. For signing, sources and language are required, poster and duration do not apply, and `tracks`/`transcript` are actively meaningless, since captions on a signing video would be the English text already on screen. Stated explicitly so no future policy adds a caption requirement to signed content.

  Validation is "treat as absent, never as text": a payload with no usable source resolves to `null` instead of rendering an empty player or a URL as visible content, and a `sign-language` card carrying a bare URL in `content` is reported and ignored rather than half-rendered. Source URLs are restricted to schemes a media element can actually fetch, so an authored `javascript:` or `file:` URL cannot ride into the DOM.

  ## Extraction

  `SignLanguageExtractor` is the signing counterpart of `SSMLExtractor` and exists for the same reason: authors carry the accessibility material inline, and the runtime needs catalog cards. It probes content for `data-sign-language` regions, lifts the video into a card with sources, poster and an optional `data-sign-language-start` / `-end` range, removes it from the visible markup, and docks the catalog on the content it translates via `data-catalog-idref`.

  Removing the video from visible content is the substantive divergence from Learnosity, where a signing video is ordinary item content that renders unconditionally with nothing to gate. In PIE it becomes catalog data that policy decides on.

  An existing `data-catalog-idref` is never overwritten. The attribute is one canonical name with two readers, and clobbering it would break TTS resolution for that node; the synthesized catalog is still emitted and still resolves, because the region finds cards through the item's catalog set rather than by walking the DOM.

  ## Resolution

  Lookup goes through `AccessibilityCatalogResolver.getAlternative(catalogId, { type: "sign-language", language })`, so assessment/item/scoped priority and owner scoping are not re-implemented. `ResolvedCatalog` now carries the card's `payload`.

  Owner scoping needed one consolidation to make that true. Catalogs are placed dynamically — a shell registers what its entity carries on mount, and readers resolve by identifier within an owner scope — so registration and lookup have to agree on where a catalog is filed, and the resolver matches contexts field by field, meaning a disagreement resolves nothing rather than failing loudly. The walk over the three places catalogs hang off an entity, and the construction of the context each is filed under, now live in one place: `collectEntityCatalogRegistrations` and `catalogOwnerContextFor`, both exported from `pie-assessment-toolkit`, with the runtime registration event handler reduced to an adapter over the first. The media region borrows the walk rather than repeating it, so a lookup cannot name a scope registration never wrote.

  One behaviour is deliberately stricter than the resolver's default. Its last fallback rung matches any card of the requested type regardless of language, which is helpful for spoken content and wrong for signing: ASL, BSL and LSF are not interchangeable, so handing an ASL learner a BSL recording is worse than handing them nothing. A card reached by that rung is accepted only if its language matches, or if it asserts no language at all — a card that names no language cannot be shown to be a mismatch, while one that positively claims another language can.

  ## Policy

  Signing is gated on the `signLanguage` PNP support id through the existing six-level `PnpPolicySource` precedence. Because the region is not a toolbar surface, a placement-scoped `decide(...)` would answer the wrong question — absent because it was never placed, not because policy said no — so `ToolPolicyEngine.decideFeature(featureId)` and `ToolkitCoordinator.decideFeaturePolicy(featureId)` resolve one feature id independent of placement. `PnpPolicySource.resolveFeature(...)` reuses the existing rule evaluation rather than copying the six levels, so the two cannot drift.

  `pnpEnforcement` is not consulted for a feature decision: that flag governs whether profile policy _refines_ an otherwise-visible tool set, and a feature with no placement has no unrefined baseline to fall back to, so skipping the profile read would make the accommodation permanently unavailable rather than merely unrefined.

  `computeDefaultSupports()` now excludes `ACCOMMODATION_ONLY_SUPPORT_IDS`, which lists `signLanguage`. That function derives the fallback profile from every registered tool's `pnpSupportIds`, which is right for universal features and wrong for an accommodation: signing requires a documented need, so inheriting it by default would invert the eligibility tier. Excluded by id rather than by declining to register, so the guarantee holds however a signing tool later reaches the registry. Hosts that supply their own profile are unaffected.

  ## Region

  `SectionItemCard.svelte` gains a `data-region="media"` region beside its existing `header` and `content` regions, holding a resolved catalog card. Named for the slot rather than its first tenant — audio description is the same "docked alternate media, gated by PNP" shape.

  `item-player` needs no changes and learns nothing about signing.

  - **Fixed to the right of the content.** Not below: signing is re-checked _while_ an answer is being formed, so a bottom placement means scrolling between video and choices repeatedly. Side by side keeps both visible however long the item is, and the region is sticky within the card so it follows a long question down. Being parallel rather than sequential also sidesteps a problem an above/below split cannot solve, since `item-player` renders prompt and choices as one opaque block.
  - **Resizable** via a keyboard-accessible `role="separator"` divider following `SectionSplitDivider.svelte`'s shape rather than reusing it — that component is wired to the passage/items grid and converts a drag with a fixed 0.1%-per-pixel factor. Inside a card the same drag has to mean the same thing whether the card is wide or narrow, so the math here is container-relative.
  - **Sized for legibility** by an aspect-ratio target with a height floor, not a flat width percentage, which either wastes space on a short clip or crushes signing on a narrow device. Retunable via `--pie-section-player-item-media-aspect-ratio`, `--pie-section-player-item-media-min-height` and `--pie-section-player-item-media-max-height`. Below a 560px card width the region stacks and the divider withdraws.
  - No orientation toggle and no free repositioning. Free 2D positioning is the floating-tool pattern, built for movable utility windows; the `toolParameters` seam is the right place for a policy-driven generalization, and nothing hangs there yet.

  The split wrapper is always present and the content region always occupies the same slot within it, so a card resolving after mount adds siblings rather than re-creating the item player. An item with no signing markup comes back from extraction by reference, so nothing downstream sees config churn.

  Playback is a minimal `<video>` wrapper: the clips are seconds long, so sharing a player with a section-scale stimulus element buys nothing. Its own audio is muted by default, its accessible name states the language ("American Sign Language") rather than saying "video", and starting it pauses TTS — the action the learner just took wins.

  ## Availability

  Signing appears when **both** conditions hold: the item carries a matching card, and policy grants eligibility. Both are checked independently and neither is a default. The content half is AfA's resource-side declaration (QTI approximates DRD in-band — the presence of a card _is_ the declaration) and is what keeps the region off the overwhelming majority of items, so a learner with the accommodation still sees no dead affordance where no signing was authored.

  ## Also

  `AssessmentSection` gains an optional `personalNeedsProfile`. Section players already read it (falling back to `settings.personalNeedsProfile`, then to the computed default) through an `any` cast; this types an existing runtime contract.

- 0dcec2e: Remove `SignLanguageExtractor`. A signed alternate is a catalog card, authored or imported, never lifted out of item markup at render time.

  The extractor mirrored `SSMLExtractor` for signing: it found `[data-sign-language]` video regions in an item's markup, prompts and choice labels, turned each into a `sign-language` card, removed the video from the visible content and docked the card via `data-catalog-idref`. Section-player ran it on every item card mount.

  Nothing produced that inline form. The Learnosity transform in `pie-api-aws` writes `accessibilityCatalogs` directly, and signing is new enough in PIE that no legacy content carries a video inline — the attribute's only producer was this repo's own demo. The symmetry with `SSMLExtractor` was the whole case for it, and it does not hold: inline `<speak>` is real authored content PIE does not control.

  It also failed in the wrong direction. Extraction needed `DOMParser`, so under SSR it no-opped, and a parse error took the same path — in both cases the `<video>` stayed in the visible prompt and rendered to every learner, granted the accommodation or not. A card cannot leak that way, because it was never in the content. Its synthesized catalog ids were positional (`auto-sign-prompt-q1-0`), so inserting a signing region renumbered the reference docking another one.

  Breaking for anyone importing `SignLanguageExtractor`, `SIGN_LANGUAGE_ATTRIBUTE` or `SignLanguageExtractionResult` from `@pie-players/pie-assessment-toolkit`, and for `prepareSignLanguageItem` from section-player's shared components: author the card on `accessibilityCatalogs` instead, at item or model level. Resolution, gating and rendering are unchanged — `collectSignLanguageCatalogRefs` reads the same three places catalogs hang off an entity as it always did. `SSMLExtractor` is untouched.

- acee584: Accept `signLanguage` as an input alias for a sign-language card's `payload`, so cards from the two producers that already shipped resolve.

  `CatalogCard.payload` was the only accepted name for a signing card's structured media. Two landed implementations disagree with that: `pie-elements-ng` declares the payload as `signLanguage` (PIE-879), and the `pie-api-aws` Learnosity importer emits `signLanguage` (PIE-881). A card from either validated, imported, stored and then resolved to `null` — no signing video, no error a learner or proctor would ever see. That is the exact failure mode the accommodation model exists to prevent, and it is invisible precisely to the people who depend on it.

  `CatalogCard.signLanguage` is now accepted and folded into `payload` at the one point where `AccessibilityCatalogResolver` projects a card, so a single field still reaches every consumer and nothing downstream learns two names. `resolveSignLanguageMedia` reads the alias too, for callers that hand it a raw card. `payload` wins when a card somehow carries both.

  Tolerated on input, never canonical. Which name the three repos settle on is a separate decision; this stops content from silently losing its accommodation while that decision is made.

- 25511d7: Play recorded audio as a `spoken` alternate.

  PIE's `spoken` card was a string, so it could carry a reading script but never
  "play this file for this node" — and some programs prefer a human voice to
  synthesis. QTI 3 treats the two as the _same_ support, with recorded audio
  referenced by file and MIME type on a `spoken` card, so this adds a form of an
  existing accommodation rather than a new one. No new PNP entitlement: a recording
  played by the player is still computer-delivered speech.

  `SpokenAudioCardPayload` carries a `MediaAssetRef` of `kind: "audio"` plus an
  optional time range. `resolveSpokenAudioMedia` validates it with the same
  "absent, never partially valid" posture as sign-language cards, refusing
  non-audio media so signing and speech cards cannot quietly swap roles, and
  staying silent for a plain script card — which arrives on that path routinely,
  since form resolution is a preference.

  Highlighting is the docked node as a block for the clip's duration. A recording
  emits no word-boundary events, and deriving them from its duration would
  highlight the wrong words confidently rather than the right region vaguely; word
  -level highlighting stays available on the synthesized path. The rate setting
  applies through `playbackRate`, a time range becomes a Media Fragments URI with
  the end bound enforced by the player, and the first source is used because an
  `<audio>` element with alternative `<source>` children reports failure through a
  path that is awkward to observe reliably.

  A clip that will not play degrades to the node's `content` card through the
  existing speak-time fallback — which is the concrete reason QTI's guidance keeps
  the script alongside the audio. With no script, the failure is reported rather
  than silently skipped. `stop()` and seeking cancel a playing clip and settle its
  pending playback, so a superseded run cannot wedge the chunk loop, and
  `data-tts-suppress` withholds a recording exactly as it withholds a script.

  Also extracts the media-URL allow-list, source and fragment normalization shared
  by signing and spoken-audio cards into one module, rather than keeping two copies
  of a security-relevant allow-list.

- bbcabc0: One docking rule for both catalog extractors, and no synthesized content to hold a reference.

  `data-catalog-idref` is a single canonical attribute naming a whole card array, with more than one reader now that signed alternates render. `SSMLExtractor` was overwriting it unconditionally on whatever element wrapped an inline `<speak>` — usually an element the author wrote. When that element already carried a reference, the authored one was silently replaced, taking every card under it out of reach: not just the spoken alternate the extractor cares about, but that node's braille, simplified-language and sign-language cards too. `SignLanguageExtractor` already refused to overwrite; both now follow the same rule. `SSMLExtractor` also reports the collision; `SignLanguageExtractor` still declines silently, because a signing card is resolved through the item's catalog set rather than by DOM lookup and so loses nothing it was relying on.

  Also removed: the invented docking node. Both extractors used to insert a `<span>` when the marked content sat at the root of a fragment, so the reference had somewhere to live — and on the SSML side that span was filled with the `<speak>` element's own text content, which is spoken phrasing, not visible phrasing. Where an author wrote `<speak>x squared, plus two x, equals eight</speak>` as an item's whole markup, that spoken phrasing became the visible content — the documented authoring examples avoid this only because their `<speak>` sits inside a `<div>`, which took the other branch. A `<speak>` or a signing video with no element around it has no content node to be an alternate _for_, so neither extractor now synthesizes one: the catalog is still emitted and still resolves through the item's catalog set, and on the SSML side the missing docking node is reported.

  The trade this makes deliberately: a `<speak>` that _is_ an item's entire markup now leaves the visible content empty rather than showing spoken phrasing. Sibling visible content is unaffected — a `<speak>` beside a `<p>` removes only the `<speak>`.

  Two consequences for authored content, both surfaced as console warnings rather than silent behavior:

  - Inline `<speak>` inside an already-docked node no longer applies to TTS. Move the SSML into a `spoken` card on the existing catalog, or give the `<speak>` its own wrapper.
  - Root-level inline `<speak>` no longer produces visible text or a docked catalog. Wrap the visible content the SSML speaks in an element.

  Authored `accessibilityCatalogs` are unaffected — this is extraction-time behavior only.

- 30baec4: Resolve a selection's spoken catalog by climbing to the nearest ancestor that actually holds spoken content.

  `data-catalog-idref` names a whole card array, not a spoken card. The TTS tool took the nearest docked ancestor of a selection and passed its id straight to `speak()`, which was correct while spoken cards were the only kind that got docked. They are not any more: `SignLanguageExtractor` docks a signing catalog onto the element wrapping a marked video, and that element can sit inside a node the author docked to a catalog carrying the SSML. The inner reference then wins, the lookup finds no spoken card, and the selection is read as generated speech — plausible enough that nobody notices the authored pronunciation was dropped.

  `TTSService.hasSpokenAlternate(catalogId, language?)` answers whether a catalog holds speakable content, and the tool walks up from the selection until one does, falling back to the nearest docked id when the service cannot answer (no resolver attached), which is the previous behaviour. The composed-speech path never had this problem — it descends into children when a card has no string form — so only the selection path changes.

- Updated dependencies [9b2f37d]
- Updated dependencies [bb1a90b]
- Updated dependencies [a5241b9]
- Updated dependencies [acee584]
- Updated dependencies [b3acac4]
- Updated dependencies [25511d7]
  - @pie-players/pie-players-shared@0.3.64
  - @pie-players/pie-calculator@0.3.64
  - @pie-players/pie-calculator-desmos@0.3.64
  - @pie-players/pie-context@0.3.64
  - @pie-players/pie-tts@0.3.64
  - @pie-players/tts-client-server@0.3.64

## 0.3.63

### Patch Changes

- @pie-players/pie-calculator@0.3.63
- @pie-players/pie-calculator-desmos@0.3.63
- @pie-players/pie-context@0.3.63
- @pie-players/pie-players-shared@0.3.63
- @pie-players/pie-tts@0.3.63
- @pie-players/tts-client-server@0.3.63

## 0.3.62

### Patch Changes

- c73c995: Give the annotation toolbar outline and the annotation underline their own contrast-checked tokens, so neither depends on a token that cannot satisfy WCAG 2.2 SC 1.4.11.

  ## Toolbar outline

  The floating toolbar's stroke is the only boundary between it and the content
  behind it, so it has to clear 3:1 against both. It was derived from
  `--pie-border`, which cannot carry that: the DaisyUI bridge maps that token to
  `--color-base-300`, a surface tint rather than a boundary colour — `#eeeeee` at
  1.16:1 on the light base, `#15191e` at 1.12:1 on the dark one.

  The outline now reads a new `--pie-tool-annotation-toolbar-border`, defaulting to
  a measured `light-dark(#5c5c5c, #949494)` pair — dark grey on light surfaces,
  light grey on dark ones.

  Both arms are measured against the surfaces the toolbar is actually drawn on
  rather than against pure white and pure black. Real theme bases are off-white and
  off-black, and a grey chosen at the edge of passing against an extreme drops under
  threshold on everything else: across DaisyUI's 21 light and 14 dark themes, every
  light surface needs a grey no lighter than `#828282` and every dark surface one no
  darker than `#878787`. Those ranges are disjoint, so one value cannot serve both
  and `light-dark()` is the mechanism. `#5c5c5c` holds 5.22:1 as its worst case on
  the light surfaces and `#949494` holds 3.56:1 on the dark ones.

  `@pie-players/pie-theme` then hands the last word back to palettes that do choose
  a boundary colour deliberately:

  - `[data-theme="dark"]` and `pie-theme[theme="dark"]` pin the dark arm,
    `#949494`. `light-dark()` keys off the declared `color-scheme`, which pie-theme
    does not set, so without this a pie-theme dark page would take the light arm.
  - All ten `data-color-scheme` accessibility palettes map the outline to their own
    `--pie-border`, which each picks for maximum contrast against its own
    background. This rule sits after the dark rule deliberately — the two have
    equal specificity and a scheme can be active on a dark page. The schemes are
    named rather than matched with a bare `[data-color-scheme]`, so an unknown id
    cannot pull in the `:root` values (`--pie-border` is `#9a9a9a`, which misses 3:1
    on white).

  - Each palette also fixes which underline value applies. The underline default is
    selected by `[data-theme]`, which reports what the _page_ declares rather than
    which scheme is active — so a host declaring itself light while running a dark
    scheme pinned the light value over a dark background.

    The colours themselves were never the problem, so they are unchanged: `#4221d5`
    and `#9c89ec` clear 3:1 between them on nine of the ten backgrounds, and each
    scheme is simply given the arm that suits its own. Both states get that one
    value, because within a scheme the background is fixed regardless of what
    `data-theme` reports. Worst case is 4.33:1 (`light-gray-on-dark-gray`).

    `yellow-on-navy` is the sole exception: its `#33508a` background is mid-tone and
    neither arm reaches 3:1 (1.10 light, 2.71 dark), so there alone the underline
    defers to the palette's own `--pie-primary` (`#ffff99`, 7.54:1) — the same
    deference the outline makes to `--pie-border`.

    All three tokens are declared in both delivery routes: per scheme in
    `color-schemes.ts`, so `<pie-theme scheme="…">` applies them as inline styles
    with no CSS import, and in `color-schemes.css` for hosts that set
    `data-color-scheme` themselves.

  `--pie-tool-annotation-toolbar-border` is registered as a `component-public`
  token. Hosts overriding it must keep 3:1 against both the toolbar surface and the
  content behind it.

  ## Annotation underline

  `::highlight(annotation-underline)` took its colour from `--pie-primary`, a theme
  accent chosen against one background and therefore illegible on the other. It now
  reads `--pie-annotation-underline` (default `#4221d5`) and
  `--pie-annotation-underline-dark` (default `#9c89ec`). One value cannot serve
  both: `#4221d5` is 2.41:1 on black and `#9c89ec` is 2.85:1 on white. Each state
  gets its own token so overriding one never silently moves the other, and so
  either can beat a host-set `--pie-primary` — a `var()` fallback can never
  override a value the host actually set.

  The `prefers-color-scheme` media query only reports the OS preference, which is a
  guess at what the page is showing. Three mutually exclusive `[data-theme]` rules
  now override it: explicit `light` and `dark` take the matching default, and any
  other value — including DaisyUI theme ids — follows that theme's accent, falling
  back to the light default. All three carry attribute selectors, so they outrank
  the bare rules including the one inside the media query, whatever the source
  order.

  ## Upgrade note

  Two host overrides stop having their old effect, which is the point of the change
  rather than a side effect of it:

  - Setting `--pie-border` no longer recolours the annotation toolbar outline; set
    `--pie-tool-annotation-toolbar-border`.
  - Setting `--pie-primary` no longer recolours the annotation underline; set
    `--pie-annotation-underline` and `--pie-annotation-underline-dark`. A host that
    declares `data-theme` with neither token set still follows its accent.

- 507b56f: Restore dark-mode, high-contrast, print, and reduced-motion styling for TTS and annotation highlights.

  `HighlightCoordinator` injects the `::highlight()` rules for TTS read-along and
  student annotations. A second copy of those rules also existed as
  `packages/tool-annotation-toolbar/highlights.css`, imported with a plain CSS
  import that never reached the page: the package builds with Vite in library
  mode, so the import was extracted to a `dist` stylesheet the built JS never
  referenced and no `exports` entry exposed.

  The two copies had diverged in both directions. The injected copy had gained
  newer TTS work (`--pie-tts-line-highlight`, element-level fallbacks, an orange
  swatch) while never having the media-query blocks the file carried. So at runtime
  annotation highlights had no dark-mode or high-contrast treatment, printing did
  not strip transient TTS highlighting or convert annotation fills to underlines,
  and reduced-motion did not drop highlight text shadows.

  Those blocks now live with the rules they modify, covering all five annotation
  swatches including orange. Two corrections were made rather than copying the old
  file forward:

  - The recovered stylesheet used `@media (prefers-contrast: high)`. `high` is not
    a valid value for that feature (the keywords are `no-preference`, `more`,
    `less`, `custom`), so an invalid query evaluates to `not all` and the block
    could never have matched in any browser even had the file loaded. It is now
    `more`.
  - The TTS dark-mode and high-contrast blocks were dropped rather than restored.
    They varied only a `var()` fallback, and `applyAdaptiveTTSStyle()` writes
    `--pie-tts-*` inline on `documentElement` on every paint, so those fallbacks
    can never apply. TTS contrast adaptation is handled by that adaptive path.

  `highlights.css` and its dead import are removed. Its `.pie-sr-only` and
  focus-visible rules were already defined in the toolbar component's own `<style>`
  block, where they do take effect.

- a1edde5: Minify and code-split the assessment toolkit custom-element bundles. The three CE artifacts are now produced by a single bundler invocation that shares code through `dist/components/chunks/`, so the Svelte runtime, services layer, and policy engine are no longer duplicated per artifact, and `SectionToolBar` no longer inlines a second copy of `ItemToolBar`. Splitting also restores the lazy `speech-rule-engine` boundary that `math-speech.ts` already asked for: it moves to a chunk fetched only when math speech runs, instead of being flattened into the eager bundle. Eager CE bytes drop from 1,993 KB to 346 KB, and the section player's main bundle drops from roughly 2.6 MB to 1.4 MB. Entry filenames, the `exports` map, and per-entrypoint custom-element registration side effects are unchanged.
- 7864f66: Declare the toolkit's two optional peer packages as devDependencies so the build graph orders them before its own `tsc`.

  `assessment-toolkit` type-imports `@pie-players/pie-calculator-desmos` and
  `@pie-players/tts-client-server` at the dynamic-import sites in
  `DesmosToolProvider` and `TTSToolProvider`. Both were declared only as optional
  `peerDependencies`, which states the consumer contract but is not a build-graph
  edge: only `dependencies` and `devDependencies` order one workspace package's
  build after another's.

  turbo 2.9 happened to derive task-graph edges from `peerDependencies` too, so the
  ordering held by accident. turbo 2.10 stopped, turning the toolkit's build into a
  race against those two packages that fails whenever its own `tsc` wins:

  ```
  src/services/tool-providers/DesmosToolProvider.ts(135,34): error TS2307:
    Cannot find module '@pie-players/pie-calculator-desmos'
  ```

  Both packages are now also devDependencies, so the ordering is explicit and holds
  under either turbo version. The `peerDependencies` and `peerDependenciesMeta`
  entries are unchanged, so consumers still see both as optional peers, and the
  runtime load path is untouched. A standalone build of just this package in a fresh
  checkout now works too.

  `check:deps` grew a `workspace-build-edge` rule that fails when a package imports a
  workspace package it declares only as a peer or optional dependency, so this cannot
  regress silently.

- 3b4e461: Keep every runtime dependency external in the assessment toolkit's custom-element build, and stop publishing sourcemaps.

  Inlining a dependency into a prebuilt custom-element chunk creates a copy a consumer's bundler cannot deduplicate, because its module id is the chunk file rather than the dependency's path in `node_modules`. `speech-rule-engine` was reaching the section player twice for exactly that reason — once through `services/tts/math-speech.js` and once inside the prebuilt chunk — about 1.3 MB of duplicate payload. Externalizing the manifest's dependencies collapses that to one copy. It asks nothing new of consumers: these artifacts already emitted bare `@pie-players/*` specifiers, so they always required a bundler or an import map.

  Publishable packages ship only `dist`, so a usable sourcemap also required `inlineSources`, which embedded every TypeScript source into the tarball. That cost roughly 2.5 MB across the tsc-built packages while every Vite-built package in the repo already shipped none. Sourcemaps are now off everywhere.

- 7605500: Update `speech-rule-engine` from 5.0.0-rc.1 to 5.0.0-rc.4 (current latest).

  Spoken output is unchanged. Verified by diffing both installed copies across 88 outputs — 22 MathML shapes covering fractions, roots, powers, matrices, integrals, sums, Greek, inequalities, percents, absolute values and decimals, against both locale/domain pairs the toolkit derives (`en`/clearspeak and non-English/mathspeak), in both `none` and `ssml` markup modes. Every output matched byte for byte, so the cached-speech key in `generated-speech/math-speech-cache.ts` is deliberately left alone: bumping it would invalidate every cached spoken string in the field for no behavioural reason.

- Updated dependencies [14666b3]
- Updated dependencies [001486e]
- Updated dependencies [6a18f3c]
- Updated dependencies [3b4e461]
  - @pie-players/pie-players-shared@0.3.62
  - @pie-players/pie-calculator@0.3.62
  - @pie-players/pie-calculator-desmos@0.3.62
  - @pie-players/pie-tts@0.3.62
  - @pie-players/tts-client-server@0.3.62
  - @pie-players/pie-context@0.3.62

## 0.3.61

### Patch Changes

- @pie-players/pie-calculator@0.3.61
- @pie-players/pie-calculator-desmos@0.3.61
- @pie-players/pie-context@0.3.61
- @pie-players/pie-players-shared@0.3.61
- @pie-players/pie-tts@0.3.61
- @pie-players/tts-client-server@0.3.61

## 0.3.60

### Patch Changes

- @pie-players/pie-calculator@0.3.60
- @pie-players/pie-calculator-desmos@0.3.60
- @pie-players/pie-context@0.3.60
- @pie-players/pie-players-shared@0.3.60
- @pie-players/pie-tts@0.3.60
- @pie-players/tts-client-server@0.3.60

## 0.3.59

### Patch Changes

- Add an opt-in `nds-icons` flag so hosts can render the vendored `<nds-icon-button>` per environment. Enable it with the `nds-icons` attribute on a section-player element (`<pie-section-player-splitpane nds-icons={true}>`, and likewise on `-vertical`, `-tabbed`, and `-base`) or via `runtime.ndsIcons: true`. When on, the toolbar tool buttons, the calculator shell controls, the inline-TTS play/pause trigger, and the section scroll-hint render as NDS icon buttons; the flag flows through the toolkit runtime context. It defaults to off, so unless a host explicitly opts in these controls render as plain `<button>`s.
  - @pie-players/pie-calculator@0.3.59
  - @pie-players/pie-calculator-desmos@0.3.59
  - @pie-players/pie-context@0.3.59
  - @pie-players/pie-players-shared@0.3.59
  - @pie-players/pie-tts@0.3.59
  - @pie-players/tts-client-server@0.3.59

## 0.3.58

### Patch Changes

- Updated dependencies [8df52bf]
- Updated dependencies [d5cc905]
  - @pie-players/pie-players-shared@0.3.58
  - @pie-players/pie-calculator@0.3.58
  - @pie-players/pie-calculator-desmos@0.3.58
  - @pie-players/pie-context@0.3.58
  - @pie-players/pie-tts@0.3.58
  - @pie-players/tts-client-server@0.3.58

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.57
  - @pie-players/pie-calculator-desmos@0.3.57
  - @pie-players/pie-context@0.3.57
  - @pie-players/pie-players-shared@0.3.57
  - @pie-players/pie-tts@0.3.57
  - @pie-players/tts-client-server@0.3.57

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.56
  - @pie-players/pie-calculator-desmos@0.3.56
  - @pie-players/pie-context@0.3.56
  - @pie-players/pie-players-shared@0.3.56
  - @pie-players/pie-tts@0.3.56
  - @pie-players/tts-client-server@0.3.56

## 0.3.55

### Patch Changes

- Updated dependencies [7f45877]
  - @pie-players/pie-players-shared@0.3.55
  - @pie-players/pie-calculator@0.3.55
  - @pie-players/pie-calculator-desmos@0.3.55
  - @pie-players/pie-context@0.3.55
  - @pie-players/pie-tts@0.3.55
  - @pie-players/tts-client-server@0.3.55

## 0.3.54

### Patch Changes

- bead424: Make inline TTS speed controls a single-select radio-style group with visible Normal selected by default, while preserving host ordering and numeric helper compatibility.
  - @pie-players/pie-calculator@0.3.54
  - @pie-players/pie-calculator-desmos@0.3.54
  - @pie-players/pie-context@0.3.54
  - @pie-players/pie-players-shared@0.3.54
  - @pie-players/pie-tts@0.3.54
  - @pie-players/tts-client-server@0.3.54

## 0.3.53

### Patch Changes

- @pie-players/pie-calculator@0.3.53
- @pie-players/pie-calculator-desmos@0.3.53
- @pie-players/pie-context@0.3.53
- @pie-players/pie-players-shared@0.3.53
- @pie-players/pie-tts@0.3.53
- @pie-players/tts-client-server@0.3.53

## 0.3.52

### Patch Changes

- 905080d: Add a runtime TTS highlight target resolver so hosts can remap spoken ranges to visible highlight targets while PIE Players keeps default identity highlighting, painting, and cleanup.
- Updated dependencies [017f5a9]
  - @pie-players/pie-players-shared@0.3.52
  - @pie-players/pie-calculator@0.3.52
  - @pie-players/pie-calculator-desmos@0.3.52
  - @pie-players/pie-context@0.3.52
  - @pie-players/pie-tts@0.3.52
  - @pie-players/tts-client-server@0.3.52

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.51
  - @pie-players/pie-calculator-desmos@0.3.51
  - @pie-players/pie-context@0.3.51
  - @pie-players/pie-players-shared@0.3.51
  - @pie-players/pie-tts@0.3.51
  - @pie-players/tts-client-server@0.3.51

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.50
  - @pie-players/pie-calculator-desmos@0.3.50
  - @pie-players/pie-context@0.3.50
  - @pie-players/pie-players-shared@0.3.50
  - @pie-players/pie-tts@0.3.50
  - @pie-players/tts-client-server@0.3.50

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.49
  - @pie-players/pie-calculator-desmos@0.3.49
  - @pie-players/pie-context@0.3.49
  - @pie-players/pie-players-shared@0.3.49
  - @pie-players/pie-tts@0.3.49
  - @pie-players/tts-client-server@0.3.49

## 0.3.48

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0c20d0f]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.48
  - @pie-players/pie-calculator@0.3.48
  - @pie-players/pie-calculator-desmos@0.3.48
  - @pie-players/pie-context@0.3.48
  - @pie-players/pie-tts@0.3.48
  - @pie-players/tts-client-server@0.3.48

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.47
  - @pie-players/pie-calculator-desmos@0.3.47
  - @pie-players/pie-context@0.3.47
  - @pie-players/pie-players-shared@0.3.47
  - @pie-players/pie-tts@0.3.47
  - @pie-players/tts-client-server@0.3.47

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.46
  - @pie-players/pie-calculator-desmos@0.3.46
  - @pie-players/pie-context@0.3.46
  - @pie-players/pie-players-shared@0.3.46
  - @pie-players/pie-tts@0.3.46
  - @pie-players/tts-client-server@0.3.46

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- fd140a3: TTS: generate spoken math as SSML for SSML-capable providers (PIE-623)

  The generated (no authored `accessibilityCatalogs`) math speech path can now
  emit Speech Rule Engine SSML to providers that voice it, while keeping the same
  confidence-gated highlighting and plain-text behavior everywhere else.

  - `@pie-players/pie-tts`: `TTSProviderCapabilities` gains an optional
    `supportsSSML` flag. It is optional and defaults to `false`, so existing
    provider implementations are unaffected.
  - `@pie-players/tts-client-server`: `ServerTTSProvider.getCapabilities()` now
    reports `supportsSSML`. It is conservative — `true` only for the SSML-reliable
    `pie` transport backends (Polly, Google) and `false` for the `custom`
    transport and unknown providers.
  - `@pie-players/pie-assessment-toolkit`: the speech composition core assembles a
    DOM-free plan and, for SSML-capable providers, sends SRE SSML for math
    segments with a plain-text speak-time fallback if a provider rejects it. The
    browser Web Speech provider always receives plain text.
  - `@pie-players/pie-assessment-toolkit`: fixed word/token-level highlighting for
    generated math SSML. Provider word boundaries on a generated math chunk (raw
    SSML in `speechText`, no catalog span alignment) are now mapped from
    raw-SSML offsets back into spoken-text space, so per-token tracking works the
    same as the authored-SSML path instead of falling back to whole-formula
    block highlighting.
  - `@pie-players/pie-assessment-toolkit`: strip the leading `<?xml …?>` prolog
    from Speech Rule Engine SSML so SSML-capable providers (AWS Polly, Google),
    which require the payload to begin with `<speak>`, accept the generated math
    SSML.

- Updated dependencies
- Updated dependencies [fd140a3]
  - @pie-players/pie-calculator@0.3.45
  - @pie-players/pie-calculator-desmos@0.3.45
  - @pie-players/pie-context@0.3.45
  - @pie-players/pie-players-shared@0.3.45
  - @pie-players/pie-tts@0.3.45
  - @pie-players/tts-client-server@0.3.45

## 0.3.44

### Patch Changes

- Lockstep release covering develop since 0.3.42:

  - PIE-548: Integrate `<nds-icon-button>` for the calculator icon in `ItemToolBar`.
  - PIE-565: Add `splitPaneInitialPassageWidth` prop to section-player layout components (split-pane / tabbed / vertical).
  - PIE-553: Section-demos keyboard-navigation demo page; align `partLabels` default with KC.
  - Test stability: audit and wire package test coverage; stabilize item-source-editor and section TTS e2e flows; keep item-player test mocks in sync.

  Note: 0.3.43 was published manually from feat/PIE-546 without merging back to develop. This release re-issues the develop branch onto npm at 0.3.44 and brings local manifests back in sync with the published lockstep version.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.44
  - @pie-players/pie-calculator-desmos@0.3.44
  - @pie-players/pie-context@0.3.44
  - @pie-players/pie-players-shared@0.3.44
  - @pie-players/pie-tts@0.3.44
  - @pie-players/tts-client-server@0.3.44

## 0.3.42

### Patch Changes

- 6496dda: Add host tool context resolvers so integrations can attach per-item render params, such as calculator type, after policy and PNP gates but without overriding packaged tool registrations.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.42
  - @pie-players/pie-calculator-desmos@0.3.42
  - @pie-players/pie-context@0.3.42
  - @pie-players/pie-players-shared@0.3.42
  - @pie-players/pie-tts@0.3.42
  - @pie-players/tts-client-server@0.3.42

## 0.3.41

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.41
  - @pie-players/pie-calculator-desmos@0.3.41
  - @pie-players/pie-context@0.3.41
  - @pie-players/pie-players-shared@0.3.41
  - @pie-players/pie-tts@0.3.41
  - @pie-players/tts-client-server@0.3.41

## 0.3.40

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [3a167a8]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.40
  - @pie-players/pie-calculator@0.3.40
  - @pie-players/pie-calculator-desmos@0.3.40
  - @pie-players/pie-context@0.3.40
  - @pie-players/pie-tts@0.3.40
  - @pie-players/tts-client-server@0.3.40

## 0.3.39

### Patch Changes

- 0072fad: Move Svelte out of published runtime dependencies and add a release check that rejects future accidental `svelte` runtime dependency declarations. Assessment toolkit custom-element outputs now bundle their Svelte runtime helpers so consumers do not install a second Svelte runtime through player packages.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0072fad]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.39
  - @pie-players/pie-calculator@0.3.39
  - @pie-players/pie-calculator-desmos@0.3.39
  - @pie-players/pie-context@0.3.39
  - @pie-players/pie-tts@0.3.39
  - @pie-players/tts-client-server@0.3.39

## 0.3.38

### Patch Changes

- ef29724: Rename generic QTI policy APIs and diagnostics to PNP/profile terminology, including the built-in policy source, default enforcement helpers, provenance tags, and required-tool diagnostics.

  Enhance the editable PNP debugger and section demos so hosts can exercise all available tools and PNP/profile enforcement behavior end-to-end.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [f856362]
- Updated dependencies [c8d46d7]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.38
  - @pie-players/pie-calculator@0.3.38
  - @pie-players/pie-calculator-desmos@0.3.38
  - @pie-players/pie-context@0.3.38
  - @pie-players/pie-tts@0.3.38
  - @pie-players/tts-client-server@0.3.38

## 0.3.37

### Patch Changes

- 2818f93: Remove unused `TypedEventBus` from the public API.

  `TypedEventBus` was a generic ~80-LOC `EventTarget` wrapper exported as a "building block" that nothing inside the toolkit used. The toolkit's actual event surfaces deliberately rely on different patterns:

  - Controller streams use `controller.subscribe(listener)` returning a disposer and dispatching a strongly-typed discriminated union (`SectionControllerEvent`).
  - `ToolkitCoordinator.subscribeSectionEvents` / `subscribeItemEvents` / `subscribeSectionLifecycleEvents` use the same disposer + filtered fan-out shape.
  - `FrameworkErrorBus` is a hand-rolled bus with a documented contract (synchronous fan-out, listener isolation, snapshot iteration, idempotent unsubscribe, no replay) — guarantees `EventTarget` does not provide.
  - `I18nService` uses a plain `Set<() => void>` and intentionally does not bubble through the DOM.
  - DOM `CustomEvent`s on `<pie-assessment-toolkit>` cover host-facing communication and are typed via the constants in `runtime/registration-events.ts`.

  ### BREAKING CHANGE (typed integrations only)

  `TypedEventBus` is no longer exported from `@pie-players/pie-assessment-toolkit`. Hosts that imported it can drop in any of:

  - A bare `EventTarget` + `CustomEvent` (the wrapper added almost nothing on top).
  - A small bus library (`mitt`, `nanoevents`, etc.) — equivalent shape, more familiar to most teams.
  - A purpose-built listener `Set` plus a typed `subscribe(listener)` disposer pattern, which is what the toolkit's own services do.

  No replacement is shipped; the export is removed outright because there were no internal call sites and the public-facing surface was already documented as "exported as a building block, not used internally" in both the package README and the marketing docs.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.37
  - @pie-players/pie-calculator-desmos@0.3.37
  - @pie-players/pie-context@0.3.37
  - @pie-players/pie-players-shared@0.3.37
  - @pie-players/pie-tts@0.3.37
  - @pie-players/tts-client-server@0.3.37

## 0.3.36

### Patch Changes

- 9ef211c: PIE-512 Phase D cleanup: drop prior `sectionId` / `attemptId` args from internal subscribe call sites; sharpen the migration narrative for typed integrations.

  This is a follow-up to `0.3.35` — same active-cohort contract, no functional behavior change. It cleans up internal code that was still passing the now-ignored args, and adds an explicit migration recipe for typed integrators.

  ### BREAKING CHANGE (re-stated from `0.3.35` for clarity)

  `coordinator.subscribeSectionEvents` / `subscribeItemEvents` / `subscribeSectionLifecycleEvents` no longer accept `sectionId` / `attemptId` arguments at the type level. The runtime silently ignores any extra unknown properties, so untyped or loosely-typed call sites continue to work, but **typed integrations that import `SectionEventSubscriptionArgs`, `SectionItemEventSubscriptionArgs`, or `SectionScopedEventSubscriptionArgs` directly and pass `sectionId` / `attemptId` will fail to compile against `>=0.3.35`.**

  #### What this changes for typed integrations

  | Before (`<0.3.35`)                                                                            | After (`>=0.3.35`)                                                                                                       |
  | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
  | `subscribeItemEvents({ sectionId, attemptId, listener })`                                     | `subscribeItemEvents({ listener })`                                                                                      |
  | Listener bound to one controller; manual re-subscribe needed on cohort change                 | Listener follows the active cohort automatically; single subscribe survives navigation                                   |
  | `subscribe*` was a no-op when called with an unknown `sectionId`                              | `subscribe*` throws if **no** active cohort exists; call it after the first `getOrCreateSectionController(...)` resolves |
  | Subscribing the same listener function with different filter args added a second subscription | Subscribing the same listener function replaces the prior subscription (filter args from the second call win)            |
  | Listener throws bubbled up to the dispatcher and could break fan-out                          | Listener throws are caught and `console.warn`-logged; fan-out to other listeners continues                               |

  #### Action required

  - **Drop** `sectionId` / `attemptId` from every `subscribeSectionEvents`, `subscribeItemEvents`, `subscribeSectionLifecycleEvents` call site. The args have no runtime effect under `>=0.3.35`.
  - **Move the subscribe call** to _after_ the first `getOrCreateSectionController(...)` resolves (rather than synchronously on `toolkit-ready`).
  - **Remove any re-subscribe-on-navigation logic.** A single subscribe call after the first controller-resolve is sufficient — the listener migrates automatically and gets a snapshot replay (`content-loaded` × N then `section-loading-complete`) on every cohort transition. **This is the most common breakage pattern**: hosts that previously detached and re-subscribed on every `toolkit-ready` (correct under the pre-Phase D pinned-subscription contract) will now observe **double snapshot replays** on every section navigation — once via Phase D auto-migration, then again from the manual re-subscribe. Listener handlers that are not strictly idempotent will fire twice (e.g. analytics `pageAction`s, increment counters that aren't Set-deduplicated, side-effecting hydration calls).
  - **For intentionally-pinned subscriptions to a non-active section** (e.g. a host UI that wants to keep watching section A while displaying B), use `coordinator.getSectionController({ sectionId, attemptId })` and subscribe directly on the controller handle via `controller.subscribe?.(...)`. That binding is pinned to one controller instance and does not migrate.
  - **Hand-rolled local structural types** that duplicate the public arg shape: drop the `sectionId` / `attemptId` properties from the local type so the local declaration matches the public contract. Otherwise the local type is misleadingly-wrong dead code at runtime.

  #### Concrete simplification example

  If your wrapper used the pre-Phase D detach-and-re-subscribe pattern on every `toolkit-ready` event:

  ```typescript
  public handleToolkitReady(event: Event): void {
    const coordinator = (event as CustomEvent).detail?.coordinator;
    if (!coordinator) return;

    // Pre-Phase D: rebind for the new section.
    this.controllerUnsubscribe?.();
    const itemUnsub = coordinator.subscribeItemEvents({
      sectionId: this.sectionId, // pinned to currently-displayed section
      listener: handleItemEvent,
    });
    const sectionUnsub = coordinator.subscribeSectionLifecycleEvents({
      sectionId: this.sectionId,
      listener: handleSectionEvent,
    });
    this.controllerUnsubscribe = () => { itemUnsub?.(); sectionUnsub?.(); };
  }
  ```

  …simplify to subscribe **once** and let Phase D follow the active cohort:

  ```typescript
  public handleToolkitReady(event: Event): void {
    const coordinator = (event as CustomEvent).detail?.coordinator;
    if (!coordinator) return;
    this.toolkitCoordinator = coordinator;

    // Phase D: subscribe once; the listener follows the active cohort
    // across all subsequent navigation. Bail if already subscribed.
    if (this.controllerUnsubscribe) return;

    const itemUnsub = coordinator.subscribeItemEvents({
      listener: handleItemEvent,
    });
    const sectionUnsub = coordinator.subscribeSectionLifecycleEvents({
      listener: handleSectionEvent,
    });
    this.controllerUnsubscribe = () => { itemUnsub?.(); sectionUnsub?.(); };
  }
  ```

  The full migration recipe with before/after code samples is in `packages/assessment-toolkit/README.md` under "Migrating from `<0.3.35`".

  ### Internal cleanup

  Drops `sectionId` / `attemptId` from:

  - `packages/section-player-tools-event-debugger/EventPanel.svelte` — local `ToolkitCoordinatorLike` structural type and the two coordinator subscribe call sites.
  - `packages/section-player-tools-session-debugger/SectionSessionPanel.svelte` — same shape.
  - `packages/section-player/tests/section-player-pie-512-cross-section-events.spec.ts` — the `EventPanelHandle` type and the in-page subscribe call sites.

  These were dead-args at runtime under Phase D — the runtime ignores them, but their presence was misleading: the local types claimed args that the public API no longer accepts, and any future maintainer copy-pasting from those panels would write code that's TS-broken against the public types. No test or behavior change; the cleanup is purely contract-shape hygiene.

  Also fixes a single overlooked `sectionId,` arg in `docs/section-player/client-architecture-tutorial.md` (post-0.3.35 doc-sweep straggler) and adds explicit migration notes to `packages/assessment-toolkit/README.md` and `packages/section-player/README.md`.

  ### Coverage

  No new tests — this is a code-shape cleanup of internal call sites. Coverage for the Phase D contract itself is in:

  - `packages/assessment-toolkit/tests/pie-512-phase-d-active-cohort-tracking.test.ts` (12 cases)
  - `packages/assessment-toolkit/tests/runtime/adapter/coordinator-bridge-cohort-handoff.test.ts` (3 cases)
  - `packages/assessment-toolkit/tests/pie-512-cross-section-event-delivery.test.ts` (3 cases)
  - `packages/section-player/tests/section-player-pie-512-cross-section-events.spec.ts` (Playwright e2e, narrow-viewport A→B→A traversal)

  All pass with the cleanup applied.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.36
  - @pie-players/pie-calculator-desmos@0.3.36
  - @pie-players/pie-context@0.3.36
  - @pie-players/pie-players-shared@0.3.36
  - @pie-players/pie-tts@0.3.36
  - @pie-players/tts-client-server@0.3.36

## 0.3.35

### Patch Changes

- 286418e: fix(PIE-512): make `subscribeSectionEvents` follow the active section cohort across navigation (Phase D)

  Phase B/C addressed engine-side replay and same-section `updateInput` regressions but
  left a final residual flake: `coordinator.subscribeItemEvents` and
  `coordinator.subscribeSectionLifecycleEvents` bound a listener to the section
  controller that was active **at subscribe time**. A host that subscribes once
  on `toolkit-ready` and then navigates between sections — without re-subscribing
  — stayed pinned to the original controller and silently missed `content-loaded`
  / `section-loading-complete` events from the new cohort. Demos that remounted
  the layout custom element on navigation (via `{#key}` or equivalent) avoided
  the bug; a host that keeps the element persistent (the supported pattern) hit
  it on every cross-section navigation.

  ### What changes

  - `subscribeSectionEvents`, `subscribeItemEvents`, and
    `subscribeSectionLifecycleEvents` now bind to the toolkit's _active section
    cohort_ and automatically migrate across cohort transitions. On every
    migration the listener is detached from the old controller, attached to the
    new one, and replayed the new cohort's snapshot (`content-loaded` × N in
    registration order, then `section-loading-complete` if applicable) — the
    same ordering a fresh subscriber would have observed.
  - `subscribeSectionEvents` now throws when no active cohort exists; host code
    must call `getOrCreateSectionController(...)` at least once before
    subscribing. (`toolkit-ready` alone is not sufficient.) The typical
    pattern is a single subscribe right after the first
    `getOrCreateSectionController(...)` resolves — that subscription then
    follows all subsequent navigation without further wiring.
  - Subscribing the same listener function twice replaces the prior
    subscription (filter args from the second call win); the dedup key is
    listener identity alone, no per-section key.
  - A listener that throws is caught and `console.warn`-logged; the throw does
    not interrupt fan-out to other listeners (matches the
    `FrameworkErrorBus` isolation pattern).
  - `SectionEventSubscriptionArgs`, `SectionItemEventSubscriptionArgs`, and
    `SectionScopedEventSubscriptionArgs` no longer declare `sectionId?` /
    `attemptId?` properties. **Type-level breaking change** for consumers
    importing these types directly. Runtime tolerates extra unknown
    properties, so existing call sites that still pass `sectionId` /
    `attemptId` continue to run unchanged — the args are simply ignored
    and the subscription follows the active cohort.
  - `getSectionController({ sectionId, attemptId })` is **unchanged**; it is
    still keyed by id and remains the right call when reading state from
    inactive (persisted) sections.

  ### Why this is expected to be the final pass on PIE-512

  - Removes the only remaining subscribe-time staleness path. No new corner-case
    branches, no timing dependency, no flag — single canonical contract.
  - Coordinator-side dead code (`resolveSectionSubscriptionEntry`,
    `resolveSectionControllerForSubscription`,
    `detachSectionEventSubscriptionsForMapKey`, the listener-id /
    composite-key bookkeeping) is deleted; the active-cohort registry
    collapses subscription state to one Map keyed by listener identity.

  ### Coverage

  - `packages/assessment-toolkit/tests/pie-512-phase-d-active-cohort-tracking.test.ts`
    (new) — 12 coordinator-only synthetic-harness tests covering active-cohort
    binding, migration with replay, replay ordering, the no-active-cohort
    throw, listener throw isolation, snapshot-safe unsubscribe during
    fan-out, same-cohort `updateInput` no-op, re-entrant subscribe during
    migration replay, and contract tolerance of prior `sectionId` args.
  - `packages/assessment-toolkit/tests/runtime/adapter/coordinator-bridge-cohort-handoff.test.ts`
    (new) — bridge + real-`ToolkitCoordinator` integration test mirroring
    Darin's persistent-host wrapper pattern: `resolveSectionController(A) →
resolveSectionController(B)` migrates a coordinator-bound listener with
    replay, `bridge.dispose()` detaches, and stale token rollovers do not
    dispatch a duplicate `section-controller-resolved` core input.
  - `packages/assessment-toolkit/tests/pie-512-cross-section-event-delivery.test.ts`
    — pre-existing PIE-512 regression pins, with `sectionId` arg dropped to
    match the Phase D shape; the three tests still pin live delivery on
    cohort flips, A→B→A round-trips, and asymmetric multi-item replays.
  - `packages/assessment-toolkit/tests/toolkit-coordinator-section-events.test.ts`
    — cleanup pass: rewrote "replaces existing subscription" to pin
    listener-identity dedup, deleted "ambiguous without attempt id"
    (no longer reachable), dropped `sectionId` args from all subscribes.

  ### Pre-fix failure gate

  Before any production code changed, the new + edited tests were run against
  the pre-fix source: 10 of 17 targeted tests failed in the expected ways
  (ambiguous-section throws, missed migrations, no throw isolation, missing
  contract tolerance, missing bridge replay). The 7 that passed against
  pre-fix source pin orthogonal invariants (single-cohort replay ordering,
  dispose-detach, snapshot-safe iteration). All 27 pass against the Phase D
  implementation.

  ### Migration notes for type consumers

  If your code imports `SectionEventSubscriptionArgs`,
  `SectionItemEventSubscriptionArgs`, or `SectionScopedEventSubscriptionArgs`
  directly, drop the `sectionId?` / `attemptId?` properties from your call
  sites — the runtime ignores them. Hosts using local hand-rolled structural
  types (e.g. an Angular wrapper) need no changes at compile time and pick
  up the runtime fix automatically.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.35
  - @pie-players/pie-calculator-desmos@0.3.35
  - @pie-players/pie-context@0.3.35
  - @pie-players/pie-players-shared@0.3.35
  - @pie-players/pie-tts@0.3.35
  - @pie-players/tts-client-server@0.3.35

## 0.3.34

### Patch Changes

- af850c0: fix(PIE-512): preserve controller lifecycle on same-section updateInput and always replay registry into resolved controller (Phase C)

  Phase B (released as `0.3.33`) replayed the engine's `RuntimeRegistry` into the
  new cohort's controller when the cohort flip resolved to a fresh controller —
  fixing the persistent-shell case. It left two related gaps that surfaced as
  intermittent regressions in the consumer's narrow-viewport (passage-only)
  flow:

  - `SectionController.initialize` ran `resetLifecycleTracking()` unconditionally,
    so any `updateInput` (which `ToolkitCoordinator.resolveExistingSectionController`
    always invokes when the engine resolves the existing controller) wiped
    `trackedRenderables`, `loadedRenderableKeys`, and `sectionLoadingComplete`.
    A subscriber that attached between the wipe and the next live event saw
    empty `runtimeState.loadedRenderables` and missed `content-loaded` /
    `section-loading-complete` for shells that were already mounted and
    loaded.
  - `SectionRuntimeEngine.initialize` only re-fed the registry into the
    controller when the resolved controller was a NEW instance
    (`resolved !== previousController`). Same-cohort `updateInput` resolves
    to the existing controller, so replay was skipped and the wipe above
    was not undone.

  Phase C closes both gaps:

  - `SectionController.initialize` now only calls `resetLifecycleTracking()`
    when the section identifier actually changes between the previous
    input and the next. Same-section refreshes preserve lifecycle state.
  - `SectionController.handleContentRegistered` and `handleContentLoaded`
    short-circuit on already-tracked / already-loaded renderable keys —
    no duplicate `content-loaded` emit, no spurious re-evaluation of
    `section-loading-complete`, and the engine's replay stays safe to
    run on every `initialize` call.
  - `SectionRuntimeEngine.initialize` drops the
    `resolved !== previousController` gate and unconditionally re-feeds
    the registry into the resolved controller. Combined with the
    controller-side idempotence above, the replay is a true no-op when
    the controller already knows about the registered shells, and a
    recovery seeding when an `updateInput` cohort refresh has wiped
    state.

  Coverage:

  - `packages/section-player/tests/section-controller-pie-512-phase-c.test.ts` —
    five new Bun unit tests pinning the controller-side invariants
    (no wipe on same-section `updateInput`; idempotent register / load;
    late subscriber on same-section `updateInput` observes preserved
    `runtimeState`).
  - `packages/assessment-toolkit/tests/pie-512-persistent-shell-cohort-handoff.test.ts` —
    new same-controller engine integration test covering the
    drop-the-gate change.
  - The existing PIE-512 cross-section A → B → A Playwright spec
    continues to pass unchanged. End-to-end coverage of the
    same-cohort `updateInput` path is intentionally left to the
    engine integration test (under `@happy-dom`) which exercises
    the exact engine→controller seam where the bug lived; a
    Playwright spec that drives a second `engine.initialize`
    imperatively from `page.evaluate` (mirroring the real
    consumer's plain-HTML pattern) is a useful follow-up but is
    not required for this fix.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.34
  - @pie-players/pie-calculator-desmos@0.3.34
  - @pie-players/pie-context@0.3.34
  - @pie-players/pie-players-shared@0.3.34
  - @pie-players/pie-tts@0.3.34
  - @pie-players/tts-client-server@0.3.34

## 0.3.33

### Patch Changes

- 70612af: PIE-512 follow-up: fix persistent-shell cohort handoff in the section runtime
  engine.

  When a passage shell stays mounted across a cohort flip (same passage element
  diffed between sections in the passage-only narrow-viewport split layout), it
  does not re-fire `pie-register` / `pie-content-loaded`. The previous fix
  restored event delivery for the **freshly-mounted** shell case, but the
  engine's `initialize(...)` swap to a new `SectionController` left that
  controller's `loadedRenderables` snapshot empty for any persistent shell —
  late `content-loaded` subscribers on the new cohort therefore saw nothing.

  `SectionRuntimeEngine` now mirrors a "loaded" set alongside the existing
  `RuntimeRegistry`. On a controller swap, it replays both the registered shells
  and the still-loaded ones into the new controller in document order, so the
  new cohort's snapshot is correct without requiring shells to remount.
  Same-cohort `updateInput` resolves to the existing controller and short-
  circuits the replay (no double-bookkeeping).

  Covered by
  `packages/assessment-toolkit/tests/pie-512-persistent-shell-cohort-handoff.test.ts`,
  which pins the cohort handoff at the engine layer (the previous Playwright
  e2e used `{#key}` and force-remounted the CE host, masking this gap).

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.33
  - @pie-players/pie-calculator-desmos@0.3.33
  - @pie-players/pie-context@0.3.33
  - @pie-players/pie-players-shared@0.3.33
  - @pie-players/pie-tts@0.3.33
  - @pie-players/tts-client-server@0.3.33

## 0.3.32

### Patch Changes

- 0355143: Fix PIE-512: replay `content-loaded` events for late subscribers after
  cohort transitions.

  `ToolkitCoordinator.subscribeSectionEvents` already replays a single
  `section-loading-complete` event to subscribers that attach after a
  controller finishes loading, but had no equivalent for the per-renderable
  `content-loaded` events that fire earlier in the sequence. Consumers that
  attached their listeners after the section player had bootstrapped (e.g.
  wrapper hosts that subscribe in response to `pie-section-controller-ready`,
  or hosts navigating across asymmetric sections in a narrow split-pane
  layout where the controller is recreated per cohort) silently missed every
  `content-loaded` event for renderables that had already loaded.

  The coordinator now replays one synthesized `content-loaded` event per
  renderable reported as loaded by the controller's runtime state, in
  registration order, immediately before the existing
  `section-loading-complete` replay. The replay is strict: only renderables
  explicitly reported in `runtimeState.loadedRenderables` are replayed, so
  synthetic test harnesses and older controllers that don't populate the
  field stay on the existing single-replay path.

  `SectionControllerRuntimeState` gains an optional
  `loadedRenderables: ReadonlyArray<{ itemId; canonicalItemId; contentKind }>`
  field, populated by `SectionController.getRuntimeState` from
  `loadedRenderableKeys` ∩ `trackedRenderables` in registration order. The
  field is purely additive; existing consumers that ignore it are
  unaffected.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.32
  - @pie-players/pie-calculator-desmos@0.3.32
  - @pie-players/pie-context@0.3.32
  - @pie-players/pie-players-shared@0.3.32
  - @pie-players/pie-tts@0.3.32
  - @pie-players/tts-client-server@0.3.32

## 0.3.31

### Patch Changes

- 26dbea3: PIE-501: harden element loading during section-player section swaps.

  Pre-1.0 lockstep release: every package in the `fixed` block bumps
  together at release time per the project versioning policy. Per pre-1.0
  semver convention every release is a patch bump, even when behavior
  changes are breaking — the breaking changes inventory below is for
  host migration, not for the version bump level. PIE-501
  investigation traced sporadic post-section-swap render failures
  (`Preloaded strategy requires pre-registered elements; missing tags:
…`) to two coupled root causes — a non-truthful element-load promise
  contract, and the section-player rewriting embedded items' loading
  strategy and tracking readiness through cached state. Fixing those
  unblocked a broader architecture-review compat-removal sweep that had
  been gated on the same surfaces.

  This release ships both phases of the PIE-501 plan plus the
  compat-removal work that fell out of the same review. None of the
  removed surfaces are part of the `pie-item` client contract (the only
  allowed compatibility surface per
  `.cursor/rules/legacy-compatibility-boundaries.mdc`).

  ## What's new

  - **Deep `ElementLoader` primitive** (PIE-501 Phase A). A single loader
    primitive whose promise resolves only when every requested custom-
    element tag is actually registered, and rejects with a per-tag
    reason otherwise. Both IIFE and ESM are now adapters over this
    primitive. Replaces the previous parallel `IifeLoader` / `EsmLoader`
    classes in `@pie-players/pie-players-shared`. The deep primitive is
    the shipped contract; the strategy name (`iife` / `esm` / `preloaded`)
    selects an adapter rather than a parallel implementation.

  - **Strategy substitution removed** (PIE-501 Phase B). Embedded
    item-players inherit the host's chosen strategy verbatim. The
    section-player still pre-warms the aggregate element set for
    performance but no longer owns correctness through cached state;
    widget readiness is now a function of inputs. The
    `allowPreloadedFallbackLoad` escape hatch is gone.

  - **M5 — strict two-tier mirror rule.** Tier-1 layout-CE props mirror
    to `runtime.*` keys with documented precedence; the resolver enforces
    the mirror per-key.

  - **M6 — canonical stage vocabulary.** `pie-stage-change` (`composed`,
    `engine-ready`, `interactive`, `disposed`) and `pie-loading-complete`
    are the canonical readiness surface, with a toolkit-side stage
    tracker and `onStageChange` / `onLoadingComplete` props on the layout
    CEs.

  - **M7 — `SectionRuntimeEngine`.** A single FSM-driven runtime engine
    consolidates section-controller lifecycle, readiness derivation, and
    stage emissions previously scattered across multiple coordinators.

  - **M8 — tool policy engine.** Allow/block + PNP/profile enforcement become a
    first-class policy surface on `ToolkitCoordinator`
    (`onPolicyChange`, `decideToolPolicy`, `updateToolPlacement`,
    `setPnpEnforcement`, `registerPolicySource`), with narrow profile
    auto-detection mirrored through `runtime.tools.pnpEnforcement`.

  - **`FrameworkErrorBus` contract.** A single canonical
    `framework-error` source, single subscription via
    `onFrameworkError(model: FrameworkErrorModel)`, and the layout-CE
    host emits exactly one `framework-error` per error (the previous
    toolkit-bubble + engine-bridge dual-emit is collapsed — see Removed).

  - **Tabbed section-player layout.** New `<pie-section-player-tabbed>`
    CE alongside the existing splitpane and vertical layouts.

  ## Removed (breaking)

  - **Deprecated `AssessmentToolkitEvents` event-map and member event
    interfaces** (`AssessmentStartedEvent`, `AssessmentCompletedEvent`,
    `AssessmentPausedEvent`, `AssessmentResumedEvent`,
    `CanNavigateChangedEvent`, `InteractionEvent`, `InteractionType`,
    `ItemChangedEvent`, `ItemMetadata`, `LoadCompleteEvent`,
    `LocaleChangedEvent`, `LocaleLoadingCompleteEvent`,
    `LocaleLoadingErrorEvent`, `LocaleLoadingStartEvent`,
    `NavigationRequestEvent`, `PlayerErrorEvent`, `SessionChangedEvent`,
    `StateRestoredEvent`, `StateSavedEvent`, `SyncFailedEvent`,
    `ToolActivatedEvent`, `ToolDeactivatedEvent`,
    `ToolStateChangedEvent`). They were aspirational and never emitted
    from any production path. The canonical replacement surfaces
    (DOM `CustomEvent`s on `<pie-assessment-toolkit>`,
    `ToolkitCoordinator.subscribe*` helpers, and the M3
    framework-error contract) are unchanged.

  - **Deprecated Svelte-store-shaped `toolCoordinatorStore`** and the
    prior `ToolCoordinator` _interface_ (the z-index / visibility shape
    in `packages/assessment-toolkit/src/tools/types.ts`, with
    `registerTool` / `showTool` / `hideTool` / `toggleTool` /
    `bringToFront` / `updateToolElement` / `hideAllTools` /
    `getToolState` / `isToolVisible`). The canonical replacement is the
    class-based `ToolCoordinator` (typed by `ToolCoordinatorApi` in
    `packages/assessment-toolkit/src/services/interfaces.ts`)
    re-exported from `@pie-players/pie-assessment-toolkit` and
    instantiated by `ToolkitCoordinator` as `coordinator.toolCoordinator`.
    All instance methods carry over verbatim, plus a `subscribe()` for
    reactive consumption that replaces the deleted Svelte-store derived
    views. Independently, `ToolkitCoordinator`'s tool-policy surface
    (`onPolicyChange`, `decideToolPolicy`, `updateToolPlacement`,
    `setPnpEnforcement`, `registerPolicySource`) is the canonical entry
    point for the _tool policy_ concern (allow/block + PNP/profile enforcement)
    — that is a different concern than the floating-tool z-index API
    the deleted interface served.

  - **Top-level `createSectionController` prop on every section-player
    layout custom element** (`<pie-section-player-splitpane>`,
    `<pie-section-player-vertical>`, `<pie-section-player-tabbed>`,
    `<pie-section-player-kernel-host>`, `<pie-section-player-base>`)
    and the corresponding kernel pass-through. The factory is now
    exposed only via `runtime.createSectionController`, the canonical
    M5 entry point.

    Note: `<pie-assessment-toolkit>`'s `createSectionController` prop
    is **unchanged** — the toolkit accepts it directly as part of its
    composition surface.

  - **Top-level `isolation` prop on every section-player layout custom
    element** (`<pie-section-player-splitpane>`,
    `<pie-section-player-vertical>`, `<pie-section-player-tabbed>`,
    `<pie-section-player-kernel-host>`, `<pie-section-player-base>`)
    and the corresponding kernel pass-through. The isolation strategy
    is now read only from `runtime.isolation`; when omitted, the
    resolver falls back to the package default (`DEFAULT_ISOLATION`).

    Note: the toolkit's `<pie-assessment-toolkit>` keeps `isolation` as a
    JS-only object property (see the toolkit-side carve-out below), but
    the kebab-attribute (`isolation="…"` HTML form) was also removed in
    this sweep. Layout-CE hosts must use `runtime.isolation`; standalone
    toolkit hosts must assign `el.isolation = …` programmatically.

  - **Top-level `item-toolbar-tools` / `passage-toolbar-tools`
    attribute aliases (and their `itemToolbarTools` / `passageToolbarTools`
    prop forms) on every section-player layout custom element**
    (`<pie-section-player-splitpane>`, `<pie-section-player-vertical>`,
    `<pie-section-player-tabbed>`, `<pie-section-player-kernel-host>`),
    along with the matching one-time deprecation warnings and the
    `parseToolList(itemToolbarTools)` / `parseToolList(passageToolbarTools)`
    absorption inside `resolveToolsConfig`. Per-region tool placement is
    now configured directly on the canonical `tools` object as
    `tools.placement.item` / `tools.placement.passage` (or via
    `runtime.tools.placement.{item,passage}`).

    The kernel re-exposes the canonical placement arrays as
    comma-separated strings via slot props (`itemToolbarTools`,
    `passageToolbarTools`) so internal card / pane custom elements
    (`<pie-section-player-item-card>`, `<pie-section-player-passage-card>`,
    `<pie-section-player-items-pane>`,
    `<pie-section-player-passages-pane>`) keep their existing
    string-attribute contract unchanged.

  - **Deprecated readiness DOM-event aliases on every section-player
    layout custom element** — `readiness-change`, `interaction-ready`,
    and `ready` — along with the engine's `legacy-event-bridge` that
    emitted them, the corresponding `SectionEngineOutput` kinds
    (`readiness-change`, `interaction-ready`, `ready`), the engine
    state fields that gated them (`interactionReadyEmitted`,
    `readyEmitted`, `lastReadinessDetail`), the
    `pie-section-readiness-change` / `pie-section-interaction-ready` /
    `pie-section-ready` instrumentation mappings, and the
    `readinessChange` / `interactionReady` / `ready` entries on
    `SECTION_PLAYER_PUBLIC_EVENTS`. Hosts now consume the canonical
    M6 vocabulary directly:

    - `readiness-change` → `pie-stage-change` (the readiness payload
      is also reachable via the layout CE's `selectReadiness()` /
      `getSnapshot().readiness`).
    - `interaction-ready` → `pie-stage-change` filtered on
      `detail.stage === "interactive"`.
    - `ready` → `pie-loading-complete`.

  - **Deprecated `section-controller-ready` Svelte/DOM event** — the
    kernel-side `dispatch("section-controller-ready", ...)` call,
    the matching `on:section-controller-ready={…}` forwarders on every
    layout CE wrapper (`<pie-section-player-splitpane>`,
    `<pie-section-player-vertical>`, `<pie-section-player-tabbed>`,
    `<pie-section-player-kernel-host>`), the
    `sectionControllerReady` entry on `SECTION_PLAYER_PUBLIC_EVENTS`,
    the `SectionPlayerControllerReadyDetail` type export, and the
    `pie-section-controller-ready` instrumentation mapping in
    `SECTION_INSTRUMENTATION_EVENT_MAP`. The kernel still feeds the
    engine FSM's `section-controller-resolved` input on first
    resolution per cohort (canonical stage progression
    `booting-section → engine-ready`); only the kernel-level Svelte
    event and its DOM-forwarded layout-host emit are gone. The
    toolkit-internal `pie-toolkit-section-controller-ready`
    telemetry name is unchanged. Migration:

    - Pull a controller handle directly:
      `await el.waitForSectionController(timeoutMs)` or
      `el.getSectionController()` on the layout CE.
    - Or filter `pie-stage-change` for
      `detail.stage === "engine-ready"` and then call
      `el.getSectionController()`.

  - **`autoFocusFirstItem` boolean alias on
    `SectionPlayerFocusPolicy`** and the runtime translation logic that
    mapped it onto the canonical `autoFocus` enum (along with its
    one-time deprecation warning). Hosts now set `autoFocus` directly:

    ```ts
    // before
    el.policies = { focus: { autoFocusFirstItem: true } };
    // after
    el.policies = { focus: { autoFocus: "start-of-content" } };
    // (or `"none"` to disable)
    ```

    The two Playwright tests that pinned the deprecated alias contract
    (`section-player-navigation-contract.spec.ts`) are removed.

  - **Orphaned `runtime-event-guards.ts` re-export shim** in
    `@pie-players/pie-assessment-toolkit` (`@deprecated since M7`,
    `createRuntimeId` is the only re-export). Import from
    `@pie-players/pie-assessment-toolkit/runtime/internal` instead.

  - **`one-time warning utility` deprecation-warning utility** and its
    public re-export from `@pie-players/pie-assessment-toolkit`
    (`packages/assessment-toolkit/src/services/deprecation-warnings.ts`,
    along with the test-only `test reset helper` and the
    `one-time warning utility` test block in
    `tests/framework-error-bus.test.ts`). Every internal callsite
    was removed earlier in this sweep; no in-tree code depends on the
    utility. External consumers that imported it from the package
    root should inline a per-callsite `console.warn` (the utility
    was a thin once-per-label, dev-only `console.warn` wrapper).

  - **Toolkit `isolation` kebab-attribute surface on
    `<pie-assessment-toolkit>`.** The `isolation` prop is now a
    JS-only object property (`type: "Object", reflect: false`); the
    previously observed `isolation="…"` HTML attribute is no longer
    parsed. Hosts that set isolation declaratively must move to a
    property assignment (or set it via `runtime.isolation` on the
    enclosing layout CE):

    ```html
    <!-- before -->
    <pie-assessment-toolkit isolation="shadow"></pie-assessment-toolkit>
    ```

    ```ts
    // after
    el.isolation = "shadow";
    ```

  - **Removed `ToolkitCoordinatorHooks` error hooks**
    (`onError`, `onTTSError`, `onProviderError`) and their
    subscription/dispatch logic on `ToolkitCoordinator`, plus the
    internal helpers (`toCauseError`, `contextFromFrameworkErrorModel`,
    `providerIdFromSource`) that synthesized the prior
    `(error, context)` payload from the canonical
    `FrameworkErrorModel`. The single canonical hook is
    `onFrameworkError(model: FrameworkErrorModel)`, which already
    delivers every `framework-error` exactly once per error
    (filterable on `model.kind`). Migration:

    ```ts
    // before
    coordinator.setHooks({
      onError: (error, context) => log({ error, context }),
      onTTSError: (error) => bumpTtsErrorCount(),
      onProviderError: (error, context) => log(context.providerId, error),
    });

    // after
    coordinator.setHooks({
      onFrameworkError: (model) => {
        // model.kind: "tool-config" | "runtime-init" | "runtime-dispose"
        //           | "coordinator-init" | "provider-init" | "provider-register"
        //           | "tts-init" | "tool-state-load" | "tool-state-save"
        //           | "section-controller-init" | "section-controller-dispose"
        //           | "unknown"
        // model.severity, model.source, model.message, model.details,
        // model.recoverable, model.cause, …
        log(model);
        if (model.kind === "tts-init") bumpTtsErrorCount();
      },
    });
    ```

  - **`framework-error` dual-emit on the layout CE host.** Previously,
    while a `<pie-assessment-toolkit>` was nested inside a layout CE,
    the layout host received **two** `framework-error` DOM events per
    error (one engine-bridge emit on the layout host plus the bubbled
    toolkit emit). The dual-emit is collapsed to a single canonical
    emit: the kernel's `handleFrameworkError` listener at
    `<pie-section-player-base>` now calls `event.stopPropagation()`
    after re-feeding the engine, so the bubbled toolkit emit no
    longer reaches the layout CE host. Outside listeners on the layout
    host now see exactly one `framework-error` per error — the
    engine-bridge emit (target = layout host, non-bubbling,
    non-composed). Direct listeners attached to
    `<pie-assessment-toolkit>` itself are unaffected (the toolkit
    dispatch reaches them before the kernel listener runs). The
    `onFrameworkError` callback prop and the package-internal
    `FrameworkErrorBus` are unchanged — both were already single-fire.
    The single-emit contract is now pinned by
    `packages/section-player/tests/section-player-framework-error-dual-emit.test.ts`
    (the file name is preserved for git blame; the test now asserts
    the single canonical emit).

  - **`allowPreloadedFallbackLoad` escape hatch.** Removed alongside the
    PIE-501 Phase B strategy-substitution work. Hosts that relied on it
    to mask preload-misses should ensure their preload set is correct
    (the `ElementLoader` primitive now rejects deterministically with a
    per-tag reason if a requested tag never registers).

  - **Per-strategy loader classes** (`IifeLoader`, `EsmLoader` and their
    test fixtures) in `@pie-players/pie-players-shared`. Replaced by the
    deep `ElementLoader` primitive plus IIFE / ESM adapters. Hosts that
    imported the loader classes directly should switch to
    `ElementLoader`; hosts that only used the public
    `<pie-item-player>` / `<pie-section-player-*>` attribute surface
    need no change.

  ## Migration

  ```ts
  // before
  const el = document.createElement("pie-section-player-splitpane");
  el.createSectionController = () => new SectionController();
  el.isolation = "shadow";
  el.setAttribute("item-toolbar-tools", "calculator,answer-eliminator");
  el.setAttribute("passage-toolbar-tools", "line-reader");

  // after
  el.runtime = {
    createSectionController: () => new SectionController(),
    isolation: "shadow",
    tools: {
      placement: {
        item: ["calculator", "answer-eliminator"],
        passage: ["line-reader"],
      },
    },
  };
  ```

  Section-controller resolution (replaces `section-controller-ready`):

  ```ts
  // before
  el.addEventListener("section-controller-ready", (event) => {
    const { controller } = (event as CustomEvent).detail;
    // …
  });

  // after — pull-style (preferred for one-shot consumers)
  const controller = await(
    el as HTMLElement & {
      waitForSectionController?: (timeoutMs?: number) => Promise<unknown>;
    }
  ).waitForSectionController?.(5000);

  // after — event-driven
  el.addEventListener("pie-stage-change", (event) => {
    const { stage } = (event as CustomEvent).detail;
    if (stage !== "engine-ready") return;
    const controller = (
      el as HTMLElement & { getSectionController?: () => unknown }
    ).getSectionController?.();
    // …
  });
  ```

  `AssessmentToolkitEvents` consumers should subscribe to the canonical
  DOM events / coordinator helpers instead. The Svelte-store coordinator
  had no in-tree consumers; hosts that imported it should switch to the
  class-based `ToolCoordinator` reachable via
  `coordinator.toolCoordinator` on `ToolkitCoordinator` (same method
  shape — `registerTool`, `showTool`, `hideTool`, `toggleTool`,
  `bringToFront`, `updateToolElement`, `hideAllTools`, `getToolState`,
  `isToolVisible` — plus `subscribe(listener)` for reactive consumers
  that previously relied on the Svelte-store derived views).

  ```ts
  // before
  el.addEventListener("readiness-change", (event) => {
    // event.detail: EngineReadinessDetail
  });
  el.addEventListener("interaction-ready", () => {
    // gate "start test" UI
  });
  el.addEventListener("ready", () => {
    // all items loaded
  });

  // after
  import type { StageChangeDetail } from "@pie-players/pie-players-shared/pie";
  import type { EngineReadinessDetail } from "@pie-players/pie-assessment-toolkit/runtime/internal";

  el.addEventListener("pie-stage-change", (event) => {
    const { stage } = (event as CustomEvent<StageChangeDetail>).detail;
    // stage: "composed" | "engine-ready" | "interactive" | "disposed"
    if (stage === "interactive") {
      // gate "start test" UI
    }
  });
  el.addEventListener("pie-loading-complete", () => {
    // all items loaded (single-shot, cohort-scoped)
  });
  // Readiness payload (formerly the `readiness-change` detail) is also
  // reachable on demand:
  const readiness: EngineReadinessDetail | undefined = el.selectReadiness?.();
  ```

  Hosts that previously de-duplicated `framework-error` listeners on the
  layout CE host (because the same logical error arrived twice — once
  bubbled from the toolkit, once from the engine bridge) can drop that
  de-dup logic: the layout host now fires `framework-error` exactly once
  per error. The canonical `onFrameworkError` callback prop and the
  package-internal `FrameworkErrorBus` were already single-fire and need
  no migration.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [26dbea3]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.31
  - @pie-players/pie-calculator@0.3.31
  - @pie-players/pie-calculator-desmos@0.3.31
  - @pie-players/pie-context@0.3.31
  - @pie-players/pie-tts@0.3.31
  - @pie-players/tts-client-server@0.3.31

## 0.3.30

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies [0981bc3]
- Updated dependencies [698aa82]
- Updated dependencies
  - @pie-players/pie-players-shared@0.3.30
  - @pie-players/pie-calculator@0.3.30
  - @pie-players/pie-calculator-desmos@0.3.30
  - @pie-players/pie-context@0.3.30
  - @pie-players/pie-tts@0.3.30
  - @pie-players/tts-client-server@0.3.30

## 0.3.29

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.29
  - @pie-players/pie-calculator-desmos@0.3.29
  - @pie-players/pie-context@0.3.29
  - @pie-players/pie-players-shared@0.3.29
  - @pie-players/pie-tts@0.3.29
  - @pie-players/tts-client-server@0.3.29

## 0.3.28

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.28
  - @pie-players/pie-calculator-desmos@0.3.28
  - @pie-players/pie-context@0.3.28
  - @pie-players/pie-players-shared@0.3.28
  - @pie-players/pie-tts@0.3.28
  - @pie-players/tts-client-server@0.3.28

## 0.3.27

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.27
  - @pie-players/pie-calculator-desmos@0.3.27
  - @pie-players/pie-context@0.3.27
  - @pie-players/pie-players-shared@0.3.27
  - @pie-players/pie-tts@0.3.27
  - @pie-players/tts-client-server@0.3.27

## 0.3.26

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.26
  - @pie-players/pie-calculator-desmos@0.3.26
  - @pie-players/pie-context@0.3.26
  - @pie-players/pie-players-shared@0.3.26
  - @pie-players/pie-tts@0.3.26
  - @pie-players/tts-client-server@0.3.26

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.25
  - @pie-players/pie-calculator-desmos@0.3.25
  - @pie-players/pie-context@0.3.25
  - @pie-players/pie-players-shared@0.3.25
  - @pie-players/pie-tts@0.3.25
  - @pie-players/tts-client-server@0.3.25

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.25
  - @pie-players/pie-calculator-desmos@0.3.25
  - @pie-players/pie-context@0.3.25
  - @pie-players/pie-players-shared@0.3.25
  - @pie-players/pie-tts@0.3.25
  - @pie-players/tts-client-server@0.3.25

## 0.3.24

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.24
  - @pie-players/pie-calculator-desmos@0.3.24
  - @pie-players/pie-context@0.3.24
  - @pie-players/pie-players-shared@0.3.24
  - @pie-players/pie-tts@0.3.24
  - @pie-players/tts-client-server@0.3.24

## 0.3.23

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.23
  - @pie-players/pie-calculator-desmos@0.3.23
  - @pie-players/pie-context@0.3.23
  - @pie-players/pie-players-shared@0.3.23
  - @pie-players/pie-tts@0.3.23
  - @pie-players/tts-client-server@0.3.23

## 0.3.22

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.22
  - @pie-players/pie-calculator-desmos@0.3.22
  - @pie-players/pie-context@0.3.22
  - @pie-players/pie-players-shared@0.3.22
  - @pie-players/pie-tts@0.3.22
  - @pie-players/tts-client-server@0.3.22

## 0.3.21

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.21
  - @pie-players/pie-calculator-desmos@0.3.21
  - @pie-players/pie-context@0.3.21
  - @pie-players/pie-players-shared@0.3.21
  - @pie-players/pie-tts@0.3.21
  - @pie-players/tts-client-server@0.3.21

## 0.3.20

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.20
  - @pie-players/pie-calculator-desmos@0.3.20
  - @pie-players/pie-context@0.3.20
  - @pie-players/pie-players-shared@0.3.20
  - @pie-players/pie-tts@0.3.20
  - @pie-players/tts-client-server@0.3.20

## 0.3.19

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.19
  - @pie-players/pie-calculator-desmos@0.3.19
  - @pie-players/pie-context@0.3.19
  - @pie-players/pie-players-shared@0.3.19
  - @pie-players/pie-tts@0.3.19
  - @pie-players/tts-client-server@0.3.19

## 0.3.18

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.18
  - @pie-players/pie-calculator-desmos@0.3.18
  - @pie-players/pie-context@0.3.18
  - @pie-players/pie-players-shared@0.3.18
  - @pie-players/pie-tts@0.3.18
  - @pie-players/tts-client-server@0.3.18

## 0.3.17

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.17
  - @pie-players/pie-calculator-desmos@0.3.17
  - @pie-players/pie-context@0.3.17
  - @pie-players/pie-players-shared@0.3.17
  - @pie-players/pie-tts@0.3.17
  - @pie-players/tts-client-server@0.3.17

## 0.3.16

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.16
  - @pie-players/pie-calculator-desmos@0.3.16
  - @pie-players/pie-context@0.3.16
  - @pie-players/pie-players-shared@0.3.16
  - @pie-players/pie-tts@0.3.16
  - @pie-players/tts-client-server@0.3.16

## 0.3.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.15
  - @pie-players/pie-calculator-desmos@0.3.15
  - @pie-players/pie-context@0.3.15
  - @pie-players/pie-players-shared@0.3.15
  - @pie-players/pie-tts@0.3.15
  - @pie-players/tts-client-server@0.3.15

## 0.3.14

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.14
  - @pie-players/pie-calculator-desmos@0.3.14
  - @pie-players/pie-context@0.3.14
  - @pie-players/pie-players-shared@0.3.14
  - @pie-players/pie-tts@0.3.14
  - @pie-players/tts-client-server@0.3.14

## 0.3.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.13
  - @pie-players/pie-calculator-desmos@0.3.13
  - @pie-players/pie-context@0.3.13
  - @pie-players/pie-players-shared@0.3.13
  - @pie-players/pie-tts@0.3.13
  - @pie-players/tts-client-server@0.3.13

## 0.3.12

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.12
  - @pie-players/pie-calculator-desmos@0.3.12
  - @pie-players/pie-context@0.3.12
  - @pie-players/pie-players-shared@0.3.12
  - @pie-players/pie-tts@0.3.12
  - @pie-players/tts-client-server@0.3.12

## 0.3.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.11
  - @pie-players/pie-calculator-desmos@0.3.11
  - @pie-players/pie-context@0.3.11
  - @pie-players/pie-players-shared@0.3.11
  - @pie-players/pie-tts@0.3.11
  - @pie-players/tts-client-server@0.3.11

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.10
  - @pie-players/pie-calculator-desmos@0.3.10
  - @pie-players/pie-context@0.3.10
  - @pie-players/pie-players-shared@0.3.10
  - @pie-players/pie-tts@0.3.10
  - @pie-players/tts-client-server@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.9
  - @pie-players/pie-calculator-desmos@0.3.9
  - @pie-players/pie-context@0.3.9
  - @pie-players/pie-players-shared@0.3.9
  - @pie-players/pie-tts@0.3.9
  - @pie-players/tts-client-server@0.3.9

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.10
  - @pie-players/pie-calculator-desmos@0.3.10
  - @pie-players/pie-context@0.3.10
  - @pie-players/pie-players-shared@0.3.10
  - @pie-players/pie-tts@0.3.10
  - @pie-players/tts-client-server@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.9
  - @pie-players/pie-calculator-desmos@0.3.9
  - @pie-players/pie-context@0.3.9
  - @pie-players/pie-players-shared@0.3.9
  - @pie-players/pie-tool-calculator-desmos@0.3.9
  - @pie-players/pie-tool-text-to-speech@0.3.9
  - @pie-players/pie-tool-tts-inline@0.3.9
  - @pie-players/pie-tts@0.3.9
  - @pie-players/tts-client-server@0.3.9

## 0.3.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.8
  - @pie-players/pie-calculator-desmos@0.3.8
  - @pie-players/pie-context@0.3.8
  - @pie-players/pie-players-shared@0.3.8
  - @pie-players/pie-tts@0.3.8
  - @pie-players/tts-client-server@0.3.8

## 0.3.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.7
  - @pie-players/pie-calculator-desmos@0.3.7
  - @pie-players/pie-context@0.3.7
  - @pie-players/pie-players-shared@0.3.7
  - @pie-players/pie-tts@0.3.7
  - @pie-players/tts-client-server@0.3.7

## 0.3.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.6
  - @pie-players/pie-calculator-desmos@0.3.6
  - @pie-players/pie-context@0.3.6
  - @pie-players/pie-players-shared@0.3.6
  - @pie-players/pie-tts@0.3.6
  - @pie-players/tts-client-server@0.3.6

## 0.3.5

### Patch Changes

- Publish a patch release for all publishable pie-players packages.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.5
  - @pie-players/pie-calculator-desmos@0.3.5
  - @pie-players/pie-context@0.3.5
  - @pie-players/pie-players-shared@0.3.5
  - @pie-players/pie-tts@0.3.5
  - @pie-players/tts-client-server@0.3.5

## 0.3.4

### Patch Changes

- Patch release for the lockstep package train with toolkit architecture hardening, stricter runtime validation, and a section-player vertical layout regression fix covered by e2e.
  - @pie-players/pie-calculator@0.3.4
  - @pie-players/pie-calculator-desmos@0.3.4
  - @pie-players/pie-context@0.3.4
  - @pie-players/pie-players-shared@0.3.4
  - @pie-players/pie-tts@0.3.4
  - @pie-players/tts-client-server@0.3.4

## 0.3.3

### Patch Changes

- Prepare a patch release for the latest framework fixes, math-rendering hardening, and packaging safety improvements.
- Updated dependencies
  - @pie-players/pie-calculator@0.3.3
  - @pie-players/pie-calculator-desmos@0.3.3
  - @pie-players/pie-context@0.3.3
  - @pie-players/pie-players-shared@0.3.3
  - @pie-players/pie-tts@0.3.3
  - @pie-players/tts-client-server@0.3.3

## 0.3.2

### Patch Changes

- Finalize the opt-in tool-loading model and align section demo/tooling behavior with explicit tool registration, section-level placement changes, and stronger interaction coverage in section-player tests.
  - @pie-players/pie-calculator@0.3.2
  - @pie-players/pie-calculator-desmos@0.3.2
  - @pie-players/pie-context@0.3.2
  - @pie-players/pie-players-shared@0.3.2
  - @pie-players/pie-tts@0.3.2
  - @pie-players/tts-client-server@0.3.2

## 0.3.1

### Patch Changes

- Patch release preparation for the fixed-version package group.
  - @pie-players/pie-calculator@0.3.1
  - @pie-players/pie-calculator-desmos@0.3.1
  - @pie-players/pie-context@0.3.1
  - @pie-players/pie-players-shared@0.3.1
  - @pie-players/pie-tts@0.3.1
  - @pie-players/tts-client-server@0.3.1

## 0.3.0

### Minor Changes

- Adopt monorepo-wide fixed versioning and establish the first lockstep release train at 0.3.0.

### Patch Changes

- 9385ce0: Release all publishable packages in the repository.

  This intentionally triggers a full patch release sweep across all non-private workspace packages.

- Updated dependencies
- Updated dependencies [9385ce0]
  - @pie-players/pie-calculator@0.3.0
  - @pie-players/pie-calculator-desmos@0.3.0
  - @pie-players/pie-context@0.3.0
  - @pie-players/pie-players-shared@0.3.0
  - @pie-players/pie-tts@0.3.0
  - @pie-players/tts-client-server@0.3.0

## 0.2.10

### Patch Changes

- beffcc0: Release all publishable packages.
- Updated dependencies [beffcc0]
  - @pie-players/pie-calculator@0.1.5
  - @pie-players/pie-calculator-desmos@0.1.6
  - @pie-players/pie-context@0.1.2
  - @pie-players/pie-players-shared@0.2.6
  - @pie-players/pie-tts@0.1.5
  - @pie-players/tts-client-server@0.2.5

## 0.2.9

### Patch Changes

- 71a9581: Update publishing documentation and regenerate custom element inventory to reflect current custom element registration entrypoints and publishable package scope.
- Updated dependencies [71a9581]
  - @pie-players/pie-calculator@0.1.4
  - @pie-players/pie-calculator-desmos@0.1.5
  - @pie-players/pie-context@0.1.1
  - @pie-players/pie-players-shared@0.2.5
  - @pie-players/pie-tts@0.1.4
  - @pie-players/tts-client-server@0.2.4
