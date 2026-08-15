---
"@pie-players/pie-players-shared": patch
---

Detect a host's content stylesheet wherever it sits in the cascade, so a host
that confines its copy is no longer told it shipped nothing.

`components.css` carries bare `h1`-`h6`, `table` and `th` normalisation plus
`.text-center`'s `!important`, and the player installs it into the host document
unscoped. A host with its own chrome therefore has to confine its copy —
`@scope (.item-content) { … }` is the shape that reaches — and both detection
paths were blind to exactly that. `declaresContentStylesSentinel` read
`.style` off top-level rules only, and a grouping rule holds no declarations of
its own, so a confined copy presented one rule with an empty `.style` and read
as absent. Sentinel detection now recurses into `CSSGroupingRule.cssRules`,
which covers `@scope`, `@media`, `@supports` and `@layer` alike.

Both consequences were real. An opted-out host with a working scoped copy was
warned `No PIE content stylesheet found` on every page load, the one message
that is meant to fire only when authored content is genuinely unstyled. And the
`loaded twice` warning — the diagnostic that catches a host copy pinned to an
older `@pie-players/pie-theme` silently overriding newer player rules — could
never fire against a scoped copy, so the duplicate it exists to surface stayed
silent.

`contentStylesPresent` gains the sheet scan as a fallback rather than a
replacement. The computed sentinel on `<html>` stays authoritative for a
document-wide stylesheet; it cannot see a confined one, because the `:root` rule
that declares the sentinel can never match inside a scoping root that `<html>`
is not a descendant of. CSS-wide values (`unset`, `inherit`, …) are still
rejected at every depth, so Svelte's dev-mode custom-element reset does not read
as a host copy from inside a grouping rule either.

No API change, and a host doing nothing unusual is unaffected: a document-wide
copy is still found by the computed property on the first probe.
