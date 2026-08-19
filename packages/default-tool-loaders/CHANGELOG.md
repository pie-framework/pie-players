# @pie-players/pie-default-tool-loaders

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
- 1d9f2d3: One term-lookup implementation behind both dictionaries, and three defaults that no longer need a host to know about them.
  
  The two dictionaries shipped as near-copies: term normalisation and the headword guard were character-identical, the POST clients differed only in error strings, and each panel carried its own copy of the same state machine. That is now one module, `@pie-players/pie-players-shared/tools/term-lookup`, and each tool supplies only what a result of its own carries — an entry, or a picture. The subtle part, a superseded lookup not overwriting the newer one's state, exists once and is tested once. A lookup result is `{ status, items }` rather than `entries`/`pictures`.
  
  **An endpoint alone is now the whole configuration.** The client sent `credentials: "omit"` and documented `headers` as the way to authorise, but `headers` was unreachable: the element exposed no such property and the factory taking it was never exported. A host that put its dictionary route behind the assessment's own session — which the tool host contract asks for — got a 401 on every lookup and a learner-facing "the dictionary is unavailable (401)". Endpoints are called `same-origin`, so that route answers with nothing further configured; `headers` and `credentials` are now real properties for a host authorising some other way, and neither is required.
  
  **Plain `http:` picture URLs are refused.** The validator accepted `https?:` while its own comment said anything else with a scheme was refused, so `http://cdn.example/cat.png` reached `src` and was mixed-content-blocked on every https deployment — the broken image the guard exists to prevent. Protocol-relative and same-origin paths still pass, and "same-origin" is now checked by resolving rather than by looking for a leading slash: `/\evil.example/x.png` looks like a path and resolves to another host, because a backslash is a path separator for special schemes and a tab is stripped outright. Both still resolve to https, so neither defeated the mixed-content guard — but same-origin is what the function claims.
  
  **A requested term is answered once per request, not once per term.** Params reach a tool through a seam reapplied on every sync, so the term alone cannot distinguish a re-render from a fresh ask. Keyed on the panel's last search, every reopen re-issued the selection that opened it and discarded the word the learner had typed since. Requests now carry a `termRequestId`, which both dictionary panels accept as an optional property; a host assigning `term` directly can leave it unset and gets term identity, enough to stop a re-render re-issuing.
  
  **A tool-open request falls back off section scope.** Requests defaulted to `"section"` and resolved only there, so a host placing a capability at item scope only had the selection action silently vanish: the tool was granted, hosted and visible, with no action on the selection and nothing to say why. Resolution now prefers section scope and falls back to any level that hosts the capability. Naming a level in the request still makes it a constraint, honoured strictly.
  
  Both panels' effects now write their reactive state under `untrack`, matching the rule AGENTS.md sets for effect bodies that read what they write. `check:capability-neutrality` gained `dictionary` and `pictureDictionary`, so its guard covers the packaged set its own comment claims to track.
  
  Also: `requestTool`, `canRequestTool`, `registerToolRequestTarget` and `onToolRequestTargetsChange` are optional on `ToolkitCoordinatorApi`. They were declared required while both call sites duck-typed them away for a host coordinator predating the seam, which made such a coordinator structurally non-conformant for no benefit. Both dictionary packages dropped two declared dependencies that nothing imported.
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
- Updated dependencies [5a41616]
- Updated dependencies [2d8ce6a]
- Updated dependencies [27284f8]
- Updated dependencies [e94b097]
- Updated dependencies [67a3d7e]
- Updated dependencies [d68c01b]
- Updated dependencies [3f5e968]
- Updated dependencies [27284f8]
- Updated dependencies [67f286c]
- Updated dependencies [55016b5]
- Updated dependencies [fc71c91]
- Updated dependencies [e94b097]
- Updated dependencies [00b8a71]
- Updated dependencies [6e1e053]
- Updated dependencies [e94b097]
- Updated dependencies [7c9fb28]
- Updated dependencies [979e643]
- Updated dependencies [1d9f2d3]
- Updated dependencies [2cda539]
- Updated dependencies [e94b097]
- Updated dependencies [27284f8]
- Updated dependencies [54742db]
- Updated dependencies [f61c7c7]
- Updated dependencies [0dc9c96]
- Updated dependencies [2d680c8]
- Updated dependencies [cb11691]
- Updated dependencies [4f0cb3f]
- Updated dependencies [e94b097]
- Updated dependencies [27284f8]
  - @pie-players/pie-tool-annotation-toolbar@0.3.68
  - @pie-players/pie-players-shared@0.3.68
  - @pie-players/pie-assessment-toolkit@0.3.68
  - @pie-players/pie-tool-dictionary@0.3.68
  - @pie-players/pie-tool-picture-dictionary@0.3.68
  - @pie-players/pie-tool-ruler@0.3.68
  - @pie-players/pie-tool-calculator-desmos@0.3.68
  - @pie-players/pie-tool-theme@0.3.68
  - @pie-players/pie-tool-graph@0.3.68
  - @pie-players/pie-tool-line-reader@0.3.68
  - @pie-players/pie-tool-periodic-table@0.3.68
  - @pie-players/pie-tool-protractor@0.3.68
  - @pie-players/pie-tool-tts-inline@0.3.68
  - @pie-players/pie-tool-answer-eliminator@0.3.68

## 0.3.67

### Patch Changes

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
- Updated dependencies [73d2be4]
- Updated dependencies [fe9b4f0]
- Updated dependencies [61d6aa0]
  - @pie-players/pie-players-shared@0.3.67
  - @pie-players/pie-tool-answer-eliminator@0.3.67
  - @pie-players/pie-assessment-toolkit@0.3.67
  - @pie-players/pie-tool-annotation-toolbar@0.3.67
  - @pie-players/pie-tool-calculator-desmos@0.3.67
  - @pie-players/pie-tool-theme@0.3.67
  - @pie-players/pie-tool-graph@0.3.67
  - @pie-players/pie-tool-line-reader@0.3.67
  - @pie-players/pie-tool-periodic-table@0.3.67
  - @pie-players/pie-tool-protractor@0.3.67
  - @pie-players/pie-tool-ruler@0.3.67
  - @pie-players/pie-tool-tts-inline@0.3.67

## 0.3.66

### Patch Changes

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

- 5e6fcde: Author the packaged capability set through one validated composition so its
  registrations, element tags, lazy loaders, placement/order projections and
  explicit universal-support policy cannot drift independently. Existing host
  exports, registry overrides, opt-in loader behavior and fail-soft `toolIds`
  selection remain unchanged.
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

