---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-players-shared": patch
"@pie-players/tts-server-sc": patch
---

The SSML sanitizer and the SchoolCity TTS provider now classify hosts through one module, the new `@pie-players/pie-players-shared/security/private-hosts` entry (`isCloudMetadataHostname`, `isPrivateHostname`), so their block lists can no longer drift apart. `@pie-players/tts-server-sc` now depends on `@pie-players/pie-players-shared`. The SSML sanitizer now drops an `<audio src>` that points at the Oracle Cloud metadata host (`metadata.oci.oraclecloud.com`) or at a private or metadata address written as IPv4-mapped IPv6, such as `http://[::ffff:169.254.169.254]/`. Both now refuse the IPv6 unspecified address, `http://[::]/`, which reaches the local host the way `0.0.0.0` does.
