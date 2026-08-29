# @pie-players/pie-players-shared

## 0.3.69

## 0.3.68

### Patch Changes

- 2d8ce6a: Give `pie-assessment-player-default` an interface locale.
  
  The adoption pass covered the item player, the section players and the toolkit,
  and left the assessment player out: it rendered its own section-to-section
  navigation from four English literals — "Section {n} of {total}", "No sections",
  "Back" and "Next" — and forwarded no locale to the section element it mounts, so a
  host that set one got translated section chrome inside an untranslated assessment
  frame.
  
  It now observes a `locale` attribute, resolves its own provider, and forwards the
  tag to the section element. Its own provider rather than a context read, because
  the navigation sits beside the section host rather than inside it, so there is no
  published toolkit context above it. The catalog gains
  `player.assessment.sectionPosition` and `player.assessment.noSections`; the two
  buttons take the `common.back` / `common.next` that already existed.
  
  Additive and default-English: with no `locale` the provider stays on `en-US` and
  the four strings render exactly what they rendered before, and the section element
  gets no `locale` attribute rather than an empty one, which it would otherwise try
  to resolve.
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
- 3f5e968: Offer a dictionary per language: `dictionarySpanish` and `pictureDictionarySpanish` join
  the packaged set, and the registrations become factories so a host can compose any other
  language.
  
  The language of a definition belongs to the learner, not to the content. The base
  capabilities take their lookup language from the toolbar's content-alternate language,
  which serves the reader who wants a definition in the language they are already reading —
  but the learner who needs a Spanish gloss is reading an English passage, and one capability
  following the content cannot express that. It also could not be granted separately: the
  four support ids on `dictionary` are four names for one grant.
  
  Each variant claims its own PNP support ids — `spanishDictionary`,
  `spanishPictureDictionary` and their glossary spellings — and shares none with the base
  capabilities, so a programme grants Spanish independently of English in either direction.
  Neither variant declares a universal support, on the same grounds as the base capabilities:
  a dictionary on a vocabulary item is construct-relevant.
  
  A variant carries its corpus language and that language outranks the content-alternate
  language, since a variant that followed the content would be indistinguishable from the
  base capability on exactly the content it exists for. A language the host names in the
  tool's render params still wins over both, so a host serving `es-MX` specifically can say
  so. Both variants render the same elements as the capabilities they vary: two capability
  ids, one panel implementation, one module load.
  
  `createDictionaryToolRegistration` and `createPictureDictionaryToolRegistration` are
  exported for any other language, taking a `toolId`, `pnpSupportIds`, a `lookupLanguage` and
  optionally a `messageKeyPrefix` for a host's own catalogue; a key that does not resolve
  falls back to the registration's literal name. `dictionaryToolRegistration` and
  `pictureDictionaryToolRegistration` remain exported and unchanged in behaviour, and are
  now built from those factories.
  
  Interface strings for both variants ship in every declared locale.
