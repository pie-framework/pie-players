---
"@pie-players/pie-tool-picture-dictionary": patch
---

Read `image` as an alias for `url` in a picture-dictionary response, so PIE's own
picture-dictionary service answers the packaged panel with no host resolver.

`POST /api/picture-dictionary` on the PIE API answers `{ images: [{ image }] }`, one
signed object-storage URL per entry. The panel already accepted `images` as the array
key and already POSTs `{ keyword, language?, max? }`, which is that route's request
body — so the only thing standing between the deployed service and the packaged panel
was the field naming the URL. An entry the item reader rejects is dropped rather than
failing the response, so every lookup against PIE's own service resolved to zero
usable pictures and the panel reported "no picture": the learner was told their word
has no entry when the service had answered with several.

`url` still wins when a payload carries both names, and the URL guard is unchanged —
an unsafe value under `image` is dropped on the same terms, so the alias widens which
payloads are readable and not which URLs are renderable.

Wiring the panel to that service is now an endpoint plus, because it is cross-origin
from the assessment, a `headers` function carrying the service token; `language`
defaults to `en-us` server-side, so a non-English lookup has to declare one.
