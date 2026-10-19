---
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

Content language reaches the delivery channel. `Env` gains an optional
`locale`: the BCP 47 tag the language the item's content is written in — the
same delivery-fact channel `mode` travels, and never the interface locale. The
item player reflects it onto its content subtree's root as `lang`/`dir`
(canonicalized, direction from the tag), and asserts nothing when the delivery
declares none or declares a non-tag, so a screen reader takes the content's
voice rules and RTL content lays out right to left while the chrome keeps the
interface locale's. `env` remains pass-through; nothing is filtered. The
authoring-side half of the slice — hosts emitting `locale` and QTI emitting
`xml:lang` — is still open. No listed host is affected: a host that sends no
`env.locale` sees no stamp, exactly as before.