- 67f286c: Reword sixteen English interface strings that the i18n adoption deliberately
  carried over unchanged, and settle one naming rule for the nine toolbar tool
  buttons.
  
  Adopting the interface locale held English byte-identical on purpose, so that a
  host who opted into nothing saw exactly the chrome they already had and no text
  change hid inside a refactor. That left a set of strings keyed but not fixed. This
  is that follow-up, and it is a text change with nothing else in it.
  
  Most of them are accessible names, which is why they are worth the entry: a screen
  reader reads them aloud, and a host may be asserting the exact string.
  
  - `tools.protractor.toolA11y` no longer ends "Current rotation displayed via
    Moveable.js". A learner does not need the name of the drag library, and the
    clause said nothing about how to use the tool. The keyboard instructions in
    front of it are unchanged apart from `PageUp/PageDown` becoming "PageUp or
    PageDown", which a screen reader reads as words rather than a path.
    `tools.ruler.applicationA11y` carries the same instruction and gets the same
    treatment.
  - `tools.graph.toolA11y`, `tools.graph.canvasA11y` and
    `tools.periodicTable.toolA11y` were Title Case with a hyphen standing in for a
    break ("Graph Tool - Draw points and lines…"). Now sentence case with an em
    dash. The periodic table's also said "Click elements", which excludes keyboard
    and touch, and now reads "select an element to view its details".
  - `tools.textToSpeech.toolA11y` was "Text-to-Speech Tool", now "Text-to-speech
    tool", matching every other `toolA11y`.
  - The four `tools.graph.mode*Hint` strings capitalised the word after the colon
    ("Point: Click on the grid"). Now lowercase, as running text.
  - Five `debug.tts.*` messages spelled the abbreviation "TTS" at a learner. They
    now say "text-to-speech", or drop the word where the surrounding sentence
    already establishes it.
  - `debug.liveUpdatesDisconnected` and `debug.tts.applying` used three ASCII dots
    where `common.loading` uses an ellipsis. Now consistent.
  
  One key pair is removed rather than reworded. `tools.ruler` carried three forms of
  each unit name because the pre-adoption code rendered three: Title Case on the
  button, lowercase in the announcement, and the raw `'inches' | 'cm'` state token in
  the accessible name and the image alt — so the same tool said "inches" for one unit
  and "cm" for the other, in a string a screen reader speaks as two letters. The
  abbreviation pair is gone and both of those now interpolate the spelled-out
  in-sentence form, leaving two forms per unit instead of three.
  
  ## Toolbar button accessible names
  
  Every toolbar tool button is a toggle: the toolbar mirrors its active state onto
  the button as `aria-pressed`. Two of the nine names contradicted that by naming an
  action — "Open ruler tool" announced as "Open ruler tool, toggle button, pressed"
  once the ruler was open. The rest used a `Name - Description` form whose hyphen a
  screen reader renders as an unpredictable pause, and two of them collided outright:
  `tools.highlighter` and `tools.annotationToolbar` both resolved to "Highlight
  text" for different buttons.
  
  All nine now follow one rule. The name contains the button's visible tooltip
  verbatim, per WCAG 2.5.3 Label in Name, and adds a comma-separated purpose clause
  only where the tooltip alone does not identify the tool — so "Ruler" and
  "Protractor" stand alone, while "Theme" becomes "Theme, change colors and
  contrast". No name encodes an action, because the pressed state already carries it.
  `tools.answerEliminator.buttonA11y` previously did not contain its own tooltip
  ("Strike Through") at all, which is the 2.5.3 failure rather than a style
  preference.
  
  `tools.annotationToolbar.tooltip` changes from "Highlight" to "Annotate": two
  toolbar buttons carrying the same *visible* label is a defect, and this tool also
  underlines, removes and clears.
  
  The calculator's name no longer swaps between "Open …" and "Close …" as it opens.
  Three unlocalized strings surfaced while making that change, all of them built by
  splicing a raw type token into an English template, and all of them rendered:
  `Close ${name.toLowerCase()}` as the toolbar button's tooltip, `Close ${type}
  calculator` as the inline calculator's tooltip, and `${type} calculator opened`
  in the inline calculator's live region. All three now resolve from the catalog,
  which gains a name and two announcements for each of the three variants the Desmos
  provider implements — including `graphing`, which the inline element accepts from
  its host and which the old template rendered while the catalog had no key for it —
  and drops the six open/close keys the swap needed.
  
  ## nl-NL
  
  The rewordings above leave it alone: a translation was never obliged to reproduce
  an English flaw, and it already rendered the protractor's help without the
  Moveable.js clause. The button naming rule is not an English matter, so all nine
  Dutch `buttonA11y` values move with their English counterparts, and
  `tools.annotationToolbar.tooltip` becomes "Aantekenen" for the same reason it
  becomes "Annotate". Both catalogs stay complete.
  
  ## Downstream impact
  
  This is the only part of the interface-locale work that changes what a host
  renders with no `locale` supplied. Host A is the affected consumer — it drives
  live delivery with the toolbar placed — and Host R renders the same buttons.
  Neither asserts, styles, nor selects on any of the retired strings, so the
  exposure is screen-reader output only. See `docs/integrations/consumer-api-dependencies.md`.
- 55016b5: Fold the player error banners into the palette when a colour scheme asks for one.
  
  The three banners — two in `players-shared`'s `PieItemPlayer`, one in
  `pie-item-player` — were painted with a pinned `#d32f2f` edge, `#ffebee` fill and
  `#c62828` ink. That was never a contrast failure, since fill and ink were pinned
  together and measure about 6.2:1 wherever they render. It was a palette failure: a
  learner on White on Black or Yellow on Navy met a pale pink box in the middle of
  the scheme they chose in order to be able to read the screen.
  
  All three now use `--pie-fixed-hue-collapse`, exact at 0% for every Base Theme and
  folded at 100% for every scheme. The collapsed ink is `--pie-text`, not
  `--pie-incorrect`: the error hue against this tint drops to 4.14:1 under Black on
  White, where the page's own ink holds at 6.18:1 or better on all ten schemes. That
  pair is now a declared contrast relationship, `incorrect feedback surface text`, so
  `assertCanonicalThemeDefinitions` keeps it true for any scheme added later rather
  than it having been measured once.
  
  `--pie-incorrect-secondary` is a tint of the page, roughly 1.1:1 from it, so the
  collapsed banner reads as a banner by its `--pie-incorrect` edge — which clears
  4.53:1 against every scheme's page. This is the division of labour the periodic
  table's collapsed cells already rely on.
  
  The colours moved out of the inline `style` attributes into each component's
  `.pie-player-error` rule. An inline declaration outranks any stylesheet, so a host
  could not have restyled the banner without `!important`; it now behaves like the
  rest of the players' chrome.
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
- e94b097: Declare the players-shared modules that siblings resolve from source in one place,
  and add the gate that keeps them declared.
  
  `components`, `ui/use-promise` and `ui/use-zoom-compensation` carry Svelte runes or
  are components, and this package builds with plain `tsc`, whose config excludes
  both — so they never reach `dist` and three sibling Vite configs each aliased the
  source with their own copy of the path. The set of source-resolved modules was
  whatever each build file happened to list.
  
  `svelte-source-aliases.ts` now holds that list, at the package root so it stays out
  of `dist` and unpublished. These paths are deliberately still absent from the
  `exports` map: putting them there means publishing the source and making
  `PieItemPlayer.svelte` and the rune helpers public API, which is a consumer-facing
  decision rather than a packaging detail.
  
  `check-undeclared-subpaths` is the new gate. Every cross-package `@pie-players/*`
  import must name a subpath the owner declares, with the three source-resolved ones
  as a visible allowlist; it also checks that a config spelling an alias out agrees
  with the declaration, so the copies cannot drift back apart. Nothing enforced this
  before — `check-consumer-boundaries` walks `apps/` only, which is how the three
  tables accumulated.
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
- 979e643: Stop a PIE element's own `session-changed` at the item player boundary, so one
  name carries one contract.
  
  A PIE element emits `session-changed` on itself with the element contract's
  metadata detail — `complete`, `component`, and no `session` — as its signal to the
  player. The player listens for it, resolves the session, and re-emits a canonical
  `session-changed` from its own host. The element's event kept bubbling, so a host
  listening on `<pie-item-player>` received two events per change under one name: the
  canonical one carrying `detail.session`, then the element's carrying
  `detail.session === undefined`. A host reading the last value it saw got nothing,
  and the undefined was indistinguishable from `resolveSessionChangedForwarding`'s
  deliberate `session: null` plus `intent: "metadata-only"` signal, which is the
  supported way to say "metadata changed, the response did not".
  
  Now every `session-changed` that leaves the player is readable without guessing:
  either it carries a session, or it declares `intent: "metadata-only"` with an
  explicit null. `event.stopPropagation()` runs before the re-entry guard so the raw
  event does not escape on the early-return paths either. The player's own
  re-dispatch is a separate event object and is unaffected.
  
  No behavioural risk to the known consumers, all of which were checked. The quiz
  engine player's payload handler is fed by section-player's item-event coordinator
  (`item-session-data-changed`), not by the DOM event; its DOM handlers are
  `@HostListener('document:session-changed')` and `document:item-session-changed`,
  which take no argument, read no detail, and only trigger a snapshot and persist —
  and the canonical event still reaches `document`, so they still fire.
  knowledge-check does not reference `session-changed` at all. Inside this repo,
  section-player's `ItemShellElement` carries fingerprint and cross-shell dedupe
  specifically to absorb duplicate session events; it now has one fewer to discard.
  The players-shared item renderer is never nested inside another instance — a
  stimulus layout is one instance rendering both passage and item — so stopping
  propagation at its root cannot hide an inner element's change from an outer player.
  
  Covered by `packages/item-player/tests/item-player-session-changed-contract.spec.ts`,
  which fails without the change.
