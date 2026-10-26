---
"@pie-players/pie-item-player": patch
"@pie-players/pie-players-shared": patch
---

Resolve fetched stylesheet asset URLs against their stylesheet location before scoping, reject failed requests and redirects, and redact signed stylesheet URLs from diagnostics while logging the failure reason. Validate CSS resources against the host origin policy; reject @import and image-set forms that could load unchecked resources. Keep shared fetches, per-instance style cleanup, existing selector scoping and host-opted-in cross-origin stylesheet links.
