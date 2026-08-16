---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-section-player-tools-event-debugger": patch
"@pie-players/pie-section-player-tools-instrumentation-debugger": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-section-player-tools-session-debugger": patch
"@pie-players/pie-section-player-tools-shared": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-tool-calculator-desmos": patch
"@pie-players/pie-tool-calculator-inline-desmos": patch
"@pie-players/pie-tool-color-scheme": patch
"@pie-players/pie-tool-graph": patch
"@pie-players/pie-tool-line-reader": patch
"@pie-players/pie-tool-periodic-table": patch
"@pie-players/pie-tool-protractor": patch
"@pie-players/pie-tool-ruler": patch
"@pie-players/pie-tool-sign-language": patch
"@pie-players/pie-tool-text-to-speech": patch
"@pie-players/pie-tool-tts-inline": patch
---

Localize player and tool chrome, with Dutch as the first complete locale.

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

`en-US` and `nl-NL` are complete at 401 keys, and they are the only locales
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
