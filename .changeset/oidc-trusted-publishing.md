---
"@pie-players/pie-print-player": patch
---

Normalize `repository.url` to the `git+https://` form. npm compares this against the repository it publishes from when generating a provenance attestation, and rewrites any other form with a warning, so the canonical form is now required by `check:package-metadata`.
