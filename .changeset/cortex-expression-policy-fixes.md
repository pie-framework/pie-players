---
"@pie-players/pie-calculator-cortex": patch
---

Fix four classes of expression the Cortex calculator refused, three of them
reachable from its own keypad.

Parentheses were rejected in every mode: the Compute Engine parses `(4+5)` as
`["Delimiter", …]`, which the capability allowlist did not permit, so `(2+3)×4`
failed while the numeric layer shipped `(` and `)` keys. Implicit multiplication
was rejected for the same reason — `2x`, `2π`, `3(4+5)` and `2sin(x)` parse to
`InvisibleOperator` — so `y=3x^2+2x+1`, the ordinary way a polynomial is
written, could not be graphed. The three inverse-trigonometry keys inserted
`\sin^{-1}(…)`, which parses to `["Apply", ["InverseFunction", "Sin"], …]`
rather than to the canonical `Arcsin`, and were refused. Euler's number was
accepted only under its canonical spelling `ExponentialE`, so both the `e` key
and the `e^x` key failed, and `e^x` resolved to the `power` capability instead
of `exponential`.

Grouping and implicit multiplication grant no capability that `Multiply` did
not; operands are still validated recursively, so a narrowed `allowedFunctions`
still refuses the functions it excludes. Function application is permitted only
for the three inverse-trigonometry heads, not for an arbitrary head.

`busy` no longer stays set after a keystroke supersedes a calculation in
flight. The view announces `calculating` on the transition into busy, so a
stuck flag silenced that announcement for every later calculation.
