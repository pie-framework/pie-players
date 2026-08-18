---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
---

Re-publish the toolkit runtime context on each tool window, so a shelled tool
resolves the interface locale rather than the English-only default.

A tool window mounts at `document.body`, which is what keeps it clear of the
player's overflow and stacking contexts. The consequence was that a tool inside
one sat outside every provider's subtree: its `context-request` bubbled to `body`
and reached nothing, `resolveInterfaceI18n` fell back to `getDefaultI18n()`, and
the tool rendered English under a translated toolbar. With `locale="nl-NL"` the
graph offered "Selector / Point / Line / Delete" beneath a "Grafiek" button, and
the same held for the theme, periodic-table and calculator panels — every tool
the toolbar gives a shell. The unshelled overlays, ruler and protractor and line
reader among them, were never affected: they mount inside the toolbar's own DOM
and reached the provider all along. The i18n adoption keyed all of these tools at
once, so the catalog and the call sites were already in place; only the delivery
path was missing.

`ItemToolBar` now hosts a second `ContextProvider` on the shell element, carrying
the value it consumes itself and re-setting it on each republish. That restores
the whole runtime context to a shelled tool, not just `i18n` — the coordinators,
the TTS service and the catalog resolver were equally unreachable there.

Two smaller faults on the same surface. The window's own controls — move, resize,
centre, close — are built imperatively, so `t()` ran once with no reactive read to
invalidate: a shell built before its locale's catalog import resolved kept English
for the rest of the session, and a locale change never reached it. Their labels
are now re-read from the catalog whenever the shell updates. And a window's title
came from `ToolRegistration.name`, the raw English field, rather than through
`nameKey`; graph, periodic table and theme now resolve it the way the toolbar
does, and the calculator's window takes the variant name its button already
carries. `resolveToolRegistrationName` is exported from
`@pie-players/pie-assessment-toolkit/tools/internal` for that.

Default-English is unchanged: with no `locale` every one of these surfaces renders
exactly what it rendered before, including the shell controls' accessible names,
which hosts may be asserting on.

Covered by `packages/section-player/tests/section-player-interface-locale.spec.ts`,
which opens the graph window under `nl-NL` and asserts the window title, the
header controls and the tool's own labels.
