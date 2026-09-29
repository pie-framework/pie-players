---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-default-tool-loaders": patch
---

`@pie-players/tts-client-server` is now a dependency of
`@pie-players/pie-default-tool-loaders`, whose TTS registration imports it, and
no longer an optional peer of the toolkit. A webpack host that installed the
toolkit without the adapter failed to build, because webpack resolves the
toolkit's `import()` of it at build time. `TTSToolProvider` now receives the
adapter's provider class through a `loadServerProvider` option, and a server
backend constructed without one fails to initialize. A host that installed the
adapter only for the toolkit can drop it.
