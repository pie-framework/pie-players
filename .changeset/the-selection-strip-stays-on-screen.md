---
"@pie-players/pie-tool-annotation-toolbar": patch
---

The selection strip no longer places its own controls off screen.

`toolbarAnchor` returned the selection's horizontal centre and the stylesheet shifted the strip by half a width and a full height. Nothing clamped the result, and nothing kept the arithmetic and the transform agreed — so clamping was not expressible at all. Measured against a passage in the split-pane layout: a selection starting 25px from the viewport edge placed a 353px strip at `x ≈ -109`, putting its first highlight swatches where no pointer can reach them. The vertical case is the more common one, because extending a selection past the fold scrolls it to the top of the viewport.

The anchor now returns the strip's top-left, clamped inside a 4px margin on every edge, and there is no transform to undo it. It flips below the selection only when the strip genuinely does not fit above — above is the preference, since it keeps the strip clear of the text being read — and clamps rather than flipping into a second overflow when neither side fits. A strip wider than the viewport pins to the leading edge, where its first control is.

Placement needs the rendered size, so the first pass places an unmeasured strip and an effect corrects it in the same frame; that correction is what makes the clamp active on the pass that can actually push a control off screen.
