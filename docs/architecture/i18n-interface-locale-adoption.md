# Interface locale adoption

Status: Implemented. This is the design record for the interface locale, rollout
slices 3 and 4 of [`internationalization.md`](./internationalization.md).

This record covers **interface locale** only: the strings the packages in this
repository render themselves, such as toolbar labels, tool panels, player status
and error text, `aria-label`s and debug-panel chrome. It is for contributors
changing the i18n layer. Content language and in-item alternates are separate
concerns on separate channels; [`internationalization.md`](./internationalization.md)
sets out why the three are separate. The
[players-shared i18n README](../../packages/players-shared/src/i18n/README.md) is
the usage guide for hosts and component authors.

[pie-qti](https://github.com/pie-framework/pie-qti) is the reference. PIE takes its
BCP-47 catalog names and its per-locale views, and avoids its reload on locale
change, its published loader that only a Vite build can evaluate, and its hardcoded
`one`/`other` plurals.

## Scope

Every string a player, the assessment toolkit, a tool or a debug panel renders
itself is keyed: the section and item player chrome, the toolbar and tool-shell
chrome, each tool's own UI and announcements, the debug panels, and the tool
display names and descriptions in `default-tool-loaders`.

Developer-facing diagnostics stay in English and out of the catalog: the remaining
`scan-hardcoded` findings are overwhelmingly `throw new Error` messages, log
strings, DOM tag names and CSS identifiers, and the scanner stays advisory.

TTS preview sample text is unlocalized too. It is handed to the voice under test,
so its language follows that voice: Dutch chrome previewing an English voice still
sends English.

## English output

Keying a string does not change it. Fixed lockstep patch-only versioning puts a
reworded label into a host's live delivery on its next install with no signal on
its side, and the strings this work touched are largely accessible names and
live-region announcements, where a host may assert exact text. Every English value
in the adoption commit therefore reproduced the literal it replaced byte for byte,
including its punctuation and its flaws, so that a text change shows up as a text
change and never inside an i18n refactor.

Rewording followed separately, in `67f286ce`. The toolbar button names follow one
rule since: the accessible name contains the button's visible tooltip verbatim, per
WCAG 2.5.3 Label in Name, and encodes no action, because `aria-pressed` carries the
toggle state.

Interpolation cannot assemble a string a language inflects, so a unit name that
appears both as a button label and inside a sentence takes one key per form:
`tools.ruler` carries Title Case for the button and a lowercase in-sentence form
for the announcement, the accessible name and the image alt. A translation is not
obliged to reproduce an English flaw.

## Decisions

**One provider, in `players-shared`.** `players-shared` is already a runtime
dependency of every tool and player, is on the publish policy's `nodeSafe` list,
and owns `i18n/language-tags`. A new package would mean a Changesets `fixed` entry,
build wiring and a dependency edit in 30 packages to deliver one interface and one
catalog.

**One implementation, `SimpleI18n`, rewritten in place.** The layer it replaced had
two implementations that had drifted apart, `SimpleI18n` and the toolkit's
`I18nService` wrapper; a third beside them would repeat that. `SimpleI18n` keeps
its name and its `I18nServiceApi` surface, and the wrapper is gone.

**Catalogs are TypeScript modules.** The English catalog's shape generates the
`MessageKey` union, so a mistyped key is a compile error instead of a key rendered
on screen, which is most of what `check-coverage` would otherwise catch after the
fact. And `tsc` compiles a `.ts` catalog to real JavaScript, so no catalog import
needs the `with { type: "json" }` attribute Node's ESM loader requires; the JSON
catalogs of the replaced layer lacked it on every non-English locale and could not
load under Node.js.

`MessageKeyInput` is that union plus `DynamicMessageKey`, a branded string produced
only by `dynamicMessageKey()`. Two call sites need it: a periodic-table element
category, which a host data file can extend beyond what the catalog enumerates, and
`ToolRegistration.nameKey`, which a host authors against its own catalog. Both pair
it with `hasKey`, so a miss falls back to a literal instead of rendering a key. The
union stays closed: an open `MessageKey | (string & {})` makes every mistyped
literal assignable, which is the failure the union exists to prevent.

**Catalogs are keyed by full BCP-47 tag**, `en-US` and `nl-NL`. That matches
pie-qti's catalog names and what AfA PNP and QTI declare, and makes the POSIX forms
a host sends (`nl_NL`) resolvable. `findBestLanguageMatch` from
`i18n/language-tags` does the resolution, so `nl`, `nl_NL`, `nl-NL` and `NL-nl` all
land on `nl-NL` without a mapping table.

**English is the single source, with no inline English fallbacks.** pie-qti puts
an English literal at each call site, which makes its i18n runtime fully erasable
and costs a bespoke scanner to police drift between literal and catalog. The
opposite trade fits here because a provider always exists: `players-shared`
exports a module-level default whose English catalog is statically bundled, so
`t()` never returns a bare key, even with no host, no player and no context.

**Locale catalogs never enter a tool bundle.** Most tool bundles import
`players-shared` from the host. The item player and the section player's browser
build set `external: []`, and the print player declares no externals, so each
inlines everything it reaches. The module split enforces the boundary either way:
tools import the types as `import type` and the English default from `provider`,
and only players import the dynamic loader map in `catalogs` and the
`createPieI18n()` wiring in `i18n`. A tool therefore pulls in the interface and the
English fallback and never sees `catalogs`, so no locale chunk is emitted into its
`dist`. The README's [Module layout](../../packages/players-shared/src/i18n/README.md#module-layout)
lists each module.

**Interface locale is a composition context, set by one element attribute.** The
deployment picks the interface language; no tool and no element can know it.
[`composition-context.md`](./composition-context.md) gives the mechanism, and the
section player's `nds-icons` attribute (`ndsIcons`), which opts toolbar buttons into
icon buttons, is the working precedent for a scalar traveling this exact path:

```
locale attribute ?? "en-US"
      → AssessmentToolkitRuntimeContext.locale + .i18n
            → connectToolRuntimeContext(host, …) in every tool
```

The change signal is the context republish the toolkit already performs when
`runtimeContextValue` re-derives, which satisfies the invariant that a published
context carry one.

`resolveInterfaceI18n` is the only implementation of the resolution, and every
consumer goes through it. It returns a fresh facade per call, so a `$derived`
reading it re-renders on the republish, and it maps a missing publisher to the
English-only default. That lets `ToolbarContext.i18n` and `ToolSurfaceServices.i18n`
be required. An optional field pushes the no-publisher fallback onto each consumer,
and consumers then reach for the default provider directly and miss locale changes,
as two of the first three did. A registration reads `toolbarContext.i18n` and
cannot get this wrong.

**The graceful default is `en-US`.** Under fixed lockstep patch-only versioning
across every published package, a change that alters a rendered string reaches
live delivery on a host's next install with no build signal on its side. Detecting
the browser locale would silently switch a Dutch-configured laptop's assessment
chrome to Dutch. `detectBrowserLocale()` stays exported for a host that wants it,
and nothing calls it by default.

**`lang` and `dir` go on the chrome subtree, never on
`document.documentElement`.** An embedded player has no business writing the
document root. Each localized custom element stamps its own host, so RTL chrome
works inside an LTR page and two players on one page can differ. `direction`
derives from `Intl.Locale.prototype.textInfo`, with an RTL primary-subtag set as
fallback.

**Tool display names gain key fields; the required strings stay.**
`ToolRegistration.name` and `.description` are host-facing required API, and
`check:capability-neutrality` forbids core from naming a capability id. Optional
`nameKey` and `descriptionKey` resolve both: `default-tool-loaders`, already the
only place a packaged capability set is named, supplies the keys, and the toolbar
prefers the key when a provider is present and falls back to `name` when it is
not. Core never learns a capability id, and a host that implements
`ToolRegistration` by hand keeps working. The `tools.*` catalog namespace lives in
`players-shared`, outside the neutrality gate's scoped file list.

**Per-locale views over one provider.** `withLocale(tag)` returns a view that
shares catalogs, loaded-locale bookkeeping and custom messages by reference. Two
players on one page can render different interface locales without either mutating
the other, and no catalog is parsed twice. The design comes from pie-qti.

**No `window.location.reload()` on locale change.** pie-qti reloads, which buys
real simplicity. Here the provider already has `subscribe()`, components are
Svelte 5, and a reload in an embedded assessment player would discard in-progress
session state.

**Tool windows resolve the same context as the chrome around them.** A tool the
toolbar gives a window (graph, periodic table, the color-scheme tool (`theme`),
calculator, the two dictionaries) mounts at `document.body`, which keeps it clear of
the player's overflow and stacking contexts. That puts it outside the published
context's subtree: a context request bubbles to `body` and the tool falls back to
the English-only default. `ItemToolBar` therefore hosts a second `ContextProvider`
on the shell element, carrying the value it consumes itself and re-setting it on
each republish, so a shelled tool resolves the same runtime context as the chrome
around it, coordinators and services as much as `i18n`. Anything else that mounts
a player-owned surface outside the player's DOM needs the same treatment. Walking a
stored reference into the detached subtree is the alternative, and it reaches one
service instead of the context and goes stale on the next republish.

The window's own chrome is imperative DOM, with no reactive read to invalidate, so
its labels are re-read from the catalog on every shell update. That covers a locale
change under a live window and the first catalog import landing after the window
was built. A window's title resolves through `ToolRegistration.nameKey`, falling
back to `name`.

## Key namespace

Five namespaces, one module per locale:

- `common.*` — verbs and nouns reused everywhere: `close`, `cancel`, `loading`.
- `player.*` — player chrome: pane labels, tabs, loading states, error banners,
  formative controls, passage title.
- `toolkit.*` — toolbar and shared tool-shell chrome, settings panel.
- `tools.<toolId>.*` — per-capability strings, including `name` and
  `description` for the registration keys.
- `debug.*` — developer panel chrome.

Plural groups are objects of CLDR category keys selected by `Intl.PluralRules`, so
Arabic's `zero`, `two`, `few` and `many` are reachable. The README's
[Adding a key](../../packages/players-shared/src/i18n/README.md#adding-a-key) holds
the catalog conventions.

## Locale set and coverage policy

`en-US` and `nl-NL` ship, both complete. `nl-NL` is the audit language and gets
every key.

The replaced layer's `es`, `zh` and `ar` catalogs were deleted, not re-keyed, for
three reasons, each sufficient alone:

- They were harvested from a design instead of from call sites: over half their
  keys named UI this codebase does not render, while strings on screen, such as
  formative feedback, `Passage`, `Try again` and the sign-language names, had no
  keys.
- No published version could load them under Node.js, for the import-attribute
  reason under [Decisions](#decisions).
- Nothing read them.

Machine-filling the gap was the alternative and is worse: it ships strings nobody
has read, to learners, under a coverage number that certifies nothing.

`check-coverage` keeps two tiers. A complete locale must be at 100% or the check
fails; a carried locale reports without gating. `CARRIED_LOCALES` is empty: the
tier is for a locale mid-translation, not for a catalog nobody is translating.
`check:i18n-coverage` runs in the pre-commit and CI gates.

## Adoption pattern

A component resolves the provider off the toolkit runtime context with
`connectToolRuntimeContext`, falls back to `getDefaultI18n()`, reads strings
through `$derived`, and stamps `lang` and `dir` on its own host; a player
constructs the provider with `createPieI18n()` and publishes it on the
`AssessmentToolkitRuntimeContext`. The README's
[For a component in this repository](../../packages/players-shared/src/i18n/README.md#for-a-component-in-this-repository)
gives the snippet. The `$derived` read is load-bearing: a plain
`const label = i18n.t(…)` reads once and never updates when the locale moves, the
same class of failure as a composition context without a change signal.

The closed `MessageKey` union catches an undefined key in a component only where
`svelte-check` runs, so a package carrying `.svelte` files needs a `check` script
that runs it.

## Out of scope

Content language for elements (`Env.locale`, `lang` and `dir` on the *content*
subtree), language catalog cards with parameterized PNP, and the remaining tool and
accommodation locale work are slices 2, 5 and 6 in
[`internationalization.md`](./internationalization.md#rollout). Read-aloud's content
language has shipped separately; [TTS language](./internationalization.md#tts-language)
is its contract. None of these is blocked by this work, and this work is not
blocked by an authoring host emitting a locale.
