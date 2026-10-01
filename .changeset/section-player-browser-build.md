---
"@pie-players/pie-section-player": patch
---

`@pie-players/pie-section-player/browser` is a self-contained ES module build in
`dist/browser/`. A page loads it by full file path from jsDelivr, with no import
map and no bundler. It also exports `createPackagedToolRegistry` and
`DEFAULT_TOOL_MODULE_LOADERS`, so a host that adds its own tool registration
builds the packaged set from the same build.
