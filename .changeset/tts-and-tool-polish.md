---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-players-shared": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-tool-answer-eliminator": patch
"@pie-players/pie-section-player-tools-tts-settings": patch
---

TTS tool settings accept `headers` and `assetOrigins` and pass them to
`ServerTTSProvider`. `pie-tool-tts-inline` fires `pie-tool-active-change` only
when its active state changes. Answer-eliminator toggles carry
`aria-pressed="false"` from creation. The TTS settings panel uses the shared
focus trap, so Tab order reaches controls inside a provider's shadow root and
closing the panel returns focus to an opener inside one.
`@pie-players/pie-players-shared/pie/tag-names` exports `parseVersionedTagName`.
