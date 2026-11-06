---
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-toolkit": patch
---

`policies.checkControl.enabled: false` removes the Check answer / Try again button from section player item cards and keeps the status line. The section controller gains `checkItem({ itemId })`, which scores a rendered item and records the Try as the button does.
