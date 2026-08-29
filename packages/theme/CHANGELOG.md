# @pie-players/pie-theme

## 0.3.70

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.69

### Patch Changes

- 01eb0f9: Add `--pie-section-player-card-header-background-dark`, a card header fill applied under dark themes. A host whose brand tint is legible on a light card gets a near-white title on that same tint once a dark theme is active; this is the hook for giving the dark theme its own fill. It falls back to `--pie-section-player-card-header-background` when unset, so a host that sets only the light hook is unaffected. The passage card bridges the dark value to `--pie-passage-header-background` as well, so a hosted passage-player follows. Dark is detected with the same selectors the theme package writes its dark tokens under: `[data-theme="dark"]` on an ancestor, or `pie-theme[theme="dark"]`.
- 8bb668b: Add a separately packaged GeoGebra calculator suite with provider, full tool,
  inline trigger, tests, documentation, and a section-player demo. Basic requests
  map to GeoGebra Scientific, while scientific and graphing use their matching
  embedded apps.
  
  Move calculator lifecycle and UI into a provider-neutral shared package, keep
  vendor settings in their implementation packages, and select implementations
  through the same `provider.init`, `provider.runtime`, and `settings` schema.
  Desmos remains the no-configuration default and preserves its unkeyed legacy
  load and runtime `proxyEndpoint` initialization for existing clients. The
  packaged composition selects the GeoGebra element and lazy bundle from the same
  provider config used by the toolkit.
  
  Document that PIE bundles only MIT-licensed adapter code, not either vendor
  application. Clarify the separate Desmos and GeoGebra license obligations,
  runtime credential boundary, attribution, and self-hosting restrictions.
- 3deb7a2: Stop driving the split-pane pane backdrop from `--pie-passage-header-background` and read the canonical `--pie-background-dark` directly. The pane rule is a grouped selector covering the items pane as well, so a host that set the passage header hook to color a hosted passage-player's header also repainted both pane backdrops — including a pane that holds no passage header. `--pie-background-dark` is what the panes already resolved to whenever the hook was unset, so appearance is unchanged. The backdrop deliberately gets no pane-specific hook: it stays with the theme. `--pie-passage-header-background` keeps its documented job, the passage card bridging it to `--pie-section-player-card-header-background`.
- 3017425: Publish the light Base Theme's `--pie-background` as opaque `#ffffff`.
  
  It shipped as `rgba(255, 255, 255, 0)` from the first commit so PIE content revealed whatever surface the host painted behind it. The cost outgrew the capability: components across `pie-players`, `pie-lib` and `pie-elements` read the token as an opaque surface fill, which produced see-through dropdown menus and bleeding passage headings (PIE-940, PIE-853), and the token registry itself describes it as a page *or component surface* background that component hooks may fall back through. Two declared contrast relationships, the annotation underline and the annotation toolbar boundary, were permanently `contrast-unmeasurable` because their effective contrast depended on a backdrop the theme could not see; both are certified now, and `parseOpaqueColor` no longer special-cases the value.
  
  `--pie-background` remains the page token. A host that wants its own surface to show through PIE content sets the token itself, which is the same override any other palette change uses. Hosts already setting it opaque, or painting an opaque surface behind PIE content, see no change — the value they resolve is unchanged in the dark base theme and in all ten colour schemes, which set it explicitly.
  
  The change reaches the element repos with no edit there. `pie-lib` resolves `color.background()` to `var(--pie-background, …)` and every use of its own transparent default is that fallback rather than a literal, so roughly 150 call sites across `pie-lib` and `pie-elements` follow the theme, the inline-dropdown menu among them. `pie-lib`'s default still applies wherever PIE elements render with no `<pie-theme>` mounted.
  
  Surfaces should still resolve through a surface role — `--pie-white`, `--pie-background-dark`, `--pie-dropdown-background`, `--pie-secondary-background` — rather than through the page token, since a host may point `--pie-background` anywhere. Component comments and docs that justified avoiding it by its transparency now state that role reason instead.

## 0.3.68

