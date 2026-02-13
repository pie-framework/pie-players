---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-section-player": patch
---

Fix bundle URL construction to handle bundleHost without trailing slash

- Normalize bundleHost to ensure proper URL construction with exactly one trailing slash
- Handle edge cases: missing slash, multiple slashes, empty string, whitespace
- Fixes error: `bundles@pie-element` → `bundles/@pie-element` in production environments