- Updated dependencies [556c422]
- Updated dependencies [2a741c6]
- Updated dependencies [5e6fcde]
- Updated dependencies [2bcd9fa]
- Updated dependencies [1e0c10f]
- Updated dependencies [2bcd9fa]
- Updated dependencies [e8a6f0e]
- Updated dependencies [08f77f5]
- Updated dependencies [2bcd9fa]
- Updated dependencies [1f29de7]
- Updated dependencies [5e6fcde]
- Updated dependencies [5f133be]
- Updated dependencies [2a741c6]
- Updated dependencies [9a183cf]
  - @pie-players/pie-assessment-toolkit@0.3.66
  - @pie-players/pie-players-shared@0.3.66
  - @pie-players/pie-tool-tts-inline@0.3.66
  - @pie-players/pie-tool-periodic-table@0.3.66
  - @pie-players/pie-tool-calculator-desmos@0.3.66
  - @pie-players/pie-tool-theme@0.3.66
  - @pie-players/pie-tool-annotation-toolbar@0.3.66
  - @pie-players/pie-tool-answer-eliminator@0.3.66
  - @pie-players/pie-tool-graph@0.3.66
  - @pie-players/pie-tool-line-reader@0.3.66
  - @pie-players/pie-tool-protractor@0.3.66
  - @pie-players/pie-tool-ruler@0.3.66

## 0.3.65

### Patch Changes

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

- Updated dependencies [c16c77c]
- Updated dependencies [35f1cc9]
- Updated dependencies [c5fbf21]
- Updated dependencies [c4c3aca]
- Updated dependencies [2b015a9]
- Updated dependencies [411b2cd]
- Updated dependencies [f0d5802]
- Updated dependencies [f588924]
- Updated dependencies [3f6e33a]
- Updated dependencies [3972f16]
- Updated dependencies [5183654]
- Updated dependencies [c59396b]
  - @pie-players/pie-tool-answer-eliminator@0.3.65
  - @pie-players/pie-assessment-toolkit@0.3.65
  - @pie-players/pie-players-shared@0.3.65
  - @pie-players/pie-tool-theme@0.3.65
  - @pie-players/pie-tool-annotation-toolbar@0.3.65
  - @pie-players/pie-tool-calculator-desmos@0.3.65
  - @pie-players/pie-tool-graph@0.3.65
  - @pie-players/pie-tool-line-reader@0.3.65
  - @pie-players/pie-tool-periodic-table@0.3.65
  - @pie-players/pie-tool-protractor@0.3.65
  - @pie-players/pie-tool-ruler@0.3.65
  - @pie-players/pie-tool-tts-inline@0.3.65

## 0.3.64

### Patch Changes

- Updated dependencies [dc44392]
  - @pie-players/pie-tool-line-reader@0.3.64
  - @pie-players/pie-tool-annotation-toolbar@0.3.64
  - @pie-players/pie-tool-answer-eliminator@0.3.64
  - @pie-players/pie-tool-calculator-desmos@0.3.64
  - @pie-players/pie-tool-theme@0.3.64
  - @pie-players/pie-tool-graph@0.3.64
  - @pie-players/pie-tool-periodic-table@0.3.64
  - @pie-players/pie-tool-protractor@0.3.64
  - @pie-players/pie-tool-ruler@0.3.64
  - @pie-players/pie-tool-tts-inline@0.3.64

## 0.3.63

### Patch Changes

- Updated dependencies [b960bae]
  - @pie-players/pie-tool-line-reader@0.3.63
  - @pie-players/pie-tool-annotation-toolbar@0.3.63
  - @pie-players/pie-tool-answer-eliminator@0.3.63
  - @pie-players/pie-tool-calculator-desmos@0.3.63
  - @pie-players/pie-tool-theme@0.3.63
  - @pie-players/pie-tool-graph@0.3.63
  - @pie-players/pie-tool-periodic-table@0.3.63
  - @pie-players/pie-tool-protractor@0.3.63
  - @pie-players/pie-tool-ruler@0.3.63
  - @pie-players/pie-tool-tts-inline@0.3.63

## 0.3.62

### Patch Changes

- Updated dependencies [c73c995]
- Updated dependencies [507b56f]
- Updated dependencies [c810459]
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.62
  - @pie-players/pie-tool-tts-inline@0.3.62
  - @pie-players/pie-tool-answer-eliminator@0.3.62
  - @pie-players/pie-tool-calculator-desmos@0.3.62
  - @pie-players/pie-tool-theme@0.3.62
  - @pie-players/pie-tool-graph@0.3.62
  - @pie-players/pie-tool-line-reader@0.3.62
  - @pie-players/pie-tool-periodic-table@0.3.62
  - @pie-players/pie-tool-protractor@0.3.62
  - @pie-players/pie-tool-ruler@0.3.62

## 0.3.61

### Patch Changes

- @pie-players/pie-tool-annotation-toolbar@0.3.61
- @pie-players/pie-tool-answer-eliminator@0.3.61
- @pie-players/pie-tool-calculator-desmos@0.3.61
- @pie-players/pie-tool-theme@0.3.61
- @pie-players/pie-tool-graph@0.3.61
- @pie-players/pie-tool-line-reader@0.3.61
- @pie-players/pie-tool-periodic-table@0.3.61
- @pie-players/pie-tool-protractor@0.3.61
- @pie-players/pie-tool-ruler@0.3.61
- @pie-players/pie-tool-tts-inline@0.3.61

## 0.3.60

### Patch Changes

- @pie-players/pie-tool-annotation-toolbar@0.3.60
- @pie-players/pie-tool-answer-eliminator@0.3.60
- @pie-players/pie-tool-calculator-desmos@0.3.60
- @pie-players/pie-tool-theme@0.3.60
- @pie-players/pie-tool-graph@0.3.60
- @pie-players/pie-tool-line-reader@0.3.60
- @pie-players/pie-tool-periodic-table@0.3.60
- @pie-players/pie-tool-protractor@0.3.60
- @pie-players/pie-tool-ruler@0.3.60
- @pie-players/pie-tool-tts-inline@0.3.60

## 0.3.59

### Patch Changes

- Updated dependencies
  - @pie-players/pie-tool-tts-inline@0.3.59
  - @pie-players/pie-tool-annotation-toolbar@0.3.59
  - @pie-players/pie-tool-answer-eliminator@0.3.59
  - @pie-players/pie-tool-calculator-desmos@0.3.59
  - @pie-players/pie-tool-theme@0.3.59
  - @pie-players/pie-tool-graph@0.3.59
  - @pie-players/pie-tool-line-reader@0.3.59
  - @pie-players/pie-tool-periodic-table@0.3.59
  - @pie-players/pie-tool-protractor@0.3.59
  - @pie-players/pie-tool-ruler@0.3.59

