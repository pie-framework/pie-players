---
"@pie-players/pie-assessment-toolkit": patch
---

The `./services/pnp-standard-features` entry and its root exports (`QTI_STANDARD_ACCESS_FEATURES`, `ALL_STANDARD_ACCESS_FEATURES`, `EXAMPLE_PNP_CONFIGURATIONS`, `isStandardAccessFeature`, `getFeatureCategory` and `getFeaturesInCategory`) are removed. Nothing read them at runtime: a support id is the id of the tool it grants, and the registry is the vocabulary.
