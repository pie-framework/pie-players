---
"@pie-players/pie-players-shared": patch
---

`resolveInterfaceI18n` now delivers the locale formatters the `I18nProvider`
contract promises: the facade forwards `formatNumber` and `formatDate`, and a
provider that does not implement them falls through to `Intl` at the locale
the provider resolves — the bundled provider's own behaviour. The returned
type, `ResolvedInterfaceI18n`, states the promise. Section-player components
resolving through `useInterfaceI18n` get the same two methods. No behaviour
changes for the bundled provider or for hosts that never format through the
facade; the first component that needed locale-aware output no longer has to
reach past the sanctioned resolution path.