## 0.3.58

### Patch Changes

- @pie-players/pie-tool-annotation-toolbar@0.3.58
- @pie-players/pie-tool-answer-eliminator@0.3.58
- @pie-players/pie-tool-calculator-desmos@0.3.58
- @pie-players/pie-tool-theme@0.3.58
- @pie-players/pie-tool-graph@0.3.58
- @pie-players/pie-tool-line-reader@0.3.58
- @pie-players/pie-tool-periodic-table@0.3.58
- @pie-players/pie-tool-protractor@0.3.58
- @pie-players/pie-tool-ruler@0.3.58
- @pie-players/pie-tool-tts-inline@0.3.58

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.57
  - @pie-players/pie-tool-answer-eliminator@0.3.57
  - @pie-players/pie-tool-calculator-desmos@0.3.57
  - @pie-players/pie-tool-graph@0.3.57
  - @pie-players/pie-tool-line-reader@0.3.57
  - @pie-players/pie-tool-periodic-table@0.3.57
  - @pie-players/pie-tool-protractor@0.3.57
  - @pie-players/pie-tool-ruler@0.3.57
  - @pie-players/pie-tool-theme@0.3.57
  - @pie-players/pie-tool-tts-inline@0.3.57

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.56
  - @pie-players/pie-tool-answer-eliminator@0.3.56
  - @pie-players/pie-tool-calculator-desmos@0.3.56
  - @pie-players/pie-tool-graph@0.3.56
  - @pie-players/pie-tool-line-reader@0.3.56
  - @pie-players/pie-tool-periodic-table@0.3.56
  - @pie-players/pie-tool-protractor@0.3.56
  - @pie-players/pie-tool-ruler@0.3.56
  - @pie-players/pie-tool-theme@0.3.56
  - @pie-players/pie-tool-tts-inline@0.3.56

## 0.3.55

### Patch Changes

- @pie-players/pie-tool-annotation-toolbar@0.3.55
- @pie-players/pie-tool-answer-eliminator@0.3.55
- @pie-players/pie-tool-calculator-desmos@0.3.55
- @pie-players/pie-tool-theme@0.3.55
- @pie-players/pie-tool-graph@0.3.55
- @pie-players/pie-tool-line-reader@0.3.55
- @pie-players/pie-tool-periodic-table@0.3.55
- @pie-players/pie-tool-protractor@0.3.55
- @pie-players/pie-tool-ruler@0.3.55
- @pie-players/pie-tool-tts-inline@0.3.55

## 0.3.54

### Patch Changes

- Updated dependencies [bead424]
  - @pie-players/pie-tool-tts-inline@0.3.54
  - @pie-players/pie-tool-annotation-toolbar@0.3.54
  - @pie-players/pie-tool-answer-eliminator@0.3.54
  - @pie-players/pie-tool-calculator-desmos@0.3.54
  - @pie-players/pie-tool-theme@0.3.54
  - @pie-players/pie-tool-graph@0.3.54
  - @pie-players/pie-tool-line-reader@0.3.54
  - @pie-players/pie-tool-periodic-table@0.3.54
  - @pie-players/pie-tool-protractor@0.3.54
  - @pie-players/pie-tool-ruler@0.3.54

## 0.3.53

### Patch Changes

- Updated dependencies [ee6c081]
- Updated dependencies [20fc985]
  - @pie-players/pie-tool-tts-inline@0.3.53
  - @pie-players/pie-tool-theme@0.3.53
  - @pie-players/pie-tool-annotation-toolbar@0.3.53
  - @pie-players/pie-tool-answer-eliminator@0.3.53
  - @pie-players/pie-tool-calculator-desmos@0.3.53
  - @pie-players/pie-tool-graph@0.3.53
  - @pie-players/pie-tool-line-reader@0.3.53
  - @pie-players/pie-tool-periodic-table@0.3.53
  - @pie-players/pie-tool-protractor@0.3.53
  - @pie-players/pie-tool-ruler@0.3.53

## 0.3.52

### Patch Changes

- Updated dependencies [905080d]
  - @pie-players/pie-tool-tts-inline@0.3.52
  - @pie-players/pie-tool-annotation-toolbar@0.3.52
  - @pie-players/pie-tool-answer-eliminator@0.3.52
  - @pie-players/pie-tool-calculator-desmos@0.3.52
  - @pie-players/pie-tool-theme@0.3.52
  - @pie-players/pie-tool-graph@0.3.52
  - @pie-players/pie-tool-line-reader@0.3.52
  - @pie-players/pie-tool-periodic-table@0.3.52
  - @pie-players/pie-tool-protractor@0.3.52
  - @pie-players/pie-tool-ruler@0.3.52

## 0.3.51

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.51
  - @pie-players/pie-tool-answer-eliminator@0.3.51
  - @pie-players/pie-tool-calculator-desmos@0.3.51
  - @pie-players/pie-tool-graph@0.3.51
  - @pie-players/pie-tool-line-reader@0.3.51
  - @pie-players/pie-tool-periodic-table@0.3.51
  - @pie-players/pie-tool-protractor@0.3.51
  - @pie-players/pie-tool-ruler@0.3.51
  - @pie-players/pie-tool-theme@0.3.51
  - @pie-players/pie-tool-tts-inline@0.3.51

## 0.3.50

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.50
  - @pie-players/pie-tool-answer-eliminator@0.3.50
  - @pie-players/pie-tool-calculator-desmos@0.3.50
  - @pie-players/pie-tool-graph@0.3.50
  - @pie-players/pie-tool-line-reader@0.3.50
  - @pie-players/pie-tool-periodic-table@0.3.50
  - @pie-players/pie-tool-protractor@0.3.50
  - @pie-players/pie-tool-ruler@0.3.50
  - @pie-players/pie-tool-theme@0.3.50
  - @pie-players/pie-tool-tts-inline@0.3.50

## 0.3.49

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.49
  - @pie-players/pie-tool-answer-eliminator@0.3.49
  - @pie-players/pie-tool-calculator-desmos@0.3.49
  - @pie-players/pie-tool-graph@0.3.49
  - @pie-players/pie-tool-line-reader@0.3.49
  - @pie-players/pie-tool-periodic-table@0.3.49
  - @pie-players/pie-tool-protractor@0.3.49
  - @pie-players/pie-tool-ruler@0.3.49
  - @pie-players/pie-tool-text-to-speech@0.3.49
  - @pie-players/pie-tool-theme@0.3.49

