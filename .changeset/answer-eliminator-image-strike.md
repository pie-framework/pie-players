---
"@pie-players/pie-tool-answer-eliminator": patch
"@pie-players/pie-theme": patch
---

Mark eliminated answer choices that are not made of text: an X over images, and a
line-through over rendered math, both in the same strike colour as the text.

The strikethrough strategy paints with the CSS Custom Highlight API, which — like
`text-decoration` — only draws on text. An answer choice whose content is a
picture therefore looked completely untouched after being eliminated: the student
got a pressed toggle button and nothing else.

Images are replaced elements, so they cannot carry a pseudo-element either. Each
`img` in an eliminated choice is now wrapped in a positioned
`span.pie-answer-eliminator-image-strike` that hosts an absolutely-positioned SVG
overlay drawing two diagonals corner to corner — upper-left to lower-right and
lower-left to upper-right — for a big X over the whole image. Wrapping (rather
than measuring and re-positioning an overlay) keeps the X glued to the image
through later reflow: responsive resizing, a late image `load`, zoom.

The wrapper preserves the image's own box: a fluid image that already spans its
parent gets a block wrapper, a block-level image gets a `fit-content` block
wrapper so it stays on its own line at its own width, and the wrapper's line box
is collapsed so no descender gap lets the X overhang the artwork. Restoring the
choice unwraps the image and returns the DOM to its original shape.

The overlay is `aria-hidden` and `pointer-events: none` — the eliminated state is
already announced on the label — and each diagonal is painted over a wider light
casing line (`--pie-answer-eliminator-image-strike-casing-color`) so the X clears
3:1 (SC 1.4.11) over dark artwork.

## Rendered math

Math had the same problem for a different reason. MathJax's CHTML output draws
every visible glyph as an `mjx-c` element with empty `textContent` — the character
comes from `::before` generated content, which belongs to no Range — and its SVG
output has no text at all. The highlight was painting only MathJax's
`mjx-assistive-mml` copy of the source MathML, which is clipped to 1px, so a
math-only choice looked identical to an un-eliminated one.

For each `mjx-container` in an eliminated choice, the inner `mjx-math` box is now
marked with `pie-answer-eliminator-math-strike` and painted by the theme. The
rendered math box is an ordinary element, so this needs only a class and a
pseudo-element — no wrapper, and MathJax's own layout is untouched.

Which mark depends on the shape of the expression. A single row of symbols takes
the centred line-through the prose takes. An expression that draws horizontal
rules of its own — a fraction bar, a table rule — takes the diagonals an
eliminated image takes, because a centred line lands on the math axis, exactly
where the fraction bar already sits, and reads as a recoloured bar rather than an
elimination. The split is structural (`mjx-mfrac`, `mjx-mtable`) rather than
height-based: an inline `a/b` is only 1.16x its font size, indistinguishable in
height from a radical (1.17x) or a parenthesised row (1.10x), yet it is precisely
the colliding case. Radicals and stacked limits keep the line — their bars sit at
the top, or the strike simply crosses the base.

The paint target is the inner `mjx-math`, not the container: for inline math
`mjx-container` is `display: inline`, so its rect is the surrounding line box — a
constant ~1.16x font size whatever it holds — while the expression overflows it,
a fraction by 3px above and 8px below. Painting the container both mismeasured
the expression and drew the line in the wrong place.

Only MathJax containers are marked. Natively rendered MathML keeps real text in
`mi`/`mn`/`mo`, so the highlight already strikes every token there, and marking it
too would double the line over one expression.

## One strike colour

Text, images, and math all read `--pie-answer-eliminator-strike-color` (defaulting
to `--pie-incorrect`), so a choice mixing prose, pictures, and math reads as a
single treatment rather than three, and a host can restyle every part of an
elimination from one property.
