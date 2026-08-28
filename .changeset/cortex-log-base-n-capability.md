---
"@pie-players/pie-calculator-cortex": patch
---

Split base-n logarithms into their own `log-base-n` capability, and add keypad
keys for a base-n logarithm and a stacked fraction.

`log-base-n` exists because it could not otherwise be declined. The Compute
Engine parses `\log_{3}(9)` as `["Log", 9, 3]` -- the same operator that carries
base 10 -- so an arbitrary base was admitted by `common-log` from the beginning
and a host granting log base 10 had no way to refuse it. Base 2 is spelled
differently again, `["Lb", 8]`, and was refused outright while every other base
answered. Revoking `log-base-n` now leaves base 10 and base e working, and
revoking `common-log` no longer takes base-n with it. It ships in the default
scientific and graphing sets, matching the reference implementations; basic mode
has no logarithms at all.

Both new keys go in a fourth row on the scientific layer, within the four-row
budget that keeps keys at 44px. Each inserts a template with a single
placeholder, because a second one would be unreachable: `ArrowRight` leaves a
subscript rather than crossing to the next placeholder, and MathLive binds
`moveToNextPlaceholder` to Tab, which this keypad spends on being a single tab
stop. The logarithm's base fills and its argument follows the subscript, and the
fraction takes what precedes it as the numerator through `#@`, the idiom the
`nth-root` key already uses.

No sign key. A handheld separates the sign from the subtraction operator because
there they are different operations; in a mathfield `-` is contextual, so
pressing Minus on an empty expression negates. That path is now pinned by a test
rather than assumed.
