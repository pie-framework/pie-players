# Interface locale adoption

Status: `Active` — implementation plan for rollout slices 3 and 4 of
[`internationalization.md`](./internationalization.md).

This plan covers **interface locale** only: the strings the packages in this
repository render themselves — toolbar labels, tool panels, player status and
error text, `aria-label`s, debug-panel chrome. Content language and in-item
alternates are separate concerns on separate channels and are out of scope; see
`internationalization.md` for why the three are not one.

The reference is `pie-qti`, whose optional-provider shape this adopts and whose
three known defects it does not.

## Scope

184 user-visible strings across 31 Svelte components, plus 12 tool display names
and 11 tool descriptions in `default-tool-loaders`. By owner:

| Package | Strings | Surface |
|---|---|---|
| `section-player-tools-tts-settings` | 40 | TTS settings panel |
| `section-player-tools-pnp-debugger` | 17 | PNP panel |
| `item-player` | 13 | session debugger, config error |
| `tool-text-to-speech` | 12 | TTS window |
| `section-player-tools-event-debugger` | 11 | event panel |
| `tool-annotation-toolbar` | 10 | annotation toolbar |
| `section-player-tools-shared` | 14 | panel chrome, toggles, session DB |
| `tool-ruler`, `tool-periodic-table` | 8 each | tool chrome |
| `tool-tts-inline`, `tool-line-reader` | 5 each | inline controls, overlay |
| `section-player-tools-*-debugger` (2 more) | 10 | instrumentation, session |
| `section-player` | 12 | tabs, pane labels, loading, passage title, formative controls |
| `tool-graph`, `tool-protractor`, `tool-calculator-desmos`, `tool-color-scheme` | 11 | tool chrome |
| `players-shared` | 6 | preview toggle, error banners, settings panel |
| `assessment-toolkit` | 1 | toolbar group label |
| `default-tool-loaders` | 23 | `ToolRegistration.name` / `.description` |

Out of scope, deliberately: the remaining `scan-hardcoded` findings, which are
overwhelmingly `throw new Error` messages, log strings, DOM tag names and CSS
identifiers. Developer-facing diagnostics stay in English. The scanner keeps its
current advisory role rather than becoming a gate.

Also deliberately unlocalized: TTS preview sample text. It is handed to the voice
under test, so its language follows that voice, not the interface locale — Dutch
chrome previewing an English voice must still send English.

## English output

Keying a string must not change it. Fixed lockstep patch-only versioning puts a
reworded label into a host's live delivery on their next install with no signal on
their side, and the strings this pass touches are largely accessible names and
live-region announcements, where a host may be asserting exact text. Every
English value therefore reproduces the literal it replaced byte for byte,
including its punctuation and its flaws: `Graph Tool - Draw points…` keeps the
hyphen and the capital, `applying` keeps three ASCII dots where `common.loading`
uses an ellipsis, and `tools.protractor.toolA11y` keeps `Current rotation
displayed via Moveable.js`. Improving any of them is a separate change with its
own changeset entry, so it is visible as a text change rather than arriving inside
an i18n refactor.

Two consequences for the key set. Interpolation cannot be used to assemble a
string a language inflects, so a unit name that appears both as a button label and
inside a sentence needs one key per form — `tools.ruler` carries three forms of
each unit, because the pre-adoption code rendered Title Case on the button,
lowercase in the announcement, and the raw `'inches' | 'cm'` state token in the
accessible name. And a translation is not obliged to reproduce an English flaw:
`nl-NL` renders the protractor's help without the Moveable.js clause.

## Decisions

**One provider, in `players-shared`, not a new package.** `players-shared` is
already a runtime dependency of every tool and player, is already on the publish
policy's `nodeSafe` list, and already owns `i18n/language-tags`. A 37th package
would mean a Changesets `fixed` entry, build wiring, and a dependency edit in 30
packages to deliver one interface and one catalog.

**The existing `SimpleI18n` is rewritten, not supplemented.** It and
`I18nService` are the two implementations `internationalization.md` records as
having drifted; adding a third alongside them repeats the mistake that produced
the second. `SimpleI18n` keeps its name and its `I18nServiceApi` surface, and
`I18nService` stays the thin delegating wrapper it already is.

**Catalogs become TypeScript modules, not JSON.** Two consequences. The English
catalog's shape generates the `MessageKey` union, so a mistyped key is a compile
error rather than a key rendered on screen — which is most of what
`check-coverage` exists to catch after the fact. And `tsc` compiles a `.ts`
catalog to real JS, removing the `with { type: "json" }` import-attribute hazard
that already broke every non-English locale once under Node's ESM loader.

