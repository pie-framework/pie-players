---
"@pie-players/pie-print-player": patch
---

Validate print configs before invoking resolvers or changing the active job.
HTML `pie-*` tags must be declared in the item's element map, even with trusted
markup or a custom sanitizer, so already-registered undeclared PIE elements cannot
execute. Invalid replacements throw synchronously and preserve valid pending or
rendered output.

Add the optional `loaderOptions.elementPackagePolicy` allowlist using the same
policy as the item player. Existing resolver signatures and CDN entry filenames
remain unchanged; hosts using declared element maps need no changes unless they
choose to restrict packages.
