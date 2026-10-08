---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-section-player-tools-pnp-debugger": patch
"@pie-players/pie-default-tool-loaders": patch
---

A `testAdministration.toolOverrides` grant now holds on the item toolbar as a profile support does, and the PNP debugger shows only the bound assessment's profile. `PersonalNeedsProfile.activateAtInit`, `districtPolicy.policies`, `testAdministration.mode`, `startDate` and `endDate`, and `AssessmentSection.personalNeedsProfile` are removed because policy read none of them, and a `testAdministration` without a `toolOverrides` entry no longer turns automatic PNP enforcement on; a host that puts a profile on a section binds it as the assessment's with `updateAssessment`.