- 1d9f2d3: One term-lookup implementation behind both dictionaries, and three defaults that no longer need a host to know about them.
  
  The two dictionaries shipped as near-copies: term normalisation and the headword guard were character-identical, the POST clients differed only in error strings, and each panel carried its own copy of the same state machine. That is now one module, `@pie-players/pie-players-shared/tools/term-lookup`, and each tool supplies only what a result of its own carries — an entry, or a picture. The subtle part, a superseded lookup not overwriting the newer one's state, exists once and is tested once. A lookup result is `{ status, items }` rather than `entries`/`pictures`.
  
  **An endpoint alone is now the whole configuration.** The client sent `credentials: "omit"` and documented `headers` as the way to authorise, but `headers` was unreachable: the element exposed no such property and the factory taking it was never exported. A host that put its dictionary route behind the assessment's own session — which the tool host contract asks for — got a 401 on every lookup and a learner-facing "the dictionary is unavailable (401)". Endpoints are called `same-origin`, so that route answers with nothing further configured; `headers` and `credentials` are now real properties for a host authorising some other way, and neither is required.
  
  **Plain `http:` picture URLs are refused.** The validator accepted `https?:` while its own comment said anything else with a scheme was refused, so `http://cdn.example/cat.png` reached `src` and was mixed-content-blocked on every https deployment — the broken image the guard exists to prevent. Protocol-relative and same-origin paths still pass, and "same-origin" is now checked by resolving rather than by looking for a leading slash: `/\evil.example/x.png` looks like a path and resolves to another host, because a backslash is a path separator for special schemes and a tab is stripped outright. Both still resolve to https, so neither defeated the mixed-content guard — but same-origin is what the function claims.
  
  **A requested term is answered once per request, not once per term.** Params reach a tool through a seam reapplied on every sync, so the term alone cannot distinguish a re-render from a fresh ask. Keyed on the panel's last search, every reopen re-issued the selection that opened it and discarded the word the learner had typed since. Requests now carry a `termRequestId`, which both dictionary panels accept as an optional property; a host assigning `term` directly can leave it unset and gets term identity, enough to stop a re-render re-issuing.
  
  **A tool-open request falls back off section scope.** Requests defaulted to `"section"` and resolved only there, so a host placing a capability at item scope only had the selection action silently vanish: the tool was granted, hosted and visible, with no action on the selection and nothing to say why. Resolution now prefers section scope and falls back to any level that hosts the capability. Naming a level in the request still makes it a constraint, honoured strictly.
  
  Both panels' effects now write their reactive state under `untrack`, matching the rule AGENTS.md sets for effect bodies that read what they write. `check:capability-neutrality` gained `dictionary` and `pictureDictionary`, so its guard covers the packaged set its own comment claims to track.
  
  Also: `requestTool`, `canRequestTool`, `registerToolRequestTarget` and `onToolRequestTargetsChange` are optional on `ToolkitCoordinatorApi`. They were declared required while both call sites duck-typed them away for a host coordinator predating the seam, which made such a coordinator structurally non-conformant for no benefit. Both dictionary packages dropped two declared dependencies that nothing imported.
