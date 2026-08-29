---
"@pie-players/pie-calculator-cortex": patch
---

Accept a base-2 logarithm. The Compute Engine parses `\log_{3}(9)` as
`["Log", 9, 3]`, which the policy already admitted through `Log`, but
special-cases base 2 into its own `Lb` operator, which was refused -- so every
base worked except the one a learner reaches for after 10. `Lb` now maps to the
same `common-log` capability, and a host revoking `common-log` still loses every
base at once.

Add typing-sequence coverage: an end-to-end test types into the real mathfield
and asserts only the answer, since what an editor builds from raw keystrokes is
MathLive's behaviour, while the LaTeX it hands to `validateExpression` is this
package's seam. The unit scenarios gain grouping, precedence and entry-shape
cases derived from the public LaTeX corner-case corpora in `mathquill` and
Doenet's `math-expressions`.
