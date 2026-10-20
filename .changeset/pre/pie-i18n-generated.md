---
"@pie-players/pie-i18n-generated": patch
---

Add the optional machine-generated locale tier: `@pie-players/pie-i18n-generated` ships provenance-marked, unreviewed catalogs generated from the English source against per-locale terminology briefs, starting with Thai (`th-TH`). Hosts opt in by installing the package and composing its loaders after the bundled ones in `createPieI18n`; a host that never sets a generated locale loads nothing. `check:i18n-generated` gates key, placeholder and plural shape against `en-US` and fails when English has moved and a catalog has not been regenerated. A Dutch calibration run against the audited `nl-NL` catalog (`calibration/nl-NL-calibration.md`) measures what the pipeline delivers and scopes the native review pass.