### Patch Changes

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
- 89688fc: Make the font size presets scale the players that actually render items.
  
  `font-sizes.css` shipped, was exported, and scaled nothing this repo renders. Its
  rules targeted only `pie-player`, the externally loaded item wrapper some hosts
  render items through — so the section player's own content hosts
  (`pie-item-shell`, `pie-passage-shell`) and the standalone `pie-item-player` were
  never matched. The miss was invisible from the outside: `--pie-font-scale`
  resolved correctly at every preset, and no rule consumed it.
  
  Selecting a preset was worse than not selecting one. The stylesheet forced
  `font-size: inherit !important` onto `*`, which collapses every heading, `<small>`
  and superscript in an item to body size — at 100% scale, before any accommodation
  takes effect. That blanket rule is gone; text now inherits from the content host,
  so elements keep their own relative sizing.
  
  No consumer was hit by that. Every rule in the file is scoped under a
  `data-font-size` attribute and no recorded host sets it, so all three take only its
  `:root { --pie-font-scale: 1 }` default today — which is also why changing these
  rules is safe while renaming the file would not be. The consumer pad now records
  that asymmetry.
  
  The rules are scoped under `[data-font-size]` so the declarations exist only once
  a host opts in, and no rule uses `!important` — a host has to be able to win
  through the normal cascade, which is why `pie-theme`'s base-theme adapter already
  keeps its own specificity low.
  
  The four presets are unchanged (1 / 1.25 / 1.5 / 1.75, Learnosity's steps), and
  so is the `data-font-size` contract. A host driving `<pie-theme>` can set
  `--pie-font-scale` through `variables` instead and needs nothing from the
  stylesheet.
  
  What scales is inherited text, because `font-size` inheritance crosses shadow
  boundaries. What does not is text whose own rule names `rem` or `px`: `rem`
  resolves against the document root, `px` against nothing, and no rule inside a
  subtree can change what either means. A host that needs those to follow scales
  the root font size itself. That is documented rather than worked around, and
  browser zoom is unaffected either way, so WCAG 2.2 1.4.4 does not rest on this.
  
  The scale is applied as `calc(1rem * var(--pie-font-scale))` rather than an `em`
  factor because the content hosts nest — an `em` factor compounds, and a requested
  1.25 renders as 1.56 wherever an item shell sits inside a themed region.
  
  No student-facing control ships here. Per PIE-478's own discussion the picker is
  host chrome; this package owns the token, the presets, and the rules that consume
  them. Nothing claims the `fontEnlargement` or `resizeText` PNP support ids yet
  either — a support id is claimed by a capability registration, and there is no
  capability to hang it on until the ownership question that story raises is
  settled.
- c9e3404: Resolve provider variables from the theme being applied, so a theme change
  reaches `--pie-*` on the first pass.
  
  `<pie-theme>` read its provider before the new theme reached the target.
  Provider adapters resolve by reading custom properties off that target —
  daisyUI's `--color-*`, selected by `data-theme` — so a read taken while the
  target still carried the outgoing theme returned the outgoing palette, and those
  values were written as the new PIE token set. Every `--pie-*` landed one
  selection behind.
  
  Nothing corrected it afterwards. A host that writes only the attributes that
  changed triggers one `attributeChangedCallback`, so the stale set stood until an
  unrelated attribute moved, and switching again showed the theme before that one
  rather than catching up. The visible result is an app whose own chrome repaints
  instantly — daisyUI reads `data-theme` directly — while PIE content keeps the
  palette of the theme the user just left.
  
  The same read ran on first connect, where the target may carry no `data-theme`
  at all and the provider resolves from whatever the page happens to inherit. A
  host that stamps its stored theme before hydration escaped that; one that leaves
  the first stamp to the element did not.
  
  The incoming `data-theme` and `data-color-scheme` are now stamped on the target
  before the read and restored immediately after. Restoring rather than leaving
  them keeps two contracts intact: under `scope="document"` the ownership
  arbitration decides whether this element may stamp at all, and the document
  baseline needs the host's pre-existing value to have something to restore on
  disconnect. Stamp and restore happen in one synchronous pass, so the transient
  state is never painted.
  
  `scope="self"` gains the behaviour it should always have had: a self-scoped host
  resolves its own theme's palette rather than the ambient one, because the probe
  stamps `data-theme` on the element the provider's rules match. A host with no
  provider is unaffected — under `provider="none"`, or on a page with no daisyUI
  palette, nothing resolves either way.
- 9d3c500: Remove `@pie-players/pie-theme-daisyui`. The DaisyUI integration is the provider
  adapter in this package, and was already the only part of it that worked.
  
  The package shipped `bridge.css` — the same slot mapping as static CSS on
  `:root, [data-theme]`, for a host wanting DaisyUI tokens without `<pie-theme>` —
  plus three JS mappers over the same table. `<pie-theme scope="document">` writes
  `--pie-*` as inline styles on the target, and `bridge.css` declared them in a
  stylesheet with no `!important`, so inline won: every host that imported it also
  mounted the element, which made the import inert. The JS mappers had no consumer
  in this repo or in any host we read.
  
  Nothing is lost that a host was using. The adapter resolves the same
  `DAISYUI_PIE_TOKEN_MAP`, and it is the side that can correct a slot which lands
  illegible, because it reads resolved colours through a canvas measure — the
  correction static CSS could never make. The parity test that held the two copies
  together goes with the copy; the assertions that were about the table rather than
  the CSS already live in `packages/theme/tests/daisyui-mapping.test.ts`.
  
  A host wanting the zero-`<pie-theme>` path aliases DaisyUI's variables to
  `--pie-*` in its own stylesheet — the same twenty lines any non-DaisyUI design
  system needs, and the only shape that also reaches host chrome under
  `[data-color-scheme]`.
  
  Published versions stay on npm, so a range pointing at the package still
  resolves; it stops receiving releases. One host still declares the dependency
  without importing it and should drop it.
- 5a13755: Stamp `color-scheme` from a resolved colour scheme, so native controls follow the
  accommodation instead of the host's theme.
  
  A scheme replaces every colour it participates in, but nothing in CSS infers
  polarity from custom properties. UA-styled controls — `input` and `select` text,
  scrollbars, native form widgets — paint from `color-scheme`, which stays whatever
  the host's theme declared, because a scheme changes `data-color-scheme` and never
  `data-theme`. A dark accommodation on a light host therefore renders those
  controls in the light-mode system colour: measured at roughly 1.1:1 for two
  version pickers on a `yellow-on-blue` page, black text on `#000066`. An
  accommodation that leaves a control unreadable has not been delivered.
  
  `resolvePieTheme` now reports the keyword the palette implies as
  `ThemeResolution.colorScheme`, and `<pie-theme>` writes it to the target. Chosen
  by whether black or white contrasts better against the resolved
  `--pie-background`, which is the same test that picks a legible foreground
  elsewhere in this package.
  
  Only a resolved scheme decides it. Without one — including a requested scheme
  that turned out unavailable — the value is `null` and the host keeps ownership,
  because a host's stylesheet already declared the polarity of its own themes and
  restating that from PIE's base palette would take the decision away from every
  host that never asked for an accommodation. `null` restores rather than removes,
  so clearing a scheme returns the host's own declaration instead of deleting it,
  tracked through the same document baseline that already carries `data-theme`.
  
  A background the resolver cannot read as an opaque colour also yields `null`: a
  translucent value, a `var()` reference out to a host property, or the transparent
  light base leave polarity dependent on the host's backdrop, which makes it the
  host's call rather than a guess.
- e0f1134: Document and prove SchoolCity colour-scheme parity as host registration.
  
  The SchoolCity parity report records "15 schemes against PIE's 10" as the
  remaining delta on PIE-472, which reads as eleven missing palettes. It is not one
  change of that size, and measuring it settled the shape: four of SchoolCity's 15
  are already built in (Black on White, White on Black, Black on Rose, Yellow on
  Blue), and the other eleven are registrable by a host today with no change here.
  
  Adds a validated worked example, one scheme per cost class, and a README section
  carrying SchoolCity's own palette values. The cost is the finding: it scales with
  how far the background sits from white, because every semantic colour in the light
  base was chosen against white. A white-background scheme needs 2 tokens. Green on
  White needs 4 — its ink is the tightest of the set at 4.73:1 and misses the tinted
  recessed surfaces. Pure black needs 10, borrowed from the dark base theme, which
  authored its inks against `#000000` already. A mid-tone background — blue, red,
  green, dark gray — needs about 18, because neither the light inks nor the dark
  ones hold against it and the icons, control boundaries and focus rings all have to
  be re-chosen.
  
  All 15 clear 4.5:1 for ordinary text, so the text pair is never what blocks a
  scheme; the other 24 enforced relationships are.
  
  The example also pins the trap. Contrast diagnostics are warnings rather than
  errors, deliberately, because a registered palette is host-owned — so a two-token
  White on Blue registers successfully and returns fourteen warnings, and a host
  filtering on `severity === "error"` ships cyan links on a mid-blue page. A test
  holds that behavior so it cannot quietly become an error and break a host, or
  quietly disappear.
  
  No new built-in schemes. A built-in is a full 48-token palette because a
  two-colour scheme is a promise the whole surface keeps, and which schemes a
  programme wants is unsettled on PIE-472 — the story was deferred out of the SB v1
  scope with its requirements still open, so eleven authored palettes would be
  speculation with a published surface attached.
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

## 0.3.67

### Patch Changes

- 73d2be4: Dim an eliminated choice on both strike paths, not only the fallback one.

  The dim was declared twice, and neither copy reached the path most learners are
  on. `components.css` carried it on `.pie-answer-eliminator-eliminated-fallback`, a
  class the strategy adds only when `CSS.highlights` is missing. The strategy's own
  injected rule carried it inside `::highlight(...)`, where a highlight pseudo
  honours only colour, background, text-decoration and text-shadow — so the
  declaration parsed and painted nothing. Every browser with the CSS Custom
  Highlight API shipped the strike as the sole cue for elimination.

  The dim now hangs off `[data-pie-answer-eliminated="true"]`, which both paths set
  on the choice container, and the inert declaration is gone from the injected rule.
  Redundant coding is the point: elimination has to survive a strike colour a
  learner cannot distinguish from the text.

- 73d2be4: Correct the answer-eliminator toggle's size, which the move to `em` overshot.

  The toggle is specified at 28px with an 18px glyph on a 16px base, and going to
  `em` was meant to keep those numbers while letting PNP font scaling carry them.
  It did not: `width: 1.75em` sits on the same rule as `font-size: 1.125em`, and
  `em` in a length resolves against the element's own font-size rather than the
  parent's, so the box measured 31.5px — 12.5% over spec, with the comment above it
  asserting otherwise.

  The box now divides by the glyph factor, `calc(1.75em / 1.125)`: 28px at a 16px
  base, still past SC 2.5.8's 24px minimum at the smallest base PNP offers, and
  still scaling linearly with the surrounding text. The test pins the resolved size
  rather than the unit, since the unit was never the thing at risk.

## 0.3.66

### Patch Changes

- e8a6f0e: Add `--pie-content-emphasis` and take `.content-emphasis` from it.

  The previous fix mixed 65% red toward `--pie-text`, on the strength of two
  measurements. Sweeping all 35 shipped themes showed that was not enough: the mix
  falls under SC 1.4.3's 4.5:1 on seven of them, and lands at 2.91:1 on `aqua`.
  Lowering the red share does clear every theme, but only at 25%, where the colour
  is no longer recognisably the red the content author chose.

  The token is mapped from the DaisyUI error slot through the same `legible`
  correction `--pie-incorrect` uses, which is the one construction that clears
  4.5:1 against the page on all 35 — measured, not assumed. Its base-theme values
  are a red chosen for the same bar (7.4:1 on the light page, 7.3:1 on the dark
  one), and each built-in colour scheme mirrors the red it already declares for
  `--pie-incorrect`.

  A canonical entry rather than a package-private hook: authored content is host
  content, so which red emphasis takes is a host decision, and the value has to
  participate in colour schemes.

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

- 6bbfae1: Resolve DaisyUI's palette to PIE tokens a learner can see, from one table instead
  of four copies.

  The same 47-row slot-to-token table was written out four times: the provider
  adapter in `@pie-players/pie-theme`, `mapDaisyThemeToPieVariables` and
  `mapResolvedDaisyThemeToPieVariables` in `@pie-players/pie-theme-daisyui`, and that
  package's `bridge.css`. Two defects lived in the drift between them, and the parity
  test meant to catch drift compared only which token names each copy declared, never
  which slot a token derived from.

  `DAISYUI_PIE_TOKEN_MAP` in `pie-theme` is now the single table, and one renderer
  serves all three JS mappers. `bridge.css` cannot import it, so the parity test now
  holds it to the table expression by expression. Three copies of the table are gone.

  ## An unanswered question was painted as a wrong one

  `--pie-missing` and `--pie-incorrect` both resolved to `--color-error`, so under
  every DaisyUI theme an unanswered question and a wrong one were the same colour.
  `--pie-missing` now takes `--color-warning`, the mapping the rest of PIE already
  declares: pie-elements-ng keys it to `warning`, and the assessment toolkit's
  `.pie-warning` rule paints it.

  ## Feedback marks and control boundaries were unreadable

  DaisyUI's semantic slots are background colours — `--color-success` is chosen to
  sit behind `--color-success-content` — while PIE paints `--pie-correct`,
  `--pie-incorrect` and `--pie-missing` as `color:`. Taken verbatim, the correct mark
  measured 1.26:1 against the page under `acid` and 1.96:1 under `light`, against SC
  1.4.3's 4.5:1.

  `--pie-border` and `--pie-button-border` have the same shape of problem against SC
  1.4.11's 3:1. They map to `--color-base-300`, a surface tint, so a boundary painted
  with it sits between 1.09:1 and 1.53:1 across the shipped themes. What makes that a
  defect rather than a subtle divider is that `--pie-button-bg` resolves to
  `--color-base-100`, the page's own colour: for a toolbar button, an answer-eliminator
  toggle, or the inline TTS control, that border is the only thing separating the
  control from the page behind it. `--pie-border-dark` is corrected too, since
  `--color-neutral` collapses to 1.09:1–1.85:1 against the page in dark themes, taking
  the graph tool's grid lines with it.

  The repo already had one component routing around this: the annotation toolbar was
  given its own contrast-checked border token because, as the note in
  `color-schemes.css` puts it, `--pie-border` "carries a surface tint that leaves the
  outline at ~1.1:1". Correcting the token means the next component does not need its
  own escape hatch.

  The selected button surface had the related inverse problem. DaisyUI chooses
  `--color-base-content` against `--color-base-100`, but PIE also paints it on
  `--pie-button-active-bg`. Under `valentine`, the direct `--color-base-300` mapping
  left selected picker text at 4.17:1. The active background now keeps 70% of that
  deeper tint and mixes toward `--color-base-100`, the nearest 5% step that clears
  4.5:1 across the shipped DaisyUI themes. The public PIE token and cascade stay the
  same; only the inaccessible provider-derived value is corrected.

  The feedback and boundary corrections go through `legibleColorAgainst`: they
  leave a slot untouched when it already clears its minimum against
  `--color-base-100`; otherwise they use the largest 5% share that passes, mixed
  toward `--color-base-content`. Mixing toward the theme's own text colour borrows
  the theme's guarantee — base-content is what that theme chose to be readable on
  that surface — so one code path lightens a mark in a dark theme and darkens it in
  a light one. Stepping down from the top keeps as much hue as the threshold allows:
  36 of the 84 theme/slot feedback combinations need no correction and keep their
  exact colour.

  `--pie-border-light` is deliberately left alone. It is the token the players use for
  card edges and pane dividers, which 1.4.11 exempts, and a 3:1 outline around every
  item card would be a visual regression rather than a fix. The `-secondary` tints are
  untouched for the same reason: they are fills, and what has to contrast with them is
  the text on top.

  ## Measuring

  Contrast is measured by painting one pixel on a canvas and reading it back. DaisyUI
  5 resolves its palette in `oklch()`, and an oklch-to-sRGB implementation in this
  package would be a second opinion about colours the browser has already decided.

  Where the values are not measurable colours — `mapDaisyThemeToPieVariables` emits
  `var()` references, `bridge.css` is static CSS, and a server render has no canvas —
  the correction falls back to a fixed hue share: 30% for the 4.5:1 targets and 35%
  for the 3:1 ones, each the largest 5% step that clears its threshold for every
  affected slot in all 28 shipped themes. Deliberately pessimistic: a slot that needed
  no correction still gets pulled most of the way to the text colour.

- 1e0c10f: Collapse fixed component hues into the palette under a colour scheme.

  A component sometimes paints a hue the palette does not own: the periodic
  table's element cells encode category as a fixed pastel. Pinning their ink made
  them legible under a dark theme, but a colour scheme is a two-colour promise,
  and a pastel field ignores it — a learner on yellow-on-blue got a pastel grid.

  `--pie-fixed-hue-collapse` is the share by which such a hue folds into the
  palette. A component mixes its own value towards `--pie-background-dark` and
  `--pie-text` by this share, so `0%` renders the authored hue exactly and `100%`
  removes it. Base Themes set `0%`; every built-in colour scheme sets `100%`, and
  a registered custom scheme collapses without declaring anything, because it is a
  palette a host chose for a learner. A scheme that wants a hue encoding kept sets
  `0%` itself.

  Both ends of the mix are exact, so a Base Theme renders the periodic table byte
  for byte as before. Under a scheme its cells take the scheme's recessed surface
  and ink — measured across all ten built-ins, 5.44:1 at worst and 19.26:1 at best
  — and the cell edge takes `--pie-border`, which the palette corrects to 3:1,
  because collapsed fills sit on the panel at about 1.1:1 and can no longer
  separate themselves. Category then lives where it does not depend on hue: the
  badge row filters by it, the selected-element panel names it, and each cell's
  accessible name carries it.

  Sweeping those ten also cost the cell's secondary text its opacity. Fading the
  atomic number, name and mass spent contrast the palette cannot always afford: at
  0.8 the atomic mass measured 4.12:1 under grey-on-light-grey and 4.00:1 under
  purple-on-light-green, whose ink and recessed surface hold only 6.46:1 and 5.44:1
  before anything is faded. Size and weight carry the hierarchy instead, which also
  lifts the worst pairing under a Base Theme from 6.01:1 to 8.99:1.

  `--pie-text` against `--pie-background-dark` is now a certified contrast
  relationship, since that pair is where a collapsed hue lands. Every built-in
  palette already clears it; a custom scheme that does not now warns.

- e8a6f0e: Prune the shipped content stylesheet: remove what could not be made accessible,
  tweak what could.

  Removed. A `#stimulus` / `#item` pair of 50%-wide left floats hard-coded a
  two-column layout keyed to two global ids: it cannot reflow at a
  320px-equivalent width (SC 1.4.10), and being id-based it applied to any element
  in the host document carrying either id. A `.lrn_feature h3` margin override and
  `.lrn_width_auto.table` styled a third-party product's markup that PIE does not
  render. None of the three had a correct form here.

  Tweaked. The heading reset dropped `font-weight: 500`, which flattened every
  authored heading to lighter-than-bold and weakened the visual hierarchy that
  mirrors the heading level. The answer-eliminator toggle moves from a fixed 28px
  box with an 18px glyph to `1.75em` / `1.125em`: PNP font scaling raises the
  surrounding text without touching px boxes, so the control used to stay put while
  its context grew — the em values are the same size at the default 16px base and
  stay past SC 2.5.8's 24px minimum for any base at or above 14px. The centred
  `.block-quote`, `.text-block` and `.equation-block` keep their 20% gutters on a
  wide viewport but drop them below 30rem, where they otherwise left a ~190px
  column.

  Kept deliberately: the MathJax `font-family` overrides, `.text-center`'s
  `!important`, and the bare `table` / `th` normalisation that authored tables
  depend on.

- a4beb70: Two additions a host needs to explain a resolved theme to a person: the token registry becomes a package export, and `provider="none"` becomes a supported mode.

  ## `@pie-players/pie-theme/token-registry.json`

  The registry already answers "what is this token for, and who owns it" for all 84 `--pie-*` names — owner, scope, category, status, fallback policy — and `check:theme-tokens` holds it against source on every commit. It was internal, so a host wanting to show that answer had to derive grouping from token names or keep its own list, and both drift the moment a token is added here.

  Exported as the JSON itself rather than a wrapper, matching how the stylesheets are exported, with `PieThemeTokenRegistryEntry` from the root entry point to type the import. `tsc` does not emit files it did not compile, so the build copies the JSON into `dist` alongside the CSS; a test pins the export entry, the copy step and `files`, because an export pointing at a file the build forgot resolves to a 404 for every consumer and nothing else would catch it.

  ## `provider="none"`

  `auto` lets any registered adapter that can read the target win, which on a DaisyUI page means PIE tokens follow `--color-*`. `none` resolves nothing and leaves the shipped defaults, which is how a host reproduces the palette it had before adopting a provider — the first thing to check when colours differ between two environments.

  Naming an unregistered provider already landed in the same place, by accident and undocumented. The mode short-circuits ahead of both the registry lookup and the document-element retry, since that retry exists so a subtree host inherits a themed page and would otherwise put the provider's values straight back. `unregisterPieThemeProvider` cannot take it away, because it is not in the registry at all.

  `PIE_THEME_PROVIDER_NONE` is exported for hosts that would otherwise hardcode the string.

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

- c16c77c: Mark eliminated answer choices that are not made of text: an X over images, and a
  line-through over rendered math, both in the same strike colour as the text.

  The strikethrough strategy paints with the CSS Custom Highlight API, which — like
  `text-decoration` — only draws on text. An answer choice whose content is a
  picture therefore looked completely untouched after being eliminated: the student
  got a pressed toggle button and nothing else.

  Images are replaced elements, so they cannot carry a pseudo-element either. Each
  `img` in an eliminated choice is now wrapped in a positioned
  `span.pie-answer-eliminator-image-strike` that hosts an absolutely-positioned SVG
  overlay drawing two diagonals corner to corner — upper-left to lower-right and
  lower-left to upper-right — for a big X over the whole image. Wrapping (rather
  than measuring and re-positioning an overlay) keeps the X glued to the image
  through later reflow: responsive resizing, a late image `load`, zoom.

  The wrapper preserves the image's own box: a fluid image that already spans its
  parent gets a block wrapper, a block-level image gets a `fit-content` block
  wrapper so it stays on its own line at its own width, and the wrapper's line box
  is collapsed so no descender gap lets the X overhang the artwork. Restoring the
  choice unwraps the image and returns the DOM to its original shape.

  The overlay is `aria-hidden` and `pointer-events: none` — the eliminated state is
  already announced on the label — and each diagonal is painted over a wider light
  casing line (`--pie-answer-eliminator-image-strike-casing-color`) so the X clears
  3:1 (SC 1.4.11) over dark artwork.

  ## Rendered math

  Math had the same problem for a different reason. MathJax's CHTML output draws
  every visible glyph as an `mjx-c` element with empty `textContent` — the character
  comes from `::before` generated content, which belongs to no Range — and its SVG
  output has no text at all. The highlight was painting only MathJax's
  `mjx-assistive-mml` copy of the source MathML, which is clipped to 1px, so a
  math-only choice looked identical to an un-eliminated one.

  For each `mjx-container` in an eliminated choice, the inner `mjx-math` box is now
  marked with `pie-answer-eliminator-math-strike` and painted by the theme. The
  rendered math box is an ordinary element, so this needs only a class and a
  pseudo-element — no wrapper, and MathJax's own layout is untouched.

  Which mark depends on the shape of the expression. A single row of symbols takes
  the centred line-through the prose takes. An expression that draws horizontal
  rules of its own — a fraction bar, a table rule — takes the diagonals an
  eliminated image takes, because a centred line lands on the math axis, exactly
  where the fraction bar already sits, and reads as a recoloured bar rather than an
  elimination. The split is structural (`mjx-mfrac`, `mjx-mtable`) rather than
  height-based: an inline `a/b` is only 1.16x its font size, indistinguishable in
  height from a radical (1.17x) or a parenthesised row (1.10x), yet it is precisely
  the colliding case. Radicals and stacked limits keep the line — their bars sit at
  the top, or the strike simply crosses the base.

  The paint target is the inner `mjx-math`, not the container: for inline math
  `mjx-container` is `display: inline`, so its rect is the surrounding line box — a
  constant ~1.16x font size whatever it holds — while the expression overflows it,
  a fraction by 3px above and 8px below. Painting the container both mismeasured
  the expression and drew the line in the wrong place.

  Only MathJax containers are marked. Natively rendered MathML keeps real text in
  `mi`/`mn`/`mo`, so the highlight already strikes every token there, and marking it
  too would double the line over one expression.

  ## One strike colour

  Text, images, and math all read `--pie-answer-eliminator-strike-color` (defaulting
  to `--pie-incorrect`), so a choice mixing prose, pictures, and math reads as a
  single treatment rather than three, and a host can restyle every part of an
  elimination from one property.

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

## 0.3.64

### Patch Changes

- dc44392: Make the frame's masking a host setting rather than a student one. How much surrounding context a test taker can still see trades against reading focus, which is a decision a programme makes for its whole population, so `--pie-tool-line-reader-frame-opacity` is now the only way to change it: the keyboard-only `[`/`]` adjustment — undiscoverable to anyone not reading the tool's aria-label, and with no pointer equivalent — is gone, and the component no longer writes the opacity inline, so a host declaration wins without `!important`.

  Promote the frame's masking properties to registered host contract. `--pie-tool-line-reader-frame-opacity`, `--pie-tool-line-reader-frame-color`, and `--pie-tool-line-reader-control-color` are now `component-public` entries in `packages/theme/src/token-registry.json` instead of package-private internals, since a deployment is expected to configure them and needs the compatibility guarantee that carries. The control colour is registered as the fill's companion: the glyphs sit on the frame and default to white for a dark scrim, so a light fill has to set it too and keep 3:1 against the fill. `--pie-tool-line-reader-outline-color` stays package-private.

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

## 0.3.63

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

- c73c995: Add four built-in accessibility color schemes: Grey on Light Grey, Purple on Light Green, Black on Violet, and Yellow on Navy.

  Each scheme ships in both places a scheme has to exist to be usable:

  - a `[data-color-scheme="<id>"]` block in `color-schemes.css`, setting the full
    token set (text, primary/secondary/tertiary, backgrounds, borders, focus, and
    correct/incorrect/missing states) so a host can activate it with the attribute
    alone.
  - a `BUILTIN_PIE_COLOR_SCHEMES` entry in `color-schemes.ts`, carrying the
    variables a scheme applies programmatically plus the `preview` swatch trio
    (`bg`, `text`, `primary`) that scheme pickers render.

  Purely additive: the six pre-existing schemes are untouched, and a host that
  sets no `data-color-scheme` is unaffected.

- 14666b3: Install the shared PIE content stylesheet from the player instead of requiring hosts to import it.

  `@pie-players/pie-theme/components.css` holds classes that authored content depends on but no component owns: passage markup (`.numbered-paragraph`, `.p-number`, `div.passage-title`), the legacy `kds-*` families, and the `pie-answer-eliminator-*` styles. `PieItemPlayer.svelte` already imported that stylesheet, but in this package's Vite library build a plain CSS import is extracted to `dist/assets/pie-item-player.css` — a file nothing loads at runtime and no `exports` entry exposes. The import was a silent no-op, so hosts rendered authored passages unstyled unless they happened to import the stylesheet themselves, which was documented nowhere.

  `@pie-players/pie-item-player` now inlines the stylesheet as text (`?raw`) and installs it once per document at import time, alongside custom-element registration, so it is in place before any instance renders. The separately importable session-debugger entry installs it too. The orphaned `dist/assets/pie-item-player.css` is no longer emitted. `@pie-players/pie-section-player` and `@pie-players/pie-assessment-player` are covered transitively, since they render items through the item player.

  The stylesheet is prepended to `<head>` and deliberately left unlayered, so host CSS that loads later still wins at equal specificity — the placement hosts were previously told to arrange by hand. A cascade layer would have been wrong here: unlayered author declarations beat all layered ones regardless of specificity, so a host reset as broad as `p { margin: 0 }` would have silently outranked `.numbered-paragraph { margin-left: 36px }`.

  Hosts that want to own the stylesheet can set `<html data-pie-content-styles="host">` before the player script runs; the player then installs nothing and warns once if no content stylesheet turns out to be present. `components.css` declares `--pie-content-styles` on `:root` as the presence sentinel behind that check.

  Upgrading hosts do not have to remove an existing `import "@pie-players/pie-theme/components.css"` for this release to be correct: installation is idempotent, and two matching copies render identically. But a host copy loads later than the installed one and therefore wins ties at equal specificity, so a host copy pinned to an older `@pie-players/pie-theme` would silently override newer player rules. Rather than leave that to be discovered, the players now log a one-time warning naming the redundant import when they detect a second copy in the document.

  `@pie-players/pie-print-player` installs it the same way, from its `src/index.ts` entry. This player never told hosts to import the stylesheet at all, so it had no working route to these styles. The gap is worse than a cosmetic one here: `components.css` owns `@media print { .noprint, .kds-noprint { display: none } }`, so a missing copy did not just render authored passage markup unstyled — it printed content the author had marked as non-printing. Nothing in the package strips authored classes on the way through; `processMarkup` swaps only the interactive element tags and returns the surrounding markup verbatim, and `pie-print` renders into light DOM (`createRenderRoot()` returns `this`), so a document-level stylesheet is the only thing that can reach that content.

  New in `@pie-players/pie-players-shared`: `installContentStyles`, `contentStylesPresent`, `contentStylesOptedOut`, `auditContentStyles`, plus a narrow `@pie-players/pie-players-shared/ui/content-styles` export. Print player imports through that subpath rather than the package root, because players-shared declares `sideEffects: true` and print player externalizes nothing — the root barrel would have bundled all of players-shared into `print-player.js`.

  Hosts that already import `@pie-players/pie-theme/components.css` need no change — installation is idempotent and a duplicate host copy simply wins on document order.

- 99929d8: Move debugger panel styling out of the shared content stylesheet and into the panels that own it.

  `components.css` carried a `SECTION PLAYER DEBUGGER OVERLAYS` block styling the PNP
  and session debugger panels. That file is for authored-content classes no component
  owns, so panel-private rules did not belong in it, and the split was already
  inconsistent: each panel defined most of its own classes locally and left a handful
  behind.

  Those rules now live in each panel's own `<style>` block. The two classes applied by
  `SharedFloatingPanel` rather than by the panel template — the panel root and
  `__content-shell` — are wrapped in `:global()`, since Svelte would otherwise scope
  them to the panel component and they would match nothing.

  Of the 37 classes in the removed block, 14 were referenced nowhere at all
  (`__header*`, `__title`, `__icon-button`, `__icon-xs`, `__resize-*`) — leftovers from
  before `SharedFloatingPanel` renamed those parts to `pie-shared-floating-panel__*`.
  They were deleted rather than relocated.

  Five panels also dropped a `@pie-players/pie-theme/components.css` import that never
  did anything: these packages build with Vite in library mode, so the import was
  extracted to a `dist` CSS file that the built JS never referenced and that no
  `exports` entry exposed — the same defect fixed for `PieItemPlayer.svelte`. Each
  package now ships one fewer dead file.

  If you import `@pie-players/pie-theme/components.css` directly and relied on the
  `pie-section-player-tools-{pnp,session}-debugger*` classes it used to define, they are
  no longer there; they ship with their panel packages instead.

- c810459: Make the documented active/open trigger hooks work again in the inline TTS tool.

  `README.md` documents `--pie-tool-trigger-active-background`, `-color` and
  `-border-color` as the supported way to style the trigger while its panel is
  open, instead of overriding broad tokens such as `--pie-primary`. The component
  referenced none of them, so a host following the documentation got no effect.
  PIE-727 added these hooks for exactly this control; they were lost in a later
  refactor, and the stale registry metadata pointing at this package is what
  surfaced it.

  All three now apply while `aria-expanded="true"`, which the markup already
  maintains.

  Each hook falls back to the value the control already resolves to, so setting
  none of them leaves the trigger looking identical open and closed. That is
  deliberate: unlike the calculator's equivalent hooks, this trigger has never had
  a filled active look — the panel opening is itself the state indication — and
  introducing one would restyle a shipped control for every host. The README
  previously claimed the unset default derived from `--pie-primary`, which had
  never shipped here; it now describes the actual fallbacks.

  Verified in Chromium by comparing the three properties as sRGB bytes rather than
  as computed-style strings, since routing an identical value through one more
  `var()` layer changes the colour space Chromium serialises to. With the hooks
  unset, open matches closed exactly. With them set, all three take effect, and
  they stop applying once `aria-expanded` goes false.

  The token registry regains this package in `definedIn` for the three hooks.

## 0.3.61

## 0.3.60

## 0.3.59

## 0.3.58

## 0.3.57

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.56

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.55

## 0.3.54

## 0.3.53

### Patch Changes

- ee6c081: Add the initial PIE theme token registry contract, source-usage gate, theme parity checks, compatibility fallback chains, and broad theming accessibility planning artifacts for safer host theme overrides.

## 0.3.52

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

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.39

### Patch Changes

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.38

### Patch Changes

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

- Temporary release changeset: patch all publishable packages to keep lockstep versions.

## 0.3.30

### Patch Changes

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

## 0.3.1

## 0.3.0

### Minor Changes

- Adopt monorepo-wide fixed versioning and establish the first lockstep release train at 0.3.0.

### Patch Changes

- 9385ce0: Release all publishable packages in the repository.

  This intentionally triggers a full patch release sweep across all non-private workspace packages.

## 0.1.2

### Patch Changes

- beffcc0: Release all publishable packages.

## 0.1.1

### Patch Changes

- 71a9581: Update publishing documentation and regenerate custom element inventory to reflect current custom element registration entrypoints and publishable package scope.
