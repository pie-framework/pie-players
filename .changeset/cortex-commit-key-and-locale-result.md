---
"@pie-players/pie-calculator-cortex": patch
---

Put the commit key on every keypad layer, punctuate a displayed answer for the
locale, and pin the non-integer factorial.

The commit key was on the numeric layer alone, so a learner who built an
expression from the scientific or graphing keys had to switch layers back to
reach a key they could see. Enter always committed, but a pointer or
switch-access user has no Enter. `withCommit` now appends one to each
non-numeric layer after pruning — after, because the key requires no capability
and a layer carrying it as data would survive a host revoking every function on
it and render as a lone `=`. A new `KeypadKey.column` pins it to the fifth key
column so it holds the same corner on a short row as on a full one; it replaces
`span`, which was declared and never read.

A displayed answer now takes the locale's decimal separator, closing a split
where an `nl-NL` calculator's keypad wrote `1,5`, its mathfield accepted `1,5`,
and its answer came back `1.5`. `CortexCalculatorLocalization.formatResult`
applies it at the display boundary only — the live readout, the history tape and
the screen-reader announcement. `getResult`, the history entries a host reads and
the serialized state stay `.`-separated, so state saved under one locale is not
reinterpreted under another. It is a separator swap, not a reformat: handing
`formatted` to `Intl.NumberFormat` would re-round it to `maximumSignificantDigits`
and expand `2.432902008e+18` into nineteen digits. The separator resolver moved
from `mathlive-runtime.ts` to `localization.ts` as `localeDecimalSeparator`, so
the mathfield, the keypad's separator key and the answer share one source rather
than two implementations of the same `Intl` probe.

`2.5!` answering `3.32335097` is now pinned as intended: the factorial is the
Gamma continuation off the integers, which is what Desmos answers and what the
Compute Engine computes, unlike a handheld's domain error. Still a domain error
at the negative integers, where Gamma has poles.

The keypad's sizing note cited a 380x372 panel, which no calculator type ships.
Corrected, along with the reasoning: row count is a layout budget rather than a
target-size one, so a row costs panel height. Four rows is the budget and the
graphing layer spends five, carrying the graph keys as well. The e2e panel-fit
test measured only the layer that opens, so neither function layer had been
checked against the panel; it now switches to each. The panel sizes themselves,
and what happens when a layout does not fit one, are the subject of
`calculator-panel-fit-and-density`.
