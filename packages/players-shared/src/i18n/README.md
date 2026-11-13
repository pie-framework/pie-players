# Interface i18n

The strings the packages in this repository render themselves: toolbar labels,
tool panels, player status and error text, `aria-label`s.

Not the language of authored content, and not in-item alternates. Those are
separate concerns on separate channels —
[`docs/architecture/internationalization.md`](../../../../docs/architecture/internationalization.md)
sets out why the three are not one, and
[`docs/architecture/i18n-interface-locale-adoption.md`](../../../../docs/architecture/i18n-interface-locale-adoption.md)
records the decisions behind what is here.

## For a host

Set one attribute. Unset, every player renders exactly the English it rendered
before this existed — the locale is never detected from the browser.

```html
<pie-section-player-tabbed locale="nl-NL" …></pie-section-player-tabbed>
<pie-item-player locale="nl-NL" …></pie-item-player>
```

This package bundles `en-US` alone; every other catalog comes from a loader the
host composes, such as the generated tier's
([`pie-i18n-generated`](../../../pie-i18n-generated/README.md)). With that tier
wired, POSIX (`nl_NL`), bare (`nl`) and regional (`nl-BE`) tags all resolve to
its `nl-NL` catalog, through RFC 4647 lookup then primary-subtag widening. Both
stay within the request's script, explicit or the CLDR likely script from
`Intl.Locale.maximize()`: `zh-TW` reads `zh-TW`, `zh-Hant`, then `zh`, and a
bare `zh` catalog, which is Simplified, never serves it. Host messages resolve
apart from catalogs, exact tag then truncation, so an `es-MX` override sits on
top of a shipped `es`, and `getLocale()` reports `es`. A locale no catalog serves in its script stays the
request (`getRequestedLocale()`): supply your own messages for it, and anything
you omit resolves to English. `getLocale()` and `getDirection()` name the
locale actually served, so until such messages exist they name `en-US`.

```ts
import { createPieI18n } from "@pie-players/pie-players-shared/i18n";

const i18n = createPieI18n({
  locale: "cy-GB",
  customMessages: { "cy-GB": { common: { close: "Cau" } } },
});
```

`customMessages` also overrides a shipped catalog one key at a time, so renaming
a single label needs no fork.

Hand the provider to the player through the host-supplied provider seam — the
`runtime.i18n` key on a section-player layout, or the `i18n` property on
`pie-assessment-toolkit` or `pie-item-player` — and let the element's `locale`
name the language. The attribute is the only locale driver: a supplied provider
is driven by it and by nothing else, so build the provider without `locale` and
set the attribute (`createPieI18n({ locale })` names a tag without loading its
catalog). The shape and the rules are the
[host-supplied interface locale provider PRD](../../../../docs/prds/interface-i18n-host-provider.md).

```html
<pie-section-player-tabbed locale="nl-NL" …></pie-section-player-tabbed>
<script type="module">
  player.runtime = { assessmentId, i18n };
</script>
```

## For a component in this repository

Resolve the provider; never construct one. The toolkit publishes it on its
runtime context, which is the composition-context pattern
([`composition-context.md`](../../../../docs/architecture/composition-context.md)):
the deployment knows the interface language and no tool can.

```svelte
<script lang="ts">
  import type { I18nProvider } from "@pie-players/pie-players-shared/i18n/types";
  import { getDefaultI18n } from "@pie-players/pie-players-shared/i18n/provider";
  import {
    connectToolRuntimeContext,
    type AssessmentToolkitRuntimeContext,
  } from "@pie-players/pie-assessment-toolkit";

  let containerEl = $state<HTMLDivElement | null>(null);
  let runtimeContext = $state<AssessmentToolkitRuntimeContext | null>(null);
  $effect(() => {
    if (!containerEl) return;
    return connectToolRuntimeContext(containerEl, (v) => (runtimeContext = v));
  });

  const interfaceI18n = $derived(runtimeContext?.i18n ?? getDefaultI18n());
</script>

<div
  bind:this={containerEl}
  lang={interfaceI18n.getLocale()}
  dir={interfaceI18n.getDirection?.() ?? "ltr"}
>
  <button aria-label={interfaceI18n.t("common.closeA11y")}>×</button>
</div>
```

Three things in there are load-bearing.

**`$derived`, not `const`.** A string captured once pins the English that
rendered before the catalog's dynamic import resolved. The context republishes
when the locale moves and again when a catalog lands; only a reactive read sees
it.

**`getDefaultI18n()` as the fallback.** No publisher is a legitimate state — a
tool in `print-player`, in an authoring preview, in a unit test. The default provider
is English-only and shared process-wide, so `t()` returns `"Close"` rather than
`"common.closeA11y"`.

**`lang`/`dir` on your own host, never `document.documentElement`.** An embedded
player has no business writing the host page's root. `direction` is an inherited
CSS property, so one attribute on the host reaches your content across a shadow
boundary with no per-node wiring. `lang` itself resolves along the node tree —
parent element, or the host for a shadow root's child — so a stamp inside a
shadow tree never reaches slotted content: an element whose chrome is slotted
stamps its host element instead. `stampInterfaceLocale(element, provider)` is
the imperative form for that host, for a shell built with `createElement`, or
for a vanilla element; call it from whatever already re-runs on a locale change
and a catalog load.

For a capability registration, `ToolbarContext.i18n` carries the same provider;
`interfaceI18n(toolbarContext)` in `default-tool-loaders` applies the fallback.

## Adding a key