## 0.3.48

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.48
  - @pie-players/pie-tool-answer-eliminator@0.3.48
  - @pie-players/pie-tool-calculator-desmos@0.3.48
  - @pie-players/pie-tool-graph@0.3.48
  - @pie-players/pie-tool-line-reader@0.3.48
  - @pie-players/pie-tool-periodic-table@0.3.48
  - @pie-players/pie-tool-protractor@0.3.48
  - @pie-players/pie-tool-ruler@0.3.48
  - @pie-players/pie-tool-text-to-speech@0.3.48
  - @pie-players/pie-tool-theme@0.3.48

## 0.3.47

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.47
  - @pie-players/pie-tool-answer-eliminator@0.3.47
  - @pie-players/pie-tool-calculator-desmos@0.3.47
  - @pie-players/pie-tool-graph@0.3.47
  - @pie-players/pie-tool-line-reader@0.3.47
  - @pie-players/pie-tool-periodic-table@0.3.47
  - @pie-players/pie-tool-protractor@0.3.47
  - @pie-players/pie-tool-ruler@0.3.47
  - @pie-players/pie-tool-text-to-speech@0.3.47
  - @pie-players/pie-tool-theme@0.3.47

## 0.3.46

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.46
  - @pie-players/pie-tool-answer-eliminator@0.3.46
  - @pie-players/pie-tool-calculator-desmos@0.3.46
  - @pie-players/pie-tool-graph@0.3.46
  - @pie-players/pie-tool-line-reader@0.3.46
  - @pie-players/pie-tool-periodic-table@0.3.46
  - @pie-players/pie-tool-protractor@0.3.46
  - @pie-players/pie-tool-ruler@0.3.46
  - @pie-players/pie-tool-text-to-speech@0.3.46
  - @pie-players/pie-tool-theme@0.3.46

## 0.3.45

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.45
  - @pie-players/pie-tool-answer-eliminator@0.3.45
  - @pie-players/pie-tool-calculator-desmos@0.3.45
  - @pie-players/pie-tool-graph@0.3.45
  - @pie-players/pie-tool-line-reader@0.3.45
  - @pie-players/pie-tool-periodic-table@0.3.45
  - @pie-players/pie-tool-protractor@0.3.45
  - @pie-players/pie-tool-ruler@0.3.45
  - @pie-players/pie-tool-text-to-speech@0.3.45
  - @pie-players/pie-tool-theme@0.3.45

## 0.3.44

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.44
  - @pie-players/pie-tool-answer-eliminator@0.3.44
  - @pie-players/pie-tool-calculator-desmos@0.3.44
  - @pie-players/pie-tool-graph@0.3.44
  - @pie-players/pie-tool-line-reader@0.3.44
  - @pie-players/pie-tool-periodic-table@0.3.44
  - @pie-players/pie-tool-protractor@0.3.44
  - @pie-players/pie-tool-ruler@0.3.44
  - @pie-players/pie-tool-text-to-speech@0.3.44
  - @pie-players/pie-tool-theme@0.3.44

## 0.3.42

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.42
  - @pie-players/pie-tool-answer-eliminator@0.3.42
  - @pie-players/pie-tool-calculator-desmos@0.3.42
  - @pie-players/pie-tool-graph@0.3.42
  - @pie-players/pie-tool-line-reader@0.3.42
  - @pie-players/pie-tool-periodic-table@0.3.42
  - @pie-players/pie-tool-protractor@0.3.42
  - @pie-players/pie-tool-ruler@0.3.42
  - @pie-players/pie-tool-text-to-speech@0.3.42
  - @pie-players/pie-tool-theme@0.3.42

## 0.3.41

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.41
  - @pie-players/pie-tool-answer-eliminator@0.3.41
  - @pie-players/pie-tool-calculator-desmos@0.3.41
  - @pie-players/pie-tool-graph@0.3.41
  - @pie-players/pie-tool-line-reader@0.3.41
  - @pie-players/pie-tool-periodic-table@0.3.41
  - @pie-players/pie-tool-protractor@0.3.41
  - @pie-players/pie-tool-ruler@0.3.41
  - @pie-players/pie-tool-text-to-speech@0.3.41
  - @pie-players/pie-tool-theme@0.3.41

## 0.3.40

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.40
  - @pie-players/pie-tool-answer-eliminator@0.3.40
  - @pie-players/pie-tool-calculator-desmos@0.3.40
  - @pie-players/pie-tool-graph@0.3.40
  - @pie-players/pie-tool-line-reader@0.3.40
  - @pie-players/pie-tool-periodic-table@0.3.40
  - @pie-players/pie-tool-protractor@0.3.40
  - @pie-players/pie-tool-ruler@0.3.40
  - @pie-players/pie-tool-text-to-speech@0.3.40
  - @pie-players/pie-tool-theme@0.3.40

## 0.3.39

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.39
  - @pie-players/pie-tool-answer-eliminator@0.3.39
  - @pie-players/pie-tool-calculator-desmos@0.3.39
  - @pie-players/pie-tool-graph@0.3.39
  - @pie-players/pie-tool-line-reader@0.3.39
  - @pie-players/pie-tool-periodic-table@0.3.39
  - @pie-players/pie-tool-protractor@0.3.39
  - @pie-players/pie-tool-ruler@0.3.39
  - @pie-players/pie-tool-text-to-speech@0.3.39
  - @pie-players/pie-tool-theme@0.3.39

## 0.3.38

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.38
  - @pie-players/pie-tool-answer-eliminator@0.3.38
  - @pie-players/pie-tool-calculator-desmos@0.3.38
  - @pie-players/pie-tool-graph@0.3.38
  - @pie-players/pie-tool-line-reader@0.3.38
  - @pie-players/pie-tool-periodic-table@0.3.38
  - @pie-players/pie-tool-protractor@0.3.38
  - @pie-players/pie-tool-ruler@0.3.38
  - @pie-players/pie-tool-text-to-speech@0.3.38
  - @pie-players/pie-tool-theme@0.3.38

## 0.3.37

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.37
  - @pie-players/pie-tool-answer-eliminator@0.3.37
  - @pie-players/pie-tool-calculator-desmos@0.3.37
  - @pie-players/pie-tool-graph@0.3.37
  - @pie-players/pie-tool-line-reader@0.3.37
  - @pie-players/pie-tool-periodic-table@0.3.37
  - @pie-players/pie-tool-protractor@0.3.37
  - @pie-players/pie-tool-ruler@0.3.37
  - @pie-players/pie-tool-text-to-speech@0.3.37
  - @pie-players/pie-tool-theme@0.3.37

