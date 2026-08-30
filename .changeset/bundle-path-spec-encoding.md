---
"@pie-players/pie-players-shared": patch
---

Encode element package specs per segment when building build-service bundle
URLs.

`getPieElementBundlesUrl` and the IIFE adapter's `buildBundleUrl` both ran the
`+`-joined package list through `encodeURI`, which leaves `/`, `?`, `#` and `%`
unescaped. `config.elements` is authored content, so a spec carrying any of
those rewrote the request path on the host's own build service: `#` truncated
the URL at a fragment, `?` turned the remainder into a query string (in
`buildBundleUrl`, also displacing the real `elements=` parameter), and `/`
plus a `..` segment left the `/bundles/` route entirely.

Each spec is now encoded individually and the encoded specs are joined with a
literal `+`, which the legacy IIFE bundle route uses as its package separator.
`/` and `@` stay literal because a scoped spec
(`@pie-element/multiple-choice@9.9.1`) spans path segments in that route;
everything outside the RFC 3986 unreserved set plus those two is escaped, and a
spec containing a `.` or `..` segment has all its slashes escaped so the URL
parser cannot resolve the path upward.

No change for any spec that is a valid npm package name and version — those
round-trip byte-for-byte.

`encodeElementPackageSpecs` is exported from
`@pie-players/pie-players-shared/pie` so the preloaded-player CLI builds the
same route the same way.
