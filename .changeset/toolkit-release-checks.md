---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-tool-calculator-shared": patch
"@pie-players/pie-tool-text-to-speech": patch
"@pie-players/pie-tool-annotation-toolbar": patch
---

`pie-assessment-toolkit` takes `isolation` as an attribute, and a `coordinator` passed to a nested toolkit wins over the outer one's. The calculator starts its provider under the toolkit's tool failure policy. Selection read-aloud and math control names take the content language, `en-US` unless markup or the host names another.