## 0.3.36

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.36
  - @pie-players/pie-tool-answer-eliminator@0.3.36
  - @pie-players/pie-tool-calculator-desmos@0.3.36
  - @pie-players/pie-tool-graph@0.3.36
  - @pie-players/pie-tool-line-reader@0.3.36
  - @pie-players/pie-tool-periodic-table@0.3.36
  - @pie-players/pie-tool-protractor@0.3.36
  - @pie-players/pie-tool-ruler@0.3.36
  - @pie-players/pie-tool-text-to-speech@0.3.36
  - @pie-players/pie-tool-theme@0.3.36

## 0.3.35

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.35
  - @pie-players/pie-tool-answer-eliminator@0.3.35
  - @pie-players/pie-tool-calculator-desmos@0.3.35
  - @pie-players/pie-tool-graph@0.3.35
  - @pie-players/pie-tool-line-reader@0.3.35
  - @pie-players/pie-tool-periodic-table@0.3.35
  - @pie-players/pie-tool-protractor@0.3.35
  - @pie-players/pie-tool-ruler@0.3.35
  - @pie-players/pie-tool-text-to-speech@0.3.35
  - @pie-players/pie-tool-theme@0.3.35

## 0.3.34

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.34
  - @pie-players/pie-tool-answer-eliminator@0.3.34
  - @pie-players/pie-tool-calculator-desmos@0.3.34
  - @pie-players/pie-tool-graph@0.3.34
  - @pie-players/pie-tool-line-reader@0.3.34
  - @pie-players/pie-tool-periodic-table@0.3.34
  - @pie-players/pie-tool-protractor@0.3.34
  - @pie-players/pie-tool-ruler@0.3.34
  - @pie-players/pie-tool-text-to-speech@0.3.34
  - @pie-players/pie-tool-theme@0.3.34

## 0.3.33

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.33
  - @pie-players/pie-tool-answer-eliminator@0.3.33
  - @pie-players/pie-tool-calculator-desmos@0.3.33
  - @pie-players/pie-tool-graph@0.3.33
  - @pie-players/pie-tool-line-reader@0.3.33
  - @pie-players/pie-tool-periodic-table@0.3.33
  - @pie-players/pie-tool-protractor@0.3.33
  - @pie-players/pie-tool-ruler@0.3.33
  - @pie-players/pie-tool-text-to-speech@0.3.33
  - @pie-players/pie-tool-theme@0.3.33

## 0.3.32

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.32
  - @pie-players/pie-tool-answer-eliminator@0.3.32
  - @pie-players/pie-tool-calculator-desmos@0.3.32
  - @pie-players/pie-tool-graph@0.3.32
  - @pie-players/pie-tool-line-reader@0.3.32
  - @pie-players/pie-tool-periodic-table@0.3.32
  - @pie-players/pie-tool-protractor@0.3.32
  - @pie-players/pie-tool-ruler@0.3.32
  - @pie-players/pie-tool-text-to-speech@0.3.32
  - @pie-players/pie-tool-theme@0.3.32

## 0.3.31

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.31
  - @pie-players/pie-tool-answer-eliminator@0.3.31
  - @pie-players/pie-tool-calculator-desmos@0.3.31
  - @pie-players/pie-tool-graph@0.3.31
  - @pie-players/pie-tool-line-reader@0.3.31
  - @pie-players/pie-tool-periodic-table@0.3.31
  - @pie-players/pie-tool-protractor@0.3.31
  - @pie-players/pie-tool-ruler@0.3.31
  - @pie-players/pie-tool-text-to-speech@0.3.31
  - @pie-players/pie-tool-theme@0.3.31

## 0.3.30

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.30
  - @pie-players/pie-tool-answer-eliminator@0.3.30
  - @pie-players/pie-tool-calculator-desmos@0.3.30
  - @pie-players/pie-tool-graph@0.3.30
  - @pie-players/pie-tool-line-reader@0.3.30
  - @pie-players/pie-tool-periodic-table@0.3.30
  - @pie-players/pie-tool-protractor@0.3.30
  - @pie-players/pie-tool-ruler@0.3.30
  - @pie-players/pie-tool-text-to-speech@0.3.30
  - @pie-players/pie-tool-theme@0.3.30

## 0.3.29

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.29
  - @pie-players/pie-tool-answer-eliminator@0.3.29
  - @pie-players/pie-tool-calculator-desmos@0.3.29
  - @pie-players/pie-tool-graph@0.3.29
  - @pie-players/pie-tool-line-reader@0.3.29
  - @pie-players/pie-tool-periodic-table@0.3.29
  - @pie-players/pie-tool-protractor@0.3.29
  - @pie-players/pie-tool-ruler@0.3.29
  - @pie-players/pie-tool-text-to-speech@0.3.29
  - @pie-players/pie-tool-theme@0.3.29

## 0.3.28

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.28
  - @pie-players/pie-tool-answer-eliminator@0.3.28
  - @pie-players/pie-tool-calculator-desmos@0.3.28
  - @pie-players/pie-tool-graph@0.3.28
  - @pie-players/pie-tool-line-reader@0.3.28
  - @pie-players/pie-tool-periodic-table@0.3.28
  - @pie-players/pie-tool-protractor@0.3.28
  - @pie-players/pie-tool-ruler@0.3.28
  - @pie-players/pie-tool-text-to-speech@0.3.28
  - @pie-players/pie-tool-theme@0.3.28

## 0.3.27

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.27
  - @pie-players/pie-tool-answer-eliminator@0.3.27
  - @pie-players/pie-tool-calculator-desmos@0.3.27
  - @pie-players/pie-tool-graph@0.3.27
  - @pie-players/pie-tool-line-reader@0.3.27
  - @pie-players/pie-tool-periodic-table@0.3.27
  - @pie-players/pie-tool-protractor@0.3.27
  - @pie-players/pie-tool-ruler@0.3.27
  - @pie-players/pie-tool-text-to-speech@0.3.27
  - @pie-players/pie-tool-theme@0.3.27

