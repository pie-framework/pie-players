---
"@pie-players/pie-players-cli": patch
---

A generated `@pie-players/pie-preloaded-player` build keeps the module shim's `//# sourceMappingURL=` string escaped, so a host bundler whose source-map loader strips that text, Angular's in builds with script source maps on, compiles it.
