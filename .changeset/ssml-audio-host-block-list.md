---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-players-shared": patch
"@pie-players/tts-server-sc": patch
---

The SSML sanitizer and the SchoolCity TTS provider now classify hosts through one module, the new `@pie-players/pie-players-shared/security/private-hosts` entry (`isCloudMetadataHostname`, `isPrivateHostname`), so they can no longer drift apart. It classifies IP literals with `ipaddr.js` against the IANA special-purpose address registries in place of hand-written patterns, and treats every address outside public unicast space as private. Both checks now refuse carrier-grade NAT (`100.64.0.0/10`), multicast, broadcast, documentation and reserved ranges, all of `fc00::/7` and `fe80::/10`, IPv4-compatible IPv6, and the NAT64, 6to4 and Teredo forms that embed an IPv4 address, as well as the IPv6 unspecified address `[::]` and `*.localhost`. The SSML sanitizer also gains the Oracle Cloud metadata host and IPv4-mapped IPv6, which the provider already refused. `@pie-players/tts-server-sc` now depends on `@pie-players/pie-players-shared`, and `@pie-players/pie-players-shared` on `ipaddr.js`.
