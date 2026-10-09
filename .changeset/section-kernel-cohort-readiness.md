---
"@pie-players/pie-section-player": patch
---

Readiness follows the cohort it was reported for. An element warmup failure from
the previous section no longer fails the next one, a new attempt on a section
whose elements failed to load now fails instead of never finishing its stage
chain, and a toolkit bootstrap failure clears once the host's corrected runtime
gives the toolkit a new coordinator. Warmup error reports and instrumentation
carry the section id the section resolves to.

Host A swaps sections in place on one player, so the first of these could fail a
section that loaded correctly.
