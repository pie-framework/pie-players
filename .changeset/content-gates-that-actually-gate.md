---
"@pie-players/pie-assessment-toolkit": patch
---

Make the math and science content heuristics able to answer "no", and stop a
heuristic from withdrawing a granted accommodation.

`hasMathContent` tested `/[+\-*/=<>≤≥∑∫√π]/`, which matches the hyphen in
"well-known" and the slash in "and/or"; `hasScienceContent` tested
`/\b[A-Z][a-z]?\d*\b/`, which matches "It", "In", "A" and "No". Both therefore
answered `true` for essentially all content while gating `isVisibleInContext` for
the calculator, ruler, graph and periodic table. An operator now needs operands
around it or no prose reading at all, and an element symbol has to appear as a
formula does — with a count, or beside another symbol — so a lone "He" or "As" is
just English.

Two consequences of tightening had to be handled. `hasMathContent`'s MathML
pattern was unreachable: extraction stripped tags before the predicate ran, so an
item whose only math signal is `<math>` matched nothing. Extraction now offers
both views and structural patterns read the markup. And because a tool's Pass-2
answer can hide a tool Pass 1 allowed, tightening would have let a regex withdraw
an accommodation a learner is entitled to; entries the policy decision marks
`required` or `alwaysAvailable` now skip the relevance gate. The one-way veto is
intact — these ids come from the decision's own surviving entries, so nothing here
can make a tool visible that Pass 1 removed.
