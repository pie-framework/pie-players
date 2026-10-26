---
"@pie-players/pie-tool-ruler": patch
"@pie-players/pie-tool-protractor": patch
"@pie-players/pie-tool-tts-inline": patch
---

Keep native tool property types optional until the Svelte component mounts and supplies its defaults. Hosts can assign properties immediately after construction; reads must account for an unset value before mount. Runtime behavior and existing host assignments are unchanged.
