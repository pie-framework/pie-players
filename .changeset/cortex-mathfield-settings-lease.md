---
"@pie-players/pie-calculator-cortex": patch
---

Restore the page's own mathfield configuration when a Cortex calculator closes.

`MathfieldElement.locale` and `.decimalSeparator` are static properties of the
element class, so they are shared with every other mathfield on the page. The
calculator set them and never put them back: a `nl-NL` calculator left every
later field on the page parsing `,` as the decimal separator after it closed.
The lease that already existed for MathLive's virtual keyboard now covers them —
first acquirer captures, each later one takes ownership, only the current owner's
release restores.

The virtual-keyboard half of that lease is deleted. This package renders its own
keypad because MathLive's is a viewport-fixed singleton containing no focusable
elements, and every call site turned the layout swapping off, so the code that
swapped layouts was unreachable. The `ownKeypad` parameter goes with it.
