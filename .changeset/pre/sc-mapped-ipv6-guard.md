---
"@pie-players/tts-server-sc": patch
---

The asset URL guard recognises IPv4-mapped IPv6 hosts in the form the URL parser produces (`[::ffff:7f00:1]` for `[::ffff:127.0.0.1]`), so they meet the private-host and cloud-metadata blocks. Before, only the origin allow-list stopped them, and an allow-list naming such an origin let the fetch through.
