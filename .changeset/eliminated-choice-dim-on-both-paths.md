---
"@pie-players/pie-theme": patch
"@pie-players/pie-tool-answer-eliminator": patch
---

Dim an eliminated choice on both strike paths, not only the fallback one.

The dim was declared twice, and neither copy reached the path most learners are
on. `components.css` carried it on `.pie-answer-eliminator-eliminated-fallback`, a
class the strategy adds only when `CSS.highlights` is missing. The strategy's own
injected rule carried it inside `::highlight(...)`, where a highlight pseudo
honours only colour, background, text-decoration and text-shadow — so the
declaration parsed and painted nothing. Every browser with the CSS Custom
Highlight API shipped the strike as the sole cue for elimination.

The dim now hangs off `[data-pie-answer-eliminated="true"]`, which both paths set
on the choice container, and the inert declaration is gone from the injected rule.
Redundant coding is the point: elimination has to survive a strike colour a
learner cannot distinguish from the text.
