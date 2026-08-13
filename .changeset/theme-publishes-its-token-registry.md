---
"@pie-players/pie-theme": patch
---

Two additions a host needs to explain a resolved theme to a person: the token registry becomes a package export, and `provider="none"` becomes a supported mode.

## `@pie-players/pie-theme/token-registry.json`

The registry already answers "what is this token for, and who owns it" for all 84 `--pie-*` names — owner, scope, category, status, fallback policy — and `check:theme-tokens` holds it against source on every commit. It was internal, so a host wanting to show that answer had to derive grouping from token names or keep its own list, and both drift the moment a token is added here.

Exported as the JSON itself rather than a wrapper, matching how the stylesheets are exported, with `PieThemeTokenRegistryEntry` from the root entry point to type the import. `tsc` does not emit files it did not compile, so the build copies the JSON into `dist` alongside the CSS; a test pins the export entry, the copy step and `files`, because an export pointing at a file the build forgot resolves to a 404 for every consumer and nothing else would catch it.

## `provider="none"`

`auto` lets any registered adapter that can read the target win, which on a DaisyUI page means PIE tokens follow `--color-*`. `none` resolves nothing and leaves the shipped defaults, which is how a host reproduces the palette it had before adopting a provider — the first thing to check when colours differ between two environments.

Naming an unregistered provider already landed in the same place, by accident and undocumented. The mode short-circuits ahead of both the registry lookup and the document-element retry, since that retry exists so a subtree host inherits a themed page and would otherwise put the provider's values straight back. `unregisterPieThemeProvider` cannot take it away, because it is not in the registry at all.

`PIE_THEME_PROVIDER_NONE` is exported for hosts that would otherwise hardcode the string.
