---
"@pie-players/pie-section-player-tools-tts-settings": patch
"@pie-players/pie-players-shared": patch
---

The TTS settings panel's `preview` custom-provider hook is now typed `Promise<CustomProviderPreviewResult | undefined>` rather than `Promise<void | CustomProviderPreviewResult>`: the same runtime contract, typed by its resolved value. Providers that return nothing are unchanged at runtime, though a bare `async` arrow with no return may need `return undefined` to satisfy the type. `scan-hardcoded` now parses the packages' Svelte templates and warns only on template text and static `aria-label`, `title` and `placeholder` literals — a scoped advisory report, run weekly by the new `i18n-hardcoded-scan` workflow instead of the previous quoted-string regex.
