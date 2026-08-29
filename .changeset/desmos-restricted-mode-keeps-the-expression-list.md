---
"@pie-players/pie-calculator-desmos": patch
---

Stop `restrictedMode` from removing a graphing calculator's only input.

The Desmos adapter mapped `restrictedMode: true` to `expressions: false` along
with the chrome flags. On a `GraphingCalculator` that removes the whole expression
list, so a restricted graphing calculator was graph paper with no way to enter a
function — the exact call this package's README documents. Basic and scientific
never noticed: `expressions` is a graphing option their constructors ignore. It was
also the odd one out among the three adapters, where GeoGebra's restricted branch
hides the menu bar, tool bar, file features and CAS but keeps the input, and Cortex
disables the clipboard.

`expressions` leaves the restricted set. The rest of it does not change, and
neither does its precedence: restricted mode still lands after the host's own
`settings` and a host still cannot relax it, which is the contract Cortex states
for the same flag. A host that does want the list gone passes
`settings: { expressions: false }` and sets the chrome flags itself — those are
honoured wherever restricted mode is not what overrides them.

A host currently sending `restrictedMode: true` for a graphing Desmos calculator
will see the expression list appear. That is the fix, not a regression: the panel
it replaces could not be used for anything. No host in the consumer dependency pad
sends the field.
