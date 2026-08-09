# @pie-players/pie-theme

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