- 54742db: A second full-codebase review turned up more drift, duplication, and interface
  problems than the first sweep caught, concentrated in the TTS provider stack and
  the debugger-tool family. No public surface changes; behaviour fixes are called
  out explicitly.
  
  **TTS rate and pitch.** Polly and Google both advertised `supportsRate` /
  `supportsPitch` while never reading `request.rate` / `request.pitch` — a caller
  asking for a different speech rate got normal-speed audio with no error.
  `BaseTTSProvider.applyProsody` / `buildProsodyAttrs` now wrap plain-text requests
  in an SSML `<prosody>` envelope on both providers; already-SSML input is left
  alone. `pitch` follows this repo's existing 0-2 multiplier convention (the TTS
  settings UI's `normalizePitch`), converted to SSML's relative percentage form.
  
  **SchoolCity speech-mark timing.** `tts-client-server`'s custom-transport parser
  reimplemented SchoolCity's JSONL wire format from scratch, with none of the
  offset/time-unit corrections `SchoolCityServerProvider` applies — reproducing the
  mistiming bug that correction was built to fix. `normalizeSpeechMarks` moves to
  `tts-server-core` so both share one implementation.
  
  **TTS error-mapping granularity.** Polly collapsed every AWS SDK error to
  `PROVIDER_ERROR`; SchoolCity did the same for every HTTP failure. Both now map
  to `TEXT_TOO_LONG` / `INVALID_REQUEST` / `RATE_LIMIT_EXCEEDED` /
  `AUTHENTICATION_ERROR` where the underlying exception name or HTTP status
  says so, matching the granularity Google already had. A documented consumer maps
  these four `TTSErrorCode` members onto HTTP responses, so Polly's
  `TextLengthExceededException` reaching `TEXT_TOO_LONG` is newly correct handling
  on a path that previously always fell through to a generic error.
  
  **Rate-to-speedRate bucketing.** `SchoolCityServerProvider` and
  `ServerTTSProvider` each bucketed a numeric rate into `slow`/`medium`/`fast`
  with different thresholds, disagreeing for rate 1.1-1.49.
  `resolveSpeedRateBucket` in `tts-server-core` is now the one implementation,
  on the server's deliberate 0.95-1.5 tolerance band.
  
  **Shadow-DOM-blind theme lookup.** `tool-color-scheme`'s host lookup called
  `closest('pie-theme')` from inside its own open shadow root, which
  `Element.closest()` can never cross — on any page with more than one
  independently-scoped `<pie-theme>` it silently always picked the wrong one.
  `resolvePieThemeHost` in `pie-theme` walks out through each shadow root's host
  to find the real ancestor. The same change adds `applyPieColorScheme` as the one
  canonical "resolve host, set scheme, persist" sequence, replacing both
  `tool-color-scheme`'s own copy and `apps/section-demos`' independently-drifted
  version.
  
  **Debugger-panel subscription lifecycle.** `EventPanel` and `SectionSessionPanel`
  each reimplemented the same subscribe/detach/resubscribe scaffolding;
  `SectionSessionPanel`'s read and wrote reactive state directly inside a tracked
  `$effect` body instead of wrapping it in `untrack()`, and its lifecycle handler
  always resubscribed instead of distinguishing the disposed and same-target cases
  `EventPanel` already handled. `createSectionControllerSubscriptionManager` in
  `section-player-tools-shared` is now shared by both. The same change wires
  `persistence-scope` / `persistence-panel-id` through for `PnpPanel` and
  `SectionSessionPanel`, which had neither despite `SharedFloatingPanel` supporting
  layout persistence and two sibling debuggers already exposing it.
  
  **Pointer-drag tracking.** `tool-line-reader` and `tool-text-to-speech` each
  hand-rolled identical pointer-capture drag-position tracking.
  `createPointerDragController` in `players-shared/ui` covers the shared position
  math; `tool-line-reader`'s separate resize handling stays where it is.
  
  **Custom-element registration.** `pie-print` bypassed its own package's guarded
  registry and called Lit's `@customElement` decorator directly, which throws an
  uncaught `NotSupportedError` on double-bundling where every other player
  no-ops. It now goes through the same guard. `defineCustomElementSafely`
  (players-shared) and print-player's registry also shared the same
  duplicate-define handling with different collision coverage; consolidated into
  one implementation, which incidentally fixes a latent bug where an
  already-registered tag not tracked locally hit a doomed wrapped-subclass retry
  instead of short-circuiting.
  
  **Everything else.** `coerceBooleanLike` had three different, disagreeing
  implementations across `section-player` and `assessment-player` for the same
  attribute-coercion job; unified in `players-shared`. `sanitize-item-markup` and
  `sanitize-svg-icon`'s DOMPurify forbid-lists had drifted despite a comment
  claiming parity; now share one list. `AssessmentPlayerDefaultElement` swallowed
  TTS teardown errors in empty catch blocks instead of reporting them through
  `ToolkitCoordinator.reportFrameworkError`. `item-player`'s `"player-error"` event
  now has an exported constant matching the pattern `section-player` and
  `assessment-player` already use (no wire-value change).
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

## 0.3.67

### Patch Changes

- b264ab2: Detect a host's content stylesheet wherever it sits in the cascade, so a host
  that confines its copy is no longer told it shipped nothing.

  `components.css` carries bare `h1`-`h6`, `table` and `th` normalisation plus
  `.text-center`'s `!important`, and the player installs it into the host document
  unscoped. A host with its own chrome therefore has to confine its copy —
  `@scope (.item-content) { … }` is the shape that reaches — and both detection
  paths were blind to exactly that. `declaresContentStylesSentinel` read
  `.style` off top-level rules only, and a grouping rule holds no declarations of
  its own, so a confined copy presented one rule with an empty `.style` and read
  as absent. Sentinel detection now recurses into `CSSGroupingRule.cssRules`,
  which covers `@scope`, `@media`, `@supports` and `@layer` alike.

  Both consequences were real. An opted-out host with a working scoped copy was
  warned `No PIE content stylesheet found` on every page load, the one message
  that is meant to fire only when authored content is genuinely unstyled. And the
  `loaded twice` warning — the diagnostic that catches a host copy pinned to an
  older `@pie-players/pie-theme` silently overriding newer player rules — could
  never fire against a scoped copy, so the duplicate it exists to surface stayed
  silent.

  `contentStylesPresent` gains the sheet scan as a fallback rather than a
  replacement. The computed sentinel on `<html>` stays authoritative for a
  document-wide stylesheet; it cannot see a confined one, because the `:root` rule
  that declares the sentinel can never match inside a scoping root that `<html>`
  is not a descendant of. CSS-wide values (`unset`, `inherit`, …) are still
  rejected at every depth, so Svelte's dev-mode custom-element reset does not read
  as a host copy from inside a grouping rule either.

  No API change, and a host doing nothing unusual is unaffected: a document-wide
  copy is still found by the computed property on the first probe.

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