`MessageKeyInput` is that union plus `DynamicMessageKey`, a branded string
produced only by `dynamicMessageKey()`. Two call sites need it: a periodic-table
element category, which a host data file can extend beyond what the catalog
enumerates, and `ToolRegistration.nameKey`, which a host authors against its own
catalog. Both pair it with `hasKey` so a miss falls back to a literal instead of
rendering a key. An open `MessageKey | (string & {})` was implemented first and is
the wrong shape: it makes every mistyped literal assignable, which is exactly the
failure the union exists to prevent.

**Catalogs are keyed by full BCP-47 tag.** `en-US` and `nl-NL`, replacing today's
bare `en`/`es`/`zh`/`ar`. This matches `pie-qti`'s
catalog names, matches what AfA PNP and QTI declare, and makes the POSIX forms a
host actually sends (`nl_NL`) resolvable. `findBestLanguageMatch` from
`i18n/language-tags` does the resolution, so `nl`, `nl_NL`, `nl-NL` and `NL-nl`
all land on `nl-NL` without a mapping table. Nothing consumes
`getAvailableLocales()` today, so the rename breaks no caller.

**English is the single source; there are no inline English fallbacks.**
`pie-qti` put an English literal at each of 153 call sites, which makes the i18n
runtime fully erasable and costs a bespoke scanner to police the drift between
literal and catalog. The opposite trade is correct here because a provider always
exists: `players-shared` exports a module-level default whose English catalog is
statically bundled, so `t()` never returns a bare key even with no host, no
player and no context. The catalog is 5.4 KB — smaller than any tool's own
dependencies.

**Locale catalogs never enter a tool bundle.** Every player and tool
`vite.config.ts` sets `external: []`, so anything a tool imports at runtime
inlines into its bundle. The module split enforces the boundary:

| Module | Contents | Imported by |
|---|---|---|
| `i18n/types.ts` | `I18nProvider`, `MessageKey`, `LocaleCode` | tools, as `import type` — fully erased |
| `i18n/messages/en-US.ts` | English catalog | `provider.ts` only |
| `i18n/provider.ts` | `SimpleI18n`, `getDefaultI18n()`, `resolveInterfaceI18n()`, `dynamicMessageKey()` | tools, for the graceful default |
| `i18n/catalogs.ts` | dynamic loader map for every non-English locale | players only |
| `i18n/index.ts` | `createPieI18n()` wiring provider to catalogs | players only |

A tool that reads a provider off the runtime context pulls in the interface (a
type), and the English fallback (5.4 KB). It never sees `catalogs.ts`, so no
locale chunk is emitted into its `dist`.

**Interface locale is a composition context, resolved property-first.** The
deployment picks the interface language; no tool and no element can know it.
[`composition-context.md`](./composition-context.md) gives the mechanism, and
`ndsIcons` is the working precedent for a scalar travelling this exact path:

```
runtime.locale ?? locale prop ?? locale attribute ?? "en-US"
      → AssessmentToolkitRuntimeContext.locale + .i18n
            → connectToolRuntimeContext(host, …) in every tool
```

The change signal is the context republish the toolkit already performs when
`runtimeContextValue` re-derives, which satisfies the invariant that a published
context carry one.

`resolveInterfaceI18n` is the only implementation of the resolution, and every
consumer goes through it. It returns a fresh facade per call, so a `$derived`
reading it re-renders on the republish, and it maps a missing publisher to the
English-only default — which is what lets `ToolbarContext.i18n` and
`ToolSurfaceServices.i18n` be required rather than optional. Optional fields were
tried first and are the wrong shape: they push the no-publisher fallback onto each
consumer, and two of the three that grew reached for the default provider directly
and so never saw a locale change. A registration now reads `toolbarContext.i18n`
and cannot get this wrong.

**The graceful default is `en-US`, not `navigator.language`.** Under fixed
lockstep patch-only versioning across 36 packages, any change that alters a
rendered string reaches live delivery on a host's next install with no build
signal on their side. Detecting the browser locale would silently switch a
Dutch-configured laptop's assessment chrome to Dutch. `detectBrowserLocale()`
stays exported for a host that wants it, and nothing calls it by default.

**`lang` and `dir` go on the chrome subtree, never on
`document.documentElement`.** Today's `SimpleI18n.applyDOMDirection()` stamps the
document root, which an embedded player has no business writing. Each localized
custom element stamps its own host instead, so RTL chrome works inside an LTR
page and two players on one page can differ. `direction` derives from
`Intl.Locale.prototype.textInfo` with an RTL primary-subtag set as fallback,
replacing today's four-entry list.

