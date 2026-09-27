---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

The toolkit's math speech no longer fetches speech-rule-engine's locale tables
from jsDelivr. In a browser the toolkit hands SRE a loader over the `base`, `en`
and `es` tables from `speech-rule-engine/lib/mathmaps`, which the host's bundler
emits as lazy chunks served from its own origin. Math in any other locale is
spoken with English words, and SRE logs `Unable to load locale`, unless
`mathSpeech.engineOptions.json` or `.custom` names a source for its table.
Either option now also covers `base` and `en`, the two tables SRE loads at
start-up, which had come from jsDelivr regardless. The MathJax 3 renderer that
IIFE and preloaded elements use still loads the tables of its own SRE copy from
jsDelivr.

The toolkit and the section player import `speech-rule-engine` from the host's
`node_modules` and share one copy. A build that inlines every dynamic import
into one file gains the three tables, about 0.8 MB.