- 2bcd9fa: Paint the shared content stylesheet from the active theme instead of white-page
  literals.

  `components.css` is installed in the host document by every player, and its
  authored-content classes carried the colours the content was written against: a
  `lightgray` fill under `kds-*` table headers, `border: 1px solid black` grids and
  fill-in boxes, a white `.pie-loading` scrim, `#dee2e6` rules on the
  bootstrap-style `.table` family, and `color: red` emphasis. None of it could be
  reached by swapping the theme, so a dark theme or colour scheme rendered
  near-white header text on light grey (~1.2:1) and invisible table grids.

  Ink resolves through `--pie-text`, page-coloured fills — the scrim and the
  deliberately edgeless `.kds-verdana2t` border — through `--pie-white`, table
  header fills through `--pie-background-dark`, and the loading ring through
  `--pie-primary` at the 90% share the Figma indigo already was. Each keeps its
  original literal as the no-theme last resort.

  The subtle grid rules take an inline `color-mix` of `--pie-text` at 15% rather
  than `--pie-border-light`: the DaisyUI mapping fills that token from base-200, a
  surface, so a border taken from it disappears into the page. The mix stays inline
  instead of being hoisted into a shared custom property, because a custom property
  substitutes `var(--pie-text)` where it is declared, and a
  `<pie-theme scope="self">` below `:root` would not reach it.

  `.content-emphasis` moves to the new `--pie-content-emphasis` token; see the
  separate entry for why a red mixed toward the ink was not enough.

  `PieSpinner` duplicates the `.pie-loading` rules and follows the same change.

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

- 1f29de7: Make theme resolution one observable contract instead of separate runtime and
  stylesheet palettes.

  The light and dark Base Theme defaults and the two previously under-contrast
  built-in palettes now satisfy the named WCAG text, control-boundary, feedback,
  focus, and annotation relationships enforced by the theme contract. Hosts keep
  the same token names and can still override them through the normal cascade.

  `@pie-players/pie-theme` now owns light and dark base themes, complete built-in
  color schemes, custom-scheme registration, accessibility diagnostics, and
  generated CSS from one side-effect-free TypeScript definition. The public
  runtime interface is `resolvePieTheme`, `listPieColorSchemes`,
  `observePieColorSchemes`, and `registerPieColorSchemes`. Registration returns a
  generation-aware, idempotent receipt whose `unregister()` removes only the
  definition it registered. Built-in ids are reserved, invalid custom entries are
  rejected atomically, and valid entries from the same batch still register.

  Upgrade note: `listPieColorSchemes()` now returns an immutable snapshot rather
  than a mutable array of raw palette definitions. Raw built-in/base constants,
  authored preview values, and the one-off get/resolve/unregister scheme helpers
  are no longer public. Consumers should render `snapshot.schemes`, derive values
  through `resolvePieTheme()`, observe catalog changes when mounted, and retain the
  registration receipt when they need to unregister custom schemes.

  An unknown requested scheme is no longer silently replaced. `<pie-theme>` keeps
  the requested id in `scheme` and `data-color-scheme`, applies the safe base and
  provider result plus explicit variables, and automatically resolves it if
  registration arrives later. This preserves a CSS-only selector hook while
  making registered custom schemes the managed path. CSS-only schemes use the
  normal cascade in stylesheet-only integrations; a rule competing with a mounted
  `<pie-theme>`'s inline tokens must deliberately use `!important`.

  `@pie-players/pie-tool-theme` now follows that observable catalog and derives
  previews from resolved tokens. If a saved scheme is unavailable, the picker
  keeps the preference, shows a disabled unavailable option and status message,
  and restores the scheme after late registration. The old `schemes` and
  `schemeCatalog` inputs are removed; no recorded client-facing host depends on
  them.

  The shared focus trap now resolves and restores focus inside open shadow roots,
  so keyboard containment and Escape restoration work for the theme picker's
  shadow-DOM controls.

  The checked-in `tokens.css` and `color-schemes.css` files remain at their exact
  published paths and remain unlayered so host token declarations and
  `!important` overrides keep working. They are generated explicitly and checked
  for staleness; package builds verify them without rewriting tracked source.
  Importing the package root still registers `<pie-theme>`, while importing
  `@pie-players/pie-theme/theme-element` remains side-effect-free.

## 0.3.65

### Patch Changes

- c5fbf21: `baseHeadingLevel` and `includeSrHeading` reflect to attributes on `<pie-item-player>`, so a host controls the item's heading outline for the whole session rather than only its first paint.

  A PIE element resolves both itself: it walks up to the nearest `pie-player` / `pie-item-player`, reads the property, falls back to the `base-heading-level` / `include-sr-heading` attribute, and re-renders on a MutationObserver watching those two attributes. The player therefore has to put the value where the element looks. `baseHeadingLevel` was registered without `reflect`, and `includeSrHeading` was not a declared prop at all — it reached the element as an expando. Both were honoured at first paint and inert after it, which made the accommodation unusable anywhere the host adjusts it in response to the learner's profile or a change of surrounding page structure.

  `includeSrHeading` is now declared, typed on `PieItemPlayerElement`, and reflected. Because its default is `true`, hosts turn it off through the property: reflection then clears the attribute, and a present boolean attribute means on whatever its value.

  No host code changes. A host already passing either prop starts getting live updates; one passing neither is unaffected.

  The documented level arithmetic was off by one and is corrected. `baseHeadingLevel` names the level the item's heading occupies, not the level the element emits: the element puts its visually-hidden item heading there when `includeSrHeading` is on, and expects the host's own natural heading there when it is off. Authored `data-heading` content nests one level below either way, so `baseHeadingLevel: 2` yields `h2` for the item heading and `h3`/`h4` for `heading1`/`heading2`. The old text described `@pie-element/*` before it read the host at all, when the rewrite ran off a hardcoded default.

## 0.3.64

### Patch Changes

