---
"@pie-players/pie-calculator-cortex": patch
---

The Cortex calculator starts its worker when it opens and times a calculation
from the worker's ready signal, so a slow machine's first calculation no longer
times out while the worker loads; a worker not ready within 20 s reports
`worker-unavailable`. Keypad presses made while the calculator re-renders are
kept, and leaving an edited expression no longer calculates it.