**Tool display names gain key fields; the required strings stay.**
`ToolRegistration.name` and `.description` are host-facing required API and
`check:capability-neutrality` forbids core from naming a capability id. Adding
optional `nameKey` and `descriptionKey` resolves both: the keys are supplied by
`default-tool-loaders`, which is already documented as the only place a packaged
capability set is named, and the toolbar prefers the key when a provider is
present and falls back to `name` when it is not. Core never learns a capability
id, and a host that implements `ToolRegistration` by hand keeps working
unchanged. The `tools.*` catalog namespace lives in `players-shared`, outside the
neutrality gate's scoped file list.

**Per-locale views over one provider.** `withLocale(tag)` returns a view sharing
catalogs, loaded-locale bookkeeping and custom messages by reference. Two
players on one page can render different interface locales without either mutating
the other, and no catalog is parsed twice. Taken from `pie-qti`.

**No `window.location.reload()` on locale change.** `pie-qti` reloads, which buys
real simplicity. Here the provider already has `subscribe()`, components are
Svelte 5, and a reload in an embedded assessment player would discard in-progress
session state.

## Key namespace

Five namespaces, one module per locale:

- `common.*` — verbs and nouns reused everywhere: `close`, `cancel`, `loading`.
- `player.*` — player chrome: pane labels, tabs, loading states, error banners,
  formative controls, passage title.
- `toolkit.*` — toolbar and shared tool-shell chrome, settings panel.
- `tools.<toolId>.*` — per-capability strings, including `name` and
  `description` for the registration keys.
- `debug.*` — developer panel chrome.

`plurals` are nested objects with CLDR category keys (`one`, `other`, and
whatever else the locale needs); `Intl.PluralRules` selects the category, so
Arabic's `zero`/`two`/`few`/`many` are reachable — they are not today, because
`pie-qti` hardcodes a one/other split and the current `SimpleI18n` falls back to
one when `Intl` is missing.

## Locale set and coverage policy

`en-US` and `nl-NL`, both complete. `nl-NL` is the audit language and gets every
key.

**The pre-adoption `es`/`zh`/`ar` catalogs are deleted, not re-keyed.** Three
findings, each sufficient on its own:

- Their reference was fiction. The four old catalogs held 142 keys each with
  genuine cross-locale parity — es/zh/ar matched `en` exactly, and the old
  coverage check passed truthfully — but 76 of those 142 (54%) named UI this
  codebase does not render: a section-builder with drag-and-drop
  (`section.drop_zone`, `section.unassigned_instruction`), an assessment shell
  with a student name and fullscreen controls, 25 Desmos internals
  (`calculator.mathprint`, `calculator.sliders`) that Desmos localizes itself, and
  the colour-scheme names the theme registry owns. Meanwhile the strings actually
  on screen — formative feedback, `Passage`, `Try again`, the sign-language names
  — had no keys at all. A re-key found a current home for 66 of 142.
- Only English could ever load. `dist/i18n/loader.js` carried
  `with { type: "json" }` on the three static English imports and on none of the
  dynamic locale imports, so every non-English locale threw
  `ERR_IMPORT_ATTRIBUTE_MISSING` under Node's ESM loader, reported by the
  surrounding `catch` as "Translation files not found" while the files sat in
  `dist`. `players-shared` is on the publish policy's `nodeSafe` list, so that
  was a conformance break in every published version through `0.3.67`.
- Nothing read any of it: zero call sites in this repository and none in any of
  the three consumer checkouts.

Machine-filling the gap was the alternative and is worse: it ships strings nobody
has read, to learners, under a number that again certifies nothing.

`check-coverage` keeps a two-tier report — complete locales must be at 100% or
the check fails, carried locales report without gating — with `CARRIED_LOCALES`
empty. The tier is for a locale mid-translation, not for a catalog nobody is
translating. That is the baseline `internationalization.md` names as the
precondition for wiring i18n checks into CI.

## Adoption pattern

Every localized component follows one shape. In a tool:

