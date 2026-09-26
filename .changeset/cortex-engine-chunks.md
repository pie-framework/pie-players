---
"@pie-players/pie-calculator-cortex": patch
---

MathLive and the Compute Engine now ship as chunks of their own. In one 6 MB
runtime chunk they failed a large Vite 7 build on Node 26, Host R's included,
with `Maximum call stack size exceeded`.
