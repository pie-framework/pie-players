---
"@pie-players/pie-tool-text-to-speech": patch
---

Keep the floating text-to-speech panel inside the viewport.

The panel is `position: fixed` and took its position once from the viewport size,
with no resize handling. Shrinking the window or raising page zoom moved the
viewport out from under it, and a panel past the right or bottom edge could not
be dragged back.

Position is now clamped to the viewport on open, on drag and on window resize,
measured against the panel's rendered box because its height depends on which
controls are showing. A position that still fits is left alone. The shared tool
shell already re-clamped windowed tools this way; this panel had no equivalent.

The opening position is unchanged, expressed as the panel's width plus a gutter
rather than as one number.
