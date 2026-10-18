---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-assessment-player": patch
"@pie-players/pie-section-player-tools-shared": patch
"@pie-players/pie-tool-sign-language": patch
"@pie-players/pie-tool-calculator-shared": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-i18n-generated": patch
---

The player chrome stamps `lang` and `dir` from the interface locale, so a
screen reader takes the chrome's language and direction from the locale the
host set instead of the page's. The stamps sit on each localized element's own
subtree root — the section shell's host (the light-tree ancestor of every pane,
card and item player), the toolkit and item-tool-bar hosts and the
`document.body` tool shells, the section's navigation live region, the item
player and shared renderer roots, the session debugger and the five shared
debug panels, the sign-language region, the inline calculator and inline TTS,
and the reference assessment player's host. The document root is never
touched. The section's navigation announcement is no longer hardcoded English:
`player.questionPositionA11y` / `questionPositionLabeledA11y` are new catalog
keys (the generated `th-TH` catalog carries them). `pie-item-player`'s
interface messages now re-derive when a lazily loaded catalog becomes
resident, which previously pinned whatever rendered before the load —
including its error and loading chrome. `@pie-players/pie-players-shared/i18n`
exports `stampInterfaceLocale(element, provider)`, the imperative form of the
`lang`/`dir` pair a template puts on its root, for a host stamping an element of
its own. Hosts whose content language
can differ from the interface locale keep naming it in the content markup
(`lang`/`dir`, or `model.language` on the element); a content subtree that
names no language inherits the interface locale until the content-language
slice stamps it. No listed host is affected: every surface is a consumer of
the interface locale, and a host that supplies none renders `en-US` chrome it
was already rendering.
