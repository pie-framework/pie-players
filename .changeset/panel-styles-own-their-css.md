---
"@pie-players/pie-theme": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-section-player-tools-session-debugger": patch
"@pie-players/pie-section-player-tools-event-debugger": patch
"@pie-players/pie-section-player-tools-instrumentation-debugger": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
---

Move debugger panel styling out of the shared content stylesheet and into the panels that own it.

`components.css` carried a `SECTION PLAYER DEBUGGER OVERLAYS` block styling the PNP
and session debugger panels. That file is for authored-content classes no component
owns, so panel-private rules did not belong in it, and the split was already
inconsistent: each panel defined most of its own classes locally and left a handful
behind.

Those rules now live in each panel's own `<style>` block. The two classes applied by
`SharedFloatingPanel` rather than by the panel template — the panel root and
`__content-shell` — are wrapped in `:global()`, since Svelte would otherwise scope
them to the panel component and they would match nothing.

Of the 37 classes in the removed block, 14 were referenced nowhere at all
(`__header*`, `__title`, `__icon-button`, `__icon-xs`, `__resize-*`) — leftovers from
before `SharedFloatingPanel` renamed those parts to `pie-shared-floating-panel__*`.
They were deleted rather than relocated.

Five panels also dropped a `@pie-players/pie-theme/components.css` import that never
did anything: these packages build with Vite in library mode, so the import was
extracted to a `dist` CSS file that the built JS never referenced and that no
`exports` entry exposed — the same defect fixed for `PieItemPlayer.svelte`. Each
package now ships one fewer dead file.

If you import `@pie-players/pie-theme/components.css` directly and relied on the
`pie-section-player-tools-{pnp,session}-debugger*` classes it used to define, they are
no longer there; they ship with their panel packages instead.