Add it to `messages/en-US.ts` first. That catalog's *shape* generates
`MessageKey`, so a typo at a call site is a compile error rather than a key
rendered on screen. Then translate it in every locale listed as complete, and
run:

```bash
bun run check:i18n-coverage
```

The check has two tiers. A **complete** locale must carry every English key; a
gap fails the build. A **carried** locale is reported and never gates, because
its gaps resolve to English through the fallback chain and gating would only
pressure someone into committing translation nobody has reviewed. Both tiers
fail on a key English no longer defines — an unreachable key is drift.

Conventions the catalog follows:

- `{placeholder}` slots interpolate; the names stay identical across locales.
- A plural group is an object of CLDR categories with `other` required.
  `Intl.PluralRules` selects, so Arabic's `zero`/`two`/`few`/`many` and Polish's
  `few`/`many` are reachable and a locale may carry more forms than English has.
  Call `plural()`, never a `count === 1` branch.
- Keys ending `A11y` are for assistive technology only.
- Author whole phrases. `"Open " + name.toLowerCase()` is an English-only
  transform: Dutch and German capitalize differently, and a language with
  grammatical case needs the phrase authored rather than assembled.
- Developer diagnostics — `throw`, `console` — stay in English and stay out.

## Locales

| Tag | Coverage |
|---|---|
| `en-US` | source |

One locale, because one is the fallback: `en-US` is the statically resident
source of truth every other locale falls back through, and nothing else ships
in this package. The audited Dutch catalog — the framework's audit language and
the calibration report's ground truth — lives in the optional generated tier
since 2026-11-04, carried over verbatim as a `reviewed` catalog. The
pre-adoption `es`/`zh`/`ar` catalogs were removed rather than re-keyed: they
were harvested from a design rather than from call sites, so over half their
keys named UI this codebase does not render, and no version ever published
could load them outside a bundler.

Machine-generated and carried locales live outside this package:
[`@pie-players/pie-i18n-generated`](../../../pie-i18n-generated/README.md)
ships them — generated from `en-US` against per-locale terminology briefs, or
carried over audited, as `nl-NL` was — and gates their structure and freshness
against this catalog. Hosts compose its loaders after `loadBundledCatalog`, so
a locale promoted from there into `messages/` silently wins over its generated
predecessor with no host action.

Adding a locale to the bundled set is now an extraordinary decision — it means
shipping a catalog to every host whether or not any of them asks for it, under
a native-audit bar only `nl-NL` ever met. The ordinary path is the generated
tier: brief, generate, review pass. A bundled locale would mean: author the
catalog in `messages/`, add the tag to `BundledLocaleCode` in `types.ts` and to
`BUNDLED_LOCALES` in `catalogs.ts`. A locale still under review has no place
here — `CARRIED_LOCALES` in `scripts/check-coverage.ts` remains for one only if
the extraordinary decision above is made mid-review; gaps resolve to English.

## Hardcoded strings

The contract this README describes — every learner-visible string resolves
through the catalog — has a warning-level check, not a gate:
`bun run scan-hardcoded` parses the packages' Svelte templates and reports
template text plus static `aria-label`, `title` and `placeholder` values that
do not route through a provider. Findings are leads, not defects: whether a
string reaches a learner is a human call, and a warning that could fail a
build invites suppression. The `i18n-hardcoded-scan` workflow runs the scan
weekly and files the report on a tracking issue; triaging that issue is
closing the loop, not clearing a gate.

## Conformance with pie-elements-ng

pie-elements-ng's `@pie-element/shared-i18n` ports this engine's provider and
imports its language-tag code from
[`@pie-players/pie-language-tags`](../../../pie-language-tags/README.md), as this
engine does. The shared semantics are written down once, in that package's
[`i18n-conformance-fixtures.json`](../../../pie-language-tags/i18n-conformance-fixtures.json)
(lookup sequence, direction, plural routing with locale numerals,
interpolation, the fallback chain), and both repositories run that one file
against their own engine. A case only one engine passes is drift, and the fix
goes to the engine, not the fixture. Locale tags in the fixture are full where
CLDR's regional defaults differ: bare `ar` formats Latin digits and `ar-SA`
Arabic-Indic, which is CLDR, not an engine.

## Module layout

Which module you import decides what ships. The item player, the section
player's browser build and the print player bundle every dependency, so anything
reachable from their entries inlines into their bundles; the tool bundles,
the dictionaries included, import `players-shared` from the host, whose bundler
follows the same imports.

| Module | Contents | Imported by |
|---|---|---|
| `i18n/types` | `I18nProvider`, `MessageKey`, `LocaleCode` | components, as `import type` — fully erased |
| `i18n/provider` | `SimpleI18n`, `getDefaultI18n`, `localeDirection`, `stampInterfaceLocale` | components, for the English fallback |
| `i18n/catalogs` | dynamic loader map for the non-English locales | players only |
| `i18n` | `createPieI18n()`, wiring provider to catalogs | players only |
| `i18n/language-tags` | BCP-47 comparison, no locale data, no DOM; re-exports `@pie-players/pie-language-tags` | catalog resolver, TTS voice selection |

A component reaching only the first two pulls in the interface (a type) and the
English catalog (about 9 KB gzipped). It never reaches `catalogs`, so no locale chunk is emitted
into a bundle that will never call `setLocale`.

The loader map is written out by hand rather than generated by a bundler macro:
`tsc` emits the `import()` calls verbatim, so `dist` evaluates under webpack,
esbuild, Rollup, Node and a browser loading the files directly. Every bundler
still sees the specifiers statically, so each locale stays its own chunk.
