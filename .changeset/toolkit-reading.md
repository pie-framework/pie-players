---
"@pie-players/pie-assessment-toolkit": patch
"@pie-players/pie-section-player": patch
"@pie-players/pie-tool-annotation-toolbar": patch
"@pie-players/pie-tool-tts-inline": patch
---

Read-aloud, its highlighting and the annotation toolbar reach content rendered into open shadow roots, in rendering order, with highlight styles adopted into each shadow root and annotations that round-trip through them. Read-aloud reads a shell's `data-region="content"` region, and the annotation toolbar opens only for a selection inside one, so a card's header, lead surfaces and media no longer offer it. Content language is the nearest `lang` between the read content and its shell, else the new `content-language` attribute on `pie-assessment-toolkit` (`runtime.contentLanguage` on the section-player layouts), else `en-US`; it picks catalog cards, and the browser voice's language when markup or the host names it, the voice otherwise following the browser's language as before. `resolveContentRegion` is exported from `@pie-players/pie-assessment-toolkit/tools/registration`.
