---
"@pie-players/pie-theme": patch
"@pie-players/pie-tool-theme": patch
"@pie-players/pie-players-shared": patch
---

Make theme resolution one observable contract instead of separate runtime and
stylesheet palettes.

The light and dark Base Theme defaults and the two previously under-contrast
built-in palettes now satisfy the named WCAG text, control-boundary, feedback,
focus, and annotation relationships enforced by the theme contract. Hosts keep
the same token names and can still override them through the normal cascade.

`@pie-players/pie-theme` now owns light and dark base themes, complete built-in
color schemes, custom-scheme registration, accessibility diagnostics, and
generated CSS from one side-effect-free TypeScript definition. The public
runtime interface is `resolvePieTheme`, `listPieColorSchemes`,
`observePieColorSchemes`, and `registerPieColorSchemes`. Registration returns a
generation-aware, idempotent receipt whose `unregister()` removes only the
definition it registered. Built-in ids are reserved, invalid custom entries are
rejected atomically, and valid entries from the same batch still register.

Upgrade note: `listPieColorSchemes()` now returns an immutable snapshot rather
than a mutable array of raw palette definitions. Raw built-in/base constants,
authored preview values, and the one-off get/resolve/unregister scheme helpers
are no longer public. Consumers should render `snapshot.schemes`, derive values
through `resolvePieTheme()`, observe catalog changes when mounted, and retain the
registration receipt when they need to unregister custom schemes.

An unknown requested scheme is no longer silently replaced. `<pie-theme>` keeps
the requested id in `scheme` and `data-color-scheme`, applies the safe base and
provider result plus explicit variables, and automatically resolves it if
registration arrives later. This preserves a CSS-only selector hook while
making registered custom schemes the managed path. CSS-only schemes use the
normal cascade in stylesheet-only integrations; a rule competing with a mounted
`<pie-theme>`'s inline tokens must deliberately use `!important`.

`@pie-players/pie-tool-theme` now follows that observable catalog and derives
previews from resolved tokens. If a saved scheme is unavailable, the picker
keeps the preference, shows a disabled unavailable option and status message,
and restores the scheme after late registration. The old `schemes` and
`schemeCatalog` inputs are removed; no recorded client-facing host depends on
them.

The shared focus trap now resolves and restores focus inside open shadow roots,
so keyboard containment and Escape restoration work for the theme picker's
shadow-DOM controls.

The checked-in `tokens.css` and `color-schemes.css` files remain at their exact
published paths and remain unlayered so host token declarations and
`!important` overrides keep working. They are generated explicitly and checked
for staleness; package builds verify them without rewriting tracked source.
Importing the package root still registers `<pie-theme>`, while importing
`@pie-players/pie-theme/theme-element` remains side-effect-free.
