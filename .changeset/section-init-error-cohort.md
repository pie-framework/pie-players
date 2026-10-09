---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
---

A section that fails to start after the learner has moved on no longer fails the section they moved to. A `cohort`-scoped `FrameworkErrorModel` now carries the section it was reported for in `cohort` (`FrameworkErrorCohort`), and the section player latches it only while that section is current.
