---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-tool-tts-inline": patch
"@pie-players/pie-tool-text-to-speech": patch
---

Read-aloud, its highlighting and the annotation toolbar reach content rendered into open shadow roots, in rendering order, with highlight styles adopted into each shadow root and annotations that round-trip through them. Read-aloud reads a shell's `data-region="content"` region, and the annotation toolbar opens only for a selection inside one, so a card's header, lead surfaces and media no longer offer it. Content language is the nearest `lang` between the read content and its shell, else the new `content-language` attribute on `pie-assessment-toolkit` (`runtime.contentLanguage` on the section-player layouts), else `en-US`; it picks catalog cards and sets the browser voice's language, which followed the browser's language before. `resolveContentRegion` and `resolveContentLanguage` are exported from `@pie-players/pie-assessment-toolkit/runtime/internal`.
