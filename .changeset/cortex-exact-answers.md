---
"@pie-players/pie-calculator-cortex": patch
---

Answer with the exact value where one exists, and stop showing an answer that
belongs to a previous expression.

Evaluation went straight to the numeric approximation, which converts degrees to
radians first: `cos(90°)` answered `6.123233996e-17` and `sin(30°)` answered
`0.5000000000000008` — the second only looked right at the default 10-digit
display and read `0.500000000001` at the supported maximum of 12. The Compute
Engine's exact evaluation is tried first and answers `0` and `1/2`; expressions
with no exact form, including `sqrt(2)` and `sin(Pi)` in degree mode, still take
the numeric path.

Exponential display no longer pads the mantissa with digits the result does not
have: `12345678901234` reads `1.23456789e+13` rather than `1.234567890e+13`.
Only an all-zero mantissa was trimmed before, so two formats were reachable from
one formatter.

Editing the expression clears the displayed answer. The result line sits directly
under the input, so a stale number stood beside fresh input as though it answered
it. It also restores the result announcement for a repeated answer, which the
view fires on a change of result and therefore skipped the second time.