## 0.3.26

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.26
  - @pie-players/pie-tool-answer-eliminator@0.3.26
  - @pie-players/pie-tool-calculator-desmos@0.3.26
  - @pie-players/pie-tool-graph@0.3.26
  - @pie-players/pie-tool-line-reader@0.3.26
  - @pie-players/pie-tool-periodic-table@0.3.26
  - @pie-players/pie-tool-protractor@0.3.26
  - @pie-players/pie-tool-ruler@0.3.26
  - @pie-players/pie-tool-text-to-speech@0.3.26
  - @pie-players/pie-tool-theme@0.3.26

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.25
  - @pie-players/pie-tool-answer-eliminator@0.3.25
  - @pie-players/pie-tool-calculator-desmos@0.3.25
  - @pie-players/pie-tool-graph@0.3.25
  - @pie-players/pie-tool-line-reader@0.3.25
  - @pie-players/pie-tool-periodic-table@0.3.25
  - @pie-players/pie-tool-protractor@0.3.25
  - @pie-players/pie-tool-ruler@0.3.25
  - @pie-players/pie-tool-text-to-speech@0.3.25
  - @pie-players/pie-tool-theme@0.3.25

## 0.3.25

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.25
  - @pie-players/pie-tool-answer-eliminator@0.3.25
  - @pie-players/pie-tool-calculator-desmos@0.3.25
  - @pie-players/pie-tool-graph@0.3.25
  - @pie-players/pie-tool-line-reader@0.3.25
  - @pie-players/pie-tool-periodic-table@0.3.25
  - @pie-players/pie-tool-protractor@0.3.25
  - @pie-players/pie-tool-ruler@0.3.25
  - @pie-players/pie-tool-text-to-speech@0.3.25
  - @pie-players/pie-tool-theme@0.3.25

## 0.3.24

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.24
  - @pie-players/pie-tool-answer-eliminator@0.3.24
  - @pie-players/pie-tool-calculator-desmos@0.3.24
  - @pie-players/pie-tool-graph@0.3.24
  - @pie-players/pie-tool-line-reader@0.3.24
  - @pie-players/pie-tool-periodic-table@0.3.24
  - @pie-players/pie-tool-protractor@0.3.24
  - @pie-players/pie-tool-ruler@0.3.24
  - @pie-players/pie-tool-text-to-speech@0.3.24
  - @pie-players/pie-tool-theme@0.3.24

## 0.3.23

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.23
  - @pie-players/pie-tool-answer-eliminator@0.3.23
  - @pie-players/pie-tool-calculator-desmos@0.3.23
  - @pie-players/pie-tool-graph@0.3.23
  - @pie-players/pie-tool-line-reader@0.3.23
  - @pie-players/pie-tool-periodic-table@0.3.23
  - @pie-players/pie-tool-protractor@0.3.23
  - @pie-players/pie-tool-ruler@0.3.23
  - @pie-players/pie-tool-text-to-speech@0.3.23
  - @pie-players/pie-tool-theme@0.3.23

## 0.3.22

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.22
  - @pie-players/pie-tool-answer-eliminator@0.3.22
  - @pie-players/pie-tool-calculator-desmos@0.3.22
  - @pie-players/pie-tool-graph@0.3.22
  - @pie-players/pie-tool-line-reader@0.3.22
  - @pie-players/pie-tool-periodic-table@0.3.22
  - @pie-players/pie-tool-protractor@0.3.22
  - @pie-players/pie-tool-ruler@0.3.22
  - @pie-players/pie-tool-text-to-speech@0.3.22
  - @pie-players/pie-tool-theme@0.3.22

## 0.3.21

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.21
  - @pie-players/pie-tool-answer-eliminator@0.3.21
  - @pie-players/pie-tool-calculator-desmos@0.3.21
  - @pie-players/pie-tool-graph@0.3.21
  - @pie-players/pie-tool-line-reader@0.3.21
  - @pie-players/pie-tool-periodic-table@0.3.21
  - @pie-players/pie-tool-protractor@0.3.21
  - @pie-players/pie-tool-ruler@0.3.21
  - @pie-players/pie-tool-text-to-speech@0.3.21
  - @pie-players/pie-tool-theme@0.3.21

## 0.3.20

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.20
  - @pie-players/pie-tool-answer-eliminator@0.3.20
  - @pie-players/pie-tool-calculator-desmos@0.3.20
  - @pie-players/pie-tool-graph@0.3.20
  - @pie-players/pie-tool-line-reader@0.3.20
  - @pie-players/pie-tool-periodic-table@0.3.20
  - @pie-players/pie-tool-protractor@0.3.20
  - @pie-players/pie-tool-ruler@0.3.20
  - @pie-players/pie-tool-text-to-speech@0.3.20
  - @pie-players/pie-tool-theme@0.3.20

## 0.3.19

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.19
  - @pie-players/pie-tool-answer-eliminator@0.3.19
  - @pie-players/pie-tool-calculator-desmos@0.3.19
  - @pie-players/pie-tool-graph@0.3.19
  - @pie-players/pie-tool-line-reader@0.3.19
  - @pie-players/pie-tool-periodic-table@0.3.19
  - @pie-players/pie-tool-protractor@0.3.19
  - @pie-players/pie-tool-ruler@0.3.19
  - @pie-players/pie-tool-text-to-speech@0.3.19
  - @pie-players/pie-tool-theme@0.3.19

## 0.3.18

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.18
  - @pie-players/pie-tool-answer-eliminator@0.3.18
  - @pie-players/pie-tool-calculator-desmos@0.3.18
  - @pie-players/pie-tool-graph@0.3.18
  - @pie-players/pie-tool-line-reader@0.3.18
  - @pie-players/pie-tool-periodic-table@0.3.18
  - @pie-players/pie-tool-protractor@0.3.18
  - @pie-players/pie-tool-ruler@0.3.18
  - @pie-players/pie-tool-text-to-speech@0.3.18
  - @pie-players/pie-tool-theme@0.3.18

## 0.3.17

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.17
  - @pie-players/pie-tool-answer-eliminator@0.3.17
  - @pie-players/pie-tool-calculator-desmos@0.3.17
  - @pie-players/pie-tool-graph@0.3.17
  - @pie-players/pie-tool-line-reader@0.3.17
  - @pie-players/pie-tool-periodic-table@0.3.17
  - @pie-players/pie-tool-protractor@0.3.17
  - @pie-players/pie-tool-ruler@0.3.17
  - @pie-players/pie-tool-text-to-speech@0.3.17
  - @pie-players/pie-tool-theme@0.3.17

## 0.3.16

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.16
  - @pie-players/pie-tool-answer-eliminator@0.3.16
  - @pie-players/pie-tool-calculator-desmos@0.3.16
  - @pie-players/pie-tool-graph@0.3.16
  - @pie-players/pie-tool-line-reader@0.3.16
  - @pie-players/pie-tool-periodic-table@0.3.16
  - @pie-players/pie-tool-protractor@0.3.16
  - @pie-players/pie-tool-ruler@0.3.16
  - @pie-players/pie-tool-text-to-speech@0.3.16
  - @pie-players/pie-tool-theme@0.3.16