- 9b2f37d: `CatalogCard.payload` is the only name for a card's structured content; the `signLanguage` alias is removed.

  `pie-elements-ng` (PIE-879) and the `pie-api-aws` Learnosity importer (PIE-881) had both landed with the signing payload under `signLanguage`, so this repo accepted that spelling on input and folded it into `payload` during resolution. That kept imported items rendering, and it introduced a worse failure than the one it prevented: only the resolution path knew about the alias, so an imported card rendered its signing video _and_ reported that the item had no signed alternate to anything that enumerated alternates. One fact under two names means every read path is a place to forget one of them, and the enumeration path forgot.

  Both producers now emit `payload`, on branches that land alongside this one, so the alias has nothing left to accept. It is gone from `CatalogCard`, from `resolveCard`, and from `resolveSignLanguageMedia`.

  `resolveSignLanguageMedia` now warns on _any_ `sign-language` card it cannot resolve, not only one carrying a string in `content`. A card written against the old spelling arrives with no payload at all, and the previous code returned `null` for it in silence — which is the shape of bug that reaches a learner and no one else. The new message names `payload` and says the card needs re-importing.

  Sequencing matters for anyone landing these: a host that ships this player against content built by the older `pie-elements-ng` types or the older importer will see signing cards stop resolving, with that warning as the signal. Re-import, or take all three changes together.

- bb1a90b: `ItemEntity.passage` accepts `null`, which is what importers actually write.

  JSON has no `undefined`, so an item transformed from another format carries an explicit `passage: null` for "no passage" — the Learnosity import in `pie-api-aws` emits exactly that. The type allowed only `string | PassageEntity | undefined`, so real importer output failed to type-check on any typed path, and a host had to cast the null away to use it.

  The runtime was never the problem: `isPassageEntity` has always tested `passage !== null`, a check that was unreachable under the declared type and load-bearing in practice. Widening the field is what makes that check mean something, and it is additive — every value that type-checked before still does.

  Found by committing verbatim transform output as a fixture rather than hand-writing the shape the importer was assumed to produce.

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

- acee584: Accept `signLanguage` as an input alias for a sign-language card's `payload`, so cards from the two producers that already shipped resolve.

  `CatalogCard.payload` was the only accepted name for a signing card's structured media. Two landed implementations disagree with that: `pie-elements-ng` declares the payload as `signLanguage` (PIE-879), and the `pie-api-aws` Learnosity importer emits `signLanguage` (PIE-881). A card from either validated, imported, stored and then resolved to `null` — no signing video, no error a learner or proctor would ever see. That is the exact failure mode the accommodation model exists to prevent, and it is invisible precisely to the people who depend on it.

  `CatalogCard.signLanguage` is now accepted and folded into `payload` at the one point where `AccessibilityCatalogResolver` projects a card, so a single field still reaches every consumer and nothing downstream learns two names. `resolveSignLanguageMedia` reads the alias too, for callers that hand it a raw card. `payload` wins when a card somehow carries both.

  Tolerated on input, never canonical. Which name the three repos settle on is a separate decision; this stops content from silently losing its accommodation while that decision is made.

- b3acac4: `SignLanguageCardPayload.signLang` is optional, matching how it has always been read.

  The card's `language` is QTI's `xml:lang` on the card entry and the only field catalog resolution selects on — resolution runs before anything knows the card is a signing card, so it can only key on the generic field. `signLang` is read afterwards, to name the language in the media region's accessible label and to refuse a card in a sign language the learner did not ask for, and it has always fallen back to the card's `language` when absent. Typing it required made the redundant case look mandatory: nearly every card carries the same code twice, and authors had no way to tell which copy mattered.

  It earns its place only where the two differ — a card tagged with the item's content language (`language: "en-US"`, `signLang: "ase"`) so resolution reaches it by the default-language rung. The sign-language demo drops it accordingly.

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

## 0.3.63

## 0.3.62

### Patch Changes

- 14666b3: Install the shared PIE content stylesheet from the player instead of requiring hosts to import it.

  `@pie-players/pie-theme/components.css` holds classes that authored content depends on but no component owns: passage markup (`.numbered-paragraph`, `.p-number`, `div.passage-title`), the legacy `kds-*` families, and the `pie-answer-eliminator-*` styles. `PieItemPlayer.svelte` already imported that stylesheet, but in this package's Vite library build a plain CSS import is extracted to `dist/assets/pie-item-player.css` — a file nothing loads at runtime and no `exports` entry exposes. The import was a silent no-op, so hosts rendered authored passages unstyled unless they happened to import the stylesheet themselves, which was documented nowhere.

  `@pie-players/pie-item-player` now inlines the stylesheet as text (`?raw`) and installs it once per document at import time, alongside custom-element registration, so it is in place before any instance renders. The separately importable session-debugger entry installs it too. The orphaned `dist/assets/pie-item-player.css` is no longer emitted. `@pie-players/pie-section-player` and `@pie-players/pie-assessment-player` are covered transitively, since they render items through the item player.

  The stylesheet is prepended to `<head>` and deliberately left unlayered, so host CSS that loads later still wins at equal specificity — the placement hosts were previously told to arrange by hand. A cascade layer would have been wrong here: unlayered author declarations beat all layered ones regardless of specificity, so a host reset as broad as `p { margin: 0 }` would have silently outranked `.numbered-paragraph { margin-left: 36px }`.

  Hosts that want to own the stylesheet can set `<html data-pie-content-styles="host">` before the player script runs; the player then installs nothing and warns once if no content stylesheet turns out to be present. `components.css` declares `--pie-content-styles` on `:root` as the presence sentinel behind that check.

  Upgrading hosts do not have to remove an existing `import "@pie-players/pie-theme/components.css"` for this release to be correct: installation is idempotent, and two matching copies render identically. But a host copy loads later than the installed one and therefore wins ties at equal specificity, so a host copy pinned to an older `@pie-players/pie-theme` would silently override newer player rules. Rather than leave that to be discovered, the players now log a one-time warning naming the redundant import when they detect a second copy in the document.

  `@pie-players/pie-print-player` installs it the same way, from its `src/index.ts` entry. This player never told hosts to import the stylesheet at all, so it had no working route to these styles. The gap is worse than a cosmetic one here: `components.css` owns `@media print { .noprint, .kds-noprint { display: none } }`, so a missing copy did not just render authored passage markup unstyled — it printed content the author had marked as non-printing. Nothing in the package strips authored classes on the way through; `processMarkup` swaps only the interactive element tags and returns the surrounding markup verbatim, and `pie-print` renders into light DOM (`createRenderRoot()` returns `this`), so a document-level stylesheet is the only thing that can reach that content.

  New in `@pie-players/pie-players-shared`: `installContentStyles`, `contentStylesPresent`, `contentStylesOptedOut`, `auditContentStyles`, plus a narrow `@pie-players/pie-players-shared/ui/content-styles` export. Print player imports through that subpath rather than the package root, because players-shared declares `sideEffects: true` and print player externalizes nothing — the root barrel would have bundled all of players-shared into `print-player.js`.

  Hosts that already import `@pie-players/pie-theme/components.css` need no change — installation is idempotent and a duplicate host copy simply wins on document order.

