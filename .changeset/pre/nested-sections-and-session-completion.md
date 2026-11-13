---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-assessment-player": patch
"@pie-players/pie-assessment-toolkit": patch
---

Nested `AssessmentSection.sections` now deliver. The assessment player's delivery plan walks test parts and top-level sections in document order and descends into nested sections, so a nested subtree becomes its own consecutive delivery steps instead of being silently dropped. Every section still becomes a step, including one that only groups its subsections, as content-less top-level sections always have.

`AssessmentSession.completedAt` is stamped by the assessment player's `submit()` (first timestamp kept on a repeated submit) and the toolkit exports `markAssessmentSessionSubmitted` for hosts that roll their own submission flow.

`TestPart.navigationMode` and `submissionMode` are optional: they are QTI 3.0 import metadata that no player reads, and requiring them made hosts author values the linear delivery cannot honor.
