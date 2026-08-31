---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-tool-line-reader": patch
"@pie-players/pie-tool-protractor": patch
"@pie-players/pie-tool-ruler": patch
---

Fix keyboard placement of the ruler and the protractor.

Both tools read their current offset by parsing `style.transform` and fell back
to `window.innerWidth / 2` and `window.innerHeight / 2` when there was none.
Before the first drag there is none, so the first arrow key wrote roughly half
the viewport as if it were a 10px nudge, and the tool jumped to the middle of the
screen. The write then put `translate(-50%, -50%)` back into the inline
transform, which `DOMMatrix` refuses to parse — values must be resolvable at
parse time — so every press after that threw and keyboard placement stopped
working altogether.

The offset now comes from the computed transform, which is always a resolved
matrix, with the centring's half-box added back to recover the offset the tool
has actually been moved by. That reads correctly at rest and after a pointer
drag, so a nudge continues from wherever the tool is.

Keyboard movement is also clamped to the box the tool is positioned against.
Moveable bounds a pointer drag, but a keyboard move writes `style.transform`
directly and was bounded by nothing. `clampOffsetWithinBlock` and
`resolveContainingBlockRect` in `@pie-players/pie-players-shared` are that
clamp, shared rather than written twice.

The line reader adopts the same helpers. It arrived at the same containing-block
resolution independently and clamps an absolute centre point where the
measurement tools clamp a translate offset; `clampPointWithinBlock` is that
clamp in point coordinates, conjugate to the offset one by a translation of half
the block. Behaviour is unchanged.
