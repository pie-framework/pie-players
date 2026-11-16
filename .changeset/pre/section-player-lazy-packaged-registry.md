---
"@pie-players/pie-section-player": patch
---

Build the packaged tool registry only when no `toolRegistry` is supplied. The base element and the layout kernel each built one unconditionally at init, so every layout built two and discarded one, and a host that supplied its own registry paid for both. The default stays synchronous and backed by `@pie-players/pie-default-tool-loaders`, which remains a dependency of the section player.
