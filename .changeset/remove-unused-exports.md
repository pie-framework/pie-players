---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-item-player": patch
---

Unused exports are removed. The toolkit's `./tools/client` subpath keeps only the
calculator types: the legacy tool, accommodation, item-variant and
response-component types, the `ToolCategory` enum and `responseDiscovery` are
gone, and the `ToolCoordinator` and `HighlightCoordinator` constructors take no
argument. `pie-players-shared` drops `isPassageEntity`, `isPrerelease`,
`formatVersion`, `SessionChangedEvent`, `SessionChangedDetail`, `LoadResponse`,
the `Tracker` types, `BUILDER_ORIGIN_URL`, `renderMath`, the sanitizer test
resets and the renderer argument of `initializeMathRendering`; `setMathRenderer`
is the way to supply a renderer. The item player drops the `BackendScope` and
`BackendEventDetail` types.