- 001486e: Preserve authored attributes and children through the print tag swap, and sanitize print markup by default.

  `processMarkup` previously carried only `id`, `pie-id`, and `data-original-tag` onto the freshly built print element, so everything else authored on that element was silently dropped:

  - `class`, `style`, `lang`, `dir`, `aria-*`, and `data-*` were lost. An item authored as `<multiple-choice id="1" class="noprint">` lost its print-suppression hook and printed anyway on hosts that load `@pie-players/pie-theme/components.css`.
  - Child nodes were lost, discarding authored fallback content and destroying nested interactive elements — a nested element could even be reported in the returned node list while being absent from the returned markup.

  All attributes are now copied and children are moved across. `id`, `pie-id`, and `data-original-tag` are still set by the processor so they win over any authored value of the same name.

  `<pie-print>` now also sanitizes authored `item.markup` through `@pie-players/pie-players-shared/security` by default, matching `<pie-item-player>`. Hosts can opt out with the `trust-markup` attribute or supply their own sanitizer via the `sanitizeMarkup` property. The interactive element tags from `item.elements` and their hashed print variants are allow-listed so sanitizing does not strip them.

  `sanitizeItemMarkup` gains a `wrapOverwideContent` option (default `true`, unchanged for the screen players). The print player passes `false`: the overwide image/table wrappers are `overflow-x: auto` reflow affordances with no `@media print` override, and `overflow` clips rather than scrolls in print media, so wide images and tables would be cut off.

  Also drops the `static styles` block from `PiePrint`. It declared a `:host` border, padding and `max-width`, none of which ever applied: `createRenderRoot()` returns `this` for light-DOM rendering, so Lit never calls `adoptStyles`. Removing dead declarations, no rendered change.

- 6a18f3c: Scope external stylesheets with an at-rule-aware walker, so `@media`, `@supports` and `:root` survive.

  `pie-item-player` scoped external stylesheets by prefixing every selector-like fragment with
  one regex. That is correct for flat selector rules and wrong for everything else:
  `@media screen { ... }` became `.pie-item-player.x @media screen { ... }`, an invalid
  selector, so the browser dropped the whole block and every rule inside it. `@font-face` and
  `@keyframes` were corrupted the same way — the font never loaded, the animation name was
  gone. And `:root { --var: ... }` became `.pie-item-player.x :root`, which can never match,
  because `:root` is `<html>` and is not a descendant of the player.

  At-rules and `:root` custom properties therefore never applied at all. Both entry paths were
  affected: the `external-style-urls` attribute and `itemConfig.resources.stylesheets[*].url`.

  Scoping now walks the stylesheet brace-by-brace, in a new `scopeStylesheetCss` export from
  `@pie-players/pie-players-shared`:

  - `@media`, `@supports`, `@container`, `@layer` and `@scope` keep their prelude and have
    their inner rules scoped, recursively.
  - `@font-face`, `@keyframes` (including vendor-prefixed), `@page`, `@property` and
    `@counter-style` pass through untouched, as do at-rules the walker does not recognise —
    their blocks hold declarations or keyframe selectors, not selectors to scope.
  - `:root`, `html` and `body` are replaced by the scope selector instead of being prefixed by
    it, so external custom properties apply. Anything that followed is preserved:
    `html.dark .a` becomes `.pie-item-player.x.dark .a`.
  - A leading pseudo becomes a descendant: `:is(.a, .b) .c` scopes to
    `.pie-item-player.x :is(.a, .b) .c`, not `.pie-item-player.x:is(.a, .b) .c`, which would
    demand that the player root carry the partner's class.
  - Parsing is string- and paren-aware, so a `{` inside `content: "{"` does not end a block and
    a `,` inside `:is(a, b)` does not split a selector list. Comments are stripped before the
    walk so one sitting between two rules is not absorbed into the next selector.
  - Style-rule blocks are emitted verbatim, which is also what native CSS nesting needs:
    nested selectors are relative to a parent that has already been scoped.

  Flat selector rules scope exactly as before. No new dependency, and no public API change —
  no new attribute, prop or event.

  **Where stylesheets are passed, expect visible changes.** At-rules and `:root` variables have
  never applied in this player, so fixing the scoper turns currently-dead CSS live. That is the
  point of the fix, but it is a real rendering difference for any host that was passing a
  stylesheet with media queries or custom properties in it.

  `@import` still passes through untouched, exactly as the regex left it. It pulls in an
  unscoped stylesheet and so defeats scoping; blocking it is a policy decision, not a scoping
  one. Cross-origin stylesheets are also still unscoped — they take the `<link>` branch because
  `fetch()` cannot read the text to rewrite. Both are pre-existing and tracked separately.

## 0.3.61

## 0.3.60

## 0.3.59

## 0.3.58

### Patch Changes

- 8df52bf: Add an opt-in allow-list for executable element packages. The default policy mode requires exact versions without build metadata so legacy IIFE bundle separators cannot be injected. Existing hosts that omit the policy retain their current loading behavior.
- d5cc905: Preserve distinct full custom-element tags when multiple PIE element versions coexist, while keeping the established tag encoder and existing single-version behavior unchanged. Legacy IIFE bundles now reject unrepresentable maps containing multiple specs for one package instead of aliasing distinct tags to one constructor.

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.55

