---
"@pie-players/pie-context": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-item-player": patch
---

`interfaceLocaleContext` in `@pie-players/pie-context`, keyed
`Symbol.for("pie.interfaceLocale")`: the host-neutral channel the PIE elements
inside a player read the interface locale from. `pie-assessment-toolkit` and
`pie-item-player` answer it with `{ locale, direction }` — the BCP-47 tag as
the player's provider resolved it and its writing direction — and republish on
a locale change and again once a lazily loaded catalog is resident. An element
requests it with `subscribe: true`, resolves the tag against its own catalogs,
and treats an unanswered request as `en-US`; the value only grows. This is the
pie-players half of pie-elements-ng's interface-i18n PRD, which has elements
stop keying their chrome on `model.language`. Additive: with no `locale` the
answer is `en-US`/`ltr`, nothing reads it yet, and no listed host is affected.
