---
"@pie-players/pie-tool-picture-dictionary": patch
---

Read `image` as an alias for `url` in a picture-dictionary response, so a service that
names the URL that way answers the packaged panel with no host resolver.

A picture service may answer `{ images: [{ image }] }`, one signed object-storage URL per
entry. The panel already accepted `images` as the array key and already POSTs
`{ keyword, language?, max? }`, so the field naming the URL was the only thing standing
between such a service and the packaged panel. An entry the item reader rejects is
dropped rather than failing the response, so every lookup resolved to zero usable
pictures and the panel reported "no picture": the learner was told their word has no
entry when the service had answered with several.

A usable `url` still wins when a payload carries both names — an empty one is an absence
rather than a preference, so the alias still gets its turn — and the URL guard is
unchanged: an unsafe value under `image` is dropped on the same terms, so this widens
which payloads are readable and not which URLs are renderable.
