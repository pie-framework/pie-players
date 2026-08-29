---
"@pie-players/pie-calculator-cortex": patch
---

Add a property-based arithmetic corpus suite. The corpus is GSM8K's inline
calculator annotations (`<<48/2=24>>`) -- expression/result pairs authored to be
executed by a calculator, over `0-9 + - * / . ( )` alone, which is exactly basic
mode's capability set. 300 entries are committed; `bun run test:corpus`
regenerates and runs the full 10770.

It asserts properties, not values, because a fixture of individual expectations at
that size fails in ways nobody can act on: every outcome is a declared error code
or an answer and never an undeclared throw, every answer matches its authored
result numerically, the three capability sets nest so what basic accepts
scientific and graphing accept identically, and a displayed answer re-entered
answers itself. Only the second property uses the labels, so the other three
would hold against any corpus.
