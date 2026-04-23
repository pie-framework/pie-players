---
'@pie-players/pie-players-shared': patch
---

Bump `@pie-lib/math-rendering-module` from `4.0.7` to `4.1.2` (PIE-147 / PIE-423).

`math-rendering@4.1.0-next.1` regressed screen-reader support by dropping the
`mjx-assistive-mml` MathML sibling that MathJax attaches for assistive
technologies, so screen readers in the item player fell back to reading raw
glyphs (e.g. "9 1 8") for prompt math. `4.1.2` — via
[pie-framework/pie-lib#2201](https://github.com/pie-framework/pie-lib/pull/2201) —
restores the assistive MathML attachment, so VoiceOver / NVDA announce prompt
and answer-choice math correctly again.

`players-shared` is the single source of truth for this dependency (enforced by
`scripts/check-math-rendering-version.mjs`); every consumer — including
`@pie-players/pie-item-player` — picks this up transitively on their next
build/publish.

The existing vite `patch-math-rendering-module-eval` hook in `item-player`
still neutralizes the `return eval('require')` pattern in the upstream module
(confirmed present in `4.1.2`), and `assert-no-eval-require-in-output` passes.
