---
"@pie-players/pie-assessment-toolkit": patch
---

Update `speech-rule-engine` from 5.0.0-rc.1 to 5.0.0-rc.4 (current latest).

Spoken output is unchanged. Verified by diffing both installed copies across 88 outputs — 22 MathML shapes covering fractions, roots, powers, matrices, integrals, sums, Greek, inequalities, percents, absolute values and decimals, against both locale/domain pairs the toolkit derives (`en`/clearspeak and non-English/mathspeak), in both `none` and `ssml` markup modes. Every output matched byte for byte, so the cached-speech key in `generated-speech/math-speech-cache.ts` is deliberately left alone: bumping it would invalidate every cached spoken string in the field for no behavioural reason.
