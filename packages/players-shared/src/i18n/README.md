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

Or through `runtime`, which wins over the attribute:

```ts
element.runtime = { locale: "nl-NL", env: { mode: "gather" } };
```

POSIX (`nl_NL`), bare (`nl`) and regional (`nl-BE`) tags all resolve to the
`nl-NL` catalog, through RFC 4647 lookup then primary-subtag widening. A locale
this repository ships no catalog for is honoured rather than rejected: supply
your own messages for it, and anything you omit resolves to English.

```ts
import { createPieI18n } from "@pie-players/pie-players-shared/i18n";

const i18n = createPieI18n({
  locale: "cy-GB",
  customMessages: { "cy-GB": { common: { close: "Cau" } } },
});
```

`customMessages` also overrides a shipped catalog one key at a time, so renaming
a single label needs no fork.

## For a component in this repository

Resolve the provider; never construct one. The toolkit publishes it on its
runtime context, which is the composition-context pattern
([`composition-context.md`](../../../../docs/architecture/composition-context.md)):
the deployment knows the interface language and no tool can.

```svelte
<script lang="ts">
  import type { I18nProvider } from "@pie-players/pie-players-shared/i18n/types";
  import { getDefaultI18n } from "@pie-players/pie-players-shared/i18n/provider";
  import { connectToolRuntimeContext } from "@pie-players/pie-assessment-toolkit";

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
tool in `print-player`, in Studio preview, in a unit test. The default provider
is English-only and shared process-wide, so `t()` returns `"Close"` rather than
`"common.closeA11y"`.

**`lang`/`dir` on your own host, never `document.documentElement`.** An embedded
player has no business writing the host page's root. `direction` is an inherited
CSS property, so one attribute on the host reaches your content across a shadow
boundary with no per-node wiring.

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
| `nl-NL` | complete |

Two locales, because two are audited. The pre-adoption `es`/`zh`/`ar` catalogs
were removed rather than re-keyed: they were harvested from a design rather than
from call sites, so over half their keys named UI this codebase does not render,
and no version ever published could load them outside a bundler.

To add a locale: copy `messages/nl-NL.ts`, translate, add the tag to
`BundledLocaleCode` in `types.ts` and to both maps in `catalogs.ts`, then add it
to `COMPLETE_LOCALES` in `scripts/check-coverage.ts`. A locale still under review
can sit in `CARRIED_LOCALES` meanwhile — reported, not gating, gaps resolving to
English.

## Module layout

Which module you import decides what ships. Every player and tool
`vite.config.ts` sets `external: []`, so anything reachable from an entry inlines
into that bundle.

| Module | Contents | Imported by |
|---|---|---|
| `i18n/types` | `I18nProvider`, `MessageKey`, `LocaleCode` | components, as `import type` — fully erased |
| `i18n/provider` | `SimpleI18n`, `getDefaultI18n`, `localeDirection` | components, for the English fallback |
| `i18n/catalogs` | dynamic loader map for the non-English locales | players only |
| `i18n` | `createPieI18n()`, wiring provider to catalogs | players only |
| `i18n/language-tags` | BCP-47 comparison, no locale data, no DOM | catalog resolver, TTS voice selection |

A component reaching only the first two pulls in the interface (a type) and the
5 KB English catalog. It never reaches `catalogs`, so no locale chunk is emitted
into a bundle that will never call `setLocale`.

The loader map is written out by hand rather than generated by a bundler macro:
`tsc` emits the `import()` calls verbatim, so `dist` evaluates under webpack,
esbuild, Rollup, Node and a browser loading the files directly. Every bundler
still sees the specifiers statically, so each locale stays its own chunk.
