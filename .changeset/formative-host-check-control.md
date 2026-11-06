---
"@pie-players/pie-section-player": patch
"@pie-players/pie-assessment-toolkit": patch
---

`policies.formativeControl.enabled: false` removes the formative Check answer / Try again button from section player item cards and keeps the status line. The section controller gains `checkFormativeItem({ itemId })`, which scores a rendered item and records the Try as the button does.
