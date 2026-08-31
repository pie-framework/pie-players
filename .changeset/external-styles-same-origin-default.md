---
"@pie-players/pie-players-shared": patch
---

External stylesheet loading now defaults to same-origin.

`validateExternalStyleUrl` enforced its origin allow-list only when a host
supplied one, and `allowed-style-origins` is unset by default, so any `http(s)`
origin was accepted. The reachable input is authored —
`itemConfig.resources.stylesheets[*].url`, alongside the `external-style-urls`
attribute — so an item could name any origin and pull CSS from it on every
render.

The asymmetry made it worse than an open allow-list sounds. Same-origin CSS is
fetched and rewritten by `scopeStylesheetCss`, confined to
`.pie-item-player.<scope>`. Cross-origin CSS cannot be fetched and rewritten
without CORS, so the player injects it as a `<link>` in `<head>` and the browser
applies it page-wide. The untrusted case was getting the weaker treatment.

With no allow-list configured, only same-origin URLs now pass; a cross-origin
URL is rejected with `reason: "disallowed-origin"` and a message naming
`allowed-style-origins`. Naming an origin there is unchanged and is now the
explicit opt-in to unscoped, page-wide CSS. A call supplying neither an
allow-list nor a usable `baseUrl` is also rejected, since there is no origin to
compare against.

Behaviour change for consumers: a cross-origin `external-style-urls` entry or
`resources.stylesheets[*].url` stops loading until its origin is added to
`allowed-style-origins`. The failure is logged by the player rather than silent.
No consumer recorded in `docs/integrations/consumer-api-dependencies.md` uses
either surface.
