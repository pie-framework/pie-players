---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-assessment-player": patch
---

Failed interface-locale catalog loads are reported, not swallowed. The
standalone item player's `setLocale` catch and the reference assembly's own
provider drive dispatch a `framework-error` event (bubbles, composed) whose
detail carries `kind: "i18n-locale-load"` with `recoverable: true` — the same
shape the toolkit's error bus and the section player already report — so a
host can tell English-because-requested from English-because-failed.
`@pie-players/pie-players-shared/i18n` gains `reportInterfaceLocaleLoadError`
and the `InterfaceLocaleLoadErrorModel` type, the narrow payload contract for
players that do not depend on the toolkit. Failed loads are not cached:
re-setting the `locale` attribute or recomposing the `i18n` provider retries
the load. No listed host is affected: the event is new, and a host that never
listens sees nothing.