## 0.3.15

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.15
  - @pie-players/pie-tool-answer-eliminator@0.3.15
  - @pie-players/pie-tool-calculator-desmos@0.3.15
  - @pie-players/pie-tool-graph@0.3.15
  - @pie-players/pie-tool-line-reader@0.3.15
  - @pie-players/pie-tool-periodic-table@0.3.15
  - @pie-players/pie-tool-protractor@0.3.15
  - @pie-players/pie-tool-ruler@0.3.15
  - @pie-players/pie-tool-text-to-speech@0.3.15
  - @pie-players/pie-tool-theme@0.3.15

## 0.3.14

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.14
  - @pie-players/pie-tool-answer-eliminator@0.3.14
  - @pie-players/pie-tool-calculator-desmos@0.3.14
  - @pie-players/pie-tool-graph@0.3.14
  - @pie-players/pie-tool-line-reader@0.3.14
  - @pie-players/pie-tool-periodic-table@0.3.14
  - @pie-players/pie-tool-protractor@0.3.14
  - @pie-players/pie-tool-ruler@0.3.14
  - @pie-players/pie-tool-text-to-speech@0.3.14
  - @pie-players/pie-tool-theme@0.3.14

## 0.3.13

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.13
  - @pie-players/pie-tool-answer-eliminator@0.3.13
  - @pie-players/pie-tool-calculator-desmos@0.3.13
  - @pie-players/pie-tool-graph@0.3.13
  - @pie-players/pie-tool-line-reader@0.3.13
  - @pie-players/pie-tool-periodic-table@0.3.13
  - @pie-players/pie-tool-protractor@0.3.13
  - @pie-players/pie-tool-ruler@0.3.13
  - @pie-players/pie-tool-text-to-speech@0.3.13
  - @pie-players/pie-tool-theme@0.3.13

## 0.3.12

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.12
  - @pie-players/pie-tool-answer-eliminator@0.3.12
  - @pie-players/pie-tool-calculator-desmos@0.3.12
  - @pie-players/pie-tool-graph@0.3.12
  - @pie-players/pie-tool-line-reader@0.3.12
  - @pie-players/pie-tool-periodic-table@0.3.12
  - @pie-players/pie-tool-protractor@0.3.12
  - @pie-players/pie-tool-ruler@0.3.12
  - @pie-players/pie-tool-text-to-speech@0.3.12
  - @pie-players/pie-tool-theme@0.3.12

## 0.3.11

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.11
  - @pie-players/pie-tool-answer-eliminator@0.3.11
  - @pie-players/pie-tool-calculator-desmos@0.3.11
  - @pie-players/pie-tool-graph@0.3.11
  - @pie-players/pie-tool-line-reader@0.3.11
  - @pie-players/pie-tool-periodic-table@0.3.11
  - @pie-players/pie-tool-protractor@0.3.11
  - @pie-players/pie-tool-ruler@0.3.11
  - @pie-players/pie-tool-text-to-speech@0.3.11
  - @pie-players/pie-tool-theme@0.3.11

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.10
  - @pie-players/pie-tool-answer-eliminator@0.3.10
  - @pie-players/pie-tool-calculator-desmos@0.3.10
  - @pie-players/pie-tool-graph@0.3.10
  - @pie-players/pie-tool-line-reader@0.3.10
  - @pie-players/pie-tool-periodic-table@0.3.10
  - @pie-players/pie-tool-protractor@0.3.10
  - @pie-players/pie-tool-ruler@0.3.10
  - @pie-players/pie-tool-text-to-speech@0.3.10
  - @pie-players/pie-tool-theme@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.9
  - @pie-players/pie-tool-answer-eliminator@0.3.9
  - @pie-players/pie-tool-calculator-desmos@0.3.9
  - @pie-players/pie-tool-graph@0.3.9
  - @pie-players/pie-tool-line-reader@0.3.9
  - @pie-players/pie-tool-periodic-table@0.3.9
  - @pie-players/pie-tool-protractor@0.3.9
  - @pie-players/pie-tool-ruler@0.3.9
  - @pie-players/pie-tool-text-to-speech@0.3.9
  - @pie-players/pie-tool-theme@0.3.9

## 0.3.10

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.10
  - @pie-players/pie-tool-answer-eliminator@0.3.10
  - @pie-players/pie-tool-calculator-desmos@0.3.10
  - @pie-players/pie-tool-graph@0.3.10
  - @pie-players/pie-tool-line-reader@0.3.10
  - @pie-players/pie-tool-periodic-table@0.3.10
  - @pie-players/pie-tool-protractor@0.3.10
  - @pie-players/pie-tool-ruler@0.3.10
  - @pie-players/pie-tool-text-to-speech@0.3.10
  - @pie-players/pie-tool-theme@0.3.10

## 0.3.9

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.9
  - @pie-players/pie-tool-answer-eliminator@0.3.9
  - @pie-players/pie-tool-calculator-desmos@0.3.9
  - @pie-players/pie-tool-graph@0.3.9
  - @pie-players/pie-tool-line-reader@0.3.9
  - @pie-players/pie-tool-periodic-table@0.3.9
  - @pie-players/pie-tool-protractor@0.3.9
  - @pie-players/pie-tool-ruler@0.3.9
  - @pie-players/pie-tool-text-to-speech@0.3.9
  - @pie-players/pie-tool-theme@0.3.9

## 0.3.8

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.8
  - @pie-players/pie-tool-answer-eliminator@0.3.8
  - @pie-players/pie-tool-calculator-desmos@0.3.8
  - @pie-players/pie-tool-graph@0.3.8
  - @pie-players/pie-tool-line-reader@0.3.8
  - @pie-players/pie-tool-periodic-table@0.3.8
  - @pie-players/pie-tool-protractor@0.3.8
  - @pie-players/pie-tool-ruler@0.3.8
  - @pie-players/pie-tool-text-to-speech@0.3.8
  - @pie-players/pie-tool-theme@0.3.8

## 0.3.7

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.7
  - @pie-players/pie-tool-answer-eliminator@0.3.7
  - @pie-players/pie-tool-calculator-desmos@0.3.7
  - @pie-players/pie-tool-graph@0.3.7
  - @pie-players/pie-tool-line-reader@0.3.7
  - @pie-players/pie-tool-periodic-table@0.3.7
  - @pie-players/pie-tool-protractor@0.3.7
  - @pie-players/pie-tool-ruler@0.3.7
  - @pie-players/pie-tool-text-to-speech@0.3.7
  - @pie-players/pie-tool-theme@0.3.7

