---
"@pie-players/pie-theme": patch
"@pie-players/pie-tool-line-reader": patch
---

Make the frame's masking a host setting rather than a student one. How much surrounding context a test taker can still see trades against reading focus, which is a decision a programme makes for its whole population, so `--pie-tool-line-reader-frame-opacity` is now the only way to change it: the keyboard-only `[`/`]` adjustment — undiscoverable to anyone not reading the tool's aria-label, and with no pointer equivalent — is gone, and the component no longer writes the opacity inline, so a host declaration wins without `!important`.

Promote the frame's masking properties to registered host contract. `--pie-tool-line-reader-frame-opacity`, `--pie-tool-line-reader-frame-color`, and `--pie-tool-line-reader-control-color` are now `component-public` entries in `packages/theme/src/token-registry.json` instead of package-private internals, since a deployment is expected to configure them and needs the compatibility guarantee that carries. The control colour is registered as the fill's companion: the glyphs sit on the frame and default to white for a dark scrim, so a light fill has to set it too and keep 3:1 against the fill. `--pie-tool-line-reader-outline-color` stays package-private.
