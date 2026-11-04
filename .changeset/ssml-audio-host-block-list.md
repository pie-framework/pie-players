---
"@pie-players/pie-assessment-toolkit": patch
---

The SSML sanitizer now drops an `<audio src>` that points at the Oracle Cloud metadata host (`metadata.oci.oraclecloud.com`) or at a private or metadata address written as IPv4-mapped IPv6, such as `http://[::ffff:169.254.169.254]/`. Its host block list and hostname normalisation now match the SchoolCity TTS provider's.