## 0.3.6

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.6
  - @pie-players/pie-tool-answer-eliminator@0.3.6
  - @pie-players/pie-tool-calculator-desmos@0.3.6
  - @pie-players/pie-tool-graph@0.3.6
  - @pie-players/pie-tool-line-reader@0.3.6
  - @pie-players/pie-tool-periodic-table@0.3.6
  - @pie-players/pie-tool-protractor@0.3.6
  - @pie-players/pie-tool-ruler@0.3.6
  - @pie-players/pie-tool-text-to-speech@0.3.6
  - @pie-players/pie-tool-theme@0.3.6

## 0.3.5

### Patch Changes

- Publish a patch release for all publishable pie-players packages.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.5
  - @pie-players/pie-tool-answer-eliminator@0.3.5
  - @pie-players/pie-tool-calculator-desmos@0.3.5
  - @pie-players/pie-tool-theme@0.3.5
  - @pie-players/pie-tool-graph@0.3.5
  - @pie-players/pie-tool-line-reader@0.3.5
  - @pie-players/pie-tool-periodic-table@0.3.5
  - @pie-players/pie-tool-protractor@0.3.5
  - @pie-players/pie-tool-ruler@0.3.5
  - @pie-players/pie-tool-text-to-speech@0.3.5

## 0.3.4

### Patch Changes

- @pie-players/pie-tool-annotation-toolbar@0.3.4
- @pie-players/pie-tool-answer-eliminator@0.3.4
- @pie-players/pie-tool-calculator-desmos@0.3.4
- @pie-players/pie-tool-theme@0.3.4
- @pie-players/pie-tool-graph@0.3.4
- @pie-players/pie-tool-line-reader@0.3.4
- @pie-players/pie-tool-periodic-table@0.3.4
- @pie-players/pie-tool-protractor@0.3.4
- @pie-players/pie-tool-ruler@0.3.4
- @pie-players/pie-tool-text-to-speech@0.3.4

## 0.3.3

### Patch Changes

- Prepare a patch release for the latest framework fixes, math-rendering hardening, and packaging safety improvements.
- Updated dependencies
  - @pie-players/pie-tool-annotation-toolbar@0.3.3
  - @pie-players/pie-tool-answer-eliminator@0.3.3
  - @pie-players/pie-tool-calculator@0.3.3
  - @pie-players/pie-tool-graph@0.3.3
  - @pie-players/pie-tool-line-reader@0.3.3
  - @pie-players/pie-tool-periodic-table@0.3.3
  - @pie-players/pie-tool-protractor@0.3.3
  - @pie-players/pie-tool-ruler@0.3.3
  - @pie-players/pie-tool-text-to-speech@0.3.3
  - @pie-players/pie-tool-theme@0.3.3

## 0.3.2

### Patch Changes

- @pie-players/pie-tool-annotation-toolbar@0.3.2
- @pie-players/pie-tool-answer-eliminator@0.3.2
- @pie-players/pie-tool-calculator@0.3.2
- @pie-players/pie-tool-theme@0.3.2
- @pie-players/pie-tool-graph@0.3.2
- @pie-players/pie-tool-line-reader@0.3.2
- @pie-players/pie-tool-periodic-table@0.3.2
- @pie-players/pie-tool-protractor@0.3.2
- @pie-players/pie-tool-ruler@0.3.2
- @pie-players/pie-tool-text-to-speech@0.3.2

## 0.3.1

### Patch Changes

- @pie-players/pie-tool-annotation-toolbar@0.3.1
- @pie-players/pie-tool-answer-eliminator@0.3.1
- @pie-players/pie-tool-calculator@0.3.1
- @pie-players/pie-tool-theme@0.3.1
- @pie-players/pie-tool-graph@0.3.1
- @pie-players/pie-tool-line-reader@0.3.1
- @pie-players/pie-tool-periodic-table@0.3.1
- @pie-players/pie-tool-protractor@0.3.1
- @pie-players/pie-tool-ruler@0.3.1
- @pie-players/pie-tool-text-to-speech@0.3.1

## 0.3.0

### Minor Changes

- Adopt monorepo-wide fixed versioning and establish the first lockstep release train at 0.3.0.

### Patch Changes

- 9385ce0: Release all publishable packages in the repository.

  This intentionally triggers a full patch release sweep across all non-private workspace packages.

- Updated dependencies
- Updated dependencies [9385ce0]
  - @pie-players/pie-tool-annotation-toolbar@0.3.0
  - @pie-players/pie-tool-answer-eliminator@0.3.0
  - @pie-players/pie-tool-calculator@0.3.0
  - @pie-players/pie-tool-theme@0.3.0
  - @pie-players/pie-tool-graph@0.3.0
  - @pie-players/pie-tool-line-reader@0.3.0
  - @pie-players/pie-tool-periodic-table@0.3.0
  - @pie-players/pie-tool-protractor@0.3.0
  - @pie-players/pie-tool-ruler@0.3.0
  - @pie-players/pie-tool-text-to-speech@0.3.0

## 0.1.2

### Patch Changes

- beffcc0: Release all publishable packages.
- Updated dependencies [beffcc0]
  - @pie-players/pie-tool-annotation-toolbar@0.1.10
  - @pie-players/pie-tool-answer-eliminator@0.2.10
  - @pie-players/pie-tool-calculator@0.1.10
  - @pie-players/pie-tool-graph@0.1.10
  - @pie-players/pie-tool-line-reader@0.1.10
  - @pie-players/pie-tool-periodic-table@0.1.10
  - @pie-players/pie-tool-protractor@0.1.10
  - @pie-players/pie-tool-ruler@0.1.10
  - @pie-players/pie-tool-text-to-speech@0.1.10
  - @pie-players/pie-tool-theme@0.1.10

## 0.1.1

### Patch Changes

- 71a9581: Update publishing documentation and regenerate custom element inventory to reflect current custom element registration entrypoints and publishable package scope.
- Updated dependencies [71a9581]
  - @pie-players/pie-tool-annotation-toolbar@0.1.9
  - @pie-players/pie-tool-answer-eliminator@0.2.9
  - @pie-players/pie-tool-calculator@0.1.9
  - @pie-players/pie-tool-color-scheme@0.1.9
  - @pie-players/pie-tool-graph@0.1.9
  - @pie-players/pie-tool-line-reader@0.1.9
  - @pie-players/pie-tool-periodic-table@0.1.9
  - @pie-players/pie-tool-protractor@0.1.9
  - @pie-players/pie-tool-ruler@0.1.9
  - @pie-players/pie-tool-text-to-speech@0.1.9