### Patch Changes

- 7f45877: Forward metadata-only item session changes when renderer snapshots leave response data unchanged, without reclassifying those echoes as response data.

## 0.3.54

## 0.3.53

## 0.3.52

### Patch Changes

- 017f5a9: Treat identity-only PIE element session echoes as metadata-only updates so restored sessions do not emit learner response data changes, while preserving explicit response clears and derived session state updates.

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.48

### Patch Changes

- 0c20d0f: Fix PIE-631: EBSR (and any element with `lockChoiceOrder: false`) no longer triggers an infinite render loop. A controller's persisted derived state (e.g. shuffled choice order) now round-trips back into the authoritative item session via a new `ItemController.mergeElementSession` and an `onElementSessionUpdate` callback on `updatePieElements`, so the order is reused across renders instead of being regenerated non-deterministically each cycle.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.44

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.42

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.41

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.40

### Patch Changes

- 3a167a8: Declare Svelte as an optional peer for `pie-players-shared` raw Svelte source exports so pnpm consumers resolve the app's Svelte runtime without installing a nested copy.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.39

### Patch Changes

- 0072fad: Move Svelte out of published runtime dependencies and add a release check that rejects future accidental `svelte` runtime dependency declarations. Assessment toolkit custom-element outputs now bundle their Svelte runtime helpers so consumers do not install a second Svelte runtime through player packages.
- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.38

### Patch Changes

- f856362: Bump `@pie-lib/math-rendering-module` to `5.0.0` for the PIE-423 math accessibility rendering update.
- c8d46d7: Remove PIE-owned focus-placement APIs and automatic section navigation focus movement.

  This is a breaking cleanup for pre-1.0 hosts: `pie-item-player.focusFirst()`, section-player layout `focusStart()`, `SectionPlayerFocusPolicy.autoFocus`, `DEFAULT_FOCUS_POLICY`, and `resolveAutoFocusStrategy` are no longer exported. The shared `queryFirstFocusableDeep()` and `focusFirstFocusableInElement()` helpers were also removed; `FOCUSABLE_SELECTOR` and `isProgrammaticFocusTarget()` remain for focus-trap internals.

  Hosts should own skip links, landmarks, and page-level focus placement while section player preserves natural tab order into actionable controls.

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.37

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.36

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.35

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.34

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.33

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.32

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

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

## 0.3.30

### Patch Changes

- 0981bc3: Bump `@pie-lib/math-rendering-module` from `4.0.7` to `4.1.2` (PIE-147 / PIE-423).

  `math-rendering@4.1.0-next.1` regressed screen-reader support by dropping the
  `mjx-assistive-mml` MathML sibling that MathJax attaches for assistive
  technologies, so screen readers in the item player fell back to reading raw
  glyphs (e.g. "9 1 8") for prompt math. `4.1.2` — via
  [pie-framework/pie-lib#2201](https://github.com/pie-framework/pie-lib/pull/2201) —
  restores the assistive MathML attachment, so VoiceOver / NVDA announce prompt
  and answer-choice math correctly again.

  `players-shared` is the single source of truth for this dependency (enforced by
  `scripts/check-math-rendering-version.mjs`); every consumer — including
  `@pie-players/pie-item-player` — picks this up transitively on their next
  build/publish.

  The existing vite `patch-math-rendering-module-eval` hook in `item-player`
  still neutralizes the `return eval('require')` pattern in the upstream module
  (confirmed present in `4.1.2`), and `assert-no-eval-require-in-output` passes.

- 698aa82: Add `focusFirst()` to `pie-item-player` and nest it after section navigation focuses the current item card.

  - Export `queryFirstFocusableDeep`, `focusFirstFocusableInElement`, `isProgrammaticFocusTarget`, and `FOCUSABLE_SELECTOR` from `@pie-players/pie-players-shared` (deep traversal into **open** shadow roots; same selector basis as the focus trap).
  - `pie-item-player.focusFirst()` moves focus to the first visible interactive control inside the item.
  - Section player scaffold calls `focusFirst()` after programmatic focus lands on an item card (`start-of-content` without passage, and `current-item`).

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.29

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.28

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.27

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.26

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.24

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.23

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.22

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.21

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.20

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.19

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.18

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.17

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.16

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.14

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.12

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.5

### Patch Changes

- Publish a patch release for all publishable pie-players packages.

## 0.3.4

## 0.3.3

### Patch Changes

- Prepare a patch release for the latest framework fixes, math-rendering hardening, and packaging safety improvements.

## 0.3.2

### Patch Changes

- @pie-players/math-renderer-core@0.3.2
- @pie-players/math-renderer-mathjax@0.3.2

## 0.3.1

### Patch Changes

- @pie-players/math-renderer-core@0.3.1
- @pie-players/math-renderer-mathjax@0.3.1

## 0.3.0

### Minor Changes

- Adopt monorepo-wide fixed versioning and establish the first lockstep release train at 0.3.0.

### Patch Changes

- 9385ce0: Release all publishable packages in the repository.

  This intentionally triggers a full patch release sweep across all non-private workspace packages.

- Updated dependencies
- Updated dependencies [9385ce0]
  - @pie-players/math-renderer-core@0.3.0
  - @pie-players/math-renderer-mathjax@0.3.0

## 0.2.6

### Patch Changes

- beffcc0: Release all publishable packages.
- Updated dependencies [beffcc0]
  - @pie-players/math-renderer-core@0.1.5
  - @pie-players/math-renderer-mathjax@0.1.5

## 0.2.5

### Patch Changes

- 71a9581: Update publishing documentation and regenerate custom element inventory to reflect current custom element registration entrypoints and publishable package scope.
- Updated dependencies [71a9581]
  - @pie-players/math-renderer-core@0.1.4
  - @pie-players/math-renderer-mathjax@0.1.4
