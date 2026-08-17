---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

Move `tool-surface-host` from the section player into the assessment toolkit, so a
renderer other than the section player can host tool surfaces.

The module resolves a surface name to the tools registered against it and keeps a
snapshot in step with the registry. Nothing in it is specific to sections, but living
in `packages/section-player/src/components/shared/` made the section player the only
renderer that could use it — any other host would have had to depend on the section
player to render a surface, which inverts the layering.

It is reachable at `@pie-players/pie-assessment-toolkit/tools/internal`. Framework
errors and console warnings previously hard-coded `pie-section-player` as their
`source`; the host now passes a `hostLabel`, so a warning names the renderer that
actually raised it. The section player passes `"pie-section-player"` and behaviour
there is unchanged.

A pure move with no behavioural change: the 15 existing tests moved with the module
and pass unaltered apart from the new option. `section-player-default-tool-registry.test.ts`
dropped four assertions that pinned the module's old path.