```svelte
<script lang="ts">
  import type { I18nProvider } from "@pie-players/pie-players-shared/i18n/types";
  import { getDefaultI18n } from "@pie-players/pie-players-shared/i18n/provider";
  import { connectToolRuntimeContext } from "@pie-players/pie-assessment-toolkit";

  let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
  const i18n = $derived<I18nProvider>(runtimeContext?.i18n ?? getDefaultI18n());
  const t = $derived({
    close: i18n.t("common.close"),
    unit: (unit: string) => i18n.t("tools.ruler.switchedTo", { unit }),
  });
</script>

<div lang={i18n.getLocale()} dir={i18n.getDirection()}>
  <button aria-label={t.close}>…</button>
</div>
```

The `$derived` wrapper is load-bearing: a plain `const label = i18n.t(…)` reads
once and never updates when the locale moves, which is the same class of failure
as a composition context without a change signal.

In a player, the provider is constructed rather than resolved, and published:

```ts
const i18n = createPieI18n({ locale: resolvedLocale });
// … reaches tools through AssessmentToolkitRuntimeContext
```

## Sequencing

1. **Provider and catalog infrastructure.** `i18n/types.ts`, `i18n/messages/`,
   `i18n/provider.ts`, `i18n/catalogs.ts`, `i18n/index.ts`; `SimpleI18n`
   rewritten; `I18nService` re-pointed; package `exports` extended; unit tests
   for resolution order, fallback chain, plural categories, direction and
   `withLocale`.
2. **English catalog.** Harvested from the 184 inventoried strings plus the 23
   registration strings, superseding the drifted catalog.
3. **Dutch catalog.** Complete, and the auditable deliverable.
4. **Locale plumbing.** `RuntimeConfig.locale`, top-level `locale` prop and
   attribute on `pie-item-player`, `pie-section-player-*`,
   `pie-assessment-toolkit`; `locale` and `i18n` on
   `AssessmentToolkitRuntimeContext`.
5. **Component adoption**, package by package: `players-shared`,
   `assessment-toolkit`, `section-player`, `item-player`, the 14 `tool-*`
   packages, the 5 `section-player-tools-*` packages.
6. **Registration keys.** `nameKey` / `descriptionKey` on `ToolRegistration`,
   populated in `default-tool-loaders`, resolved in the toolbars.
7. **Gates.** Two-tier `check-coverage`; a repo script that runs it; a
   `nl-NL` end-to-end check that a locale actually changes rendered chrome.
8. **Carried locales** re-keyed, and the existing `es`/`zh`/`ar` directories
   removed.

## svelte-check coverage

Adopting this surfaced a hole in the gate rather than in the design.
`SessionDbPanel` took an `i18n` prop it never destructured from `$props()`, which
is a `ReferenceError` at render; `verify:ci-lint-typecheck` passed anyway, and only
an e2e spec that clicks a button inside that panel caught it. The cause: nineteen
packages carrying `.svelte` files had no `check` script, so `turbo check` never ran
`svelte-check` over any tool package. `svelte-check` diagnoses exactly this — *No
value exists in scope for the shorthand property* — so the files were simply never
read.

All nineteen now run `check`, taking gate coverage from 9 packages to 28. Twelve
were already clean. The other seven held 31 errors, and enabling the check is what
made them visible:

- Ten were this pass's own. `tool-annotation-toolbar` declared `interfaceI18n`
  after the `HIGHLIGHT_COLORS` list that reads it — the same declaration-order
  defect as `SessionDbPanel`, four labels' worth. And `TtsSettingsPanel` called
  `debug.tts.any` twice, a key no catalog defines, so the gender filter's "Any"
  option would have rendered its own key to a learner. That one is the exact
  failure `MessageKey` exists to prevent, caught only because the union is closed
  and the package is now read.
- The rest were pre-existing and unrelated: `moveable` ships CJS with ESM-shaped
  declarations and no `exports` map, so under `NodeNext` its default import
  resolves to the module namespace and reads as neither constructable nor usable
  as a type — the ruler and protractor now describe the slice of its surface they
  use; `*.svg` imports needed `vite/client` in `types`; the periodic table's JSON
  import needed the `type: "json"` attribute that `NodeNext` requires, which is the
  same omission that broke every non-English locale in the layer this work
  replaced; and `tool-tts-inline` needed a `tsconfig.svelte-check.json` mapping
  `ui/use-zoom-compensation` to source, mirroring the alias its Vite config
  already carries, because a `.svelte.ts` rune module cannot ship through an
  `exports` map as compiled output.

## What this does not do

Content language, `Env.locale`, `lang`/`dir` on the *content* subtree, catalog
cards, parameterized PNP, and TTS voice selection from the resolved language are
slices 2, 5 and 6 in `internationalization.md`. None of them is blocked by this
work, and this work is not blocked by Studio emitting a locale.
