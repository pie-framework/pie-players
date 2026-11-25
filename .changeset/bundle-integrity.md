---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
"@pie-players/pie-print-player": patch
"@pie-players/pie-item-list": patch
---

Element bundles can carry Subresource Integrity hashes (PIE-1580). `loaderOptions.integrity` maps a bundle or module URL to its `sha256`, `sha384` or `sha512` hash, and the browser refuses to run code whose bytes differ: the `iife` strategy sets the hash on the bundle's script, and browser ESM puts it in the import map and on each `package.json` read. Browsers before Chrome 127, Safari 18 and Firefox 138 ignore import-map hashes. A malformed hash fails the load, and `requireIntegrity: true` refuses any load without one. A refused load fails its elements with the `integrity-failed` reason, dispatches `pie-bundle-integrity-failed` on `window` with the URL, the expected hash and, when the bytes can be fetched again, their actual hash, and reports to the instrumentation provider. The `iife` strategy stops retrying a bundle whose bytes do not match.

Browser ESM loads, which include the item player's `esm` strategy, `<pie-print>` and the item list's pinned summaries, now admit only exact versions unless the host passes an `elementPackagePolicy`, so a dist-tag such as `latest` or a range fails the element's load. A host that loads tags passes `requireExactVersions: false`; `allowedPackages` is now optional and accepts `@scope/*`. `installTrustedTypesDefaultPolicy({ scriptUrlPrefixes })` from `@pie-players/pie-players-shared/security` installs a Trusted Types default policy for pages that enforce Trusted Types: it sanitizes the HTML legacy elements assign through `innerHTML`, admits only JSON as script text, and admits only script URLs under the host's prefixes.
